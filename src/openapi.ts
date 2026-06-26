export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'LightCrawl API',
    description: 'A lightweight, single-container, self-hostable Web scraping API and Model Context Protocol (MCP) server that converts web pages into clean Markdown.',
    version: '1.0.0',
  },
  servers: [
    {
      url: '/',
      description: 'Local server',
    },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        description: 'Returns the health status of the server.',
        responses: {
          200: {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      example: 'ok',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/scrape': {
      get: {
        summary: 'Scrape a single URL',
        description: 'Accesses a target URL, scrolls to load lazy content, wait 2 seconds, extracts core article content via Mozilla Readability, and converts it to Markdown.',
        parameters: [
          {
            name: 'url',
            in: 'query',
            required: true,
            description: 'The HTTP/HTTPS URL of the web page to scrape.',
            schema: {
              type: 'string',
              format: 'uri',
            },
          },
        ],
        responses: {
          200: {
            description: 'Scrape result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    url: {
                      type: 'string',
                      example: 'https://example.com',
                    },
                    title: {
                      type: 'string',
                      example: 'Example Domain',
                    },
                    markdown: {
                      type: 'string',
                      example: '# Example Domain\n\nContent...',
                    },
                    metadata: {
                      type: 'object',
                      properties: {
                        description: { type: 'string' },
                        keywords: { type: 'string' },
                        author: { type: 'string' },
                        ogTitle: { type: 'string' },
                        ogDescription: { type: 'string' },
                        ogImage: { type: 'string' },
                        canonical: { type: 'string' },
                        lang: { type: 'string' },
                      },
                    },
                    excerpt: {
                      type: 'string',
                      example: 'This domain is for use in documentation...',
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'Invalid input (URL is required or in invalid format)',
          },
          401: {
            description: 'Unauthorized (API Key is invalid or missing)',
          },
          403: {
            description: 'Forbidden (Client IP is not whitelisted)',
          },
          500: {
            description: 'Internal Server Error during scraping',
          },
        },
      },
    },
    '/map': {
      get: {
        summary: 'Extract website map links',
        description: 'Extracts all unique absolute internal HTTP/HTTPS links belonging to the same registered domain (subdomains allowed) from the target URL.',
        parameters: [
          {
            name: 'url',
            in: 'query',
            required: true,
            description: 'The starting HTTP/HTTPS URL of the website.',
            schema: {
              type: 'string',
              format: 'uri',
            },
          },
        ],
        responses: {
          200: {
            description: 'Array of unique internal URLs',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'string',
                    format: 'uri',
                  },
                  example: [
                    'https://example.com/',
                    'https://example.com/about',
                    'https://blog.example.com/posts',
                  ],
                },
              },
            },
          },
          400: {
            description: 'Invalid input',
          },
          401: {
            description: 'Unauthorized',
          },
          403: {
            description: 'Forbidden',
          },
          500: {
            description: 'Internal Server Error',
          },
        },
      },
    },
    '/crawl': {
      get: {
        summary: 'Crawl target website',
        description: 'Performs a simple BFS crawl starting from the target URL up to a maximum limit and depth, capturing Markdown and metadata for all successfully scraped pages. Cross-domain links are allowed.',
        parameters: [
          {
            name: 'url',
            in: 'query',
            required: true,
            description: 'The starting HTTP/HTTPS URL to crawl.',
            schema: {
              type: 'string',
              format: 'uri',
            },
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            description: 'Maximum number of pages to crawl (default 10, max 20).',
            schema: {
              type: 'integer',
              default: 10,
              maximum: 20,
            },
          },
          {
            name: 'maxDepth',
            in: 'query',
            required: false,
            description: 'Maximum crawl depth (default 2, max 3).',
            schema: {
              type: 'integer',
              default: 2,
              maximum: 3,
            },
          },
        ],
        responses: {
          200: {
            description: 'Array of scrape results',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      url: { type: 'string' },
                      title: { type: 'string' },
                      markdown: { type: 'string' },
                      metadata: { type: 'object' },
                      excerpt: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'Invalid input',
          },
          401: {
            description: 'Unauthorized',
          },
          403: {
            description: 'Forbidden',
          },
          500: {
            description: 'Internal Server Error',
          },
        },
      },
    },
  },
};
