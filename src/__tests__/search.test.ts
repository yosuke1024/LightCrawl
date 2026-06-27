import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import request from 'supertest';
import { app, mcpServer } from '../index';

// Mock the scraper's scrapeUrl
vi.mock('../scraper', async (importOriginal) => {
  const original = await importOriginal<typeof import('../scraper')>();
  return {
    ...original,
    scrapeUrl: vi.fn((url: string) => {
      if (url.includes('search/1') || url === 'http://example.com/1') {
        return Promise.resolve({
          success: true,
          url,
          title: 'Result 1',
          markdown: '# Result 1 Content',
          excerpt: 'Snippet 1',
        });
      }
      if (url.includes('search/2') || url === 'http://example.com/2') {
        return Promise.resolve({
          success: true,
          url,
          title: 'Result 2',
          markdown: '# Result 2 Content',
          excerpt: 'Snippet 2',
        });
      }
      return Promise.reject(new Error('Scrape failed'));
    }),
  };
});

describe('Web Search & Parallel Scraping', () => {
  const mockFetch = vi.fn();
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = mockFetch as unknown as typeof global.fetch;
    vi.stubEnv('BRAVE_SEARCH_API_KEY', 'mock-brave-key');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('should return search & scrape results when API key is set', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        web: {
          results: [
            { title: 'Result 1', url: 'http://example.com/1', description: 'Snippet 1' },
            { title: 'Result 2', url: 'http://example.com/2', description: 'Snippet 2' },
          ],
        },
      }),
    });

    const response = await request(app)
      .get('/search')
      .query({ q: 'test query', limit: 2 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        success: true,
        url: 'http://example.com/1',
        title: 'Result 1',
        markdown: '# Result 1 Content',
        excerpt: 'Snippet 1',
      },
      {
        success: true,
        url: 'http://example.com/2',
        title: 'Result 2',
        markdown: '# Result 2 Content',
        excerpt: 'Snippet 2',
      },
    ]);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.search.brave.com/res/v1/web/search?q=test%20query&count=2',
      expect.objectContaining({
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': 'mock-brave-key',
        },
      })
    );
  });

  it('should return 501 Not Implemented if BRAVE_SEARCH_API_KEY is not set', async () => {
    vi.stubEnv('BRAVE_SEARCH_API_KEY', '');

    const response = await request(app)
      .get('/search')
      .query({ q: 'test query' });

    expect(response.status).toBe(501);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Brave Search API key is not configured');
  });

  it('should return 400 Bad Request if query is missing', async () => {
    const response = await request(app)
      .get('/search');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Query is required');
  });

  it('should dynamically list or hide lightcrawl_search MCP tool based on API key presence', async () => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const listHandler = (mcpServer as any)._requestHandlers.get('tools/list');
    expect(listHandler).toBeDefined();

    // 1. With API Key
    let response = await listHandler({ method: 'tools/list' });
    expect(response.tools.some((t: { name: string }) => t.name === 'lightcrawl_search')).toBe(true);

    // 2. Without API Key
    vi.stubEnv('BRAVE_SEARCH_API_KEY', '');
    response = await listHandler({ method: 'tools/list' });
    expect(response.tools.some((t: { name: string }) => t.name === 'lightcrawl_search')).toBe(false);
  });

  it('should handle lightcrawl_search tool call', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        web: {
          results: [
            { title: 'Result 1', url: 'http://example.com/1', description: 'Snippet 1' },
          ],
        },
      }),
    });

    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const callHandler = (mcpServer as any)._requestHandlers.get('tools/call');
    expect(callHandler).toBeDefined();

    const response = await callHandler({
      method: 'tools/call',
      params: {
        name: 'lightcrawl_search',
        arguments: { query: 'test query', limit: 1 },
      },
    });

    expect(response.content).toBeDefined();
    const content = JSON.parse(response.content[0].text);
    expect(content.length).toBe(1);
    expect(content[0].title).toBe('Result 1');
  });
});
