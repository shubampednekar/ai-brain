import { Link } from 'react-router-dom';
import { HelpCircle, Loader2 } from 'lucide-react';
import { useOpenEscalations } from '../hooks/useOpenEscalations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { formatDistanceToNow } from '@/modules/memory/utils/date';

export function EscalationInbox({ workspaceId }: { workspaceId?: string } = {}) {
  const { escalations, loading, error } = useOpenEscalations();

  const filtered = workspaceId
    ? escalations.filter((e) => e.workspaceId === workspaceId)
    : escalations;

  if (loading) return null;
  if (error || filtered.length === 0) return null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5 mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-amber-600" />
          Questions waiting for your answer
          <span className="ml-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium">
            {filtered.length}
          </span>
        </CardTitle>
        <CardDescription className="text-xs">
          Teammates asked questions the AI could not answer confidently. Review the AI draft and submit a shared memory.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-2 rounded-lg border border-amber-500/20 bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium line-clamp-2">{item.question}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {item.workspaceName} · from {item.askerName}
                {item.confidence != null ? ` · AI confidence ${Math.round(item.confidence * 100)}%` : ''}
                {' · '}
                {formatDistanceToNow(item.createdAt)}
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link to={`/answer?escalation=${encodeURIComponent(item.id)}`}>Answer</Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
