---
status: implemented
---

# API & MCP Specifications — LightCrawl

This document serves as the Single Source of Truth (SSOT) for LightCrawl's HTTP API and Model Context Protocol (MCP) server interfaces.

## 1. HTTP API

The HTTP API is powered by Express and listens on the port configured via the `PORT` environment variable (default: `3000`).

### Authentication & Access Control

If configured via environment variables, the API applies the following restrictions:

1. **API Key Authentication**:
   - Triggered by setting the `API_KEY` environment variable.
   - Clients must authenticate by sending the key in the `Authorization` header as a Bearer token:
     `Authorization: Bearer <YOUR_API_KEY>`
     Or as a query parameter:
     `?url=...&key=<YOUR_API_KEY>`
2. **IP Whitelisting**:
   - Triggered by setting the `ALLOWED_IPS` environment variable (comma-separated, e.g., `127.0.0.1,203.0.113.50`).
   - Requests from non-whitelisted IPs will receive a `403 Forbidden` response. Supports `x-forwarded-for` header for reverse proxy environments.

### Configuration (Environment Variables)

The server supports the following environment variables for configuration:

1. **`API_KEY`**: Optional API key for authenticating HTTP/MCP requests.
2. **`ALLOWED_IPS`**: Optional comma-separated list of allowed client IP addresses.
3. **`REDIS_URL`**: Optional Redis connection URL (e.g., `redis://localhost:6379`). When provided, crawling operations will use Redis as a distributed queue and state backend instead of single-process memory.
4. **`ENABLE_DISTRIBUTED_WORKER`**: Optional boolean string (`true` or `false`, default: `true`). When `REDIS_URL` is set, a distributed worker is automatically started on startup to cooperatively process crawl queues. Set to `false` to run as a thin API client only.

---

### Endpoints

#### GET `/api-docs`
Launches the interactive Swagger UI. You can test all endpoints (/scrape, /map, /crawl) directly from this page in your browser.
- **URL**: `http://localhost:3000/api-docs/`
- **Authentication**: None

#### GET `/openapi.json`
Returns the raw OpenAPI 3.0.3 specification JSON object used by the Swagger UI.
- **Authentication**: None

#### GET /health
Returns the operational status of the server.
- Authentication: None
- Response (JSON):
  ```json
  { "status": "ok" }
  ```

#### GET `/metrics`
Returns Prometheus-compatible metrics for monitoring application latency and success rates.
- Authentication: None
- Response (Plain Text): Prometheus exposition format including `lightcrawl_scrape_requests_total`, `lightcrawl_scrape_duration_seconds_sum`, etc.

#### GET `/scrape`
Scrapes a single URL, converts its main content to Markdown, and extracts metadata.
- **Authentication**: Required if configured.
- **Query Parameters**:
  - `url` (string, required): The URL to scrape.
- **Response (JSON)**:
  ```json
  {
    "success": true,
    "url": "https://example.com",
    "title": "Example Domain",
    "markdown": "# Example Domain\n\nThis domain is...",
    "metadata": {
      "description": "Example description",
      "canonical": "https://example.com/",
      "lang": "en"
    },
    "excerpt": "This domain is for use in documentation..."
  }
  ```

#### GET `/map`
Extracts unique, absolute internal URLs belonging to the same registered domain (subdomains allowed) from the target page.
- **Authentication**: Required if configured.
- **Query Parameters**:
  - `url` (string, required): The target homepage URL to map.
- **Response (JSON)**:
  ```json
  [
    "https://example.com/",
    "https://example.com/about",
    "https://blog.example.com/posts"
  ]
  ```

#### GET `/crawl`
Crawls the web starting from the target URL, navigating internal and external links up to depth and count limits.
- **Authentication**: Required if configured.
- **Query Parameters**:
  - `url` (string, required): The starting URL.
  - `limit` (integer, optional): Maximum pages to crawl (default: `10`, max: `20`).
  - `maxDepth` (integer, optional): Maximum search depth (default: `2`, max: `3`).
- **Response (JSON)**:
  ```json
  [
    {
      "success": true,
      "url": "https://example.com",
      "title": "Example Domain",
      "markdown": "# Example Domain\n...",
      "metadata": { "lang": "en" }
    },
    {
      "success": true,
      "url": "https://iana.org/domains/reserved",
      "title": "IANA Reserved Domains",
      "markdown": "# Reserved Domains\n...",
      "metadata": { "lang": "en" }
    }
  ]
  ```

---

## 2. MCP Server (Model Context Protocol)

LightCrawl runs as an MCP server over Stdio transport (`StdioServerTransport`). All logging goes to `stderr` to prevent JSON-RPC corruption on `stdout`.

### Provided Tools

#### `lightcrawl_scrape`
Accesses a web page, strips unnecessary elements (headers, footers, sidebars), and extracts clean Markdown text.
- **Input Arguments**:
  - `url` (string, required): The HTTP/HTTPS URL of the web page to scrape.
- **Output (Plain Text)**: The raw Markdown string extracted from the target page.

#### `lightcrawl_map`
Extracts all internal URLs (including subdomains of the same registered domain) from a target website to build a site map.
- **Input Arguments**:
  - `url` (string, required): The starting HTTP/HTTPS URL of the website.
- **Output (JSON String)**: A JSON stringified array of absolute URLs.

#### `lightcrawl_crawl`
Performs a simple crawl starting from the target URL, navigating links up to depth and count limits without domain restrictions.
- **Input Arguments**:
  - `url` (string, required): The starting HTTP/HTTPS URL to crawl.
  - `limit` (integer, optional): Maximum number of pages to crawl (default `10`, max `20`).
  - `maxDepth` (integer, optional): Maximum crawl depth (default `2`, max `3`).
- **Output (JSON String)**: A JSON stringified array of `ScrapeResult` objects representing all crawled pages.

---

## 3. Observability & Logging

### Structured Logging
LightCrawl features a structured logger that outputs all logs in JSON format.
- **Log Target**: Logs are output exclusively to `stderr` (`console.error`). This design prevents any interference or corruption of the MCP stdio communication channel on `stdout`.
- **Payload Format**: Includes fields such as `level`, `message`, `timestamp`, `url`, `durationMs`, `success`, and `isProtected`.

### Prometheus Metrics
Exposes performance and operational metrics on the `/metrics` endpoint:
- `lightcrawl_scrape_requests_total{success="true|false",protected="true|false"}`: Tracks total scrape requests, distinguishing between successful/failed and protected/unprotected web targets.
- `lightcrawl_scrape_duration_seconds_sum` / `_count`: Tracks total latency sum and request counts to measure average scrape durations.
- `lightcrawl_map_requests_total{success="true|false"}`: Tracks website mapping operations.
- `lightcrawl_crawl_requests_total{success="true|false"}`: Tracks distributed/in-memory crawling operations.

### Anti-Bot & Protection Detection
- Detects whether target sites are strictly protected (e.g. using Cloudflare or bot protection) by inspecting HTTP status codes (403/503), response headers (`server: cloudflare`), and HTML/title keywords (`cf-challenge`, `just a moment`, etc.).
- When a protected page is detected, LightCrawl registers it as `protected="true"` and aborts the request with an error, logging it as a failed scrape with protection flags.

---

## Implementation Report

### Implemented Features (June 2026)
- **Metadata and Excerpt Extraction**: Integrated metadata extraction (description, keywords, author, ogTitle, ogDescription, ogImage, canonical, lang) and article excerpts from Mozilla Readability into the default scraping output.
- **Site Mapping (`/map` & `lightcrawl_map`)**: Added link harvesting restricted to the same registered domain (e.g. allowing `*.yahoo.co.jp` when mapping `www.yahoo.co.jp`).
- **Web Crawling (`/crawl` & `lightcrawl_crawl`)**: Added BFS-based simple crawling limited by depth and count, allowing cross-domain crawling to support document aggregation.
- **Full Test Suite & Quality Assurance**: Created comprehensive tests for all HTTP and MCP interfaces. Checked with strictly-typed TS compilations and ESLint rules.
- **Domain Matching Accuracy & Redis Scalability**:
  - Replaced custom ccTLD suffix matching with `tldts` library, supporting 100% correct eTLD+1 matching for complex subdomains.
  - Implemented opt-in Redis-backed distributed crawl queue and state manager using `ioredis`.
  - Added cooperative background worker which runs on server boot when `REDIS_URL` is present.
- **Structured Logging & Prometheus Metrics**:
  - Added JSON structured logging to `stderr` to maintain MCP stability.
  - Implemented native Prometheus metrics exporter format under `/metrics` to track average latencies and success rates.
  - Added response header, title, and HTML analysis for Cloudflare/bot protection detection, measuring success rates on strictly protected sites.
- **Hacker News Launch Preparation**:
  - Replaced the repository URL placeholder in `README.md` with the official link.
  - Copied `docs/current/api_and_mcp_specifications.md` to `docs/api_and_mcp_specifications.md` to make the specification document publicly visible while maintaining the internal AI agent workspace isolation rules.

