interface ScrapeRecordInput {
  success: boolean;
  isProtected: boolean;
  durationSeconds: number;
}

let scrapeSuccessProtected = 0;
let scrapeSuccessUnprotected = 0;
let scrapeFailureProtected = 0;
let scrapeFailureUnprotected = 0;
let scrapeDurationSecondsSum = 0;
let scrapeDurationSecondsCount = 0;

let mapSuccess = 0;
let mapFailure = 0;

let crawlSuccess = 0;
let crawlFailure = 0;

/**
 * Resets all collected metrics to zero. Mainly useful for unit tests.
 */
export function clearMetrics(): void {
  scrapeSuccessProtected = 0;
  scrapeSuccessUnprotected = 0;
  scrapeFailureProtected = 0;
  scrapeFailureUnprotected = 0;
  scrapeDurationSecondsSum = 0;
  scrapeDurationSecondsCount = 0;
  mapSuccess = 0;
  mapFailure = 0;
  crawlSuccess = 0;
  crawlFailure = 0;
}

/**
 * Record a single scraping attempt result and its duration.
 */
export function recordScrape(input: ScrapeRecordInput): void {
  if (input.success) {
    if (input.isProtected) {
      scrapeSuccessProtected++;
    } else {
      scrapeSuccessUnprotected++;
    }
  } else {
    if (input.isProtected) {
      scrapeFailureProtected++;
    } else {
      scrapeFailureUnprotected++;
    }
  }
  scrapeDurationSecondsSum += input.durationSeconds;
  scrapeDurationSecondsCount++;
}

/**
 * Record a single sitemap mapping attempt.
 */
export function recordMap(success: boolean): void {
  if (success) {
    mapSuccess++;
  } else {
    mapFailure++;
  }
}

/**
 * Record a single crawling job attempt.
 */
export function recordCrawl(success: boolean): void {
  if (success) {
    crawlSuccess++;
  } else {
    crawlFailure++;
  }
}

/**
 * Generates the Prometheus exposition text format.
 */
export function getMetricsText(): string {
  const lines: string[] = [];

  // Scrape requests total
  lines.push('# HELP lightcrawl_scrape_requests_total Total number of scrape requests.');
  lines.push('# TYPE lightcrawl_scrape_requests_total counter');
  lines.push(`lightcrawl_scrape_requests_total{success="true",protected="true"} ${scrapeSuccessProtected}`);
  lines.push(`lightcrawl_scrape_requests_total{success="true",protected="false"} ${scrapeSuccessUnprotected}`);
  lines.push(`lightcrawl_scrape_requests_total{success="false",protected="true"} ${scrapeFailureProtected}`);
  lines.push(`lightcrawl_scrape_requests_total{success="false",protected="false"} ${scrapeFailureUnprotected}`);

  // Scrape duration sum
  lines.push('# HELP lightcrawl_scrape_duration_seconds_sum Total duration of scrape requests in seconds.');
  lines.push('# TYPE lightcrawl_scrape_duration_seconds_sum counter');
  lines.push(`lightcrawl_scrape_duration_seconds_sum ${scrapeDurationSecondsSum}`);

  // Scrape duration count
  lines.push('# HELP lightcrawl_scrape_duration_seconds_count Total count of scrape requests.');
  lines.push('# TYPE lightcrawl_scrape_duration_seconds_count counter');
  lines.push(`lightcrawl_scrape_duration_seconds_count ${scrapeDurationSecondsCount}`);

  // Map requests total
  lines.push('# HELP lightcrawl_map_requests_total Total number of map requests.');
  lines.push('# TYPE lightcrawl_map_requests_total counter');
  lines.push(`lightcrawl_map_requests_total{success="true"} ${mapSuccess}`);
  lines.push(`lightcrawl_map_requests_total{success="false"} ${mapFailure}`);

  // Crawl requests total
  lines.push('# HELP lightcrawl_crawl_requests_total Total number of crawl requests.');
  lines.push('# TYPE lightcrawl_crawl_requests_total counter');
  lines.push(`lightcrawl_crawl_requests_total{success="true"} ${crawlSuccess}`);
  lines.push(`lightcrawl_crawl_requests_total{success="false"} ${crawlFailure}`);

  return lines.join('\n') + '\n';
}
