import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { scrapeUrl } from '../scraper';

let server: http.Server;
const port = 9000;
const testUrl = `http://localhost:${port}`;

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
});
