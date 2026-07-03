import { ExternalLink, Heart, Lightbulb, Loader2, Mail, Sparkles } from 'lucide-react';
import { usePreferences } from '../hooks/usePreferences';
import { PageLayout } from '@/shared/components/layout/PageLayout';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { INTENT_COLORS } from '@/modules/memory/constants';
import { formatDistanceToNow } from '@/modules/memory/utils/date';

export function PreferencesPanel() {
  const {
    memories,
    settings,
    latestDigest,
    loading,
    researching,
    error,
    updateSettings,
    runResearch,
  } = usePreferences();

  return (
    <PageLayout
      title="Preferences"
      description="Your likes and interests. Enable the daily digest to get news and deals via email."
      sidebarTitle="Daily digest"
      sidebar={
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email updates
            </CardTitle>
            <CardDescription className="text-xs">
              Once a day, AI researches your preferences and emails you the latest news.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Daily digest</span>
              <input
                type="checkbox"
                checked={settings.digestEnabled}
                onChange={(e) => void updateSettings({ digestEnabled: e.target.checked })}
                className="h-4 w-4 accent-primary"
              />
            </label>
            {settings.digestEnabled ? (
              <label className="block text-xs text-muted-foreground">
                Send at hour (local time):
                <select
                  value={settings.digestHour}
                  onChange={(e) => void updateSettings({ digestHour: Number(e.target.value) })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {h.toString().padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={researching || memories.length === 0}
              onClick={() => void runResearch()}
            >
              {researching ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Research now
            </Button>
          </CardContent>
        </Card>
      }
    >
      {error ? (
        <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 mb-4">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {latestDigest && latestDigest.researchResults.some((r) => r.updates.length > 0) ? (
            <section>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 px-1">
                Latest digest ({latestDigest.runDate})
              </p>
              <div className="space-y-3">
                {latestDigest.researchResults
                  .filter((r) => r.updates.length > 0)
                  .map((result) => (
                    <Card key={result.memoryId}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{result.preference}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {result.updates.map((update) => (
                          <div key={update.link} className="text-sm">
                            <a
                              href={update.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                            >
                              {update.title}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <p className="text-xs text-muted-foreground mt-1">{update.summary}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </section>
          ) : null}

          <section>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 px-1">
              Your preferences ({memories.length})
            </p>
            {memories.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Heart className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <h3 className="font-medium">No preferences yet</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                    Capture something like &ldquo;I like PS4&rdquo; or &ldquo;I prefer Italian food&rdquo;.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {memories.map((memory) => (
                  <Card key={memory.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <p className="text-sm leading-relaxed">{memory.originalText}</p>
                          {memory.summary && memory.summary !== memory.originalText ? (
                            <p className="text-xs text-muted-foreground">{memory.summary}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              INTENT_COLORS.preference ?? 'bg-muted text-muted-foreground'
                            }`}
                          >
                            preference
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(memory.createdAt)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>Preferences are auto-detected when you express likes or interests.</p>
              <p>Enable daily digest to receive Serper-powered news and deals by email.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </PageLayout>
  );
}
