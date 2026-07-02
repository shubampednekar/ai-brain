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
  creatorId: string;
  creatorName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  roleLabel: string;
  roleTone: 'action' | 'waiting' | 'neutral';
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
    const select =
      'id, title, description, status, priority, due_at, workspace_id, user_id, assignee_id, memory_id, created_at';

    let rows: Array<{
      id: string;
      title: string;
      description: string | null;
      status: TaskListItem['status'];
      priority: TaskListItem['priority'];
      due_at: string | null;
      workspace_id: string | null;
      user_id: string;
      assignee_id: string | null;
      memory_id: string | null;
      created_at: string;
    }> = [];

    if (options?.workspaceId) {
      let query = this.ctx.supabase
        .from('tasks')
        .select(select)
        .eq('workspace_id', options.workspaceId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (options?.status) {
        query = query.eq('status', options.status as 'pending');
      }

      const { data, error } = await query;
      if (error) throw new Error(`Failed to list tasks: ${error.message}`);
      rows = data ?? [];
    } else {
      const workspaceIds = await this.getUserWorkspaceIds(userId);

      let personalQuery = this.ctx.supabase
        .from('tasks')
        .select(select)
        .is('workspace_id', null)
        .or(`user_id.eq.${userId},assignee_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (options?.status) {
        personalQuery = personalQuery.eq('status', options.status as 'pending');
      }

      const queries = [personalQuery];

      if (workspaceIds.length > 0) {
        let workspaceQuery = this.ctx.supabase
          .from('tasks')
          .select(select)
          .in('workspace_id', workspaceIds)
          .order('created_at', { ascending: false })
          .limit(50);

        if (options?.status) {
          workspaceQuery = workspaceQuery.eq('status', options.status as 'pending');
        }

        queries.push(workspaceQuery);
      }

      const results = await Promise.all(queries.map((q) => q));
      for (const result of results) {
        if (result.error) throw new Error(`Failed to list tasks: ${result.error.message}`);
        rows.push(...(result.data ?? []));
      }

      const seen = new Set<string>();
      rows = rows
        .filter((row) => {
          if (seen.has(row.id)) return false;
          seen.add(row.id);
          return true;
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 50);
    }

    return this.mapTaskRows(rows, userId);
  }

  private async getUserWorkspaceIds(userId: string): Promise<string[]> {
    const [{ data: memberships }, { data: owned }] = await Promise.all([
      this.ctx.supabase.from('workspace_members').select('workspace_id').eq('user_id', userId),
      this.ctx.supabase.from('shared_workspaces').select('id').eq('owner_id', userId),
    ]);

    return [
      ...new Set([
        ...(memberships ?? []).map((m) => m.workspace_id),
        ...(owned ?? []).map((w) => w.id),
      ]),
    ];
  }

  private getTaskRole(
    viewerUserId: string,
    row: {
      user_id: string;
      assignee_id: string | null;
      workspace_id: string | null;
      status: TaskListItem['status'];
    },
    creatorName: string | null,
    assigneeName: string | null,
  ): { roleLabel: string; roleTone: TaskListItem['roleTone'] } {
    const isCreator = row.user_id === viewerUserId;
    const isAssignee = row.assignee_id === viewerUserId;
    const isDone = row.status === 'completed' || row.status === 'cancelled';
    const creator = creatorName ?? 'teammate';
    const assignee = assigneeName ?? 'teammate';

    if (isDone) {
      if (isCreator && isAssignee) return { roleLabel: 'You completed this', roleTone: 'neutral' };
      if (isCreator) return { roleLabel: `Completed by ${assignee}`, roleTone: 'neutral' };
      if (isAssignee) return { roleLabel: 'You completed this', roleTone: 'neutral' };
      return { roleLabel: `Created by ${creator}`, roleTone: 'neutral' };
    }

    if (!row.workspace_id) {
      if (isAssignee && !isCreator) return { roleLabel: 'Assigned to you', roleTone: 'action' };
      return { roleLabel: 'Your task', roleTone: 'neutral' };
    }

    if (isAssignee && !isCreator) {
      return { roleLabel: 'For you — please complete', roleTone: 'action' };
    }
    if (isCreator && isAssignee) {
      return { roleLabel: 'Your task', roleTone: 'action' };
    }
    if (isCreator && row.assignee_id) {
      return { roleLabel: `Waiting on ${assignee}`, roleTone: 'waiting' };
    }
    if (isCreator) {
      return { roleLabel: 'You created — unassigned', roleTone: 'waiting' };
    }
    if (row.assignee_id) {
      return { roleLabel: `Assigned to ${assignee}`, roleTone: 'neutral' };
    }
    return { roleLabel: `Created by ${creator}`, roleTone: 'neutral' };
  }

  private async mapTaskRows(
    rows: Array<{
      id: string;
      title: string;
      description: string | null;
      status: TaskListItem['status'];
      priority: TaskListItem['priority'];
      due_at: string | null;
      workspace_id: string | null;
      user_id: string;
      assignee_id: string | null;
      memory_id: string | null;
      created_at: string;
    }>,
    viewerUserId: string,
  ): Promise<TaskListItem[]> {
    const workspaceIds = [...new Set(rows.map((r) => r.workspace_id).filter(Boolean))] as string[];
    const profileIds = [
      ...new Set([
        ...rows.map((r) => r.user_id),
        ...rows.map((r) => r.assignee_id).filter(Boolean),
      ]),
    ] as string[];

    const workspaceMap = new Map<string, string>();
    if (workspaceIds.length) {
      const { data: workspaces } = await this.ctx.supabase
        .from('shared_workspaces')
        .select('id, name')
        .in('id', workspaceIds);
      for (const ws of workspaces ?? []) workspaceMap.set(ws.id, ws.name);
    }

    const profileMap = new Map<string, string>();
    if (profileIds.length) {
      const { data: profiles } = await this.ctx.supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', profileIds);
      for (const p of profiles ?? []) profileMap.set(p.id, p.full_name ?? p.email);
    }

    return rows.map((row) => {
      const creatorName = profileMap.get(row.user_id) ?? null;
      const assigneeName = row.assignee_id ? (profileMap.get(row.assignee_id) ?? null) : null;
      const { roleLabel, roleTone } = this.getTaskRole(viewerUserId, row, creatorName, assigneeName);

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        priority: row.priority,
        dueAt: row.due_at,
        workspaceId: row.workspace_id,
        workspaceName: row.workspace_id ? (workspaceMap.get(row.workspace_id) ?? null) : null,
        creatorId: row.user_id,
        creatorName,
        assigneeId: row.assignee_id,
        assigneeName,
        roleLabel,
        roleTone,
        memoryId: row.memory_id,
        createdAt: row.created_at,
      };
    });
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

    const isCreatorOrAssignee = task.user_id === userId || task.assignee_id === userId;
    if (!isCreatorOrAssignee) {
      if (!task.workspace_id) {
        throw new Error('Not authorized to update this task');
      }
      const workspaceIds = await this.getUserWorkspaceIds(userId);
      if (!workspaceIds.includes(task.workspace_id)) {
        throw new Error('Not authorized to update this task');
      }
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
      .select(
        'id, title, description, status, priority, due_at, workspace_id, user_id, assignee_id, memory_id, created_at',
      )
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

    const [mapped] = await this.mapTaskRows([updated], userId);
    if (!mapped) throw new Error('Failed to map updated task');
    return mapped;
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
