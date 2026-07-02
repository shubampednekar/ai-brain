import type { TypedSupabaseClient } from '@ai-brain/database';
import type { Memory, MemoryInsert, MemoryVersion } from '../types.js';
import type { PaginationOptions } from '../../../shared/types.js';

export class MemoryRepository {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  async create(data: MemoryInsert): Promise<Memory> {
    const { data: memory, error } = await this.supabase
      .from('memories')
      .insert(data)
      .select()
      .single();

    if (error) throw new Error(`Failed to create memory: ${error.message}`);
    return memory;
  }

  async findById(id: string): Promise<Memory | null> {
    const { data, error } = await this.supabase
      .from('memories')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to find memory: ${error.message}`);
    }
    return data;
  }

  async findByUserId(
    userId: string,
    options: PaginationOptions = {},
  ): Promise<Memory[]> {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;

    const { data, error } = await this.supabase
      .from('memories')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to list memories: ${error.message}`);
    return data ?? [];
  }

  async update(id: string, data: Partial<MemoryInsert>): Promise<Memory> {
    const { data: memory, error } = await this.supabase
      .from('memories')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update memory: ${error.message}`);
    return memory;
  }

  async createVersion(data: {
    memoryId: string;
    version: number;
    originalText: string;
    summary?: string;
    intentSlug?: string;
    intentConfidence?: number;
    changedBy?: string;
    changeReason?: string;
  }): Promise<MemoryVersion> {
    const { data: version, error } = await this.supabase
      .from('memory_versions')
      .insert({
        memory_id: data.memoryId,
        version: data.version,
        original_text: data.originalText,
        summary: data.summary,
        intent_slug: data.intentSlug,
        intent_confidence: data.intentConfidence,
        changed_by: data.changedBy,
        change_reason: data.changeReason,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create memory version: ${error.message}`);
    return version;
  }

  async mergeMemory(
    existingId: string,
    newData: Partial<MemoryInsert>,
    userId: string,
  ): Promise<Memory> {
    const existing = await this.findById(existingId);
    if (!existing) throw new Error('Memory not found');

    await this.createVersion({
      memoryId: existingId,
      version: existing.version,
      originalText: existing.original_text,
      summary: existing.summary ?? undefined,
      intentSlug: existing.intent_slug ?? undefined,
      intentConfidence: existing.intent_confidence ?? undefined,
      changedBy: userId,
      changeReason: 'merged_update',
    });

    return this.update(existingId, {
      ...newData,
      version: existing.version + 1,
      parent_memory_id: existing.parent_memory_id ?? existingId,
    });
  }
}
