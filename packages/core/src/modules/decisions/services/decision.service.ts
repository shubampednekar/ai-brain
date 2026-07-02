import { EVENT_TYPES } from '../../../events/index.js';
import type { ServiceContext } from '../../../shared/types.js';

const DECISION_PROMPT = `Extract decision details. Respond with JSON only:
{
  "decision": "<what was decided>",
  "reason": "<why, if mentioned>",
  "decision_maker_hint": "<name hint or null>"
}`;

export class DecisionService {
  constructor(private readonly ctx: ServiceContext) {}

  async recordFromMemory(
    memoryId: string,
    text: string,
    userId: string,
    workspaceId?: string,
  ): Promise<void> {
    const result = await this.ctx.ai.chat({
      messages: [
        { role: 'system', content: DECISION_PROMPT },
        { role: 'user', content: text },
      ],
      jsonMode: true,
      temperature: 0.1,
    });

    let parsed: { decision: string; reason?: string; decision_maker_hint?: string };
    try {
      parsed = JSON.parse(result.content) as typeof parsed;
    } catch {
      return;
    }

    let decisionMakerId = userId;
    if (parsed.decision_maker_hint) {
      const { data: profiles } = await this.ctx.supabase
        .from('profiles')
        .select('id')
        .ilike('full_name', `%${parsed.decision_maker_hint}%`)
        .limit(1);
      if (profiles?.[0]) decisionMakerId = profiles[0].id;
    }

    const { data: decision, error } = await this.ctx.supabase
      .from('decisions')
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        memory_id: memoryId,
        decision: parsed.decision,
        reason: parsed.reason,
        decision_maker_id: decisionMakerId,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to record decision: ${error.message}`);

    await this.ctx.eventBus.publish({
      type: EVENT_TYPES.DECISION_RECORDED,
      aggregateType: 'decision',
      aggregateId: decision.id,
      userId,
      payload: { decisionId: decision.id, memoryId, decision: parsed.decision },
    });
  }
}
