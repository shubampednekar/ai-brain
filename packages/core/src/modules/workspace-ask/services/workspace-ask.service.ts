import { EVENT_TYPES } from '../../../events/index.js';
import type { Database } from '@ai-brain/database';
import { DEFAULT_MIN_COMBINED_SCORE } from '../../search/services/search.service.js';
import type { ServiceContext } from '../../../shared/types.js';
import { NotificationService } from '../../notifications/services/notification.service.js';
import { EscalationService } from '../../escalation/services/escalation.service.js';
import { SharedMemoryService } from '../../shared-memory/services/shared-memory.service.js';

type WorkspaceMemoryRow =
  Database['public']['Functions']['search_workspace_memories']['Returns'][number];

export interface WorkspaceSearchResult {
  id: string;
  userId: string;
  originalText: string;
  summary: string | null;
  intentSlug: string | null;
  similarity: number;
  textRank: number;
  combinedScore: number;
  createdAt: string;
}

export interface WorkspaceAskResult {
  answer: string;
  confidence: number;
  escalated: boolean;
  sources: WorkspaceSearchResult[];
  relatedTaskTitle?: string;
}

const ESCALATION_CONFIDENCE_THRESHOLD = 0.7;

export class WorkspaceAskService {
  private notifications: NotificationService;
  private sharedMemory: SharedMemoryService;
  private escalations: EscalationService;

  constructor(private readonly ctx: ServiceContext) {
    this.notifications = new NotificationService(ctx);
    this.sharedMemory = new SharedMemoryService(ctx);
    this.escalations = new EscalationService(ctx);
  }

  async searchWorkspace(
    workspaceId: string,
    query: string,
    limit = 20,
  ): Promise<WorkspaceSearchResult[]> {
    let queryEmbedding: number[] | undefined;

    try {
      const result = await this.ctx.embeddings.embed({ input: query });
      queryEmbedding = result.embeddings[0];
    } catch {
      // text-only fallback
    }

    const { data, error } = await this.ctx.supabase.rpc('search_workspace_memories', {
      p_workspace_id: workspaceId,
      p_query: query,
      p_query_embedding: queryEmbedding,
      p_limit: limit,
      p_offset: 0,
    });

    if (error) throw new Error(`Workspace search failed: ${error.message}`);

    return ((data ?? []) as WorkspaceMemoryRow[]).map((row) => ({
      id: row.id,
      userId: row.user_id,
      originalText: row.original_text,
      summary: row.summary,
      intentSlug: row.intent_slug,
      similarity: row.similarity,
      textRank: row.text_rank,
      combinedScore: row.combined_score,
      createdAt: row.created_at,
    }));
  }

  async ask(
    workspaceId: string,
    askerUserId: string,
    question: string,
  ): Promise<WorkspaceAskResult> {
    await this.sharedMemory.assertMember(workspaceId, askerUserId);

    const candidates = await this.searchWorkspace(workspaceId, question, 15);
    const sources = candidates
      .filter((s) => s.combinedScore >= DEFAULT_MIN_COMBINED_SCORE)
      .slice(0, 8);

    const relatedTask = await this.findRelatedTask(workspaceId, question);
    const taskContext = relatedTask
      ? `Open task: "${relatedTask.title}" (created by user ${relatedTask.user_id})${
          relatedTask.description ? ` — ${relatedTask.description}` : ''
        }`
      : '';

    const memoryContext = sources
      .map(
        (s, i) =>
          `[${i + 1}] (author: ${s.userId}) ${s.originalText}${
            s.summary ? ` (Summary: ${s.summary})` : ''
          }`,
      )
      .join('\n');

    const result = await this.ctx.ai.chat({
      messages: [
        {
          role: 'system',
          content: `You are AI Brain, a workspace knowledge mediator. Answer the question using ONLY the shared memories and task context provided. If a teammate already documented the answer in a memory, cite it clearly. Respond with JSON only:
{"answer": "<your answer to the asker>", "confidence": <0.0-1.0>, "needs_human": <true if the asker should wait for a teammate to clarify>}`,
        },
        {
          role: 'user',
          content: `Shared memories:\n${memoryContext || 'No relevant memories found.'}\n\n${taskContext ? `${taskContext}\n\n` : ''}Question from teammate: ${question}`,
        },
      ],
      jsonMode: true,
      temperature: 0.2,
    });

    let parsed = {
      answer: result.content,
      confidence: 0.4,
      needs_human: true,
    };
    try {
      parsed = JSON.parse(result.content) as typeof parsed;
    } catch {
      // use defaults — escalate
    }

    const shouldEscalate =
      parsed.needs_human ||
      parsed.confidence < ESCALATION_CONFIDENCE_THRESHOLD ||
      sources.length === 0;

    if (!shouldEscalate) {
      await this.ctx.eventBus.publish({
        type: EVENT_TYPES.QUESTION_RESOLVED,
        aggregateType: 'workspace',
        aggregateId: workspaceId,
        userId: askerUserId,
        payload: { question, answer: parsed.answer, confidence: parsed.confidence },
      });

      return {
        answer: parsed.answer,
        confidence: parsed.confidence,
        escalated: false,
        sources,
        relatedTaskTitle: relatedTask?.title,
      };
    }

    const escalationTargetId = await this.resolveEscalationTarget(
      workspaceId,
      askerUserId,
      sources,
      relatedTask,
    );

    if (escalationTargetId) {
      const [{ data: asker }, { data: target }, { data: workspace }] = await Promise.all([
        this.ctx.supabase.from('profiles').select('full_name, email').eq('id', askerUserId).single(),
        this.ctx.supabase.from('profiles').select('full_name, email').eq('id', escalationTargetId).single(),
        this.ctx.supabase.from('shared_workspaces').select('name').eq('id', workspaceId).single(),
      ]);

      const sourceSummary = sources
        .slice(0, 3)
        .map((s, i) => `${i + 1}. ${s.originalText}`)
        .join('\n');

      const escalationId = await this.escalations.create({
        workspaceId,
        askerId: askerUserId,
        targetId: escalationTargetId,
        question,
        aiAnswer: parsed.answer,
        confidence: parsed.confidence,
      });

      await this.notifications.sendWorkspaceQuestionEscalationEmail(escalationTargetId, {
        workspaceName: workspace?.name ?? 'workspace',
        askerName: asker?.full_name ?? asker?.email ?? 'A teammate',
        question,
        aiAnswer: parsed.answer,
        confidence: parsed.confidence,
        relatedTaskTitle: relatedTask?.title,
        contextFound: sourceSummary || 'No relevant shared memories found.',
        frontendUrl: this.ctx.config.frontendUrl,
        escalationId,
      });

      await this.ctx.eventBus.publish({
        type: EVENT_TYPES.QUESTION_ESCALATED,
        aggregateType: 'workspace',
        aggregateId: workspaceId,
        userId: askerUserId,
        payload: {
          question,
          targetUserId: escalationTargetId,
          targetName: target?.full_name,
          confidence: parsed.confidence,
          relatedTaskId: relatedTask?.id,
          escalationId,
        },
      });
    }

    const escalationNote = escalationTargetId
      ? ' I have notified the relevant teammate by email so they can clarify.'
      : '';

    return {
      answer: `${parsed.answer}${escalationNote}`,
      confidence: parsed.confidence,
      escalated: Boolean(escalationTargetId),
      sources,
      relatedTaskTitle: relatedTask?.title,
    };
  }

  private async findRelatedTask(
    workspaceId: string,
    question: string,
  ): Promise<{ id: string; user_id: string; title: string; description: string | null } | null> {
    const { data: tasks } = await this.ctx.supabase
      .from('tasks')
      .select('id, user_id, title, description')
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!tasks?.length) return null;

    const questionLower = question.toLowerCase();
    const keywordMatch = tasks.find(
      (t) =>
        questionLower.includes(t.title.toLowerCase()) ||
        t.title.toLowerCase().split(' ').some((word) => word.length > 3 && questionLower.includes(word)),
    );

    return keywordMatch ?? tasks[0] ?? null;
  }

  private async resolveEscalationTarget(
    workspaceId: string,
    askerUserId: string,
    sources: WorkspaceSearchResult[],
    relatedTask: { user_id: string } | null,
  ): Promise<string | null> {
    if (relatedTask?.user_id && relatedTask.user_id !== askerUserId) {
      return relatedTask.user_id;
    }

    const topSourceAuthor = sources.find((s) => s.userId !== askerUserId);
    if (topSourceAuthor) return topSourceAuthor.userId;

    const { data: workspace } = await this.ctx.supabase
      .from('shared_workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single();

    if (workspace?.owner_id && workspace.owner_id !== askerUserId) {
      return workspace.owner_id;
    }

    const { data: members } = await this.ctx.supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .neq('user_id', askerUserId)
      .limit(1);

    return members?.[0]?.user_id ?? null;
  }
}
