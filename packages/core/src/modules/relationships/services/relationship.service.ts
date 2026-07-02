import { EVENT_TYPES } from '../../../events/index.js';
import type { ServiceContext } from '../../../shared/types.js';

export class RelationshipService {
  constructor(private readonly ctx: ServiceContext) {}

  async buildForMemory(memoryId: string, userId: string): Promise<void> {
    const { data: entities } = await this.ctx.supabase
      .from('memory_entities')
      .select('*')
      .eq('memory_id', memoryId);

    if (!entities?.length) return;

    for (const entity of entities) {
      const { data: relatedEntities } = await this.ctx.supabase
        .from('memory_entities')
        .select('memory_id, entity_type, entity_value')
        .eq('entity_type', entity.entity_type)
        .eq('normalized_value', entity.normalized_value ?? entity.entity_value)
        .neq('memory_id', memoryId);

      for (const related of relatedEntities ?? []) {
        const relationshipType =
          entity.entity_type === 'person'
            ? 'same_person'
            : entity.entity_type === 'topic'
              ? 'same_topic'
              : entity.entity_type === 'project'
                ? 'same_project'
                : 'related_to';

        await this.ctx.supabase.from('memory_relationships').upsert({
          source_memory_id: memoryId,
          target_memory_id: related.memory_id,
          relationship_type: relationshipType,
          confidence: 0.7,
        });

        await this.ctx.eventBus.publish({
          type: EVENT_TYPES.RELATIONSHIP_CREATED,
          aggregateType: 'memory',
          aggregateId: memoryId,
          userId,
          payload: {
            sourceMemoryId: memoryId,
            targetMemoryId: related.memory_id,
            relationshipType,
            entity: entity.entity_value,
          },
        });
      }
    }
  }
}
