import type { Database } from '@ai-brain/database';

export type Memory = Database['public']['Tables']['memories']['Row'];
export type MemoryInsert = Database['public']['Tables']['memories']['Insert'];
export type MemoryVersion = Database['public']['Tables']['memory_versions']['Row'];

export interface CreateMemoryInput {
  text: string;
  userId: string;
  workspaceId?: string;
  visibility?: 'private' | 'shared';
}

export interface MemoryWithRelations extends Omit<Memory, 'metadata'> {
  entities?: Database['public']['Tables']['memory_entities']['Row'][];
  extractedMetadata?: Database['public']['Tables']['memory_metadata']['Row'];
  relationships?: Database['public']['Tables']['memory_relationships']['Row'][];
}

export interface IntentClassification {
  intent: string;
  confidence: number;
  summary: string;
  entities?: {
    people?: string[];
    dates?: string[];
    locations?: string[];
    topics?: string[];
  };
}
