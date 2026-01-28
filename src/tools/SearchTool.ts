import axios from 'axios';
import { Plugin, ToolDefinition } from '../types';

export interface SearchResult {
  title:   string;
  url:     string;
  snippet: string;
}

export class SearchPlugin implements Plugin {
  name    = 'search';
  version = '0.1.0';

  private apiKey: string;
  private cx:     string;

  constructor(apiKey?: string, cx?: string) {
    this.apiKey = apiKey ?? process.env.GOOGLE_API_KEY ?? '';
    this.cx     = cx    ?? process.env.GOOGLE_CX      ?? '';
  }

  tools: ToolDefinition[] = [
    {
      name:        'web_search',
      description: 'Search the web and return top results with titles, URLs, and snippets.',
      parameters: {
        type: 'object',
        properties: {
          query:       { type: 'string',  description: 'The search query' },
          numResults:  { type: 'number',  description: 'Number of results (1-10, default 5)' },
        },
        required: ['query'],
      },
    },
  ];

  async execute(toolName: string, args: Record<string, unknown>): Promise<string> {
    if (toolName === 'web_search') return this.search(args);
    throw new Error(`unknown tool: ${toolName}`);
  }

  private async search(args: Record<string, unknown>): Promise<string> {
    const query      = args['query'] as string;
    const numResults = Math.min((args['numResults'] as number) ?? 5, 10);

    if (!this.apiKey || !this.cx) {
      return this.duckduckgoFallback(query, numResults);
    }

    const { data } = await axios.get(
      'https://www.googleapis.com/customsearch/v1',
      {
        params: {
          key: this.apiKey,
          cx:  this.cx,
          q:   query,
          num: numResults,
        },
      },
    );

    const items: SearchResult[] = (data.items ?? []).map(
      (item: { title: string; link: string; snippet: string }) => ({
        title:   item.title,
        url:     item.link,
        snippet: item.snippet,
      }),
    );

    return this.formatResults(items);
  }

  private async duckduckgoFallback(query: string, n: number): Promise<string> {
    const { data } = await axios.get('https://api.duckduckgo.com/', {
      params: { q: query, format: 'json', no_html: 1, skip_disambig: 1 },
      headers: { 'User-Agent': 'sambot/0.1 (+https://wlessin.com)' },
    });

    const results: SearchResult[] = [];
    if (data.AbstractText) {
      results.push({ title: data.Heading, url: data.AbstractURL, snippet: data.AbstractText });
    }
    for (const r of (data.RelatedTopics ?? []).slice(0, n - 1)) {
      if (r.FirstURL && r.Text) {
        results.push({ title: r.Text.slice(0, 60), url: r.FirstURL, snippet: r.Text });
      }
    }

    return this.formatResults(results) || `no results found for: ${query}`;
  }

  private formatResults(results: SearchResult[]): string {
    return results
      .map((r, i) => `[${i + 1}] ${r.title}\n    ${r.url}\n    ${r.snippet}`)
      .join('\n\n');
  }
}
