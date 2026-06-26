# Stage 1: Build TypeScript source code
FROM mcr.microsoft.com/playwright:v1.61.1-noble AS builder

WORKDIR /app

# Copy configuration files and dependencies list
COPY package*.json tsconfig.json eslint.config.mjs ./

# Install all dependencies including devDependencies
RUN npm ci

# Copy source code and build it
COPY src/ ./src
RUN npm run build

# Stage 2: Create lightweight production image
FROM mcr.microsoft.com/playwright:v1.61.1-noble AS runner

WORKDIR /app

# Configure environments
ENV NODE_ENV=production
ENV PORT=3000

# Copy compiled code and package files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Prevent downloading Firefox and WebKit to save space and memory
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Install only production dependencies
RUN npm ci --only=production

# Explicitly download only Chromium browser for production
RUN npx playwright install chromium

# Expose the API service port
EXPOSE 3000

# Run the hybrid server (HTTP and MCP)
CMD ["npm", "run", "start"]
