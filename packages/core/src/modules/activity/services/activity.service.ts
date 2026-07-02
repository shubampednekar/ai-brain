import type { ServiceContext } from '../../../shared/types.js';
import { SharedMemoryService } from '../../shared-memory/services/shared-memory.service.js';

export type ActivityType =
  | 'memory_captured'
  | 'task_created'
  | 'question_escalated'
  | 'question_resolved'
  | 'member_joined'
  | 'invitation_sent';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  actorName: string;
  summary: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export class ActivityService {
  private sharedMemory: SharedMemoryService;

  constructor(private readonly ctx: ServiceContext) {
    this.sharedMemory = new SharedMemoryService(ctx);
  }

  async listWorkspaceActivity(
    workspaceId: string,
    userId: string,
    limit = 30,
  ): Promise<ActivityItem[]> {
    await this.sharedMemory.assertMember(workspaceId, userId);

    const [memoriesResult, tasksResult, eventsResult] = await Promise.all([
      this.ctx.supabase
        .from('memories')
        .select('id, original_text, intent_slug, user_id, created_at')
        .eq('workspace_id', workspaceId)
        .eq('visibility', 'shared')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20),
      this.ctx.supabase
        .from('tasks')
        .select('id, title, user_id, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(20),
      this.ctx.supabase
        .from('domain_events')
        .select('id, event_type, user_id, payload, created_at')
        .eq('aggregate_type', 'workspace')
        .eq('aggregate_id', workspaceId)
        .in('event_type', [
          'question.escalated',
          'question.resolved',
          'workspace.member_joined',
          'workspace.invitation_sent',
        ])
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const userIds = new Set<string>();
    for (const m of memoriesResult.data ?? []) userIds.add(m.user_id);
    for (const t of tasksResult.data ?? []) userIds.add(t.user_id);
    for (const e of eventsResult.data ?? []) {
      if (e.user_id) userIds.add(e.user_id);
    }

    const profileMap = await this.loadProfileNames([...userIds]);
    const items: ActivityItem[] = [];

    for (const memory of memoriesResult.data ?? []) {
      items.push({
        id: `memory-${memory.id}`,
        type: 'memory_captured',
        actorName: profileMap.get(memory.user_id) ?? 'Someone',
        summary: memory.original_text.slice(0, 120) + (memory.original_text.length > 120 ? '…' : ''),
        createdAt: memory.created_at,
        metadata: { intentSlug: memory.intent_slug, memoryId: memory.id },
      });
    }

    for (const task of tasksResult.data ?? []) {
      items.push({
        id: `task-${task.id}`,
        type: 'task_created',
        actorName: profileMap.get(task.user_id) ?? 'Someone',
        summary: task.title,
        createdAt: task.created_at,
        metadata: { taskId: task.id },
      });
    }

    for (const event of eventsResult.data ?? []) {
      const actorName = event.user_id ? (profileMap.get(event.user_id) ?? 'Someone') : 'System';
      const payload = event.payload as Record<string, unknown>;

      switch (event.event_type) {
        case 'question.escalated':
          items.push({
            id: `event-${event.id}`,
            type: 'question_escalated',
            actorName,
            summary: String(payload.question ?? 'A question needs clarification'),
            createdAt: event.created_at,
            metadata: payload,
          });
          break;
        case 'question.resolved':
          items.push({
            id: `event-${event.id}`,
            type: 'question_resolved',
            actorName,
            summary: String(payload.question ?? 'A question was answered'),
            createdAt: event.created_at,
            metadata: payload,
          });
          break;
        case 'workspace.member_joined':
          items.push({
            id: `event-${event.id}`,
            type: 'member_joined',
            actorName,
            summary: 'Joined the workspace',
            createdAt: event.created_at,
          });
          break;
        case 'workspace.invitation_sent':
          items.push({
            id: `event-${event.id}`,
            type: 'invitation_sent',
            actorName,
            summary: `Invited ${String(payload.email ?? 'a teammate')}`,
            createdAt: event.created_at,
            metadata: payload,
          });
          break;
      }
    }

    return items
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  private async loadProfileNames(userIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (!userIds.length) return map;

    const { data } = await this.ctx.supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    for (const profile of data ?? []) {
      map.set(profile.id, profile.full_name ?? profile.email);
    }
    return map;
  }
}
