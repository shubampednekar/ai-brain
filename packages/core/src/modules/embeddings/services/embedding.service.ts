import { EVENT_TYPES } from '../../../events/index.js';
import type { ServiceContext } from '../../../shared/types.js';
import { MemoryRepository } from '../../memory/repositories/memory.repository.js';

export class EmbeddingService {
  private memoryRepo: MemoryRepository;

  constructor(private readonly ctx: ServiceContext) {
    this.memoryRepo = new MemoryRepository(ctx.supabase);
  }

  async generate(memoryId: string, text: string, userId: string): Promise<number[]> {
    const result = await this.ctx.embeddings.embed({ input: text });
    const embedding = result.embeddings[0];

    if (!embedding) throw new Error('No embedding generated');

    await this.memoryRepo.update(memoryId, { embedding });

    await this.ctx.eventBus.publish({
      type: EVENT_TYPES.EMBEDDING_GENERATED,
      aggregateType: 'memory',
      aggregateId: memoryId,
      userId,
      payload: { memoryId, dimensions: embedding.length },
    });

    const { JobService } = await import('../../jobs/services/job.service.js');
    const jobService = new JobService(this.ctx);
    await jobService.enqueue('duplicate.detect', {
      memoryId,
      text,
      userId,
    });

    return embedding;
  }
}
