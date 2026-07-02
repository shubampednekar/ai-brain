import { EVENT_TYPES } from '../../../events/index.js';
import type { Database } from '@ai-brain/database';
import type { ServiceContext } from '../../../shared/types.js';
import { MemoryService } from '../../memory/services/memory.service.js';

type Message = Database['public']['Tables']['messages']['Row'];
type Memory = Database['public']['Tables']['memories']['Row'];

export class ConversationService {
  private memoryService: MemoryService;

  constructor(private readonly ctx: ServiceContext) {
    this.memoryService = new MemoryService(ctx);
  }

  async sendMessage(
    conversationId: string,
    workspaceId: string,
    senderId: string,
    content: string,
  ): Promise<{ message: Message; memory: Memory }> {
    const memory = await this.memoryService.capture({
      text: content,
      userId: senderId,
      workspaceId,
      visibility: 'shared',
    });

    const { data: message, error } = await this.ctx.supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        workspace_id: workspaceId,
        sender_id: senderId,
        content,
        memory_id: memory.id,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to send message: ${error.message}`);

    await this.ctx.eventBus.publish({
      type: EVENT_TYPES.MESSAGE_SENT,
      aggregateType: 'message',
      aggregateId: message.id,
      userId: senderId,
      payload: { messageId: message.id, conversationId, workspaceId, memoryId: memory.id },
    });

    return { message, memory };
  }

  async askQuestion(
    workspaceId: string,
    userId: string,
    question: string,
  ): Promise<{ answer: string; confidence: number; escalated: boolean }> {
    const { data: messages } = await this.ctx.supabase
      .from('messages')
      .select('content, sender_id')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(20);

    const context = (messages ?? []).map((m) => m.content).join('\n');

    const result = await this.ctx.ai.chat({
      messages: [
        {
          role: 'system',
          content: `Answer based on workspace conversation and shared memory. Respond with JSON:
{"answer": "<your answer>", "confidence": <0.0-1.0>, "needs_human": <true|false>}`,
        },
        {
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${question}`,
        },
      ],
      jsonMode: true,
      temperature: 0.2,
    });

    let parsed = { answer: result.content, confidence: 0.5, needs_human: true };
    try {
      parsed = JSON.parse(result.content) as typeof parsed;
    } catch {
      // use defaults
    }

    if (parsed.needs_human || parsed.confidence < 0.7) {
      const { data: members } = await this.ctx.supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', workspaceId)
        .neq('user_id', userId)
        .limit(1);

      if (members?.[0]) {
        await this.ctx.eventBus.publish({
          type: EVENT_TYPES.QUESTION_ESCALATED,
          aggregateType: 'workspace',
          aggregateId: workspaceId,
          userId,
          payload: { question, targetUserId: members[0].user_id },
        });
      }

      return { answer: parsed.answer, confidence: parsed.confidence, escalated: true };
    }

    await this.ctx.eventBus.publish({
      type: EVENT_TYPES.QUESTION_RESOLVED,
      aggregateType: 'workspace',
      aggregateId: workspaceId,
      userId,
      payload: { question, answer: parsed.answer, confidence: parsed.confidence },
    });

    return { answer: parsed.answer, confidence: parsed.confidence, escalated: false };
  }
}
