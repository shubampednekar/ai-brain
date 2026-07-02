import { EVENT_TYPES } from '../../../events/index.js';
import type { ServiceContext } from '../../../shared/types.js';

const REMINDER_PROMPT = `Extract reminder details from the text. Respond with JSON only:
{
  "title": "<reminder title>",
  "description": "<optional description>",
  "scheduled_at": "<ISO 8601 datetime>",
  "timezone": "<IANA timezone, default UTC>",
  "priority": "low|medium|high|urgent",
  "recurrence_rule": "<RRULE or null>"
}

Use the current date context provided. If no specific time, default to 9:00 AM.`;

export interface ReminderListItem {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: string;
  timezone: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'scheduled' | 'sent' | 'cancelled' | 'failed';
  memoryId: string | null;
  createdAt: string;
}

export class ReminderService {
  constructor(private readonly ctx: ServiceContext) {}

  async listForUser(
    userId: string,
    options?: { status?: 'scheduled' | 'sent' | 'cancelled' | 'failed' },
  ): Promise<ReminderListItem[]> {
    let query = this.ctx.supabase
      .from('reminders')
      .select('id, title, description, scheduled_at, timezone, priority, status, memory_id, created_at')
      .eq('user_id', userId)
      .order('scheduled_at', { ascending: true })
      .limit(50);

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list reminders: ${error.message}`);

    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      scheduledAt: row.scheduled_at,
      timezone: row.timezone,
      priority: row.priority,
      status: row.status,
      memoryId: row.memory_id,
      createdAt: row.created_at,
    }));
  }

  async cancel(reminderId: string, userId: string): Promise<ReminderListItem> {
    return this.updateReminder(reminderId, userId, { status: 'cancelled' });
  }

  async snooze(reminderId: string, userId: string, scheduledAt: string): Promise<ReminderListItem> {
    return this.updateReminder(reminderId, userId, { scheduled_at: scheduledAt, status: 'scheduled' });
  }

  private async updateReminder(
    reminderId: string,
    userId: string,
    updates: { status?: 'scheduled' | 'sent' | 'cancelled' | 'failed'; scheduled_at?: string },
  ): Promise<ReminderListItem> {
    const { data: existing, error: fetchError } = await this.ctx.supabase
      .from('reminders')
      .select('user_id')
      .eq('id', reminderId)
      .single();

    if (fetchError || !existing) throw new Error('Reminder not found');
    if (existing.user_id !== userId) throw new Error('Not authorized to update this reminder');

    const { data, error } = await this.ctx.supabase
      .from('reminders')
      .update(updates)
      .eq('id', reminderId)
      .select('id, title, description, scheduled_at, timezone, priority, status, memory_id, created_at')
      .single();

    if (error) throw new Error(`Failed to update reminder: ${error.message}`);

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      scheduledAt: data.scheduled_at,
      timezone: data.timezone,
      priority: data.priority,
      status: data.status,
      memoryId: data.memory_id,
      createdAt: data.created_at,
    };
  }

  async detectFromMemory(
    memoryId: string,
    text: string,
    userId: string,
    userTimezone = 'UTC',
  ): Promise<void> {
    const now = new Date().toISOString();
    const result = await this.ctx.ai.chat({
      messages: [
        {
          role: 'system',
          content: `${REMINDER_PROMPT}\n\nCurrent datetime: ${now}\nUser timezone: ${userTimezone}`,
        },
        { role: 'user', content: text },
      ],
      jsonMode: true,
      temperature: 0.1,
    });

    let parsed: {
      title: string;
      description?: string;
      scheduled_at: string;
      timezone?: string;
      priority?: string;
      recurrence_rule?: string;
    };

    try {
      parsed = JSON.parse(result.content) as typeof parsed;
    } catch {
      return;
    }

    const { data: reminder, error } = await this.ctx.supabase
      .from('reminders')
      .insert({
        user_id: userId,
        memory_id: memoryId,
        title: parsed.title,
        description: parsed.description,
        scheduled_at: parsed.scheduled_at,
        timezone: parsed.timezone ?? userTimezone,
        priority: (parsed.priority as 'low' | 'medium' | 'high' | 'urgent') ?? 'medium',
        recurrence_rule: parsed.recurrence_rule,
        delivery_channels: ['email'],
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create reminder: ${error.message}`);

    await this.ctx.eventBus.publish({
      type: EVENT_TYPES.REMINDER_SCHEDULED,
      aggregateType: 'reminder',
      aggregateId: reminder.id,
      userId,
      payload: {
        reminderId: reminder.id,
        memoryId,
        scheduledAt: parsed.scheduled_at,
        title: parsed.title,
      },
    });
  }

  async getDueReminders(): Promise<
    Array<{
      id: string;
      user_id: string;
      title: string;
      description: string | null;
      scheduled_at: string;
    }>
  > {
    const { data, error } = await this.ctx.supabase
      .from('reminders')
      .select('id, user_id, title, description, scheduled_at')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())
      .limit(50);

    if (error) throw new Error(`Failed to fetch due reminders: ${error.message}`);
    return data ?? [];
  }

  async markSent(reminderId: string): Promise<void> {
    await this.ctx.supabase
      .from('reminders')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', reminderId);
  }
}
