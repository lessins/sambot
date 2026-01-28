import axios from 'axios';
import { Plugin, ToolDefinition } from '../types';

const READABILITY_STRIP = /<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g;

function stripHtml(html: string): string {
  return html
    .replace(READABILITY_STRIP, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function truncate(text: string, maxChars = 8000): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + `\n\n[truncated — ${text.length - maxChars} chars omitted]`;
}

export class BrowserPlugin implements Plugin {
  name    = 'browser';
  version = '0.1.0';

  tools: ToolDefinition[] = [
    {
      name:        'browser_fetch',
      description: 'Fetch and read the content of a URL. Returns readable text extracted from the page.',
      parameters: {
        type: 'object',
        properties: {
          url:      { type: 'string', description: 'The URL to fetch' },
          maxChars: { type: 'number', description: 'Max characters to return (default 8000)' },
        },
        required: ['url'],
      },
    },
    {
      name:        'browser_links',
      description: 'Extract all hyperlinks from a page.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to extract links from' },
        },
        required: ['url'],
      },
    },
  ];

  async execute(toolName: string, args: Record<string, unknown>): Promise<string> {
    if (toolName === 'browser_fetch') return this.fetch(args);
    if (toolName === 'browser_links') return this.links(args);
    throw new Error(`unknown tool: ${toolName}`);
  }

  private async fetch(args: Record<string, unknown>): Promise<string> {
    const url      = args['url'] as string;
    const maxChars = (args['maxChars'] as number) ?? 8000;

    const { data: html, headers } = await axios.get(url, {
      headers: { 'User-Agent': 'sambot/0.1 (+https://wlessin.com)' },
      timeout: 15000,
      responseType: 'text',
    });

    const contentType = headers['content-type'] ?? '';
    if (!contentType.includes('html') && !contentType.includes('text')) {
      return `[binary content — content-type: ${contentType}]`;
    }

    const text = stripHtml(html);
    return truncate(text, maxChars);
  }

  private async links(args: Record<string, unknown>): Promise<string> {
    const url = args['url'] as string;
    const { data: html } = await axios.get(url, {
      headers: { 'User-Agent': 'sambot/0.1 (+https://wlessin.com)' },
      timeout: 15000,
      responseType: 'text',
    });

    const linkRegex = /href=["']([^"']+)["']/g;
    const links: string[] = [];
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      if (href.startsWith('http')) links.push(href);
    }

    const unique = [...new Set(links)].slice(0, 50);
    return unique.join('\n') || 'no links found';
  }
}
