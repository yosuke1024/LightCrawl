import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { scrapeUrl } from './scraper';

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
    ],
  };
});

// Register MCP Call Tool Handler
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'lightcrawl_scrape') {
    throw new Error(`Tool not found: ${request.params.name}`);
  }

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
