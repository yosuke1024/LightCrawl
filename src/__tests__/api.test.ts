import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app, mcpServer } from '../index';
import * as scraper from '../scraper';

// Mock the scraper module to isolate API testing
vi.mock('../scraper', () => {
  return {
    scrapeUrl: vi.fn((url: string) => {
      if (url === 'http://example.com') {
        return Promise.resolve({
          success: true,
          url,
          title: 'Mocked Title',
          markdown: '# Mocked Title\n\nContent',
        });
      }
      return Promise.reject(new Error('Scrape failed'));
    }),
  };
});

describe('HTTP API Endpoints', () => {
  it('GET /health should return status ok', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('GET /scrape with valid url should return markdown payload', async () => {
    const response = await request(app)
      .get('/scrape')
      .query({ url: 'http://example.com' });
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      url: 'http://example.com',
      title: 'Mocked Title',
      markdown: '# Mocked Title\n\nContent',
    });
    expect(scraper.scrapeUrl).toHaveBeenCalledWith('http://example.com');
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
});

describe('MCP Server Integration', () => {
  it('should initialize MCP server instance', () => {
    expect(mcpServer).toBeDefined();
  });
});
