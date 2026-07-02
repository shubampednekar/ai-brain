import type { ServiceContext } from '../../../shared/types.js';
import { generateIdempotencyKey } from '../../../shared/types.js';
import { JobRepository, type Job, type JobPayload } from '../repositories/job.repository.js';

export class JobService {
  private repo: JobRepository;

  constructor(private readonly ctx: ServiceContext) {
    this.repo = new JobRepository(ctx.supabase);
  }

  async enqueue(
    jobType: string,
    payload: JobPayload,
    options?: { idempotencyKey?: string; scheduledAt?: Date },
  ): Promise<Job> {
    const idempotencyKey =
      options?.idempotencyKey ?? generateIdempotencyKey(jobType, JSON.stringify(payload));

    return this.repo.enqueue(jobType, payload, {
      idempotencyKey,
      scheduledAt: options?.scheduledAt,
    });
  }

  async claimNext(batchSize = 10): Promise<Job[]> {
    return this.repo.claimNext(batchSize);
  }

  async complete(id: string, result?: JobPayload): Promise<void> {
    return this.repo.complete(id, result);
  }

  async fail(id: string, error: string, attempts: number, maxAttempts: number): Promise<void> {
    return this.repo.fail(id, error, attempts, maxAttempts);
  }
}
