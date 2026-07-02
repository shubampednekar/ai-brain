import { EVENT_TYPES } from '../../../events/index.js';
import type { ServiceContext } from '../../../shared/types.js';
import { MemoryRepository } from '../../memory/repositories/memory.repository.js';

export type DuplicateClassification = 'duplicate' | 'updated_memory' | 'new_memory';

const CLASSIFY_PROMPT = `Compare these two memory texts and classify their relationship.
Respond with JSON only:
{
  "classification": "duplicate" | "updated_memory" | "new_memory",
  "confidence": <0.0-1.0>,
  "reason": "<brief explanation>"
}

- duplicate: Same information, no meaningful change
- updated_memory: Same topic but with new/updated information
- new_memory: Different topics or unrelated`;

export class DuplicateDetectionService {
  private memoryRepo: MemoryRepository;

  constructor(private readonly ctx: ServiceContext) {
    this.memoryRepo = new MemoryRepository(ctx.supabase);
  }

  async detect(memoryId: string, text: string, userId: string): Promise<void> {
    const memory = await this.memoryRepo.findById(memoryId);
    if (!memory?.embedding) return;

    const { data: similar, error } = await this.ctx.supabase.rpc('find_similar_memories', {
      p_user_id: userId,
      p_embedding: memory.embedding,
      p_threshold: 0.75,
      p_limit: 3,
    });

    if (error || !similar?.length) return;

    const candidates = similar.filter((s) => s.id !== memoryId);
    if (!candidates.length) return;

    const topMatch = candidates[0];
    if (!topMatch) return;

    const result = await this.ctx.ai.chat({
      messages: [
        { role: 'system', content: CLASSIFY_PROMPT },
        {
          role: 'user',
          content: `New: "${text}"\n\nExisting: "${topMatch.original_text}"`,
        },
      ],
      jsonMode: true,
      temperature: 0.1,
    });

    let classification: DuplicateClassification = 'new_memory';
    try {
      const parsed = JSON.parse(result.content) as { classification: DuplicateClassification };
      classification = parsed.classification ?? 'new_memory';
    } catch {
      // keep default
    }

    await this.memoryRepo.update(memoryId, { duplicate_classification: classification });

    if (classification === 'updated_memory' && topMatch.id) {
      await this.ctx.supabase.from('memory_relationships').upsert({
        source_memory_id: memoryId,
        target_memory_id: topMatch.id,
        relationship_type: 'updated_from',
        confidence: topMatch.similarity,
      });
    }

    if (classification === 'duplicate' && topMatch.id) {
      await this.memoryRepo.update(memoryId, { is_active: false });
      await this.ctx.supabase.from('memory_relationships').upsert({
        source_memory_id: memoryId,
        target_memory_id: topMatch.id,
        relationship_type: 'duplicate_of',
        confidence: topMatch.similarity,
      });
    }

    await this.ctx.eventBus.publish({
      type: EVENT_TYPES.DUPLICATE_DETECTED,
      aggregateType: 'memory',
      aggregateId: memoryId,
      userId,
      payload: {
        memoryId,
        classification,
        matchedMemoryId: topMatch.id,
        similarity: topMatch.similarity,
      },
    });
  }
}
