import { EVENT_TYPES } from '../../../events/index.js';
import type { ServiceContext } from '../../../shared/types.js';

const APPROVAL_PROMPT = `Extract approval details. Respond with JSON only:
{
  "subject": "<what was approved/rejected>",
  "status": "approved|rejected|needs_changes|pending",
  "notes": "<any notes>",
  "approver_hint": "<name hint or null>"
}`;

export class ApprovalService {
  constructor(private readonly ctx: ServiceContext) {}

  async recordFromMemory(
    memoryId: string,
    text: string,
    userId: string,
    workspaceId?: string,
  ): Promise<void> {
    const result = await this.ctx.ai.chat({
      messages: [
        { role: 'system', content: APPROVAL_PROMPT },
        { role: 'user', content: text },
      ],
      jsonMode: true,
      temperature: 0.1,
    });

    let parsed: {
      subject: string;
      status: string;
      notes?: string;
      approver_hint?: string;
    };
    try {
      parsed = JSON.parse(result.content) as typeof parsed;
    } catch {
      return;
    }

    let approverId = userId;
    if (parsed.approver_hint) {
      const { data: profiles } = await this.ctx.supabase
        .from('profiles')
        .select('id')
        .ilike('full_name', `%${parsed.approver_hint}%`)
        .limit(1);
      if (profiles?.[0]) approverId = profiles[0].id;
    }

    const { data: approval, error } = await this.ctx.supabase
      .from('approvals')
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        memory_id: memoryId,
        subject: parsed.subject,
        status: parsed.status as 'approved' | 'rejected' | 'needs_changes' | 'pending',
        approver_id: approverId,
        notes: parsed.notes,
        decided_at: parsed.status !== 'pending' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to record approval: ${error.message}`);

    await this.ctx.eventBus.publish({
      type: EVENT_TYPES.APPROVAL_RECORDED,
      aggregateType: 'approval',
      aggregateId: approval.id,
      userId,
      payload: { approvalId: approval.id, memoryId, status: parsed.status },
    });
  }
}
