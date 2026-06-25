# Lightcrawl

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/node-%3E%3D18-blue.svg" alt="Node.js Version">
  <a href="https://railway.app/new/template?template=https://github.com/yosuke1024/Lightcrawl"><img src="https://railway.com/button.svg" alt="Deploy on Railway"></a>
  <a href="https://github.com/sponsors/yosuke1024"><img src="https://img.shields.io/badge/Sponsor-%E2%9D%A4-db61a2?logo=github-sponsors" alt="Sponsor"></a>
</p>

Lightcrawl is a lightweight, single-container, self-hostable Web scraping API and Model Context Protocol (MCP) server that converts any web page into clean Markdown. It serves as a minimal, low-cost alternative to Firecrawl, optimized for local development and low-resource environments (e.g., $3-$5/month hosting).

## Features

- **Stealth Browsing**: Built with `playwright-extra` and `puppeteer-extra-plugin-stealth` to bypass basic scraper detections.
- **Dynamic Content Handling**: Automatically performs smooth scrolling to trigger lazy-loaded content, waits for 2 seconds, and captures the complete rendered HTML.
- **Clean Content Extraction**: Extracts primary page content by stripping headers, footers, navigation bars, and ads using Mozilla's `Readability` algorithm.
- **HTML to Markdown**: Converts cleaned HTML to readable Markdown via `turndown`.
- **Hybrid Interface**: Acts as both a standard Express-based HTTP API and an MCP Server (stdio-based) simultaneously, ensuring all logs go to `stderr` to avoid interfering with the JSON-RPC stdout stream.
- **Dockerized & Resource-Optimized**: Multistage build optimized for Playwright, downloading only the Chromium browser binary to minimize memory usage and container footprint.

---

## Prerequisites

- Node.js >= 18
- npm

---

## Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd Lightcrawl
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

## Usage

Lightcrawl runs as a hybrid server. When started, it opens an Express port for HTTP requests and establishes a standard input/output channel for MCP clients.

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
- **Query Parameter**: `url` (string, required)
- **Request (No Authentication)**:
  ```bash
  curl "http://localhost:3000/scrape?url=https://example.com"
  ```
- **Request (With Authentication)**:
  ```bash
  # Using Authorization Header (Recommended)
  curl -H "Authorization: Bearer YOUR_API_KEY" "http://localhost:3000/scrape?url=https://example.com"

  # Or using Query Parameter
  curl "http://localhost:3000/scrape?url=https://example.com&key=YOUR_API_KEY"
  ```
- **Response**:
  ```json
  {
    "success": true,
    "url": "https://example.com",
    "title": "Example Domain",
    "markdown": "# Example Domain\n\nThis domain is for use in illustrative examples..."
  }
  ```

### 2. MCP Server (Model Context Protocol)

You can register Lightcrawl as an MCP tool inside AI clients like Cursor or Claude Desktop.

- **Tool Name**: `lightcrawl_scrape`
- **Description**: Accesses a web page using Playwright, strips unnecessary elements, and extracts clean Markdown text.
- **Arguments**:
  - `url` (string, required): The HTTP/HTTPS URL of the web page to scrape.

#### Claude Desktop Configuration
Add the following to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "lightcrawl": {
      "command": "node",
      "args": ["/path/to/Lightcrawl/dist/index.js"]
    }
  }
}
```
*(Make sure to build the project via `npm run build` before registering the JS file)*

---

## Docker Setup

To build and run Lightcrawl inside a Docker container:

1. **Build the image**:
   ```bash
   docker build -t lightcrawl .
   ```

2. **Run the container**:
   ```bash
   docker run -d -p 3000:3000 --name lightcrawl-app lightcrawl
   ```

3. **Verify running container**:
   ```bash
   curl http://localhost:3000/health
   ```

---

## Deployment

### Deploy to Railway

The fastest way to deploy Lightcrawl is using **Railway**. With zero configuration needed, it automatically builds and runs the container.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.app/new/template?template=https://github.com/yosuke1024/Lightcrawl)

---

## Sponsors

If you find this project useful, please consider supporting its development:

- [GitHub Sponsors](https://github.com/sponsors/yosuke1024)
- [PixApps](https://pixapps.ai/)

---

## License

This project is licensed under the [MIT License](LICENSE).
