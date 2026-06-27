<p align="center">
  <img src="assets/logo.png" alt="LightCrawl Logo" width="200" height="200">
</p>

# LightCrawl

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/node-%3E%3D18-blue.svg" alt="Node.js Version">
  <a href="https://railway.com/deploy/lightcrawl?referralCode=lR1Ra-&utm_medium=integration&utm_source=template&utm_campaign=generic"><img src="https://railway.com/button.svg" alt="Deploy on Railway"></a>
  <a href="https://github.com/sponsors/yosuke1024"><img src="https://img.shields.io/badge/Sponsor-%E2%9D%A4-db61a2?logo=github-sponsors" alt="Sponsor"></a>
</p>

LightCrawl is a lightweight, single-container, self-hostable Web scraping API and Model Context Protocol (MCP) server that converts any web page into clean Markdown. It serves as a minimal, low-cost alternative to Firecrawl, optimized for local development and low-resource environments (e.g., $3-$5/month hosting). Developed and maintained by [PixApps](https://pixapps.ai/).

## Features

- **Hybrid Fetch Mode (Default)**: First attempts a lightweight static HTTP `fetch` to retrieve the page. If the page is detected to be static and has sufficient content, it completely bypasses loading a headless browser. Automatically falls back to Playwright only if JavaScript rendering (e.g., lazy-load event listeners) or bot protection (e.g., Cloudflare) is detected.
- **Fast Mode (`fast=true`)**: Skips the 2-second Playwright scrolling sleep delay and swaps the heavy `jsdom` parser for the ultra-lightweight `linkedom` DOM parser, reducing CPU/memory overhead and delivering sub-second response times.
- **Stealth Browsing**: Built with `playwright-extra` and `puppeteer-extra-plugin-stealth` to bypass basic scraper detections during browser fallback.
- **Dynamic Content Handling**: Automatically performs smooth scrolling to trigger lazy-loaded content, waits for 2 seconds, and captures the complete rendered HTML (when running in normal browser fallback mode).
- **Flexible Scraping Modes**: Supports two extraction modes:
  - `article` (Default): Extracts primary article content by stripping headers, footers, navigation, and ads using Mozilla's `Readability` algorithm. Perfect for blogs, news, and article pages.
  - `full`: Bypasses `Readability` filtering to convert the entire HTML body into Markdown. Ideal for portals, directory lists, and search results.
- **Website Mapping**: Extracts all unique internal URLs under the same registered domain (e.g., `*.example.com` when mapping `example.com`), utilizing the `tldts` library for highly accurate eTLD+1 matching.
- **Web Crawling**: Recursively crawls web pages starting from a target URL up to depth and count limits. Supports both in-memory queues and Redis-backed queues.
- **Distributed Queue (Redis)**: Scales horizontally with a distributed crawl queue and state manager using Redis, complete with a cooperative background worker that processes crawl jobs.
- **Observability**: Exposes native Prometheus-compatible metrics (average scrape latency, crawl/map success rates, protected site metrics) and outputs structured JSON logs to `stderr` to maintain MCP stability.
- **Anti-Bot Detection**: Automatically identifies if target pages are protected by Cloudflare or similar bot challenges (via HTML body, titles, and response headers), reporting status and recording separate metrics.
- **HTML to Markdown**: Converts HTML to readable Markdown via `turndown`.
- **Hybrid Interface**: Acts as both a standard Express-based HTTP API and an MCP Server (stdio-based) simultaneously, ensuring all logs go to `stderr` to avoid interfering with the JSON-RPC stdout stream.
- **Dockerized & Resource-Optimized**: Multistage build optimized for Playwright, downloading only the Chromium browser binary to minimize memory usage and container footprint.

## Security & Sandboxing Benefits

When AI agents or local tools need to scrape unknown, untrusted web pages, directly loading them in local browsers poses severe security risks. LightCrawl acts as a secure, sandboxed proxy:

- **Client Environment Protection**: By fetching and converting web pages into static Markdown, it completely eliminates the risk of client-side browser exploits (e.g., drive-by downloads, malicious JavaScript execution) infecting your host machine.
- **IP Address & Location Anonymization**: The target website only sees the IP address of the LightCrawl server (e.g., hosted on Railway or Docker), shielding your local development machine's IP and location from malicious hosts or honeypots.
- **Containerized Isolation**: Operating within a single Docker container, even if a zero-day browser exploit compromises the headless Chromium process, the threat remains isolated in an ephemeral, easily-disposable container sandbox.
- **Prompt Injection Mitigation**: By filtering out scripts, styles, and non-content elements via the `Readability` parser, it delivers clean semantic text, reducing the risk of hidden adversarial prompt injections targeting your LLM pipelines.

---

## Prerequisites

- Node.js >= 18
- npm

---

## Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yosuke1024/Lightcrawl.git
   cd LightCrawl
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Install Playwright browsers (Chromium only)**:
   ```bash
   npx playwright install chromium
   ```

---

## Development Scripts

- **Run Dev Server**:
   ```bash
   npm run dev
   ```
- **Build TypeScript**:
   ```bash
   npm run build
   ```
- **Start Production Server**:
   ```bash
   npm run start
   ```
- **Run Tests**:
   ```bash
   npm run test
   ```
- **Lint Code**:
   ```bash
   npm run lint
   ```

---

## Configuration

LightCrawl can be configured using environment variables. You can define these in a `.env` file at the root of the project (see `.env.example`).

| Environment Variable | Description | Default |
| -------------------- | ----------- | ------- |
| `PORT` | The port the HTTP API server will listen on. | `3000` |
| `API_KEY` | Optional API key for authenticating HTTP/MCP requests. | None |
| `ALLOWED_IPS` | Optional comma-separated list of allowed client IP addresses. | None |
| `REDIS_URL` | Optional Redis connection URL (e.g., `redis://localhost:6379`). When provided, crawling operations use Redis as a distributed queue and state backend. | None |
| `ENABLE_DISTRIBUTED_WORKER` | If `true` and `REDIS_URL` is set, starts a cooperative background crawl worker on startup. Set to `false` to run as a thin API client only. | `true` |
| `MAX_CONCURRENCY` | Maximum number of concurrent Playwright browser instances allowed to run. | `5` |
| `BRAVE_SEARCH_API_KEY` | Optional Brave Search API key. Enabling this activates the web search and parallel scraping endpoints/tools. | None |

---

## Usage

> [!NOTE]
> For interactive API documentation, detailed request/response schemas, and testing endpoints (/scrape, /map, /crawl), please launch the server and visit the Swagger UI at `http://localhost:3000/api-docs/`.

LightCrawl runs as a hybrid server. When started, it opens an Express port for HTTP requests and establishes a standard input/output channel for MCP clients.

### 1. HTTP API

By default, the HTTP server listens on port `3000` (can be configured via `PORT` environment variable).

#### Access Control & Security (Optional)

##### 1. API Key Authentication
If the `API_KEY` environment variable is set on the server, clients must authenticate by providing the API key in one of the following ways:
- **Authorization Header**: `Authorization: Bearer <API_KEY>`
- **Query Parameter**: `/scrape?url=...&key=<API_KEY>`

##### 2. IP Address Whitelisting
If the `ALLOWED_IPS` environment variable is set (as a comma-separated list, e.g., `127.0.0.1,203.0.113.50`), the server will block any requests originating from non-whitelisted IP addresses with a `403 Forbidden` response.
This feature automatically parses the `x-forwarded-for` proxy header to determine the correct client IP when deployed behind a reverse proxy (e.g., Railway).

#### Get Health Status
- **Endpoint**: `GET /health`
- **Request**:
  ```bash
  curl http://localhost:3000/health
  ```
- **Response**:
  ```json
  { "status": "ok" }
  ```

#### Scrape Web Page
- **Endpoint**: `GET /scrape`
- **Query Parameters**:
  - `url` (string, required): The HTTP/HTTPS URL of the web page to scrape.
  - `mode` (string, optional): The scraping mode. Must be either `'article'` (default) or `'full'`.
  - `fast` (boolean, optional): Whether to use fast mode (skips scroll and uses linkedom). Default is `false`.
- **Request (No Authentication)**:
  ```bash
  curl "http://localhost:3000/scrape?url=https://example.com"
  
  # Fetch full page content including headers/navigation
  curl "http://localhost:3000/scrape?url=https://example.com&mode=full"

  # Fetch using fast mode (linkedom parser and skips browser scrolling delay)
  curl "http://localhost:3000/scrape?url=https://example.com&fast=true"
  ```
- **Request (With Authentication)**:
  ```bash
  # Using Authorization Header (Recommended)
  curl -H "Authorization: Bearer YOUR_API_KEY" "http://localhost:3000/scrape?url=https://example.com"

  # Or using Query Parameter
  curl "http://localhost:3000/scrape?url=https://example.com&key=YOUR_API_KEY&mode=full&fast=true"
  ```
- **Response**:
  ```json
  {
    "success": true,
    "url": "https://example.com",
    "title": "Example Domain",
    "markdown": "# Example Domain\n\nThis domain is for use in illustrative examples...",
    "metadata": {
      "description": "Example description",
      "canonical": "https://example.com/",
      "lang": "en"
    },
    "excerpt": "This domain is for use in illustrative examples in documents..."
  }
  ```

#### Get Website Map
Extracts unique, absolute internal URLs belonging to the same registered domain (subdomains allowed) from the target page.
- **Endpoint**: `GET /map`
- **Query Parameters**:
  - `url` (string, required): The target homepage URL to map.
- **Request**:
  ```bash
  curl "http://localhost:3000/map?url=https://example.com"
  ```
- **Response**:
  ```json
  [
    "https://example.com/",
    "https://example.com/about",
    "https://blog.example.com/posts"
  ]
  ```

#### Crawl Web Pages
Crawls the web starting from the target URL, navigating internal and external links up to depth, count, timeout and checked pages limits.
- **Endpoint**: `GET /crawl`
- **Query Parameters**:
  - `url` (string, required): The starting URL.
  - `limit` (integer, optional): Maximum pages to crawl (default: `10`, max: `20`).
  - `maxDepth` (integer, optional): Maximum search depth (default: `2`, max: `3`).
  - `maxCheckedPages` (integer, optional): Maximum pages to check (default: `limit * 2`, max: `40`).
  - `timeoutMs` (integer, optional): Global crawl timeout in milliseconds (default: `45000`).
  - `fast` (boolean, optional): Whether to use fast mode during crawling. Default is `false`.
- **Request**:
  ```bash
  curl "http://localhost:3000/crawl?url=https://example.com&limit=2&maxDepth=2&maxCheckedPages=4&timeoutMs=10000&fast=true"
  ```
- **Response**:
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

#### Search Web Pages
Searches the web via Brave Search API and scrapes top results concurrently. (Requires `BRAVE_SEARCH_API_KEY` configured on the server).
- **Endpoint**: `GET /search`
- **Query Parameters**:
  - `q` (string, required): The search query.
  - `limit` (integer, optional): Maximum search results to scrape (default: `5`).
- **Request**:
  ```bash
  curl "http://localhost:3000/search?q=playwright+stealth&limit=3"
  ```
- **Response**:
  ```json
  [
    {
      "success": true,
      "url": "https://example.com/page1",
      "title": "Result 1",
      "markdown": "# Result 1 Content\n...",
      "metadata": { "lang": "en" },
      "excerpt": "Snippet of page 1"
    }
  ]
  ```

#### Get Prometheus Metrics
Exposes performance and operational metrics in Prometheus exposition format.
- **Endpoint**: `GET /metrics`
- **Request**:
  ```bash
  curl http://localhost:3000/metrics
  ```
- **Response**:
  ```text
  # HELP lightcrawl_scrape_requests_total Total number of scrape requests.
  # TYPE lightcrawl_scrape_requests_total counter
  lightcrawl_scrape_requests_total{success="true",protected="true"} 0
  lightcrawl_scrape_requests_total{success="true",protected="false"} 2
  lightcrawl_scrape_requests_total{success="false",protected="true"} 0
  lightcrawl_scrape_requests_total{success="false",protected="false"} 0
  # HELP lightcrawl_scrape_duration_seconds_sum Total duration of scrape requests in seconds.
  # TYPE lightcrawl_scrape_duration_seconds_sum counter
  lightcrawl_scrape_duration_seconds_sum 2.45
  # HELP lightcrawl_scrape_duration_seconds_count Total count of scrape requests.
  # TYPE lightcrawl_scrape_duration_seconds_count counter
  lightcrawl_scrape_duration_seconds_count 2
  ...
  ```

### 2. MCP Server (Model Context Protocol)

You can register LightCrawl as an MCP tool inside AI clients like Cursor or Claude Desktop.

#### 1. `lightcrawl_scrape`
- **Description**: Accesses a web page using Playwright, strips unnecessary elements, and extracts clean Markdown text.
- **Arguments**:
  - `url` (string, required): The HTTP/HTTPS URL of the web page to scrape.
  - `mode` (string, optional): The scraping mode. One of `article` (default) or `full`.
  - `fast` (boolean, optional): Whether to use fast mode (skips scroll and uses linkedom). Default is `false`.
- **Output**: Raw Markdown string.

#### 2. `lightcrawl_map`
- **Description**: Extracts all internal URLs (subdomains of same registered domain allowed) from a target website to build a site map.
- **Arguments**:
  - `url` (string, required): The starting HTTP/HTTPS URL of the website.
- **Output**: JSON stringified array of absolute URLs.

#### 3. `lightcrawl_crawl`
- **Description**: Performs a simple crawl starting from the target URL, navigating links up to depth, count, timeout and checked pages limits.
- **Arguments**:
  - `url` (string, required): The starting HTTP/HTTPS URL to crawl.
  - `limit` (integer, optional): Maximum number of pages to crawl (default `10`, max `20`).
  - `maxDepth` (integer, optional): Maximum crawl depth (default `2`, max `3`).
  - `maxCheckedPages` (integer, optional): Maximum pages to check (default `limit * 2`, max `40`).
  - `timeoutMs` (integer, optional): Global crawl timeout in milliseconds (default `45000`).
  - `fast` (boolean, optional): Whether to use fast mode during crawling. Default is `false`.
- **Output**: JSON stringified array of ScrapeResult objects representing all crawled pages.

#### 4. `lightcrawl_search`
- **Description**: Performs web search via Brave Search API and scrapes top results concurrently. (Only listed and available when `BRAVE_SEARCH_API_KEY` is configured).
- **Arguments**:
  - `query` (string, required): The search query.
  - `limit` (integer, optional): Maximum results to search and scrape (default `5`).
- **Output**: JSON stringified array of ScrapeResult objects.

#### Claude Desktop Configuration
Add the following to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "lightcrawl": {
      "command": "node",
      "args": ["/path/to/LightCrawl/dist/index.js"]
    }
  }
}
```
*(Make sure to build the project via `npm run build` before registering the JS file)*

---

## Docker Setup

To build and run LightCrawl inside a Docker container:

1. **Build the image**:
   ```bash
   docker build -t lightcrawl .
   ```

2. **Run the container**:
   ```bash
   docker run -d -p 3000:3000 \
     -e API_KEY="your-api-key" \
     -e ALLOWED_IPS="127.0.0.1" \
     -e REDIS_URL="redis://host.docker.internal:6379" \
     --name lightcrawl-app lightcrawl
   ```
   *(Configure environment variables with `-e` flags as needed)*

3. **Verify running container**:
   ```bash
   curl http://localhost:3000/health
   ```

---

## Deployment

### Deploy to Railway

We offer two different Railway deployment templates depending on your scalability and cost requirements.

#### 1. Standard (Single Container) - Recommended for personal use
This configuration runs a single Express container without any external database dependencies, keeping costs minimal ($3–$5/month).

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/lightcrawl?referralCode=lR1Ra-&utm_medium=integration&utm_source=template&utm_campaign=generic)

#### 2. Scalable (with Redis) - For high-concurrency workloads
This configuration provisions both the Express/Worker container and a Redis database service. The application automatically detects `REDIS_URL` and switches to the queue-based distributed crawling system, allowing horizontal scaling.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/lightcrawl-with-redis?referralCode=lR1Ra-&utm_medium=integration&utm_source=template&utm_campaign=generic)

*(Note: Click the button above to deploy a pre-configured multi-service stack with Redis automatically linked. Alternatively, if you want to set up Redis manually in an existing Railway project, see the manual instructions below.)*

##### 💡 Post-Deployment Steps

###### 1. Find Your API Endpoint URL
Once the deployment finishes successfully:
1. Go to your **LightCrawl** service in Railway.
2. Click on the **Settings** tab.
3. Scroll down to the **Networking** section to find your public domain (e.g., `https://lightcrawl-production-xxxx.up.railway.app`).

###### 2. How to Test Your Deployment
You can verify your deployment by sending a quick request using the `API_KEY` you configured during the deployment wizard:
```bash
# Test the public health check endpoint (Should return {"status":"ok"})
curl https://your-lightcrawl-app.up.railway.app/health

# Test scraping with your configured API key
curl -H "Authorization: Bearer <YOUR_API_KEY>" "https://your-lightcrawl-app.up.railway.app/scrape?url=https://example.com"
```

###### 3. How to Scale (For "Scalable with Redis" Template)
If you deployed the **Scalable (with Redis)** version, you can horizontally scale your scraper nodes to process massive crawl jobs in parallel:
1. Go to your **LightCrawl** service in Railway.
2. Select the **Settings** tab and go to the **Scale** section.
3. Change the **Replicas** count from `1` to your desired number of instances (e.g., `3` or `5`) and save changes.
4. Railway will automatically spin up the replicas, and they will coordinate via the shared Redis queue to process crawl jobs cooperatively.

##### 📦 Setting up Redis manually on Railway
If you want to add Redis to an existing deployment manually:
1. Click **+ New** -> **Database** -> **Redis** in your Railway project to spin up a Redis instance.
2. In your LightCrawl service settings, add a new environment variable:
   - `REDIS_URL`: `${{Redis.REDIS_URL}}` (or reference the automatically generated Redis URL variable).
   - `ENABLE_DISTRIBUTED_WORKER`: `true` (default, to start the background crawl worker).

---

### Configuration & Environment Variables

When deploying, you can configure the behavior using the following environment variables:

| Variable | Description | Default | Required |
| :--- | :--- | :--- | :--- |
| `PORT` | The port on which the Express HTTP server runs. | `3000` | No |
| `API_KEY` | Optional key to protect your endpoints. | - | No |
| `ALLOWED_IPS` | Comma-separated list of allowed IPs. | - | No |
| `REDIS_URL` | Redis connection URL (e.g. `redis://...`). Enabling this activates the distributed queue crawler. | - | No |
| `ENABLE_DISTRIBUTED_WORKER` | Set to `false` to disable the background Redis worker on this instance. | `true` | No |
| `BRAVE_SEARCH_API_KEY` | Brave Search API key. Enabling this activates the web search and parallel scraping endpoints/tools. | - | No |

---

#### 🚀 Why Self-Host on Railway?

By self-hosting your private LightCrawl API on Railway, you get a robust, production-ready scraping proxy:
- **Unlimited Usage**: No API credit limits or subscription plans compared to commercial alternatives like Firecrawl.
- **Enhanced Privacy & Security**: Protect your local development IP address. All target websites only see your Railway container IP.
- **Custom AI Tooling Integration**: Easily connect your private endpoint to AI tools like Cursor, LangChain, or LLM agents.

##### Connecting to Cursor (.cursorrules)
Add a guideline to your `.cursorrules` or project rules to let Cursor automatically utilize your hosted LightCrawl instance for web research:
```markdown
When requested to read, research, or inspect any live URL, make a background GET request to your private LightCrawl API to obtain the clean Markdown representation:
URL: https://your-lightcrawl-app.up.railway.app/scrape?url=<TARGET_URL>&key=<YOUR_API_KEY>&mode=article
```

---

## Created & Maintained by

LightCrawl is developed and maintained by **[PixApps](https://pixapps.ai/)**. We build modern AI applications and tools.

If you find this project useful, please support our open-source journey:

- [GitHub Sponsors](https://github.com/sponsors/yosuke1024)
- [Discover our projects at PixApps](https://pixapps.ai/)

---

## License

This project is licensed under the [MIT License](LICENSE).
