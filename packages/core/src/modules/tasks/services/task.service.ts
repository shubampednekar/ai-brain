import { EVENT_TYPES } from '../../../events/index.js';
import type { ServiceContext } from '../../../shared/types.js';
import { NotificationService } from '../../notifications/services/notification.service.js';

const TASK_PROMPT = `Extract task details from the text. Respond with JSON only:
{
  "title": "<task title>",
  "description": "<optional description>",
  "priority": "low|medium|high|urgent",
  "due_at": "<ISO 8601 datetime or null>",
  "assignee_hint": "<name or email hint or null>"
}`;

export interface TaskListItem {
  id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueAt: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  memoryId: string | null;
  createdAt: string;
}

export class TaskService {
  private notifications: NotificationService;

  constructor(private readonly ctx: ServiceContext) {
    this.notifications = new NotificationService(ctx);
  }

  async listForUser(
    userId: string,
    options?: { workspaceId?: string; status?: string },
  ): Promise<TaskListItem[]> {
    let query = this.ctx.supabase
      .from('tasks')
      .select('id, title, description, status, priority, due_at, workspace_id, assignee_id, memory_id, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (options?.workspaceId) {
      query = query.eq('workspace_id', options.workspaceId);
    } else {
      query = query
        .is('workspace_id', null)
        .or(`user_id.eq.${userId},assignee_id.eq.${userId}`);
    }

    if (options?.status) {
      query = query.eq('status', options.status as 'pending');
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list tasks: ${error.message}`);

    const rows = data ?? [];
    const workspaceIds = [...new Set(rows.map((r) => r.workspace_id).filter(Boolean))] as string[];
    const assigneeIds = [...new Set(rows.map((r) => r.assignee_id).filter(Boolean))] as string[];

    const workspaceMap = new Map<string, string>();
    if (workspaceIds.length) {
      const { data: workspaces } = await this.ctx.supabase
        .from('shared_workspaces')
        .select('id, name')
        .in('id', workspaceIds);
      for (const ws of workspaces ?? []) workspaceMap.set(ws.id, ws.name);
    }

    const profileMap = new Map<string, string>();
    if (assigneeIds.length) {
      const { data: profiles } = await this.ctx.supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', assigneeIds);
      for (const p of profiles ?? []) profileMap.set(p.id, p.full_name ?? p.email);
    }

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      dueAt: row.due_at,
      workspaceId: row.workspace_id,
      workspaceName: row.workspace_id ? (workspaceMap.get(row.workspace_id) ?? null) : null,
      assigneeId: row.assignee_id,
      assigneeName: row.assignee_id ? (profileMap.get(row.assignee_id) ?? null) : null,
      memoryId: row.memory_id,
      createdAt: row.created_at,
    }));
  }

  async updateStatus(
    taskId: string,
    userId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled',
  ): Promise<TaskListItem> {
    const { data: task, error: fetchError } = await this.ctx.supabase
      .from('tasks')
      .select('id, user_id, assignee_id, workspace_id')
      .eq('id', taskId)
      .single();

    if (fetchError || !task) throw new Error('Task not found');
    if (task.user_id !== userId && task.assignee_id !== userId) {
      throw new Error('Not authorized to update this task');
    }

    const updates: {
      status: typeof status;
      completed_at: string | null;
    } = {
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    };

    const { data: updated, error } = await this.ctx.supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select('id, title, description, status, priority, due_at, workspace_id, assignee_id, memory_id, created_at')
      .single();

    if (error) throw new Error(`Failed to update task: ${error.message}`);

    if (status === 'completed') {
      await this.ctx.eventBus.publish({
        type: EVENT_TYPES.TASK_COMPLETED,
        aggregateType: 'task',
        aggregateId: taskId,
        userId,
        payload: { taskId, workspaceId: task.workspace_id },
      });
    }

    let workspaceName: string | null = null;
    if (updated.workspace_id) {
      const { data: ws } = await this.ctx.supabase
        .from('shared_workspaces')
        .select('name')
        .eq('id', updated.workspace_id)
        .single();
      workspaceName = ws?.name ?? null;
    }

    let assigneeName: string | null = null;
    if (updated.assignee_id) {
      const { data: profile } = await this.ctx.supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', updated.assignee_id)
        .single();
      assigneeName = profile?.full_name ?? profile?.email ?? null;
    }

    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      status: updated.status,
      priority: updated.priority,
      dueAt: updated.due_at,
      workspaceId: updated.workspace_id,
      workspaceName,
      assigneeId: updated.assignee_id,
      assigneeName,
      memoryId: updated.memory_id,
      createdAt: updated.created_at,
    };
  }

  async extractFromMemory(
    memoryId: string,
    text: string,
    userId: string,
    workspaceId?: string,
  ): Promise<void> {
    const result = await this.ctx.ai.chat({
      messages: [
        { role: 'system', content: TASK_PROMPT },
        { role: 'user', content: text },
      ],
      jsonMode: true,
      temperature: 0.1,
    });

    let parsed: {
      title: string;
      description?: string;
      priority?: string;
      due_at?: string;
      assignee_hint?: string;
    };

    try {
      parsed = JSON.parse(result.content) as typeof parsed;
    } catch {
      return;
    }

    let assigneeId: string | undefined;
    if (parsed.assignee_hint) {
      const { data: profiles } = await this.ctx.supabase
        .from('profiles')
        .select('id, full_name, email')
        .or(`full_name.ilike.%${parsed.assignee_hint}%,email.ilike.%${parsed.assignee_hint}%`)
        .limit(1);
      assigneeId = profiles?.[0]?.id;
    }

    let otherMemberIds: string[] = [];
    if (workspaceId) {
      const { data: members } = await this.ctx.supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', workspaceId)
        .neq('user_id', userId);

      otherMemberIds = (members ?? []).map((m) => m.user_id);

      if (!assigneeId && otherMemberIds.length === 1) {
        assigneeId = otherMemberIds[0];
      }
    }

    const { data: task, error } = await this.ctx.supabase
      .from('tasks')
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        memory_id: memoryId,
        title: parsed.title,
        description: parsed.description,
        assignee_id: assigneeId,
        priority: (parsed.priority as 'low' | 'medium' | 'high' | 'urgent') ?? 'medium',
        due_at: parsed.due_at,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create task: ${error.message}`);

    await this.ctx.eventBus.publish({
      type: EVENT_TYPES.TASK_EXTRACTED,
      aggregateType: 'task',
      aggregateId: task.id,
      userId,
      payload: { taskId: task.id, memoryId, title: parsed.title, workspaceId },
    });

    const { data: creator } = await this.ctx.supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .single();

    const creatorName = creator?.full_name ?? creator?.email ?? 'A teammate';

    if (workspaceId) {
      const { data: workspace } = await this.ctx.supabase
        .from('shared_workspaces')
        .select('name')
        .eq('id', workspaceId)
        .single();

      const workspaceName = workspace?.name ?? 'workspace';
      const notifyIds = new Set(otherMemberIds);

      if (assigneeId && assigneeId !== userId) {
        notifyIds.add(assigneeId);
      }

      for (const memberId of notifyIds) {
        if (memberId === userId) continue;
        await this.notifications.sendWorkspaceTaskCreatedEmail(
          memberId,
          parsed.title,
          creatorName,
          workspaceName,
          parsed.description,
        );
      }

      if (assigneeId && assigneeId !== userId) {
        await this.ctx.eventBus.publish({
          type: EVENT_TYPES.TASK_ASSIGNED,
          aggregateType: 'task',
          aggregateId: task.id,
          userId,
          payload: { taskId: task.id, assigneeId, workspaceId },
        });
      }
    } else if (assigneeId && assigneeId !== userId) {
      await this.notifications.sendTaskAssignmentEmail(assigneeId, parsed.title, creatorName);
      await this.ctx.eventBus.publish({
        type: EVENT_TYPES.TASK_ASSIGNED,
        aggregateType: 'task',
        aggregateId: task.id,
        userId,
        payload: { taskId: task.id, assigneeId },
      });
    }
  }
}
