import { Page, BrowserContext, Browser } from 'playwright';
import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import UserAgent from 'user-agents';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { getDomain } from 'tldts';
import Redis from 'ioredis';
import { recordScrape, recordMap, recordCrawl } from './metrics';
import { logger } from './logger';

// Register the stealth plugin to bypass simple scraper detection
chromium.use(stealthPlugin());

let sharedBrowser: Browser | null = null;
let isInitializing = false;

let redisClient: Redis | null = null;

/**
 * Get or initialize the shared Redis client instance (singleton).
 */
export function getRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is not configured');
  }
  if (!redisClient) {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    redisClient.on('error', (err) => {
      console.error('[Redis] Client error:', err);
    });
  }
  return redisClient;
}

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

// Clean up browser instance and Redis client on process exit
process.on('exit', () => {
  if (sharedBrowser) {
    sharedBrowser.close().catch(() => {});
  }
  if (redisClient) {
    redisClient.disconnect();
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
interface FetchResult {
  html: string;
  isProtected: boolean;
}

/**
 * Internal helper to fetch page HTML via Playwright
 */
async function fetchHtml(url: string, skipScroll = false): Promise<FetchResult> {
  await limiter.acquire();

  let context: BrowserContext | undefined;
  let page: Page | undefined;
  let isProtected = false;

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
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });

    if (response) {
      const headers = await response.allHeaders();
      const serverHeader = headers['server']?.toLowerCase() || '';
      const status = response.status();
      if (serverHeader.includes('cloudflare') || status === 403 || status === 503) {
        isProtected = true;
      }
    }

    if (!skipScroll) {
      // Smooth scroll down to trigger lazy loading
      await autoScroll(page);

      // Wait 2 seconds as specified in the architecture document
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Retrieve HTML content
    const html = await page.content();
    const title = await page.title();

    if (
      title.toLowerCase().includes('cloudflare') ||
      title.toLowerCase().includes('access denied') ||
      title.toLowerCase().includes('just a moment') ||
      html.includes('cf-challenge') ||
      html.includes('cf-browser-verification')
    ) {
      isProtected = true;
    }

    // Close page and context in orderly fashion to avoid unhandled CDP errors
    await page.close();
    await context.close();

    // Reset references
    page = undefined;
    context = undefined;

    return { html, isProtected };
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
  const startTime = Date.now();
  let isProtected = false;
  try {
    const fetchResult = await fetchHtml(url);
    isProtected = fetchResult.isProtected;
    const html = fetchResult.html;

    if (isProtected) {
      throw new Error('Access Denied: Protected page detected (e.g. Cloudflare)');
    }

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

    const durationSeconds = (Date.now() - startTime) / 1000;
    recordScrape({ success: true, isProtected, durationSeconds });

    logger.info('Scrape completed successfully', {
      url,
      mode,
      durationMs: durationSeconds * 1000,
      success: true,
      isProtected,
    });

    return {
      success: true,
      url,
      title,
      markdown,
      metadata: Object.values(metadata).some(val => val !== undefined) ? metadata : undefined,
      excerpt,
    };
  } catch (error) {
    const durationSeconds = (Date.now() - startTime) / 1000;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const hasProtectionIndicators = errorMessage.toLowerCase().includes('cloudflare') || 
                                    errorMessage.toLowerCase().includes('access denied') ||
                                    errorMessage.toLowerCase().includes('403') ||
                                    errorMessage.toLowerCase().includes('503');
    
    const finalIsProtected = isProtected || hasProtectionIndicators;

    recordScrape({ success: false, isProtected: finalIsProtected, durationSeconds });

    logger.error('Scrape failed', {
      url,
      mode,
      durationMs: durationSeconds * 1000,
      success: false,
      isProtected: finalIsProtected,
      error: errorMessage,
    });

    throw error;
  }
}

/**
 * Helper to get the registered domain (eTLD+1) from a hostname.
 * Simple implementation for matching same website subdomains.
 */
export function getRegisteredDomain(hostname: string): string {
  if (/^[0-9.]+$/.test(hostname) || hostname.includes(':')) {
    return hostname;
  }
  return getDomain(hostname) || hostname;
}

/**
 * Extracts all unique, internal HTTP/HTTPS links from HTML content.
 * Matches same registered domain (subdomains allowed).
 */
export function extractInternalLinks(html: string, baseUrl: string): string[] {
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
 * Common HTML parser to ScrapeResult function.
 */
function parseScrapeResult(html: string, url: string): ScrapeResult {
  const dom = new JSDOM(html, { url });
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
 * Extracts all unique, internal HTTP/HTTPS links from a target page.
 * @param url Target web page URL
 * @returns Array of unique absolute URLs belonging to the same host
 */
export async function mapUrl(url: string): Promise<string[]> {
  try {
    const fetchResult = await fetchHtml(url, true); // Skip scroll for fast map
    const links = extractInternalLinks(fetchResult.html, url);
    recordMap(true);
    logger.info('Map completed successfully', {
      url,
      linksCount: links.length,
      success: true,
    });
    return links;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    recordMap(false);
    logger.error('Map failed', {
      url,
      success: false,
      error: errorMessage,
    });
    throw error;
  }
}

/**
 * Redis-based distributed crawl function.
 */
async function crawlUrlRedis(
  startUrl: string,
  limit: number,
  maxDepth: number
): Promise<ScrapeResult[]> {
  const redis = getRedisClient();
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Set up job state in Redis
  await redis.sadd('lightcrawl:active_jobs', jobId);
  await redis.rpush(
    `lightcrawl:queue:${jobId}`,
    JSON.stringify({ url: startUrl, depth: 1, maxDepth, limit })
  );
  await redis.set(`lightcrawl:pending_count:${jobId}`, '1');

  // Loop as a worker for this job until completion
  while (true) {
    const resultCount = await redis.llen(`lightcrawl:results:${jobId}`);
    if (resultCount >= limit) {
      break;
    }

    const pendingStr = await redis.get(`lightcrawl:pending_count:${jobId}`);
    const pendingCount = pendingStr ? parseInt(pendingStr, 10) : 0;
    const queueLength = await redis.llen(`lightcrawl:queue:${jobId}`);

    if (queueLength === 0 && pendingCount === 0) {
      break;
    }

    const itemStr = await redis.rpop(`lightcrawl:queue:${jobId}`);
    if (!itemStr) {
      if (pendingCount > 0) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        continue;
      }
      break;
    }

    const { url, depth } = JSON.parse(itemStr);

    const isNew = await redis.sadd(`lightcrawl:visited:${jobId}`, url);
    if (isNew === 0) {
      await redis.decr(`lightcrawl:pending_count:${jobId}`);
      continue;
    }

    try {
      const fetchResult = await fetchHtml(url);
      const result = parseScrapeResult(fetchResult.html, url);
      await redis.rpush(`lightcrawl:results:${jobId}`, JSON.stringify(result));

      const currentResultsCount = await redis.llen(`lightcrawl:results:${jobId}`);
      if (currentResultsCount < limit && depth < maxDepth) {
        const links = extractAllLinks(fetchResult.html, url);
        let addedCount = 0;
        for (const link of links) {
          const isVisited = await redis.sismember(`lightcrawl:visited:${jobId}`, link);
          if (!isVisited) {
            await redis.lpush(
              `lightcrawl:queue:${jobId}`,
              JSON.stringify({ url: link, depth: depth + 1, maxDepth, limit })
            );
            addedCount++;
          }
        }
        if (addedCount > 0) {
          await redis.incrby(`lightcrawl:pending_count:${jobId}`, addedCount);
        }
      }
    } catch (error) {
      console.error(`[Crawl Redis] Error crawling ${url}:`, error);
    } finally {
      await redis.decr(`lightcrawl:pending_count:${jobId}`);
    }
  }

  // Fetch results
  const rawResults = await redis.lrange(`lightcrawl:results:${jobId}`, 0, -1);
  const results = rawResults.map((r) => JSON.parse(r) as ScrapeResult);

  // Clean up
  await redis.del(
    `lightcrawl:queue:${jobId}`,
    `lightcrawl:visited:${jobId}`,
    `lightcrawl:results:${jobId}`,
    `lightcrawl:pending_count:${jobId}`
  );
  await redis.srem('lightcrawl:active_jobs', jobId);

  return results.slice(0, limit);
}

/**
 * Polling worker logic for distributed crawl.
 * Polls active jobs and assists in crawling their queues.
 */
export async function startRedisWorker(signal?: { aborted: boolean }): Promise<void> {
  const redis = getRedisClient();
  console.error('[Redis Worker] Started cooperating crawl worker');

  while (!signal?.aborted) {
    try {
      const activeJobs = await redis.smembers('lightcrawl:active_jobs');
      if (activeJobs.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      let processedAny = false;
      for (const jobId of activeJobs) {
        const itemStr = await redis.rpop(`lightcrawl:queue:${jobId}`);
        if (!itemStr) {
          continue;
        }
        processedAny = true;

        const { url, depth, maxDepth, limit } = JSON.parse(itemStr);

        const isNew = await redis.sadd(`lightcrawl:visited:${jobId}`, url);
        if (isNew === 0) {
          await redis.decr(`lightcrawl:pending_count:${jobId}`);
          continue;
        }

        try {
          const fetchResult = await fetchHtml(url);
          const result = parseScrapeResult(fetchResult.html, url);
          await redis.rpush(`lightcrawl:results:${jobId}`, JSON.stringify(result));

          const currentResultsCount = await redis.llen(`lightcrawl:results:${jobId}`);
          if (currentResultsCount < limit && depth < maxDepth) {
            const links = extractAllLinks(fetchResult.html, url);
            let addedCount = 0;
            for (const link of links) {
              const isVisited = await redis.sismember(`lightcrawl:visited:${jobId}`, link);
              if (!isVisited) {
                await redis.lpush(
                  `lightcrawl:queue:${jobId}`,
                  JSON.stringify({ url: link, depth: depth + 1, maxDepth, limit })
                );
                addedCount++;
              }
            }
            if (addedCount > 0) {
              await redis.incrby(`lightcrawl:pending_count:${jobId}`, addedCount);
            }
          }
        } catch (error) {
          console.error(`[Redis Worker] Error crawling ${url} for job ${jobId}:`, error);
        } finally {
          await redis.decr(`lightcrawl:pending_count:${jobId}`);
        }
      }

      if (!processedAny) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error('[Redis Worker] Error in worker loop:', error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

/**
 * Simple crawl function using memory-based queue (in-memory execution).
 */
async function crawlUrlInMemory(
  startUrl: string,
  limit: number,
  maxDepth: number
): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];
  const visited = new Set<string>();
  const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 1 }];

  while (queue.length > 0 && results.length < limit) {
    const current = queue.shift();
    if (!current) continue;

    if (visited.has(current.url)) {
      continue;
    }
    visited.add(current.url);

    try {
      const fetchResult = await fetchHtml(current.url);
      const result = parseScrapeResult(fetchResult.html, current.url);
      results.push(result);

      if (results.length >= limit) {
        break;
      }

      if (current.depth < maxDepth) {
        const links = extractAllLinks(fetchResult.html, current.url);
        for (const link of links) {
          if (!visited.has(link)) {
            queue.push({ url: link, depth: current.depth + 1 });
          }
        }
      }
    } catch (error) {
      console.error('[Crawl] Failed to crawl %s:', current.url, error);
    }
  }

  return results;
}

/**
 * Simple crawl function using memory-based queue or Redis-based distributed queue.
 * Crawls up to limits and returns scrape results.
 */
export async function crawlUrl(
  startUrl: string,
  limit = 10,
  maxDepth = 2
): Promise<ScrapeResult[]> {
  const finalLimit = Math.min(limit, 20);
  const finalMaxDepth = Math.min(maxDepth, 3);

  const redisUrl = process.env.REDIS_URL;
  const startTime = Date.now();
  
  try {
    let results: ScrapeResult[];
    if (redisUrl) {
      results = await crawlUrlRedis(startUrl, finalLimit, finalMaxDepth);
    } else {
      results = await crawlUrlInMemory(startUrl, finalLimit, finalMaxDepth);
    }
    
    recordCrawl(true);
    logger.info('Crawl completed successfully', {
      url: startUrl,
      limit: finalLimit,
      maxDepth: finalMaxDepth,
      resultsCount: results.length,
      durationMs: Date.now() - startTime,
      success: true,
      useRedis: !!redisUrl,
    });
    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    recordCrawl(false);
    logger.error('Crawl failed', {
      url: startUrl,
      limit: finalLimit,
      maxDepth: finalMaxDepth,
      durationMs: Date.now() - startTime,
      success: false,
      useRedis: !!redisUrl,
      error: errorMessage,
    });
    throw error;
  }
}
