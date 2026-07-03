import { EVENT_TYPES } from '../../../events/index.js';
import type { ServiceContext } from '../../../shared/types.js';
import { NotificationService } from '../../notifications/services/notification.service.js';

export interface EscalationRecord {
  id: string;
  workspaceId: string;
  workspaceName: string;
  askerId: string;
  askerName: string;
  targetId: string;
  question: string;
  aiAnswer: string | null;
  confidence: number | null;
  status: 'open' | 'resolved';
  resolvedMemoryId: string | null;
  createdAt: string;
}

export interface EscalationSummary {
  id: string;
  workspaceId: string;
  workspaceName: string;
  askerName: string;
  question: string;
  confidence: number | null;
  createdAt: string;
}

export class EscalationService {
  private notifications: NotificationService;

  constructor(private readonly ctx: ServiceContext) {
    this.notifications = new NotificationService(ctx);
  }

  private async assertMember(workspaceId: string, userId: string): Promise<void> {
    const { data: member } = await this.ctx.supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle();

    if (member) return;

    const { data: workspace } = await this.ctx.supabase
      .from('shared_workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('owner_id', userId)
      .maybeSingle();

    if (!workspace) throw new Error('Not a member of this workspace');
  }

  async create(input: {
    workspaceId: string;
    askerId: string;
    targetId: string;
    question: string;
    aiAnswer: string;
    confidence: number;
  }): Promise<string> {
    const { data, error } = await this.ctx.supabase
      .from('workspace_question_escalations')
      .insert({
        workspace_id: input.workspaceId,
        asker_id: input.askerId,
        target_id: input.targetId,
        question: input.question,
        ai_answer: input.aiAnswer,
        confidence: input.confidence,
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create escalation: ${error.message}`);
    return data.id;
  }

  async generateDraftAnswer(
    workspaceId: string,
    targetUserId: string,
    question: string,
    fallbackAnswer?: string,
  ): Promise<string> {
    const { data: targetWorkspaceMemories } = await this.ctx.supabase
      .from('memories')
      .select('original_text, summary')
      .eq('user_id', targetUserId)
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .limit(12);

    const targetContext = (targetWorkspaceMemories ?? [])
      .map((m, i) => `[Memory ${i + 1}] ${m.original_text}${m.summary ? ` (Summary: ${m.summary})` : ''}`)
      .join('\n');

    try {
      const draftResult = await this.ctx.ai.chat({
        messages: [
          {
            role: 'system',
            content: `You are AI Brain. A question has been escalated to you to answer on behalf of a teammate (using their documented memories).
Write a helpful, concise draft answer in the first-person (using 'I' or 'we') representing the teammate's perspective.
If their memories do not provide the answer, output a brief, polite response acknowledging you don't know yet but will find out, highlighting any minor details that were found. Do not mention system user IDs.`,
          },
          {
            role: 'user',
            content: `Your documented memories:\n${targetContext || 'No specific memories found.'}\n\nQuestion from teammate: ${question}`,
          },
        ],
        temperature: 0.3,
      });
      if (draftResult.content?.trim()) {
        return draftResult.content.trim();
      }
    } catch {
      // fall through to fallback
    }

    return fallbackAnswer ?? '';
  }

  async listOpenForTarget(userId: string): Promise<EscalationSummary[]> {
    const { data, error } = await this.ctx.supabase
      .from('workspace_question_escalations')
      .select('id, workspace_id, asker_id, question, confidence, created_at')
      .eq('target_id', userId)
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list escalations: ${error.message}`);
    if (!data?.length) return [];

    const workspaceIds = [...new Set(data.map((e) => e.workspace_id))];
    const askerIds = [...new Set(data.map((e) => e.asker_id))];

    const [{ data: workspaces }, { data: askers }] = await Promise.all([
      this.ctx.supabase.from('shared_workspaces').select('id, name').in('id', workspaceIds),
      this.ctx.supabase.from('profiles').select('id, full_name, email').in('id', askerIds),
    ]);

    const workspaceMap = new Map((workspaces ?? []).map((w) => [w.id, w.name]));
    const askerMap = new Map(
      (askers ?? []).map((a) => [a.id, a.full_name ?? a.email ?? 'A teammate']),
    );

    return data.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      workspaceName: workspaceMap.get(row.workspace_id) ?? 'workspace',
      askerName: askerMap.get(row.asker_id) ?? 'A teammate',
      question: row.question,
      confidence: row.confidence,
      createdAt: row.created_at,
    }));
  }

  async regenerateDraft(escalationId: string, userId: string): Promise<EscalationRecord> {
    const escalation = await this.getById(escalationId, userId);

    if (escalation.status === 'resolved') {
      throw new Error('Cannot regenerate draft for a resolved escalation');
    }

    if (escalation.targetId !== userId) {
      throw new Error('Only the assigned teammate can regenerate this draft');
    }

    const draftAnswer = await this.generateDraftAnswer(
      escalation.workspaceId,
      escalation.targetId,
      escalation.question,
      escalation.aiAnswer ?? undefined,
    );

    const { error } = await this.ctx.supabase
      .from('workspace_question_escalations')
      .update({ ai_answer: draftAnswer })
      .eq('id', escalationId)
      .eq('status', 'open');

    if (error) throw new Error(`Failed to update draft: ${error.message}`);

    return this.getById(escalationId, userId);
  }

  async getById(escalationId: string, userId: string): Promise<EscalationRecord> {
    const { data, error } = await this.ctx.supabase
      .from('workspace_question_escalations')
      .select('*')
      .eq('id', escalationId)
      .single();

    if (error || !data) throw new Error('Escalation not found');

    if (data.asker_id !== userId && data.target_id !== userId) {
      await this.assertMember(data.workspace_id, userId);
    }

    const [{ data: workspace }, { data: asker }] = await Promise.all([
      this.ctx.supabase.from('shared_workspaces').select('name').eq('id', data.workspace_id).single(),
      this.ctx.supabase.from('profiles').select('full_name, email').eq('id', data.asker_id).single(),
    ]);

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      workspaceName: workspace?.name ?? 'workspace',
      askerId: data.asker_id,
      askerName: asker?.full_name ?? asker?.email ?? 'A teammate',
      targetId: data.target_id,
      question: data.question,
      aiAnswer: data.ai_answer,
      confidence: data.confidence,
      status: data.status as 'open' | 'resolved',
      resolvedMemoryId: data.resolved_memory_id,
      createdAt: data.created_at,
    };
  }

  async resolve(
    escalationId: string,
    resolverUserId: string,
    memoryId: string,
    memoryText: string,
  ): Promise<void> {
    const escalation = await this.getById(escalationId, resolverUserId);

    if (escalation.status === 'resolved') return;

    if (escalation.targetId !== resolverUserId) {
      throw new Error('Only the assigned teammate can answer this escalation');
    }

    const { error } = await this.ctx.supabase
      .from('workspace_question_escalations')
      .update({
        status: 'resolved',
        resolved_memory_id: memoryId,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', escalationId)
      .eq('status', 'open');

    if (error) throw new Error(`Failed to resolve escalation: ${error.message}`);

    const [{ data: resolver }, { data: workspace }] = await Promise.all([
      this.ctx.supabase.from('profiles').select('full_name, email').eq('id', resolverUserId).single(),
      this.ctx.supabase.from('shared_workspaces').select('name').eq('id', escalation.workspaceId).single(),
    ]);

    const resolverName = resolver?.full_name ?? resolver?.email ?? 'A teammate';
    const workspaceName = workspace?.name ?? escalation.workspaceName;
    const frontendUrl = this.ctx.config.frontendUrl?.replace(/\/$/, '');

    await this.notifications.sendEscalationResolvedEmail(escalation.askerId, {
      workspaceName,
      resolverName,
      question: escalation.question,
      answer: memoryText,
      frontendUrl,
    });

    await this.ctx.eventBus.publish({
      type: EVENT_TYPES.QUESTION_RESOLVED,
      aggregateType: 'workspace',
      aggregateId: escalation.workspaceId,
      userId: resolverUserId,
      payload: {
        question: escalation.question,
        escalationId,
        resolvedMemoryId: memoryId,
        askerId: escalation.askerId,
      },
    });
  }
}
