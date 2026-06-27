# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-06-27

### Added
- **Playground Dashboard UI**:
  - Interactive web playground available at the root URL `/` for non-engineers and developers to test scraping visual outcomes.
  - Split-screen layout displaying scraping configuration and metadata on the left, and parsed Markdown rendering, raw code with syntax highlighting (PrismJS), or original site (iframe) on the right.
  - Zero-dependency architecture utilizing only basic HTML/CSS/JS with CDN links (marked.js, PrismJS, Lucide icons), maintaining zero impact on application start time, memory, or Docker image size.
  - 1-click clipboard copy feature for raw Markdown output.
  - Subtle and premium "by PixApps" branding links integrated into the header.

## [1.1.0] - 2026-06-27

### Added
- **Web Search & Parallel Scraping**:
  - Optional `GET /search` API endpoint and `lightcrawl_search` MCP tool using Brave Search API (opt-in via `BRAVE_SEARCH_API_KEY` env var).
  - Support for concurrently scraping retrieved search results to return clean Markdown.
  - Dynamically exclude the `lightcrawl_search` tool from MCP client listings when Brave Search is not configured.
- **Web Crawling Optimizations**:
  - Global crawl execution timeout (`timeoutMs`, default 45 seconds) and checked pages limit (`maxCheckedPages`, default `limit * 2` or max `40`).
  - Supports returning partial results gathered so far when timeouts or page limits are encountered (applies to both in-memory and Redis distributed crawling).
- **Performance Optimizations (Hybrid Mode & Fast Mode)**:
  - Added **Hybrid Mode** to automatically try lightweight static HTTP `fetch` first, falling back to Playwright only if the page content requires JS rendering or is protected by anti-bot checks (default behavior).
  - Added **Fast Mode (`fast=true`)** parameter to both API endpoints (`/scrape`, `/crawl`) and MCP tools (`lightcrawl_scrape`, `lightcrawl_crawl`), which uses the ultra-fast `linkedom` DOM parser instead of `jsdom`, and skips the Playwright auto-scroll and 2-second sleep delay for sub-second responses.

## [1.0.0] - 2026-06-26

### Added
- **Core Scraping Engine**:
  - Combined Playwright (for dynamic rendering/lazy loading) and JSDOM (for static pages) to ensure robust and fast HTML retrieval.
  - Implemented Mozilla Readability content extraction to clean headers, footers, sidebars, and advertising.
  - Fully integrated og-metadata and article excerpt extraction into the default JSON response.
- **HTTP API**:
  - `GET /scrape`: Scrapes a single URL and returns cleaned Markdown, title, metadata, and excerpt.
  - `GET /map`: Extracts unique, absolute internal URLs belonging to the same registered domain using `tldts` for accurate eTLD+1 matching.
  - `GET /crawl`: Runs a simple BFS crawler starting from a target URL up to depth and count limits.
  - `GET /metrics`: Exposes Prometheus-compatible performance metrics (latencies, counts, success/failure rate, bot protection hits).
  - `GET /api-docs` & `/openapi.json`: Interactive Swagger UI documentation.
  - Implemented secure `API_KEY` authentication and `ALLOWED_IPS` whitelisting middleware.
- **MCP Server (Model Context Protocol)**:
  - Supports standard Stdio transport for local AI assistant clients (Cline, Cursor, Claude Desktop, etc.).
  - Registered MCP tools: `lightcrawl_scrape`, `lightcrawl_map`, and `lightcrawl_crawl`.
  - Structured JSON logging strictly directed to `stderr` to prevent JSON-RPC channel corruption on `stdout`.
- **Infrastructure & Scalability**:
  - Multi-threaded distributed crawling option using Redis (via `ioredis`) for scalable BFS task queues.
  - Self-hosted deployment setup via `Dockerfile` and `railway.json` configuration.
  - Cloudflare and anti-bot challenge detection and metrics tracking.
