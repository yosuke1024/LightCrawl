import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app, mcpServer } from '../index';
import * as scraper from '../scraper';

// Mock the scraper module to isolate API testing
vi.mock('../scraper', () => {
  return {
    scrapeUrl: vi.fn((url: string, _mode?: string) => {
      if (url === 'http://example.com') {
        return Promise.resolve({
          success: true,
          url,
          title: 'Mocked Title',
          markdown: '# Mocked Title\n\nContent',
          metadata: { description: 'Mocked Description' },
          excerpt: 'Mocked Excerpt',
        });
      }
      return Promise.reject(new Error('Scrape failed'));
    }),
    mapUrl: vi.fn((url: string) => {
      if (url === 'http://example.com') {
        return Promise.resolve([
          'http://example.com/page1',
          'http://example.com/page2',
        ]);
      }
      return Promise.reject(new Error('Map failed'));
    }),
    crawlUrl: vi.fn((url: string) => {
      if (url === 'http://example.com') {
        return Promise.resolve([
          {
            success: true,
            url: 'http://example.com',
            title: 'Mocked Title',
            markdown: '# Mocked Title\n\nContent',
          },
          {
            success: true,
            url: 'http://example.com/page1',
            title: 'Page 1',
            markdown: '# Page 1\n\nContent',
          }
        ]);
      }
      return Promise.reject(new Error('Crawl failed'));
    }),
  };
});

describe('HTTP API Endpoints', () => {
  it('GET /health should return status ok', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('GET /openapi.json should return OpenAPI specification JSON', async () => {
    const response = await request(app).get('/openapi.json');
    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe('3.0.3');
  });

  it('GET /api-docs should redirect or return Swagger UI HTML', async () => {
    const response = await request(app).get('/api-docs');
    expect([200, 301, 302]).toContain(response.status);
  });

  it('GET /scrape with valid url should return markdown payload', async () => {
    const response = await request(app)
      .get('/scrape')
      .query({ url: 'http://example.com' });
    
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      url: 'http://example.com',
      title: 'Mocked Title',
      markdown: '# Mocked Title\n\nContent',
    });
    expect(scraper.scrapeUrl).toHaveBeenCalledWith('http://example.com', 'article');
  });

  it('GET /scrape with mode=full should pass mode to scraper', async () => {
    const response = await request(app)
      .get('/scrape')
      .query({ url: 'http://example.com', mode: 'full' });
    
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      url: 'http://example.com',
      title: 'Mocked Title',
      markdown: '# Mocked Title\n\nContent',
    });
    expect(scraper.scrapeUrl).toHaveBeenCalledWith('http://example.com', 'full');
  });

  it('GET /scrape without url query param should return 400 error', async () => {
    const response = await request(app).get('/scrape');
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('URL is required');
  });

  it('GET /scrape with failing scraper should return 500 error', async () => {
    const response = await request(app)
      .get('/scrape')
      .query({ url: 'http://fail-me.com' });
    
    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
  });

  it('GET /scrape with invalid url format should return 400 error', async () => {
    const response = await request(app)
      .get('/scrape')
      .query({ url: 'not-a-valid-url' });
    
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Invalid URL format');
  });

  it('GET /scrape should return metadata and excerpt if available', async () => {
    const response = await request(app)
      .get('/scrape')
      .query({ url: 'http://example.com' });
    
    expect(response.status).toBe(200);
    expect(response.body.metadata).toEqual({ description: 'Mocked Description' });
    expect(response.body.excerpt).toBe('Mocked Excerpt');
  });

  it('GET /map with valid url should return url array', async () => {
    const response = await request(app)
      .get('/map')
      .query({ url: 'http://example.com' });
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      'http://example.com/page1',
      'http://example.com/page2',
    ]);
    expect(scraper.mapUrl).toHaveBeenCalledWith('http://example.com');
  });

  it('GET /map without url query param should return 400 error', async () => {
    const response = await request(app).get('/map');
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('GET /crawl with valid url should return results array', async () => {
    const response = await request(app)
      .get('/crawl')
      .query({ url: 'http://example.com', limit: 2, maxDepth: 2 });
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        success: true,
        url: 'http://example.com',
        title: 'Mocked Title',
        markdown: '# Mocked Title\n\nContent',
      },
      {
        success: true,
        url: 'http://example.com/page1',
        title: 'Page 1',
        markdown: '# Page 1\n\nContent',
      }
    ]);
    expect(scraper.crawlUrl).toHaveBeenCalledWith('http://example.com', 2, 2);
  });

  it('GET /crawl without url query param should return 400 error', async () => {
    const response = await request(app).get('/crawl');
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});

describe('MCP Server Integration', () => {
  it('should initialize MCP server instance', () => {
    expect(mcpServer).toBeDefined();
  });

  it('should list tools including lightcrawl_scrape, lightcrawl_map, and lightcrawl_crawl', async () => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const listHandler = (mcpServer as any)._requestHandlers.get('tools/list');
    expect(listHandler).toBeDefined();

    const response = await listHandler({ method: 'tools/list' });
    expect(response.tools).toBeDefined();
    const tools = response.tools;
    expect(tools.some((t: unknown) => (t as { name: string }).name === 'lightcrawl_scrape')).toBe(true);
    expect(tools.some((t: unknown) => (t as { name: string }).name === 'lightcrawl_map')).toBe(true);
    expect(tools.some((t: unknown) => (t as { name: string }).name === 'lightcrawl_crawl')).toBe(true);
  });

  it('should handle lightcrawl_map tool call', async () => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const callHandler = (mcpServer as any)._requestHandlers.get('tools/call');
    expect(callHandler).toBeDefined();

    const response = await callHandler({
      method: 'tools/call',
      params: {
        name: 'lightcrawl_map',
        arguments: { url: 'http://example.com' },
      },
    });

    expect(response.content).toBeDefined();
    const content = response.content[0].text;
    const urls = JSON.parse(content);
    expect(urls).toEqual([
      'http://example.com/page1',
      'http://example.com/page2',
    ]);
  });

  it('should handle lightcrawl_crawl tool call', async () => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const callHandler = (mcpServer as any)._requestHandlers.get('tools/call');
    expect(callHandler).toBeDefined();

    const response = await callHandler({
      method: 'tools/call',
      params: {
        name: 'lightcrawl_crawl',
        arguments: { url: 'http://example.com', limit: 2, maxDepth: 2 },
      },
    });

    expect(response.content).toBeDefined();
    const content = response.content[0].text;
    const results = JSON.parse(content);
    expect(results.length).toBe(2);
    expect(results[0].title).toBe('Mocked Title');
  });
});

describe('API Key Authentication', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should bypass auth if API_KEY is not set', async () => {
    vi.stubEnv('API_KEY', '');
    const response = await request(app)
      .get('/scrape')
      .query({ url: 'http://example.com' });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should return 401 if API_KEY is set but no key is provided', async () => {
    vi.stubEnv('API_KEY', 'secret-key');
    const response = await request(app)
      .get('/scrape')
      .query({ url: 'http://example.com' });
    
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Unauthorized');
  });

  it('should return 401 if API_KEY is set but invalid key is provided in header', async () => {
    vi.stubEnv('API_KEY', 'secret-key');
    const response = await request(app)
      .get('/scrape')
      .query({ url: 'http://example.com' })
      .set('Authorization', 'Bearer invalid-key');
    
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('should return 200 if valid key is provided in Authorization header', async () => {
    vi.stubEnv('API_KEY', 'secret-key');
    const response = await request(app)
      .get('/scrape')
      .query({ url: 'http://example.com' })
      .set('Authorization', 'Bearer secret-key');
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should return 200 if valid key is provided in query parameter', async () => {
    vi.stubEnv('API_KEY', 'secret-key');
    const response = await request(app)
      .get('/scrape')
      .query({ url: 'http://example.com', key: 'secret-key' });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});

describe('IP Address Restriction', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should bypass IP restriction if ALLOWED_IPS is not set', async () => {
    vi.stubEnv('ALLOWED_IPS', '');
    const response = await request(app)
      .get('/scrape')
      .query({ url: 'http://example.com' })
      .set('x-forwarded-for', '1.2.3.4');
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should return 200 if request comes from an allowed IP', async () => {
    vi.stubEnv('ALLOWED_IPS', '127.0.0.1, 203.0.113.50');
    const response = await request(app)
      .get('/scrape')
      .query({ url: 'http://example.com' })
      .set('x-forwarded-for', '203.0.113.50');
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should return 403 if request comes from a disallowed IP', async () => {
    vi.stubEnv('ALLOWED_IPS', '127.0.0.1, 203.0.113.50');
    const response = await request(app)
      .get('/scrape')
      .query({ url: 'http://example.com' })
      .set('x-forwarded-for', '198.51.100.1');
    
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Forbidden');
  });

  it('should return 200 if request comes from an allowed IP (multiple IPs in x-forwarded-for)', async () => {
    vi.stubEnv('ALLOWED_IPS', '127.0.0.1, 203.0.113.50');
    const response = await request(app)
      .get('/scrape')
      .query({ url: 'http://example.com' })
      .set('x-forwarded-for', '203.0.113.50, 192.168.1.1');
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should return 200 if request comes from an allowed IPv6-mapped IPv4 address', async () => {
    vi.stubEnv('ALLOWED_IPS', '203.0.113.50');
    const response = await request(app)
      .get('/scrape')
      .query({ url: 'http://example.com' })
      .set('x-forwarded-for', '::ffff:203.0.113.50');
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should return 200 if request is allowed via socket remoteAddress fallback', async () => {
    // 127.0.0.1 and ::1 are the expected local socket remoteAddress in test environment
    vi.stubEnv('ALLOWED_IPS', '127.0.0.1, ::1');

    const response = await request(app)
      .get('/scrape')
      .query({ url: 'http://example.com' });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should return 403 if request is denied via socket remoteAddress fallback', async () => {
    // A non-loopback IP that won't match the local socket remoteAddress
    vi.stubEnv('ALLOWED_IPS', '203.0.113.50');

    const response = await request(app)
      .get('/scrape')
      .query({ url: 'http://example.com' });
    
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});

describe('Composite Security (API Key + IP Address)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return 200 if both IP and API Key are valid', async () => {
    vi.stubEnv('API_KEY', 'secret-key');
    vi.stubEnv('ALLOWED_IPS', '203.0.113.50');
    
    const response = await request(app)
      .get('/scrape')
      .query({ url: 'http://example.com' })
      .set('x-forwarded-for', '203.0.113.50')
      .set('Authorization', 'Bearer secret-key');
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should return 403 if IP is invalid, even if API Key is valid', async () => {
    vi.stubEnv('API_KEY', 'secret-key');
    vi.stubEnv('ALLOWED_IPS', '203.0.113.50');
    
    const response = await request(app)
      .get('/scrape')
      .query({ url: 'http://example.com' })
      .set('x-forwarded-for', '198.51.100.1')
      .set('Authorization', 'Bearer secret-key');
    
    expect(response.status).toBe(403); // IP check fails first
    expect(response.body.success).toBe(false);
  });

  it('should return 401 if IP is valid but API Key is invalid', async () => {
    vi.stubEnv('API_KEY', 'secret-key');
    vi.stubEnv('ALLOWED_IPS', '203.0.113.50');
    
    const response = await request(app)
      .get('/scrape')
      .query({ url: 'http://example.com' })
      .set('x-forwarded-for', '203.0.113.50')
      .set('Authorization', 'Bearer wrong-key');
    
    expect(response.status).toBe(401); // IP passes, but Auth fails
    expect(response.body.success).toBe(false);
  });
});
