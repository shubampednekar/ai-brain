import type { ServiceContext } from '../../../shared/types.js';

export interface SearchResult {
  id: string;
  originalText: string;
  summary: string | null;
  intentSlug: string | null;
  similarity: number;
  textRank: number;
  combinedScore: number;
  createdAt: string;
}

export class SearchService {
  constructor(private readonly ctx: ServiceContext) {}

  async search(
    userId: string,
    query: string,
    options?: { workspaceId?: string; limit?: number; offset?: number },
  ): Promise<SearchResult[]> {
    let queryEmbedding: number[] | undefined;

    try {
      const result = await this.ctx.embeddings.embed({ input: query });
      queryEmbedding = result.embeddings[0];
    } catch {
      // Fall back to text-only search
    }

    const { data, error } = await this.ctx.supabase.rpc('search_memories', {
      p_user_id: userId,
      p_query: query,
      p_query_embedding: queryEmbedding,
      p_workspace_id: options?.workspaceId,
      p_limit: options?.limit ?? 20,
      p_offset: options?.offset ?? 0,
    });

    if (error) throw new Error(`Search failed: ${error.message}`);

    return (data ?? []).map((row) => ({
      id: row.id,
      originalText: row.original_text,
      summary: row.summary,
      intentSlug: row.intent_slug,
      similarity: row.similarity,
      textRank: row.text_rank,
      combinedScore: row.combined_score,
      createdAt: row.created_at,
    }));
  }

  async ask(userId: string, question: string): Promise<{ answer: string; sources: SearchResult[] }> {
    const sources = await this.search(userId, question, { limit: 5 });

    const context = sources
      .map((s, i) => `[${i + 1}] ${s.originalText}${s.summary ? ` (Summary: ${s.summary})` : ''}`)
      .join('\n');

    const result = await this.ctx.ai.chat({
      messages: [
        {
          role: 'system',
          content: `You are AI Brain, a personal knowledge assistant. Answer the user's question based ONLY on their stored memories. If you cannot answer confidently from the provided context, say so. Cite memory numbers when relevant.`,
        },
        {
          role: 'user',
          content: `Memories:\n${context || 'No relevant memories found.'}\n\nQuestion: ${question}`,
        },
      ],
      temperature: 0.3,
    });

    return { answer: result.content, sources };
  }
}
