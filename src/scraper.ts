import { Page, BrowserContext } from 'playwright';
import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import UserAgent from 'user-agents';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

// Register the stealth plugin to bypass simple scraper detection
chromium.use(stealthPlugin());

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
  // Generate a random user agent to mimic a real browser
  const userAgentGenerator = new UserAgent({ deviceCategory: 'desktop' });
  const userAgent = userAgentGenerator.toString();

  // Launch headless Chromium
  const browser = await chromium.launch({
    headless: true,
  });

  let context: BrowserContext | undefined;
  let page: Page | undefined;

  try {
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

    // Close page, context and browser in orderly fashion to avoid unhandled CDP errors
    await page.close();
    await context.close();
    await browser.close();

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
    try {
      await browser.close();
    } catch (e) {
      // Safe to ignore
    }
    throw error;
  }
}
