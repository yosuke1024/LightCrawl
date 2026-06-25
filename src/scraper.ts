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
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
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

    // Smooth scroll down to trigger lazy loading
    await autoScroll(page);

    // Wait 2 seconds as specified in the architecture document
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Retrieve HTML content
    const html = await page.content();

    // Close page and context in orderly fashion to avoid unhandled CDP errors
    await page.close();
    await context.close();

    // Reset references to prevent double close in catch block
    page = undefined;
    context = undefined;

    // Parse HTML with JSDOM
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;

    // Use Readability to extract core article content
    const reader = new Readability(document);
    const article = reader.parse();

    // Extract title (fallback to HTML title)
    const title = article?.title || document.title || 'Untitled';

    // Convert HTML to Markdown
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });

    const targetHtml = article?.content || document.body.innerHTML;
    const markdown = turndownService.turndown(targetHtml);

    return {
      success: true,
      url,
      title,
      markdown,
    };
  } catch (error) {
    // Ensure all resources are closed even on errors
    if (page) {
      try {
        await page.close();
      } catch (e) {
        // Safe to ignore on emergency cleanup
      }
    }
    if (context) {
      try {
        await context.close();
      } catch (e) {
        // Safe to ignore
      }
    }
    throw error;
  } finally {
    limiter.release();
  }
}
