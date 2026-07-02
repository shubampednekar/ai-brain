import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { useCaptureMemory } from '@/modules/memory/hooks/useCaptureMemory';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';

interface WorkspaceCaptureProps {
  workspaceId: string;
  onCaptured?: () => void;
}

export function WorkspaceCapture({ workspaceId, onCaptured }: WorkspaceCaptureProps) {
  const [text, setText] = useState('');
  const { capture, loading, lastMemory } = useCaptureMemory();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;

    await capture(text.trim(), workspaceId);
    setText('');
    onCaptured?.();
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="relative">
        <Textarea
          placeholder="Capture a shared memory for this workspace..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[100px] resize-none pr-14 text-base"
          disabled={loading}
        />
        <Button
          type="submit"
          size="icon"
          className="absolute bottom-3 right-3"
          disabled={!text.trim() || loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>

      {lastMemory && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
            {lastMemory.intent_slug ?? 'memory'}
          </span>
          {lastMemory.summary && (
            <p className="mt-2 text-xs text-muted-foreground">{lastMemory.summary}</p>
          )}
        </div>
      )}
    </div>
  );
}
