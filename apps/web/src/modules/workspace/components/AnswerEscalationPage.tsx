import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Brain, CheckCircle2, Loader2, Send } from 'lucide-react';
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
  const [submitted, setSubmitted] = useState(false);

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
          setAnswer(`Clarification for: "${data.question}"\n\n`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load question');
      } finally {
        setLoading(false);
      }
    })();
  }, [escalationId]);

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
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4 text-sm">
                <p className="font-medium mb-1">Question</p>
                <p>{escalation.question}</p>
                {escalation.aiAnswer ? (
                  <p className="text-muted-foreground mt-3 text-xs">
                    AI tried ({escalation.confidence != null ? `${Math.round(escalation.confidence * 100)}%` : 'low'} confidence):{' '}
                    {escalation.aiAnswer}
                  </p>
                ) : null}
              </div>

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
