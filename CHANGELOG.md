# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
