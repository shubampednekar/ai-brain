import { z } from 'zod';

export const AppConfigSchema = z.object({
  supabaseUrl: z.string().url(),
  supabaseAnonKey: z.string().min(1),
  supabaseServiceRoleKey: z.string().min(1).optional(),
  openaiApiKey: z.string().optional(),
  groqApiKey: z.string().optional(),
  aiProvider: z.enum(['openai', 'groq']).default('openai'),
  embeddingProvider: z.enum(['openai']).default('openai'),
  smtpHost: z.string().default('smtp.gmail.com'),
  smtpPort: z.coerce.number().default(587),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFrom: z.string().optional(),
  workerSecret: z.string().optional(),
  cronSecret: z.string().optional(),
  featureFlags: z.array(z.string()).default([]),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  return AppConfigSchema.parse({
    supabaseUrl: env.SUPABASE_URL ?? env.VITE_SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    openaiApiKey: env.OPENAI_API_KEY,
    groqApiKey: env.GROQ_API_KEY,
    aiProvider: env.AI_PROVIDER ?? 'openai',
    embeddingProvider: env.EMBEDDING_PROVIDER ?? 'openai',
    smtpHost: env.SMTP_HOST,
    smtpPort: env.SMTP_PORT,
    smtpUser: env.SMTP_USER,
    smtpPass: env.SMTP_PASS,
    smtpFrom: env.SMTP_FROM,
    workerSecret: env.WORKER_SECRET,
    cronSecret: env.CRON_SECRET,
    featureFlags: env.FEATURE_FLAGS?.split(',').map((f) => f.trim()).filter(Boolean) ?? [],
  });
}

export function isFeatureEnabled(config: AppConfig, flag: string): boolean {
  return config.featureFlags.includes(flag);
}
