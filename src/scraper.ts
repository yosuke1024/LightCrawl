import { Page, BrowserContext, Browser } from 'playwright';
import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import UserAgent from 'user-agents';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

// Register the stealth plugin to bypass simple scraper detection
chromium.use(stealthPlugin());

let sharedBrowser: Browser | null = null;
let isInitializing = false;

/**
 * Get or initialize the shared headless browser instance (singleton).
 */
async function getBrowserInstance(): Promise<Browser> {
  if (sharedBrowser && sharedBrowser.isConnected()) {
    return sharedBrowser;
  }

  if (isInitializing) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return getBrowserInstance();
  }

  isInitializing = true;
  try {
    if (sharedBrowser) {
      await sharedBrowser.close().catch(() => {});
    }
    sharedBrowser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Critical for Docker/Railway resource limits
        '--disable-gpu',
      ],
    });
    isInitializing = false;
    return sharedBrowser;
  } catch (error) {
    isInitializing = false;
    throw error;
  }
}

// Clean up browser instance on process exit
process.on('exit', () => {
  if (sharedBrowser) {
    sharedBrowser.close().catch(() => {});
  }
});

/**
 * Concurrency limiter using a simple semaphore queue
 */
class ConcurrencyLimiter {
  private active = 0;
  private queue: (() => void)[] = [];

  constructor() {}

  private get maxConcurrency(): number {
    return parseInt(process.env.MAX_CONCURRENCY || '5', 10);
  }

  async acquire(): Promise<void> {
    if (this.active < this.maxConcurrency) {
      this.active++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) {
      this.active++;
      next();
    }
  }
}

const limiter = new ConcurrencyLimiter();

export interface ScrapeResult {
  success: boolean;
  url: string;
  title: string;
  markdown: string;
  metadata?: {
    description?: string;
    keywords?: string;
    author?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    canonical?: string;
    lang?: string;
  };
  excerpt?: string;
}


/**
 * Perform a smooth scroll to trigger lazy-loaded content.
 * @param page Playwright Page instance
 */
async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 150;
      // Scroll limit to prevent infinite scroll on some sites (10k pixels)
      const maxScrollHeight = 10000;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight || totalHeight >= maxScrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

/**
 * Scrapes a web page, executes auto-scroll, extracts core content via Readability,
 * and converts it to Markdown using Turndown.
 * @param url Target web page URL
 * @returns ScrapeResult object
 */
/**
 * Internal helper to fetch page HTML via Playwright
 */
async function fetchHtml(url: string, skipScroll = false): Promise<string> {
  await limiter.acquire();

  let context: BrowserContext | undefined;
  let page: Page | undefined;

  try {
    const browser = await getBrowserInstance();
    const userAgentGenerator = new UserAgent({ deviceCategory: 'desktop' });
    const userAgent = userAgentGenerator.toString();

    context = await browser.newContext({
      userAgent,
      viewport: { width: 1280, height: 800 },
    });

    page = await context.newPage();
    
    // Set default timeout for navigation (30 seconds)
    page.setDefaultNavigationTimeout(30000);

    // Navigate to the target URL
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    if (!skipScroll) {
      // Smooth scroll down to trigger lazy loading
      await autoScroll(page);

      // Wait 2 seconds as specified in the architecture document
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Retrieve HTML content
    const html = await page.content();

    // Close page and context in orderly fashion to avoid unhandled CDP errors
    await page.close();
    await context.close();

    // Reset references
    page = undefined;
    context = undefined;

    return html;
  } catch (error) {
    // Ensure all resources are closed even on errors
    if (page) {
      try {
        await page.close();
      } catch {
        // Safe to ignore
      }
    }
    if (context) {
      try {
        await context.close();
      } catch {
        // Safe to ignore
      }
    }
    throw error;
  } finally {
    limiter.release();
  }
}

/**
 * Scrapes a web page, executes auto-scroll, extracts core content via Readability,
 * and converts it to Markdown using Turndown.
 * @param url Target web page URL
 * @param mode Scrape mode: 'article' (extract core content) or 'full' (raw page content)
 * @returns ScrapeResult object
 */
export async function scrapeUrl(url: string, mode: 'article' | 'full' = 'article'): Promise<ScrapeResult> {
  const html = await fetchHtml(url);

  // Parse HTML with JSDOM
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;

  // Extract title & target HTML
  let title = document.title || 'Untitled';
  let targetHtml = document.body.innerHTML;
  let excerpt: string | undefined;

  if (mode === 'article') {
    // Use Readability to extract core article content
    const reader = new Readability(document);
    const article = reader.parse();
    if (article) {
      title = article.title || title;
      targetHtml = article.content || targetHtml;
      excerpt = article.excerpt || undefined;
    }
  }

  // Extract metadata
  const metadata: NonNullable<ScrapeResult['metadata']> = {};
  
  const getMeta = (nameOrProperty: string): string | undefined => {
    const element = document.querySelector(
      `meta[name="${nameOrProperty}"], meta[property="${nameOrProperty}"]`
    );
    return element?.getAttribute('content') || undefined;
  };

  metadata.description = getMeta('description');
  metadata.keywords = getMeta('keywords');
  metadata.author = getMeta('author');
  metadata.ogTitle = getMeta('og:title');
  metadata.ogDescription = getMeta('og:description');
  metadata.ogImage = getMeta('og:image');

  const canonicalEl = document.querySelector('link[rel="canonical"]');
  metadata.canonical = canonicalEl?.getAttribute('href') || undefined;

  const htmlEl = document.querySelector('html');
  metadata.lang = htmlEl?.getAttribute('lang') || undefined;

  // Convert HTML to Markdown
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });

  const markdown = turndownService.turndown(targetHtml);

  return {
    success: true,
    url,
    title,
    markdown,
    metadata: Object.values(metadata).some(val => val !== undefined) ? metadata : undefined,
    excerpt,
  };
}

/**
 * Helper to get the registered domain (eTLD+1) from a hostname.
 * Simple implementation for matching same website subdomains.
 */
function getRegisteredDomain(hostname: string): string {
  if (/^[0-9.]+$/.test(hostname) || hostname.includes(':')) {
    return hostname;
  }
  const parts = hostname.split('.');
  if (parts.length <= 2) {
    return hostname;
  }
  const secondToLast = parts[parts.length - 2].toLowerCase();
  const last = parts[parts.length - 1].toLowerCase();

  // If the second to last part is a common second-level domain under a ccTLD
  const isSecondLevel = /^(co|ne|ac|go|or|ad|pe|lg|com|net|org|edu|gov|mil)$/.test(secondToLast) &&
    /^(jp|uk|kr|cn|au|nz|tw|hk|sg|in|br|za)$/.test(last);

  if (isSecondLevel && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

/**
 * Extracts all unique, internal HTTP/HTTPS links from HTML content.
 * Matches same registered domain (subdomains allowed).
 */
function extractInternalLinks(html: string, baseUrl: string): string[] {
  const dom = new JSDOM(html, { url: baseUrl });
  const document = dom.window.document;
  const links = Array.from(document.querySelectorAll('a[href]'));

  const baseUrlObj = new URL(baseUrl);
  const baseRegDomain = getRegisteredDomain(baseUrlObj.hostname);
  const uniqueUrls = new Set<string>();

  for (const link of links) {
    const href = link.getAttribute('href');
    if (!href) continue;

    try {
      const absoluteUrl = new URL(href, baseUrl);
      if (absoluteUrl.protocol !== 'http:' && absoluteUrl.protocol !== 'https:') {
        continue;
      }
      const linkRegDomain = getRegisteredDomain(absoluteUrl.hostname);
      if (linkRegDomain === baseRegDomain) {
        absoluteUrl.hash = '';
        uniqueUrls.add(absoluteUrl.href);
      }
    } catch {
      // Ignore invalid URLs
    }
  }

  return Array.from(uniqueUrls);
}

/**
 * Extracts all unique HTTP/HTTPS links from HTML content without domain restriction.
 */
function extractAllLinks(html: string, baseUrl: string): string[] {
  const dom = new JSDOM(html, { url: baseUrl });
  const document = dom.window.document;
  const links = Array.from(document.querySelectorAll('a[href]'));

  const uniqueUrls = new Set<string>();

  for (const link of links) {
    const href = link.getAttribute('href');
    if (!href) continue;

    try {
      const absoluteUrl = new URL(href, baseUrl);
      if (absoluteUrl.protocol === 'http:' || absoluteUrl.protocol === 'https:') {
        absoluteUrl.hash = '';
        uniqueUrls.add(absoluteUrl.href);
      }
    } catch {
      // Ignore invalid URLs
    }
  }

  return Array.from(uniqueUrls);
}



/**
 * Extracts all unique, internal HTTP/HTTPS links from a target page.
 * @param url Target web page URL
 * @returns Array of unique absolute URLs belonging to the same host
 */
export async function mapUrl(url: string): Promise<string[]> {
  const html = await fetchHtml(url, true); // Skip scroll for fast map
  return extractInternalLinks(html, url);
}

/**
 * Simple crawl function using memory-based queue.
 * Crawls up to limits and returns scrape results.
 */
export async function crawlUrl(
  startUrl: string,
  limit = 10,
  maxDepth = 2
): Promise<ScrapeResult[]> {
  const finalLimit = Math.min(limit, 20);
  const finalMaxDepth = Math.min(maxDepth, 3);

  const results: ScrapeResult[] = [];
  const visited = new Set<string>();
  const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 1 }];

  while (queue.length > 0 && results.length < finalLimit) {
    const current = queue.shift();
    if (!current) continue;

    if (visited.has(current.url)) {
      continue;
    }
    visited.add(current.url);

    try {
      const html = await fetchHtml(current.url);

      // Parse with JSDOM
      const dom = new JSDOM(html, { url: current.url });
      const document = dom.window.document;

      const reader = new Readability(document);
      const article = reader.parse();
      const title = article?.title || document.title || 'Untitled';

      const metadata: NonNullable<ScrapeResult['metadata']> = {};
      const getMeta = (nameOrProperty: string): string | undefined => {
        const element = document.querySelector(
          `meta[name="${nameOrProperty}"], meta[property="${nameOrProperty}"]`
        );
        return element?.getAttribute('content') || undefined;
      };

      metadata.description = getMeta('description');
      metadata.keywords = getMeta('keywords');
      metadata.author = getMeta('author');
      metadata.ogTitle = getMeta('og:title');
      metadata.ogDescription = getMeta('og:description');
      metadata.ogImage = getMeta('og:image');

      const canonicalEl = document.querySelector('link[rel="canonical"]');
      metadata.canonical = canonicalEl?.getAttribute('href') || undefined;

      const htmlEl = document.querySelector('html');
      metadata.lang = htmlEl?.getAttribute('lang') || undefined;

      const excerpt = article?.excerpt || undefined;

      const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
      });
      const targetHtml = article?.content || document.body.innerHTML;
      const markdown = turndownService.turndown(targetHtml);

      results.push({
        success: true,
        url: current.url,
        title,
        markdown,
        metadata: Object.values(metadata).some(val => val !== undefined) ? metadata : undefined,
        excerpt,
      });

      if (results.length >= finalLimit) {
        break;
      }

      if (current.depth < finalMaxDepth) {
        const links = extractAllLinks(html, current.url);
        for (const link of links) {
          if (!visited.has(link)) {
            queue.push({ url: link, depth: current.depth + 1 });
          }
        }
      }
    } catch (error) {
      console.error(`[Crawl] Failed to crawl ${current.url}:`, error);
    }
  }

  return results;
}
