import { createServiceClient } from '@ai-brain/database';
import { PersistentEventBus, SupabaseEventStore } from './events/index.js';
import { createAIProvider, createEmbeddingProvider } from './shared/ai/index.js';
import { loadConfig } from './shared/config/index.js';
import type { ServiceContext } from './shared/types.js';
import { MemoryService } from './modules/memory/index.js';
import { SearchService } from './modules/search/index.js';
import { SharedMemoryService } from './modules/shared-memory/index.js';
import { ConversationService } from './modules/conversation/index.js';
import { WorkspaceAskService } from './modules/workspace-ask/index.js';
import { EscalationService } from './modules/escalation/index.js';
import { ActivityService } from './modules/activity/index.js';
import { TaskService } from './modules/tasks/index.js';
import { ReminderService } from './modules/reminder/index.js';
import { JobProcessor } from './modules/jobs/services/job-processor.service.js';
import { JobService } from './modules/jobs/index.js';
import { ShoppingService } from './modules/shopping/index.js';
import { PreferenceService } from './modules/preferences/index.js';
import { DigestService } from './modules/digest/index.js';

export class AppContainer {
  readonly ctx: ServiceContext;
  readonly memory: MemoryService;
  readonly search: SearchService;
  readonly sharedMemory: SharedMemoryService;
  readonly conversation: ConversationService;
  readonly workspaceAsk: WorkspaceAskService;
  readonly escalations: EscalationService;
  readonly activity: ActivityService;
  readonly tasks: TaskService;
  readonly reminders: ReminderService;
  readonly shopping: ShoppingService;
  readonly preferences: PreferenceService;
  readonly digest: DigestService;
  readonly jobs: JobService;
  readonly jobProcessor: JobProcessor;

  constructor(env: Record<string, string | undefined> = process.env) {
    const config = loadConfig(env);

    const supabase = createServiceClient(
      config.supabaseUrl,
      config.supabaseServiceRoleKey ?? config.supabaseAnonKey,
    );

    const eventStore = new SupabaseEventStore(supabase);
    const eventBus = new PersistentEventBus(eventStore);

    this.ctx = {
      supabase,
      eventBus,
      ai: createAIProvider(config.aiProvider, config.openaiApiKey, config.groqApiKey),
      embeddings: createEmbeddingProvider(config.embeddingProvider, config.openaiApiKey),
      config,
    };

    this.memory = new MemoryService(this.ctx);
    this.search = new SearchService(this.ctx);
    this.sharedMemory = new SharedMemoryService(this.ctx);
    this.conversation = new ConversationService(this.ctx);
    this.workspaceAsk = new WorkspaceAskService(this.ctx);
    this.escalations = new EscalationService(this.ctx);
    this.activity = new ActivityService(this.ctx);
    this.tasks = new TaskService(this.ctx);
    this.reminders = new ReminderService(this.ctx);
    this.shopping = new ShoppingService(this.ctx);
    this.preferences = new PreferenceService(this.ctx);
    this.digest = new DigestService(this.ctx);
    this.jobs = new JobService(this.ctx);
    this.jobProcessor = new JobProcessor(this.ctx);
  }
}

export function createContainer(env?: Record<string, string | undefined>): AppContainer {
  return new AppContainer(env);
}
