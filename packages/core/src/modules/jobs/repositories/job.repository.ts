import type { TypedSupabaseClient } from '@ai-brain/database';
import type { Database } from '@ai-brain/database';

export type Job = Database['public']['Tables']['jobs']['Row'];
export type JobStatus = Job['status'];

export type JobType =
  | 'embedding.generate'
  | 'metadata.extract'
  | 'duplicate.detect'
  | 'relationship.build'
  | 'reminder.detect'
  | 'reminder.send'
  | 'task.extract'
  | 'decision.record'
  | 'approval.record'
  | 'requirement.version'
  | 'question.resolve'
  | 'digest.daily'
  | 'digest.weekly'
  | 'project.summarize';

export interface JobPayload {
  [key: string]: unknown;
}

export class JobRepository {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  async enqueue(
    jobType: string,
    payload: JobPayload,
    options?: { idempotencyKey?: string; scheduledAt?: Date; maxAttempts?: number },
  ): Promise<Job> {
    const { data, error } = await this.supabase
      .from('jobs')
      .insert({
        job_type: jobType,
        payload: payload as import('@ai-brain/database').Json,
        idempotency_key: options?.idempotencyKey,
        scheduled_at: options?.scheduledAt?.toISOString() ?? new Date().toISOString(),
        max_attempts: options?.maxAttempts ?? 3,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505' && options?.idempotencyKey) {
        const existing = await this.findByIdempotencyKey(options.idempotencyKey);
        if (existing) return existing;
      }
      throw new Error(`Failed to enqueue job: ${error.message}`);
    }
    return data;
  }

  async findByIdempotencyKey(key: string): Promise<Job | null> {
    const { data } = await this.supabase
      .from('jobs')
      .select('*')
      .eq('idempotency_key', key)
      .single();
    return data;
  }

  async claimNext(batchSize = 10): Promise<Job[]> {
    const { data, error } = await this.supabase
      .from('jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(batchSize);

    if (error) throw new Error(`Failed to claim jobs: ${error.message}`);
    if (!data?.length) return [];

    const ids = data.map((j) => j.id);
    await this.supabase
      .from('jobs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .in('id', ids);

    return data;
  }

  async complete(id: string, result?: JobPayload): Promise<void> {
    const { error } = await this.supabase
      .from('jobs')
      .update({
        status: 'completed',
        result: (result ?? null) as import('@ai-brain/database').Json | null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw new Error(`Failed to complete job: ${error.message}`);
  }

  async fail(id: string, errorMessage: string, attempts: number, maxAttempts: number): Promise<void> {
    const shouldRetry = attempts < maxAttempts;
    const { error } = await this.supabase
      .from('jobs')
      .update({
        status: shouldRetry ? 'pending' : 'failed',
        error: errorMessage,
        attempts,
        scheduled_at: shouldRetry
          ? new Date(Date.now() + Math.pow(2, attempts) * 1000).toISOString()
          : undefined,
        started_at: null,
      })
      .eq('id', id);

    if (error) throw new Error(`Failed to update job: ${error.message}`);
  }
}
