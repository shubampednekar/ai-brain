import type { ServiceContext } from '../../../shared/types.js';

export interface ResearchResult {
  title: string;
  link: string;
  snippet: string;
}

interface SerperOrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
}

interface SerperResponse {
  organic?: SerperOrganicResult[];
}

export class ResearchAgentService {
  constructor(private readonly ctx: ServiceContext) {}

  async search(query: string, num = 5): Promise<ResearchResult[]> {
    const apiKey = this.ctx.config.serperApiKey;
    if (!apiKey) {
      console.warn('[research-agent] SERPER_API_KEY not configured');
      return [];
    }

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Serper search failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as SerperResponse;
    return (data.organic ?? [])
      .filter((r) => r.title && r.link)
      .map((r) => ({
        title: r.title!,
        link: r.link!,
        snippet: r.snippet ?? '',
      }));
  }

  buildSearchQuery(preferenceText: string): string {
    const cleaned = preferenceText.trim();
    const lower = cleaned.toLowerCase();

    if (lower.includes('like') || lower.includes('love') || lower.includes('prefer') || lower.includes('fan of')) {
      const topic = cleaned
        .replace(/^(i\s+)?(really\s+)?(like|love|prefer|enjoy|am a fan of|i'm into|im into)\s+/i, '')
        .replace(/\.$/, '')
        .trim();
      return `${topic} latest news deals ${new Date().getFullYear()}`;
    }

    return `${cleaned} latest news ${new Date().getFullYear()}`;
  }
}
