import { formatDistanceToNow } from '@/modules/memory/utils/date';
import { INTENT_COLORS } from '@/modules/memory/constants';
import { useWorkspaceMemories } from '../hooks/useWorkspaceMemories';
import { Card, CardContent } from '@/shared/components/ui/card';

interface WorkspaceMemoryFeedProps {
  workspaceId: string;
}

export function WorkspaceMemoryFeed({ workspaceId }: WorkspaceMemoryFeedProps) {
  const { memories, loading } = useWorkspaceMemories(workspaceId);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (!memories.length) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No shared memories in this workspace yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {memories.map((memory) => (
        <Card key={memory.id} className="transition-colors hover:bg-accent/30">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <p className="text-sm leading-relaxed">{memory.original_text}</p>
                {memory.summary && memory.summary !== memory.original_text && (
                  <p className="text-xs text-muted-foreground">{memory.summary}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {memory.intent_slug && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      INTENT_COLORS[memory.intent_slug] ?? 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {memory.intent_slug}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(memory.created_at)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
