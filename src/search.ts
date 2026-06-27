import { scrapeUrl, ScrapeResult } from './scraper';
import { logger } from './logger';

/**
 * Searches the web using the Brave Search API and scrapes the top results concurrently.
 * @param query Search query
 * @param limit Maximum number of search results to scrape (default 5)
 * @returns Array of ScrapeResult objects
 */
export async function searchAndScrape(query: string, limit = 5): Promise<ScrapeResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    throw new Error('BRAVE_SEARCH_API_KEY is not configured');
  }

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Brave Search API returned status ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as { web?: { results?: { url: string; title?: string; description?: string }[] } };
  const results = data.web?.results || [];

  const scrapePromises = results.slice(0, limit).map(async (item) => {
    try {
      const scrapeResult = await scrapeUrl(item.url);
      // Use Brave Search description as fallback for excerpt if not extracted by readability
      if (!scrapeResult.excerpt && item.description) {
        scrapeResult.excerpt = item.description;
      }
      return scrapeResult;
    } catch (error) {
      logger.error('Failed to scrape search result url', {
        url: item.url,
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        success: false,
        url: item.url,
        title: item.title || 'Untitled',
        markdown: `Failed to scrape this page: ${error instanceof Error ? error.message : String(error)}`,
        excerpt: item.description || undefined,
      } as ScrapeResult;
    }
  });

  return Promise.all(scrapePromises);
}
