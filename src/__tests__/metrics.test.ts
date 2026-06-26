import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import http from 'http';
import { app } from '../index';
import { getMetricsText, clearMetrics, recordScrape } from '../metrics';
import { logger } from '../logger';
import { scrapeUrl } from '../scraper';

let testServer: http.Server;
const port = 9005;
const testUrl = `http://localhost:${port}`;

beforeAll(() => {
  testServer = http.createServer((req, res) => {
    if (req.url === '/cloudflare') {
      res.writeHead(403, { 
        'Content-Type': 'text/html',
        'Server': 'cloudflare'
      });
      res.end('<html><head><title>Just a moment...</title></head><body>cf-challenge</body></html>');
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><head><title>Normal Page</title></head><body><h1>Hello</h1></body></html>');
    }
  });
  testServer.listen(port);
});

afterAll(() => {
  testServer.close();
});

describe('Metrics and Logging Tests', () => {
  // 1. Test metrics formatter and data collection
  it('should format metrics correctly', () => {
    clearMetrics();
    recordScrape({ success: true, isProtected: false, durationSeconds: 0.5 });
    recordScrape({ success: false, isProtected: true, durationSeconds: 1.2 });

    const text = getMetricsText();
    expect(text).toContain('lightcrawl_scrape_requests_total{success="true",protected="false"} 1');
    expect(text).toContain('lightcrawl_scrape_requests_total{success="false",protected="true"} 1');
    expect(text).toContain('lightcrawl_scrape_duration_seconds_sum 1.7');
    expect(text).toContain('lightcrawl_scrape_duration_seconds_count 2');
  });

  // 2. Test API endpoint GET /metrics
  it('GET /metrics should return plain text metrics', async () => {
    const response = await request(app).get('/metrics');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('lightcrawl_scrape_requests_total');
  });

  // 3. Test structured logger output
  it('should write structured logs to console.error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    logger.info('Test message', { url: 'http://example.com', success: true });
    
    expect(errorSpy).toHaveBeenCalled();
    const lastCallArg = errorSpy.mock.calls[0][0];
    const parsed = JSON.parse(lastCallArg);
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('Test message');
    expect(parsed.url).toBe('http://example.com');
    expect(parsed.success).toBe(true);
    expect(parsed.timestamp).toBeDefined();

    errorSpy.mockRestore();
  });

  // 4. Test protection detection logic and its integration into scraping
  it('should detect cloudflare protection and record it in metrics', async () => {
    clearMetrics();
    
    // Normal page scrape
    const resNormal = await scrapeUrl(`${testUrl}/normal`);
    expect(resNormal.success).toBe(true);
    
    // Cloudflare protected page (will fail or return protected result)
    try {
      await scrapeUrl(`${testUrl}/cloudflare`);
    } catch {
      // Expected to fail or reject since it returns 403
    }

    const text = getMetricsText();
    expect(text).toContain('lightcrawl_scrape_requests_total{success="true",protected="false"} 1');
    expect(text).toContain('lightcrawl_scrape_requests_total{success="false",protected="true"} 1');
  }, 30000);
});
