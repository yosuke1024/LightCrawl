import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { scrapeUrl, mapUrl, crawlUrl } from './scraper';

// Initialize Express App
export const app = express();
app.use(express.json());

// HTTP API: /health
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API Key authentication middleware
const authenticateApiKey = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const configuredApiKey = process.env.API_KEY;
  if (!configuredApiKey) {
    return next();
  }

  const authHeader = req.headers.authorization;
  let providedKey: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    providedKey = authHeader.substring(7);
  }

  if (!providedKey && req.query.key) {
    providedKey = req.query.key as string;
  }

  if (providedKey === configuredApiKey) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized: Invalid or missing API key',
  });
};

// IP Address authorization middleware
const authorizeIpAddress = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const allowedIpsEnv = process.env.ALLOWED_IPS;
  if (!allowedIpsEnv) {
    return next();
  }

  const allowedIps = allowedIpsEnv.split(',').map((ip) => ip.trim());
  const xForwardedFor = req.headers['x-forwarded-for'] as string;
  let clientIp: string;

  if (xForwardedFor) {
    clientIp = xForwardedFor.split(',')[0].trim();
  } else {
    clientIp = req.socket.remoteAddress || '';
  }

  if (clientIp.startsWith('::ffff:')) {
    clientIp = clientIp.substring(7);
  }

  if (allowedIps.includes(clientIp)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: 'Forbidden: Access denied from IP address',
  });
};

// HTTP API: /scrape
app.get('/scrape', authorizeIpAddress, authenticateApiKey, async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }

  try {
    // Validate URL format
    new URL(url);
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid URL format' });
  }

  try {
    const result = await scrapeUrl(url);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

// HTTP API: /map
app.get('/map', authorizeIpAddress, authenticateApiKey, async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid URL format' });
  }

  try {
    const result = await mapUrl(url);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

// HTTP API: /crawl
app.get('/crawl', authorizeIpAddress, authenticateApiKey, async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid URL format' });
  }

  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const maxDepth = req.query.maxDepth ? parseInt(req.query.maxDepth as string, 10) : undefined;

  try {
    const result = await crawlUrl(url, limit, maxDepth);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

// Initialize MCP Server
export const mcpServer = new Server(
  {
    name: 'lightcrawl-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register MCP List Tools Handler
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'lightcrawl_scrape',
        description: 'Accesses a web page using Playwright, strips unnecessary elements, and extracts clean Markdown text.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The HTTP/HTTPS URL of the web page to scrape.',
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'lightcrawl_map',
        description: 'Extracts all internal URLs from a target website to build a site map.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The starting HTTP/HTTPS URL of the website.',
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'lightcrawl_crawl',
        description: 'Performs a simple crawl of the target domain up to a limit and returns markdown contents.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The starting HTTP/HTTPS URL to crawl.',
            },
            limit: {
              type: 'integer',
              description: 'Maximum number of pages to crawl (default 10, max 20).',
            },
            maxDepth: {
              type: 'integer',
              description: 'Maximum crawl depth (default 2, max 3).',
            },
          },
          required: ['url'],
        },
      },
    ],
  };
});

// Register MCP Call Tool Handler
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const url = request.params.arguments?.url as string;
  if (!url) {
    return {
      content: [{ type: 'text', text: 'Error: URL parameter is required' }],
      isError: true,
    };
  }

  try {
    new URL(url);
  } catch {
    return {
      content: [{ type: 'text', text: 'Error: Invalid URL format' }],
      isError: true,
    };
  }

  if (toolName === 'lightcrawl_scrape') {
    try {
      const result = await scrapeUrl(url);
      return {
        content: [
          {
            type: 'text',
            text: result.markdown,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error scraping ${url}: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  } else if (toolName === 'lightcrawl_map') {
    try {
      const result = await mapUrl(url);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error mapping ${url}: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  } else if (toolName === 'lightcrawl_crawl') {
    const limit = request.params.arguments?.limit ? parseInt(request.params.arguments.limit as string, 10) : undefined;
    const maxDepth = request.params.arguments?.maxDepth ? parseInt(request.params.arguments.maxDepth as string, 10) : undefined;

    try {
      const result = await crawlUrl(url, limit, maxDepth);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error crawling ${url}: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  } else {
    throw new Error(`Tool not found: ${toolName}`);
  }
});

// Start servers only when not in test environment
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3000;

  // Start Express server
  // Note: All logs must go to stderr (console.error) to avoid corrupting MCP's stdout channel
  app.listen(PORT, () => {
    console.error(`[HTTP] LightCrawl API server running on port ${PORT}`);
  });

  // Start MCP server via Stdio transport
  const transport = new StdioServerTransport();
  mcpServer.connect(transport).then(() => {
    console.error('[MCP] LightCrawl MCP server connected via stdio');
  }).catch((error) => {
    console.error('[MCP] Failed to connect MCP server:', error);
  });
}
