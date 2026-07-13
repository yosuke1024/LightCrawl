import { describe, it, expect } from 'vitest';
import { getRawHtml, getBodyText, getLightcrawlFull, getLightcrawlArticle } from '../src/extractors';

describe('extractors', () => {
  const sampleHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test Page</title>
        <style>body { color: red; }</style>
        <script>console.log("hello");</script>
      </head>
      <body>
        <noscript>No script here</noscript>
        <h1>Main Title</h1>
        <div class="content">
          <p>This is the article content.</p>
        </div>
      </body>
    </html>
  `;

  it('getRawHtml should return exact HTML string', () => {
    expect(getRawHtml(sampleHtml)).toBe(sampleHtml);
  });

  it('getBodyText should remove script, style, noscript and return text content', () => {
    const text = getBodyText(sampleHtml);
    expect(text).not.toContain('color: red;');
    expect(text).not.toContain('console.log');
    expect(text).not.toContain('No script here');
    expect(text).toContain('Main Title');
    expect(text).toContain('This is the article content.');
  });

  it('getLightcrawlFull should convert full body to markdown', () => {
    const md = getLightcrawlFull(sampleHtml, 'http://example.com');
    expect(md).toContain('# Main Title');
    expect(md).toContain('This is the article content.');
  });

  it('getLightcrawlArticle should extract core article', () => {
    const md = getLightcrawlArticle(sampleHtml, 'http://example.com');
    expect(md).toContain('# Main Title');
    expect(md).toContain('This is the article content.');
  });
});
