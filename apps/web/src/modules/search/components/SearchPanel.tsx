import { useState } from 'react';
import { Brain, Loader2, Search } from 'lucide-react';
import { apiUrl, supabase } from '@/shared/lib/supabase';
import { PageLayout } from '@/shared/components/layout/PageLayout';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';

interface SearchResult {
  id: string;
  originalText: string;
  summary: string | null;
  intentSlug: string | null;
  combinedScore: number;
}

const EXAMPLE_QUERIES = [
  'What do I like to do for fun?',
  'What reminders do I have?',
  'Summarize my recent decisions',
];

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = async (searchQuery: string) => {
    if (!searchQuery.trim() || loading) return;

    setQuery(searchQuery);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${apiUrl}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ query: searchQuery.trim() }),
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSearch(query);
  };

  return (
    <PageLayout
      title="AI Search"
      description="Ask questions about your memories. AI finds relevant context and answers from what you've captured."
      sidebarTitle="Examples"
      sidebar={
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Try asking
            </CardTitle>
            <CardDescription className="text-xs">
              Vector search finds memories, then AI answers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {EXAMPLE_QUERIES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => void runSearch(example)}
                disabled={loading}
                className="w-full text-left text-xs rounded-md border bg-muted/40 px-3 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
              >
                {example}
              </button>
            ))}
          </CardContent>
        </Card>
      }
    >
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" />
            Ask a question
          </CardTitle>
          <CardDescription>
            Search across your personal memories with natural language.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="Ask anything about your memories..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" className="w-full sm:w-auto shrink-0" disabled={loading || !query.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {answer ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Answer</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{answer}</p>
          </CardContent>
        </Card>
      ) : null}

      {sources.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 px-1">
            Relevant memories
          </p>
          <div className="space-y-2">
            {sources.map((source, i) => (
              <Card key={source.id}>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    [{i + 1}] {source.intentSlug}
                  </p>
                  <p className="text-sm">{source.originalText}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </PageLayout>
  );
}
