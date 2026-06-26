---
title: Scraping Modes Specification
status: implemented
---

# Scraping Modes Specification

LightCrawl supports multiple scraping modes to accommodate different types of web pages. This document defines the specification and API behavior for the available modes.

## Specification

LightCrawl scraping can run in one of the following modes:

1. **`article` (Default)**
   - **Behavior**: Uses Mozilla's `Readability` algorithm to clean the HTML and extract the core text of the page.
   - **Target**: Blogs, news sites, and document-heavy pages where headers, footers, sidebars, and ads are noise.
2. **`full`**
   - **Behavior**: Bypasses the `Readability` extraction and converts the entire body of the HTML document to Markdown.
   - **Target**: Portals, search engines (e.g. Yahoo! JAPAN), directories, or pages where navigation and layout links are part of the target data.

---

## API Reference

### HTTP API (`GET /scrape`)

- **Query Parameters**:
  - `url` (string, required): Target URL.
  - `mode` (string, optional): `'article'` or `'full'`. Defaults to `'article'`.
- **Response**:
  - `200 OK` with JSON payload containing:
    ```json
    {
      "success": true,
      "url": "https://example.com",
      "title": "Page Title",
      "markdown": "# Page Title\n\nContent..."
    }
    ```

### MCP Tool (`lightcrawl_scrape`)

- **Arguments**:
  - `url` (string, required): Target URL.
  - `mode` (string, optional): `'article'` or `'full'`. Defaults to `'article'`.

---

## Implementation Report

- **Implemented Date**: 2026-06-26
- **Pull Request**: [TBD]
- **Implemented Changes**:
  - Modified `src/scraper.ts` to support the `mode` parameter in `scrapeUrl`.
  - Updated `src/index.ts` to propagate the `mode` parameter from Express query parameters and MCP call arguments.
  - Added unit and integration tests verifying parameter validation and behavior under both modes.
  - Documented use cases and configuration in `README.md` and added Cursor integration guidelines.
