import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { apiUrl, supabase } from '@/shared/lib/supabase';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card, CardContent } from '@/shared/components/ui/card';

interface SearchResult {
  id: string;
  originalText: string;
  summary: string | null;
  intentSlug: string | null;
  combinedScore: number;
}

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${apiUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!response.ok) throw new Error('Search failed');

      const result = await response.json() as { answer: string; sources: SearchResult[] };
      setAnswer(result.answer);
      setSources(result.sources);
    } catch {
      setAnswer('Sorry, search failed. Please try again.');
      setSources([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="Ask anything about your memories..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={loading || !query.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </form>

      {answer && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{answer}</p>
          </CardContent>
        </Card>
      )}

      {sources.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Sources
          </p>
          {sources.map((source, i) => (
            <Card key={source.id}>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground mb-1">[{i + 1}] {source.intentSlug}</p>
                <p className="text-sm">{source.originalText}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
