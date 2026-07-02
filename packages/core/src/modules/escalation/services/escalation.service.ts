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
