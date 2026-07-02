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

export class TaskService {
  private notifications: NotificationService;

  constructor(private readonly ctx: ServiceContext) {
    this.notifications = new NotificationService(ctx);
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
      payload: { taskId: task.id, memoryId, title: parsed.title },
    });

    if (assigneeId && assigneeId !== userId) {
      await this.notifications.sendTaskAssignmentEmail(assigneeId, parsed.title);
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
