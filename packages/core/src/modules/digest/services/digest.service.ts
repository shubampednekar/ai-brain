import { EVENT_TYPES } from '../../../events/index.js';
import { isFeatureEnabled } from '../../../shared/config/index.js';
import type { ServiceContext } from '../../../shared/types.js';
import { NotificationService } from '../../notifications/services/notification.service.js';
import { ResearchAgentService } from '../../research-agent/services/research-agent.service.js';
import type { DigestResearchItem } from '../../preferences/services/preference.service.js';

const SUMMARIZE_PROMPT = `Summarize these web search results for a user's personal interest digest.
Respond with JSON only:
{
  "updates": [
    { "title": "<headline>", "link": "<url>", "summary": "<1-2 sentence summary>" }
  ]
}
Include at most 3 most relevant updates. Skip duplicates and generic SEO pages.`;

const MAX_PREFERENCES_PER_DIGEST = 5;

export class DigestService {
  private notifications: NotificationService;
  private research: ResearchAgentService;

  constructor(private readonly ctx: ServiceContext) {
    this.notifications = new NotificationService(ctx);
    this.research = new ResearchAgentService(ctx);
  }

  async runDaily(): Promise<{ usersProcessed: number; emailsSent: number }> {
    const globallyEnabled = await this.isFeatureFlagEnabled('daily_digest');
    if (!globallyEnabled && !isFeatureEnabled(this.ctx.config, 'daily_digest')) {
      return { usersProcessed: 0, emailsSent: 0 };
    }

    const { data: profiles, error } = await this.ctx.supabase
      .from('profiles')
      .select('id, email, timezone, preferences');

    if (error) throw new Error(`Failed to load profiles for digest: ${error.message}`);

    let usersProcessed = 0;
    let emailsSent = 0;

    for (const profile of profiles ?? []) {
      const prefs = profile.preferences as Record<string, unknown> | null;
      if (!prefs?.digest_enabled) continue;

      const digestHour = typeof prefs.digest_hour === 'number' ? prefs.digest_hour : 8;
      if (!this.isDigestHourForTimezone(profile.timezone, digestHour)) continue;

      const sent = await this.runForUser(profile.id, profile.email);
      usersProcessed++;
      if (sent) emailsSent++;
    }

    return { usersProcessed, emailsSent };
  }

  async runForUser(userId: string, email?: string, options?: { force?: boolean }): Promise<boolean> {
    const today = new Date().toISOString().slice(0, 10);

    if (!options?.force) {
      const { data: existing } = await this.ctx.supabase
        .from('preference_digest_runs')
        .select('id')
        .eq('user_id', userId)
        .eq('run_date', today)
        .maybeSingle();

      if (existing) return false;
    } else {
      await this.ctx.supabase
        .from('preference_digest_runs')
        .delete()
        .eq('user_id', userId)
        .eq('run_date', today);
    }

    const { data: memories, error } = await this.ctx.supabase
      .from('memories')
      .select('id, original_text, summary')
      .eq('user_id', userId)
      .eq('intent_slug', 'preference')
      .eq('is_active', true)
      .is('workspace_id', null)
      .order('created_at', { ascending: false })
      .limit(MAX_PREFERENCES_PER_DIGEST);

    if (error) throw new Error(`Failed to load preference memories: ${error.message}`);
    if (!memories?.length) return false;

    const researchEnabled =
      (await this.isFeatureFlagEnabled('research_agent')) ||
      isFeatureEnabled(this.ctx.config, 'research_agent');

    const results: DigestResearchItem[] = [];

    for (const memory of memories) {
      const label = memory.summary ?? memory.original_text;
      let updates: DigestResearchItem['updates'] = [];

      if (researchEnabled && this.ctx.config.serperApiKey) {
        const query = this.research.buildSearchQuery(memory.original_text);
        const searchResults = await this.research.search(query, 5);

        if (searchResults.length > 0) {
          const summarizeResult = await this.ctx.ai.chat({
            messages: [
              { role: 'system', content: SUMMARIZE_PROMPT },
              {
                role: 'user',
                content: `Interest: ${label}\n\nSearch results:\n${searchResults
                  .map((r, i) => `${i + 1}. ${r.title}\n${r.link}\n${r.snippet}`)
                  .join('\n\n')}`,
              },
            ],
            jsonMode: true,
            temperature: 0.2,
          });

          try {
            const parsed = JSON.parse(summarizeResult.content) as {
              updates?: DigestResearchItem['updates'];
            };
            updates = parsed.updates ?? [];
          } catch {
            updates = searchResults.slice(0, 3).map((r) => ({
              title: r.title,
              link: r.link,
              summary: r.snippet,
            }));
          }
        }
      }

      results.push({
        preference: label,
        memoryId: memory.id,
        updates,
      });
    }

    const hasContent = results.some((r) => r.updates.length > 0);
    if (!hasContent) return false;

    let resolvedEmail = email;
    if (!resolvedEmail) {
      const { data: profile } = await this.ctx.supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();
      resolvedEmail = profile?.email;
    }

    const sentAt = new Date().toISOString();

    await this.ctx.supabase.from('preference_digest_runs').insert({
      user_id: userId,
      run_date: today,
      preferences_snapshot: memories.map((m) => ({
        id: m.id,
        text: m.original_text,
        summary: m.summary,
      })) as import('@ai-brain/database').Json,
      research_results: results as unknown as import('@ai-brain/database').Json,
      email_sent_at: resolvedEmail ? sentAt : null,
    });

    if (resolvedEmail) {
      await this.notifications.sendPreferenceDigestEmail(userId, resolvedEmail, results);
    }

    await this.ctx.eventBus.publish({
      type: EVENT_TYPES.DIGEST_SENT,
      aggregateType: 'digest',
      aggregateId: userId,
      userId,
      payload: { runDate: today, preferenceCount: results.length },
    });

    return Boolean(resolvedEmail);
  }

  private isDigestHourForTimezone(timezone: string, digestHour: number): boolean {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      });
      const hour = Number(formatter.format(new Date()));
      return hour === digestHour;
    } catch {
      const hour = new Date().getUTCHours();
      return hour === digestHour;
    }
  }

  private async isFeatureFlagEnabled(slug: string): Promise<boolean> {
    const { data } = await this.ctx.supabase
      .from('feature_flags')
      .select('is_enabled')
      .eq('slug', slug)
      .maybeSingle();
    return data?.is_enabled ?? false;
  }
}
