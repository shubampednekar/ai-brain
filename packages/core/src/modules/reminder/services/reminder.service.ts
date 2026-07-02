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

export class ReminderService {
  constructor(private readonly ctx: ServiceContext) {}

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
