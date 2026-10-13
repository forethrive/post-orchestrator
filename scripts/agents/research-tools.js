// The Research agent's tools: searching the web, searching public LinkedIn
// posts, and reading a page. Every page it reads is kept, so the facts it
// reports can be checked against the page afterwards.
import { tool } from '@langchain/core/tools';
import { TavilySearch, TavilyExtract } from '@langchain/tavily';
import * as z from 'zod';

const SNIPPET_CHARS = 300;
// How much of a page the agent sees. Short enough to keep requests within
// free-tier limits; the full page is kept for checking facts.
const PAGE_CHARS = 4000;

export const pageKey = (url) => url.trim().replace(/\/+$/, '');

// Tavily, the search service the tools use. To use another service, write an
// object with the same two functions.
export function tavilyServices(apiKey) {
  const searcher = new TavilySearch({ tavilyApiKey: apiKey, maxResults: 5 });
  const extractor = new TavilyExtract({ tavilyApiKey: apiKey });
  const parse = (raw) => (typeof raw === 'string' ? JSON.parse(raw) : raw);

  return {
    async search(query, { recent = false, domains } = {}) {
      const data = parse(
        await searcher.invoke({
          query,
          ...(recent && { timeRange: 'month' }),
          ...(domains && { includeDomains: domains }),
        }),
      );
      if (data.error) throw new Error(data.error);
      return (data.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
        date: r.published_date,
      }));
    },
    // Reads pages that a plain download can't, such as PDFs and pages built by
    // JavaScript.
    async extract(url) {
      const data = parse(await extractor.invoke({ urls: [url] }));
      return data.results?.[0]?.raw_content ?? '';
    },
  };
}

const ENTITIES = { amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…' };

export function htmlToText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match)
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

// Pages on this computer's network are off limits, so a web page can't steer
// the agent into reading them.
function isPrivateHost(hostname) {
  return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[::1\]|.*\.local$)/i.test(hostname);
}

export async function readPage(url, services) {
  const { protocol, hostname } = new URL(url);
  if (!/^https?:$/.test(protocol) || isPrivateHost(hostname)) throw new Error('That address can’t be opened.');
  if (/(^|\.)linkedin\.com$/i.test(hostname)) {
    throw new Error('LinkedIn pages can’t be opened. Use what the search results show.');
  }
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; ForethrivePostResearch/1.0)' },
      signal: AbortSignal.timeout(20000),
    });
    const type = res.headers.get('content-type') ?? '';
    if (res.ok && type.includes('html')) {
      const text = htmlToText(await res.text());
      if (text.length > 500) return text;
    }
  } catch {
    // Fall back to Tavily below.
  }
  const text = await services.extract(url);
  if (!text) throw new Error('Couldn’t read that page.');
  return text;
}

function formatResults(results) {
  if (results.length === 0) return 'No results.';
  return results
    .map((r) => `${r.title}\n${r.url}${r.date ? ` (${r.date})` : ''}\n${(r.snippet ?? '').slice(0, SNIPPET_CHARS)}`)
    .join('\n\n');
}

// pages is a Map the tools fill with every page read, keyed by URL.
export function makeResearchTools(services, pages) {
  const searchWeb = tool(
    async ({ query, recent }) => formatResults(await services.search(query, { recent })),
    {
      name: 'search_web',
      description: 'Search the web. Returns titles, links, dates and short snippets.',
      schema: z.object({
        query: z.string().describe('What to search for'),
        recent: z.boolean().describe('true for results from the last month only'),
      }),
    },
  );

  const searchLinkedin = tool(
    async ({ query }) => formatResults(await services.search(query, { domains: ['linkedin.com'] })),
    {
      name: 'search_linkedin',
      description:
        'Search public LinkedIn posts, to see what similar companies are posting. Returns snippets; the posts themselves can’t be opened.',
      schema: z.object({ query: z.string().describe('For example: "AI consultancy" automation tips post') }),
    },
  );

  const readPageTool = tool(
    async ({ url }) => {
      const text = await readPage(url, services);
      pages.set(pageKey(url), text);
      const more = text.length > PAGE_CHARS ? `\n\n[First ${PAGE_CHARS} of ${text.length} characters]` : '';
      return text.slice(0, PAGE_CHARS) + more;
    },
    {
      name: 'read_page',
      description: 'Read the text of a web page or PDF, to check facts and copy exact quotes.',
      schema: z.object({ url: z.string().describe('The full link, starting with https://') }),
    },
  );

  return [searchWeb, searchLinkedin, readPageTool];
}
