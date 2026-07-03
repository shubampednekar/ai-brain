import type { ServiceContext } from '../../../shared/types.js';

export class JobProcessor {
  constructor(private readonly ctx: ServiceContext) {}

  async processJob(job: {
    id: string;
    job_type: string;
    payload: Record<string, unknown>;
    attempts: number;
    max_attempts: number;
  }): Promise<void> {
    const { EmbeddingService } = await import('../../embeddings/services/embedding.service.js');
    const { MetadataService } = await import('../../metadata/services/metadata.service.js');
    const { DuplicateDetectionService } = await import(
      '../../duplicate-detection/services/duplicate-detection.service.js'
    );
    const { RelationshipService } = await import(
      '../../relationships/services/relationship.service.js'
    );
    const { ReminderService } = await import('../../reminder/services/reminder.service.js');
    const { TaskService } = await import('../../tasks/services/task.service.js');
    const { DecisionService } = await import('../../decisions/services/decision.service.js');
    const { ApprovalService } = await import('../../approvals/services/approval.service.js');
    const { JobService } = await import('../services/job.service.js');

    const jobService = new JobService(this.ctx);

    try {
      switch (job.job_type) {
        case 'embedding.generate': {
          const svc = new EmbeddingService(this.ctx);
          await svc.generate(
            job.payload.memoryId as string,
            job.payload.text as string,
            job.payload.userId as string,
          );
          break;
        }
        case 'metadata.extract': {
          const svc = new MetadataService(this.ctx);
          await svc.extract(
            job.payload.memoryId as string,
            job.payload.text as string,
            job.payload.userId as string,
            job.payload.classification as import('../../memory/types.js').IntentClassification | undefined,
          );
          await new RelationshipService(this.ctx).buildForMemory(
            job.payload.memoryId as string,
            job.payload.userId as string,
          );
          break;
        }
        case 'duplicate.detect': {
          const svc = new DuplicateDetectionService(this.ctx);
          await svc.detect(
            job.payload.memoryId as string,
            job.payload.text as string,
            job.payload.userId as string,
          );
          break;
        }
        case 'reminder.detect': {
          const svc = new ReminderService(this.ctx);
          await svc.detectFromMemory(
            job.payload.memoryId as string,
            job.payload.text as string,
            job.payload.userId as string,
          );
          break;
        }
        case 'task.extract': {
          const svc = new TaskService(this.ctx);
          await svc.extractFromMemory(
            job.payload.memoryId as string,
            job.payload.text as string,
            job.payload.userId as string,
            job.payload.workspaceId as string | undefined,
          );
          break;
        }
        case 'decision.record': {
          const svc = new DecisionService(this.ctx);
          await svc.recordFromMemory(
            job.payload.memoryId as string,
            job.payload.text as string,
            job.payload.userId as string,
            job.payload.workspaceId as string | undefined,
          );
          break;
        }
        case 'approval.record': {
          const svc = new ApprovalService(this.ctx);
          await svc.recordFromMemory(
            job.payload.memoryId as string,
            job.payload.text as string,
            job.payload.userId as string,
            job.payload.workspaceId as string | undefined,
          );
          break;
        }
        case 'shopping.extract': {
          const { ShoppingService } = await import('../../shopping/services/shopping.service.js');
          const svc = new ShoppingService(this.ctx);
          await svc.extractFromMemory(
            job.payload.memoryId as string,
            job.payload.text as string,
            job.payload.userId as string,
          );
          break;
        }
        case 'digest.daily': {
          const { DigestService } = await import('../../digest/services/digest.service.js');
          const svc = new DigestService(this.ctx);
          await svc.runDaily();
          break;
        }
        case 'reminder.send': {
          const svc = new ReminderService(this.ctx);
          const { NotificationService } = await import(
            '../../notifications/services/notification.service.js'
          );
          const notifications = new NotificationService(this.ctx);
          const reminders = await svc.getDueReminders();
          for (const reminder of reminders) {
            await notifications.sendReminderEmail(
              reminder.user_id,
              reminder.title,
              reminder.description ?? undefined,
            );
            await svc.markSent(reminder.id);
          }
          break;
        }
        default:
          throw new Error(`Unknown job type: ${job.job_type}`);
      }

      await jobService.complete(job.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await jobService.fail(job.id, message, job.attempts + 1, job.max_attempts);
      throw err;
    }
  }

  async processBatch(batchSize = 10): Promise<number> {
    const { JobService } = await import('../services/job.service.js');
    const jobService = new JobService(this.ctx);
    const jobs = await jobService.claimNext(batchSize);

    let processed = 0;
    for (const job of jobs) {
      try {
        await this.processJob({
          id: job.id,
          job_type: job.job_type,
          payload: job.payload as Record<string, unknown>,
          attempts: job.attempts,
          max_attempts: job.max_attempts,
        });
        processed++;
      } catch {
        // already marked failed in processJob
      }
    }

    return processed;
  }
}
