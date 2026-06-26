process.env.MAX_CONCURRENCY = '2';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'http';
import { scrapeUrl, mapUrl, crawlUrl } from '../scraper';
import { chromium } from 'playwright-extra';

let server: http.Server;
const port = 9000;
const testUrl = `http://localhost:${port}`;

let activeServerRequests = 0;
let peakServerConcurrency = 0;

beforeAll(() => {
  server = http.createServer((req, res) => {
    if (req.url === '/lazy') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Main Title</title></head>
        <body style="height: 3000px; margin: 0; padding: 20px;">
          <header><h1>Site Header</h1><nav>Navigation Links</nav></header>
          <main>
            <article>
              <h1>Main Title</h1>
              <p>This is a paragraph of the article. It contains enough content to look like a real web page so Readability can parse it correctly without getting confused by layout elements.</p>
              <p>Initial content of the article is located here.</p>
              <div id="lazy-content"></div>
              <script>
                // Simulate lazy loading on scroll
                window.addEventListener('scroll', () => {
                  const div = document.getElementById('lazy-content');
                  if (div && !div.innerHTML) {
                    div.innerHTML = '<p>Lazy content loaded.</p>';
                  }
                });
              </script>
            </article>
          </main>
          <footer>Copyright Info and Footer links</footer>
        </body>
        </html>
      `);
    } else if (req.url === '/delay') {
      activeServerRequests++;
      if (activeServerRequests > peakServerConcurrency) {
        peakServerConcurrency = activeServerRequests;
      }
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>Delayed Title</title></head>
          <body>
            <main>
              <article>
                <h1>Delayed Title</h1>
                <p>This is a delayed page core content. We expect Readability to extract this part successfully.</p>
              </article>
            </main>
          </body>
          </html>
        `);
        activeServerRequests--;
      }, 1000);
    } else if (req.url === '/metadata') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <title>Metadata Page</title>
          <meta name="description" content="This is a test description.">
          <meta name="keywords" content="test,scraper,metadata">
          <meta name="author" content="Test Author">
          <meta property="og:title" content="OG Title">
          <meta property="og:description" content="OG Description">
          <meta property="og:image" content="https://example.com/image.jpg">
          <link rel="canonical" href="https://example.com/canonical">
        </head>
        <body>
          <main>
            <article>
              <h1>Metadata Page</h1>
              <p>This is a paragraph that will serve as the excerpt of the article content. Readability should parse this.</p>
            </article>
          </main>
        </body>
        </html>
      `);
    } else if (req.url === '/links') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Links Page</title></head>
        <body>
          <a href="/relative-path">Relative</a>
          <a href="http://localhost:9000/absolute-path">Absolute Same Domain</a>
          <a href="https://external.com/path">External</a>
          <a href="javascript:void(0)">Javascript link</a>
          <a href="mailto:test@example.com">Mailto</a>
          <a href="/relative-path">Duplicate</a>
        </body>
        </html>
      `);
    } else if (req.url === '/crawl/1') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Crawl Page 1</title></head>
        <body>
          <main>
            <article>
              <h1>Crawl Page 1</h1>
              <p>Content of page 1.</p>
              <a href="http://127.0.0.1:9000/crawl/2">Go to Page 2</a>
              <a href="https://external.com">External link</a>
            </article>
          </main>
        </body>
        </html>
      `);
    } else if (req.url === '/crawl/2') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Crawl Page 2</title></head>
        <body>
          <main>
            <article>
              <h1>Crawl Page 2</h1>
              <p>Content of page 2.</p>
              <a href="/crawl/3">Go to Page 3</a>
            </article>
          </main>
        </body>
        </html>
      `);
    } else if (req.url === '/crawl/3') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Crawl Page 3</title></head>
        <body>
          <main>
            <article>
              <h1>Crawl Page 3</h1>
              <p>Content of page 3.</p>
            </article>
          </main>
        </body>
        </html>
      `);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Simple Title</title></head>
        <body>
          <header><h1>Site Header</h1><nav>Navigation Links</nav></header>
          <main>
            <article>
              <h1>Simple Title</h1>
              <p>This is the core content of the article. We expect Readability to extract this part and ignore the header and footer.</p>
            </article>
          </main>
          <footer>Copyright Info and Footer links</footer>
        </body>
        </html>
      `);
    }
  });
  server.listen(port);
});

afterAll(() => {
  server.close();
});

describe('Scraper Module', () => {
  it('should scrape a simple page and return clean markdown', async () => {
    const result = await scrapeUrl(testUrl);
    expect(result.success).toBe(true);
    expect(result.title).toBe('Simple Title');
    expect(result.markdown).toContain('This is the core content');
    expect(result.markdown).not.toContain('Navigation Links');
    expect(result.markdown).not.toContain('Copyright Info');
  }, 20000);

  it('should scrape a simple page in "full" mode and preserve headers/footers', async () => {
    const result = await scrapeUrl(testUrl, 'full');
    expect(result.success).toBe(true);
    expect(result.title).toBe('Simple Title');
    expect(result.markdown).toContain('This is the core content');
    expect(result.markdown).toContain('Navigation Links');
    expect(result.markdown).toContain('Copyright Info');
  }, 20000);

  it('should trigger scroll and capture lazy-loaded content', async () => {
    const result = await scrapeUrl(`${testUrl}/lazy`);
    expect(result.success).toBe(true);
    expect(result.title).toBe('Main Title');
    expect(result.markdown).toContain('Initial content');
    expect(result.markdown).toContain('Lazy content loaded.');
  }, 20000);

  it('should fail gracefully for invalid URL', async () => {
    await expect(scrapeUrl('http://invalid-domain-xxxx.com')).rejects.toThrow();
  }, 20000);

  it('should reuse browser instance across multiple scrapes', async () => {
    const launchSpy = vi.spyOn(chromium, 'launch');
    
    const result1 = await scrapeUrl(testUrl);
    expect(result1.success).toBe(true);
    
    const result2 = await scrapeUrl(testUrl);
    expect(result2.success).toBe(true);
    
    // Check that chromium.launch was only called once or not at all (if already launched previously)
    // Actually, since we spy on it now, the very first scrape in this test case will trigger it if it wasn't running,
    // or if it was already running, it might not be called.
    // In our implementation, we want to ensure the subsequent calls do NOT trigger launch.
    // Let's assert that launchSpy calls are at most 1 (and 0 if it was initialized before this test).
    expect(launchSpy.mock.calls.length).toBeLessThanOrEqual(1);
    
    launchSpy.mockRestore();
  }, 30000);

  it('should limit concurrent scrapes based on MAX_CONCURRENCY', async () => {
    peakServerConcurrency = 0;

    // Run 3 requests concurrently
    // Since MAX_CONCURRENCY is set to 2 at the top of the file, peakServerConcurrency should not exceed 2.
    const promises = [
      scrapeUrl(`${testUrl}/delay`),
      scrapeUrl(`${testUrl}/delay`),
      scrapeUrl(`${testUrl}/delay`),
    ];

    await Promise.all(promises);
    expect(peakServerConcurrency).toBeLessThanOrEqual(2);
  }, 30000);

  it('should extract metadata and excerpt successfully', async () => {
    const result = await scrapeUrl(`${testUrl}/metadata`);
    expect(result.success).toBe(true);
    expect(result.title).toBe('OG Title');
    expect(result.excerpt).toContain('OG Description');
    expect(result.metadata).toBeDefined();
    expect(result.metadata?.description).toBe('This is a test description.');
    expect(result.metadata?.keywords).toBe('test,scraper,metadata');
    expect(result.metadata?.author).toBe('Test Author');
    expect(result.metadata?.ogTitle).toBe('OG Title');
    expect(result.metadata?.ogDescription).toBe('OG Description');
    expect(result.metadata?.ogImage).toBe('https://example.com/image.jpg');
    expect(result.metadata?.canonical).toBe('https://example.com/canonical');
    expect(result.metadata?.lang).toBe('ja');
  }, 20000);

  it('should extract internal links using mapUrl', async () => {
    const links = await mapUrl(`${testUrl}/links`);
    expect(links).toContain(`${testUrl}/relative-path`);
    expect(links).toContain(`${testUrl}/absolute-path`);
    // External links and non-http links should be ignored
    expect(links).not.toContain('https://external.com/path');
    expect(links).not.toContain('javascript:void(0)');
    expect(links).not.toContain('mailto:test@example.com');
    // Duplicates should be resolved
    const duplicates = links.filter(l => l === `${testUrl}/relative-path`);
    expect(duplicates.length).toBe(1);
  }, 20000);

  it('should crawl site up to limits', async () => {
    const results = await crawlUrl(`${testUrl}/crawl/1`, 2, 2);
    // Limit is 2, so we expect exactly 2 page results
    expect(results.length).toBe(2);
    expect(results[0].url).toBe(`${testUrl}/crawl/1`);
    expect(results[0].title).toBe('Crawl Page 1');
    expect(results[1].url).toBe('http://127.0.0.1:9000/crawl/2');
    expect(results[1].title).toBe('Crawl Page 2');
  }, 30000);
});
