import { useState } from 'react';
import { AlertCircle, Brain, CheckCircle2, Loader2, Search } from 'lucide-react';
import { apiJson } from '@/shared/lib/api';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/utils';

interface WorkspaceSource {
  id: string;
  userId: string;
  originalText: string;
  summary: string | null;
  intentSlug: string | null;
  combinedScore: number;
}

interface WorkspaceAskResult {
  answer: string;
  confidence: number;
  escalated: boolean;
  sources: WorkspaceSource[];
  relatedTaskTitle?: string;
}

interface WorkspaceAskProps {
  workspaceId: string;
}

export function WorkspaceAsk({ workspaceId }: WorkspaceAskProps) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<WorkspaceAskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<WorkspaceAskResult>(`/workspaces/${workspaceId}/ask`, {
        method: 'POST',
        body: JSON.stringify({ query: query.trim() }),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get answer');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Ask this workspace
          </CardTitle>
          <CardDescription>
            AI searches all shared memories. If the answer is unclear, the task owner or memory
            author is emailed automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAsk} className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="e.g. What background color did they want?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" className="w-full sm:w-auto shrink-0" disabled={loading || !query.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Ask
            </Button>
          </form>
        </CardContent>
      </Card>

      {error ? (
        <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          {error}
        </p>
      ) : null}

      {result ? (
        <>
          <Card
            className={cn(
              result.escalated ? 'border-amber-500/30 bg-amber-500/5' : 'border-primary/20 bg-primary/5',
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {result.escalated ? (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                )}
                {result.escalated ? 'Answer (teammate notified)' : 'Answer'}
              </CardTitle>
              <CardDescription className="text-xs">
                Confidence: {Math.round(result.confidence * 100)}%
                {result.relatedTaskTitle ? ` · Related task: ${result.relatedTaskTitle}` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.answer}</p>
            </CardContent>
          </Card>

          {result.sources.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 px-1">
                Sources from shared memories
              </p>
              <div className="space-y-2">
                {result.sources.map((source, i) => (
                  <Card key={source.id}>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground mb-1">
                        [{i + 1}] {source.intentSlug ?? 'memory'}
                      </p>
                      <p className="text-sm">{source.originalText}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
