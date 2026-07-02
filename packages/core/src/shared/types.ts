import type { TypedSupabaseClient } from '@ai-brain/database';
import type { EventBus } from '../events/index.js';
import type { AIProvider, EmbeddingProvider } from './ai/types.js';
import type { AppConfig } from './config/index.js';

export interface ServiceContext {
  supabase: TypedSupabaseClient;
  eventBus: EventBus;
  ai: AIProvider;
  embeddings: EmbeddingProvider;
  config: AppConfig;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  cursor?: string;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  cursor?: string;
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function generateIdempotencyKey(...parts: string[]): string {
  return parts.join(':');
}
