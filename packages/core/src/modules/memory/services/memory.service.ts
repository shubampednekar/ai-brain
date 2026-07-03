import { EVENT_TYPES } from '../../../events/index.js';
import type { ServiceContext } from '../../../shared/types.js';
import { generateIdempotencyKey } from '../../../shared/types.js';
import { MemoryRepository } from '../repositories/memory.repository.js';
import type { CreateMemoryInput, Memory, IntentClassification } from '../types.js';
import { IntentClassifier } from '../../ai/services/intent-classifier.service.js';
import { JobService } from '../../jobs/services/job.service.js';

export class MemoryService {
  private memoryRepo: MemoryRepository;
  private intentClassifier: IntentClassifier;
  private jobService: JobService;

  constructor(private readonly ctx: ServiceContext) {
    this.memoryRepo = new MemoryRepository(ctx.supabase);
    this.intentClassifier = new IntentClassifier(ctx);
    this.jobService = new JobService(ctx);
  }

  async capture(input: CreateMemoryInput): Promise<Memory> {
    let workspaceId = input.workspaceId;
    const escalationId = input.escalationId;

    if (escalationId) {
      const { EscalationService } = await import('../../escalation/services/escalation.service.js');
      const escalations = new EscalationService(this.ctx);
      const escalation = await escalations.getById(escalationId, input.userId);
      workspaceId = escalation.workspaceId;
    }

    const classification = await this.intentClassifier.classify(input.text);

    const memory = await this.memoryRepo.create({
      user_id: input.userId,
      workspace_id: workspaceId,
      visibility: workspaceId ? 'shared' : (input.visibility ?? 'private'),
      original_text: input.text,
      summary: classification.summary,
      intent_slug: classification.intent,
      intent_confidence: classification.confidence,
    });

    await this.ctx.eventBus.publish({
      type: EVENT_TYPES.MEMORY_CREATED,
      aggregateType: 'memory',
      aggregateId: memory.id,
      userId: input.userId,
      payload: {
        memoryId: memory.id,
        text: input.text,
        intent: classification.intent,
        confidence: classification.confidence,
        summary: classification.summary,
        workspaceId,
      },
      idempotencyKey: generateIdempotencyKey('memory.created', memory.id),
    });

    if (escalationId) {
      const { EscalationService } = await import('../../escalation/services/escalation.service.js');
      const escalations = new EscalationService(this.ctx);
      await escalations.resolve(escalationId, input.userId, memory.id, input.text);
    }

    await this.jobService.enqueue('embedding.generate', {
      memoryId: memory.id,
      text: input.text,
      userId: input.userId,
    });

    await this.jobService.enqueue('metadata.extract', {
      memoryId: memory.id,
      text: input.text,
      classification,
      userId: input.userId,
    });

    // duplicate.detect is enqueued after embedding.generate completes

    if (classification.intent === 'reminder') {
      await this.jobService.enqueue('reminder.detect', {
        memoryId: memory.id,
        text: input.text,
        userId: input.userId,
        classification,
      });
    }

    if (classification.intent === 'task') {
      await this.jobService.enqueue('task.extract', {
        memoryId: memory.id,
        text: input.text,
        userId: input.userId,
        workspaceId,
      });
    }

    if (classification.intent === 'decision') {
      await this.jobService.enqueue('decision.record', {
        memoryId: memory.id,
        text: input.text,
        userId: input.userId,
        workspaceId,
      });
    }

    if (classification.intent === 'approval') {
      await this.jobService.enqueue('approval.record', {
        memoryId: memory.id,
        text: input.text,
        userId: input.userId,
        workspaceId,
      });
    }

    if (classification.intent === 'shopping') {
      await this.jobService.enqueue('shopping.extract', {
        memoryId: memory.id,
        text: input.text,
        userId: input.userId,
      });
    }

    return memory;
  }

  async getById(id: string): Promise<Memory | null> {
    return this.memoryRepo.findById(id);
  }

  async listByUser(userId: string, limit = 20, offset = 0): Promise<Memory[]> {
    return this.memoryRepo.findByUserId(userId, { limit, offset });
  }

  async listByWorkspace(workspaceId: string, limit = 20, offset = 0): Promise<Memory[]> {
    return this.memoryRepo.findByWorkspaceId(workspaceId, { limit, offset });
  }
}
