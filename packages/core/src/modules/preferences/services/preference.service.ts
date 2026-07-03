import type { ServiceContext } from '../../../shared/types.js';
import type { Json } from '@ai-brain/database';

export interface PreferenceMemory {
  id: string;
  originalText: string;
  summary: string | null;
  createdAt: string;
}

export interface PreferenceSettings {
  digestEnabled: boolean;
  digestHour: number;
}

export interface DigestResearchItem {
  preference: string;
  memoryId: string;
  updates: Array<{ title: string; link: string; summary: string }>;
}

export interface PreferenceDigestRun {
  id: string;
  runDate: string;
  researchResults: DigestResearchItem[];
  emailSentAt: string | null;
  createdAt: string;
}

function parseProfilePreferences(raw: Json): PreferenceSettings {
  const prefs = (typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    digestEnabled: Boolean(prefs.digest_enabled),
    digestHour: typeof prefs.digest_hour === 'number' ? prefs.digest_hour : 8,
  };
}

export class PreferenceService {
  constructor(private readonly ctx: ServiceContext) {}

  async listMemories(userId: string): Promise<PreferenceMemory[]> {
    const { data, error } = await this.ctx.supabase
      .from('memories')
      .select('id, original_text, summary, created_at')
      .eq('user_id', userId)
      .eq('intent_slug', 'preference')
      .eq('is_active', true)
      .is('workspace_id', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw new Error(`Failed to list preferences: ${error.message}`);

    return (data ?? []).map((row) => ({
      id: row.id,
      originalText: row.original_text,
      summary: row.summary,
      createdAt: row.created_at,
    }));
  }

  async getSettings(userId: string): Promise<PreferenceSettings> {
    const { data, error } = await this.ctx.supabase
      .from('profiles')
      .select('preferences')
      .eq('id', userId)
      .single();

    if (error) throw new Error(`Failed to load preference settings: ${error.message}`);
    return parseProfilePreferences(data.preferences);
  }

  async updateSettings(userId: string, settings: Partial<PreferenceSettings>): Promise<PreferenceSettings> {
    const { data: profile, error: fetchError } = await this.ctx.supabase
      .from('profiles')
      .select('preferences')
      .eq('id', userId)
      .single();

    if (fetchError) throw new Error(`Failed to load preference settings: ${fetchError.message}`);

    const current = parseProfilePreferences(profile.preferences);
    const next: PreferenceSettings = {
      digestEnabled: settings.digestEnabled ?? current.digestEnabled,
      digestHour: settings.digestHour ?? current.digestHour,
    };

    const existingPrefs =
      typeof profile.preferences === 'object' && profile.preferences !== null && !Array.isArray(profile.preferences)
        ? (profile.preferences as Record<string, unknown>)
        : {};

    const { error } = await this.ctx.supabase
      .from('profiles')
      .update({
        preferences: {
          ...existingPrefs,
          digest_enabled: next.digestEnabled,
          digest_hour: next.digestHour,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) throw new Error(`Failed to update preference settings: ${error.message}`);
    return next;
  }

  async getLatestDigest(userId: string): Promise<PreferenceDigestRun | null> {
    const { data, error } = await this.ctx.supabase
      .from('preference_digest_runs')
      .select('id, run_date, research_results, email_sent_at, created_at')
      .eq('user_id', userId)
      .order('run_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Failed to load latest digest: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      runDate: data.run_date,
      researchResults: (data.research_results ?? []) as unknown as DigestResearchItem[],
      emailSentAt: data.email_sent_at,
      createdAt: data.created_at,
    };
  }
}
