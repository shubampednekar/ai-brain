import { EVENT_TYPES } from '../../../events/index.js';
import type { ServiceContext } from '../../../shared/types.js';
import type { IntentClassification } from '../../memory/types.js';

const EXTRACTION_PROMPT = `Extract structured metadata from the following text. Respond with JSON only:
{
  "people": ["person names"],
  "organizations": ["org names"],
  "projects": ["project names"],
  "locations": ["places"],
  "dates": ["dates/times mentioned"],
  "topics": ["key topics"],
  "priority": "low|medium|high|urgent|null",
  "category": "general category",
  "custom_entities": {}
}`;

export class MetadataService {
  constructor(private readonly ctx: ServiceContext) {}

  async extract(
    memoryId: string,
    text: string,
    userId: string,
    classification?: IntentClassification,
  ): Promise<void> {
    const result = await this.ctx.ai.chat({
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: text },
      ],
      jsonMode: true,
      temperature: 0.1,
    });

    let metadata: Record<string, unknown>;
    try {
      metadata = JSON.parse(result.content) as Record<string, unknown>;
    } catch {
      metadata = {};
    }

    const { error } = await this.ctx.supabase.from('memory_metadata').upsert({
      memory_id: memoryId,
      people: (metadata.people ?? classification?.entities?.people ?? []) as import('@ai-brain/database').Json,
      organizations: (metadata.organizations ?? []) as import('@ai-brain/database').Json,
      projects: (metadata.projects ?? []) as import('@ai-brain/database').Json,
      locations: (metadata.locations ?? classification?.entities?.locations ?? []) as import('@ai-brain/database').Json,
      dates: (metadata.dates ?? classification?.entities?.dates ?? []) as import('@ai-brain/database').Json,
      topics: (metadata.topics ?? classification?.entities?.topics ?? []) as import('@ai-brain/database').Json,
      priority: (metadata.priority as string) ?? null,
      category: (metadata.category as string) ?? null,
      custom_entities: (metadata.custom_entities ?? {}) as import('@ai-brain/database').Json,
    });

    if (error) throw new Error(`Failed to save metadata: ${error.message}`);

    const entities = [
      ...(metadata.people as string[] ?? []).map((v) => ({ type: 'person', value: v })),
      ...(metadata.organizations as string[] ?? []).map((v) => ({ type: 'organization', value: v })),
      ...(metadata.projects as string[] ?? []).map((v) => ({ type: 'project', value: v })),
      ...(metadata.locations as string[] ?? []).map((v) => ({ type: 'location', value: v })),
      ...(metadata.topics as string[] ?? []).map((v) => ({ type: 'topic', value: v })),
    ];

    if (entities.length > 0) {
      await this.ctx.supabase.from('memory_entities').insert(
        entities.map((e) => ({
          memory_id: memoryId,
          entity_type: e.type,
          entity_value: e.value,
          normalized_value: e.value.toLowerCase(),
          confidence: 0.8,
        })),
      );
    }

    await this.ctx.eventBus.publish({
      type: EVENT_TYPES.METADATA_EXTRACTED,
      aggregateType: 'memory',
      aggregateId: memoryId,
      userId,
      payload: { memoryId, metadata },
    });
  }
}
