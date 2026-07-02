import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useCaptureMemory } from '../hooks/useCaptureMemory';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';

export function MemoryCapture() {
  const [text, setText] = useState('');
  const { capture, loading, lastMemory } = useCaptureMemory();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;

    await capture(text.trim());
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      void handleSubmit(e);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="relative">
        <Textarea
          placeholder="Type anything naturally... 'Meeting with Rahul tomorrow at 3pm', 'Sarah likes React', 'Buy MacBook'"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[120px] resize-none pr-14 text-base"
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
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
              {lastMemory.intent_slug ?? 'memory'}
            </span>
            {lastMemory.intent_confidence && (
              <span className="text-muted-foreground">
                {Math.round(lastMemory.intent_confidence * 100)}% confidence
              </span>
            )}
          </div>
          {lastMemory.summary && (
            <p className="mt-2 text-sm text-muted-foreground">{lastMemory.summary}</p>
          )}
        </div>
      )}

    </div>
  );
}
