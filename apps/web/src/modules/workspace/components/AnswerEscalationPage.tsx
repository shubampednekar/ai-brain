import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Brain, CheckCircle2, Loader2, RefreshCw, Send, Sparkles } from 'lucide-react';
import { apiJson } from '@/shared/lib/api';
import { apiUrl, supabase } from '@/shared/lib/supabase';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';

interface EscalationDetail {
  id: string;
  workspaceId: string;
  workspaceName: string;
  askerName: string;
  question: string;
  aiAnswer: string | null;
  confidence: number | null;
  status: 'open' | 'resolved';
}

export function AnswerEscalationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const escalationId = searchParams.get('escalation');

  const [escalation, setEscalation] = useState<EscalationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hasAiDraft, setHasAiDraft] = useState(false);

  useEffect(() => {
    if (!escalationId) {
      setError('Missing escalation link');
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const { escalation: data } = await apiJson<{ escalation: EscalationDetail }>(
          `/escalations/${escalationId}`,
        );
        setEscalation(data);
        if (data.status === 'open') {
          const fallback = `Clarification for: "${data.question}"\n\n`;
          setHasAiDraft(Boolean(data.aiAnswer));
          setAnswer(data.aiAnswer ?? fallback);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load question');
      } finally {
        setLoading(false);
      }
    })();
  }, [escalationId]);

  const handleRegenerateDraft = async () => {
    if (!escalationId || regenerating) return;

    setRegenerating(true);
    setError(null);
    try {
      const { escalation: data } = await apiJson<{ escalation: EscalationDetail }>(
        `/escalations/${escalationId}/regenerate-draft`,
        { method: 'POST' },
      );
      setEscalation(data);
      setHasAiDraft(Boolean(data.aiAnswer));
      if (data.aiAnswer) setAnswer(data.aiAnswer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate draft');
    } finally {
      setRegenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || !escalationId || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${apiUrl}/capture-memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ text: answer.trim(), escalationId }),
      });

      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? 'Failed to submit answer');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-2 px-4">
          <Brain className="h-6 w-6 text-primary" />
          <span className="font-semibold">AI Brain</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {error && !escalation ? (
          <Card className="border-destructive/30">
            <CardContent className="pt-6 text-destructive text-sm">{error}</CardContent>
          </Card>
        ) : submitted || escalation?.status === 'resolved' ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-primary mb-4" />
              <h2 className="text-lg font-semibold">Answer submitted</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                {escalation?.askerName ?? 'Your teammate'} will be notified by email. The shared memory
                is now available for workspace Ask.
              </p>
              <Button type="button" className="mt-6" onClick={() => navigate('/')}>
                Go to dashboard
              </Button>
            </CardContent>
          </Card>
        ) : escalation ? (
          <Card>
            <CardHeader>
              <CardTitle>Answer a teammate&apos;s question</CardTitle>
              <CardDescription>
                Workspace: {escalation.workspaceName} · Asked by {escalation.askerName}
                {escalation.confidence != null ? (
                  <> · AI confidence {Math.round(escalation.confidence * 100)}%</>
                ) : null}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4 text-sm">
                <p className="font-medium mb-1 text-muted-foreground">Teammate&apos;s Question</p>
                <p className="text-base font-semibold text-foreground">{escalation.question}</p>
              </div>

              {hasAiDraft ? (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-primary font-medium">
                      <Sparkles className="h-4 w-4 text-indigo-500" />
                      <span>AI Co-Pilot Draft Response</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleRegenerateDraft()}
                      disabled={regenerating}
                    >
                      {regenerating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Regenerate
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Based on your workspace notes and memories, the AI prepared a draft below. Edit it before submitting as a shared memory.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm">
                  <p className="text-xs text-muted-foreground">
                    No personalized AI draft was available. A starter template is pre-filled — edit it or use Regenerate to try again.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => void handleRegenerateDraft()}
                    disabled={regenerating}
                  >
                    {regenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Generate draft
                  </Button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="min-h-[140px]"
                  placeholder="Write your clarification as a shared memory..."
                  disabled={submitting}
                />
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button type="submit" disabled={!answer.trim() || submitting}>
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Submit shared memory
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
