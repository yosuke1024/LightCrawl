import fs from 'fs';
import path from 'path';
import https from 'https';
import { marked } from 'marked';

const datasetsDir = path.join(__dirname, '../../benchmarks/datasets');
const fixturesDir = path.join(__dirname, '../../benchmarks/fixtures');

const OSS_SOURCES = [
  { id: 'real-react-readme', repo: 'facebook/react', file: 'README.md', lang: 'en', cat: 'technical-documentation' },
  { id: 'real-express-guide', repo: 'expressjs/express', file: 'Readme.md', lang: 'en', cat: 'technical-documentation' },
  { id: 'real-vue-readme', repo: 'vuejs/core', file: 'README.md', lang: 'en', cat: 'technical-documentation' },
  { id: 'real-nextjs-readme', repo: 'vercel/next.js', file: 'README.md', lang: 'en', cat: 'technical-documentation' },
  { id: 'real-fastapi-readme', repo: 'tiangolo/fastapi', file: 'README.md', lang: 'en', cat: 'technical-documentation' },
  { id: 'real-node-readme', repo: 'nodejs/node', file: 'README.md', lang: 'en', cat: 'technical-documentation' },
  { id: 'real-webpack-readme', repo: 'webpack/webpack', file: 'README.md', lang: 'en', cat: 'technical-documentation' },
  { id: 'real-babel-readme', repo: 'babel/babel', file: 'README.md', lang: 'en', cat: 'technical-documentation' },
  { id: 'real-lodash-readme', repo: 'lodash/lodash', file: 'README.md', lang: 'en', cat: 'technical-documentation' },
  { id: 'real-typescript-readme', repo: 'microsoft/TypeScript', file: 'README.md', lang: 'en', cat: 'technical-documentation' },
  { id: 'real-jest-readme', repo: 'jestjs/jest', file: 'README.md', lang: 'en', cat: 'technical-documentation' },
  { id: 'real-svelte-readme', repo: 'sveltejs/svelte', file: 'README.md', lang: 'en', cat: 'technical-documentation' },
  { id: 'real-redux-readme', repo: 'reduxjs/redux', file: 'README.md', lang: 'en', cat: 'technical-documentation' },
  { id: 'real-tailwind-readme', repo: 'tailwindlabs/tailwindcss', file: 'README.md', lang: 'en', cat: 'technical-documentation' },
  { id: 'real-eslint-readme', repo: 'eslint/eslint', file: 'README.md', lang: 'en', cat: 'technical-documentation' },
  { id: 'real-prettier-readme', repo: 'prettier/prettier', file: 'README.md', lang: 'en', cat: 'technical-documentation' },
  { id: 'real-vite-readme', repo: 'vitejs/vite', file: 'README.md', lang: 'en', cat: 'technical-documentation' },
  { id: 'real-electron-readme', repo: 'electron/electron', file: 'README.md', lang: 'en', cat: 'technical-documentation' },
  { id: 'real-react-native-readme', repo: 'facebook/react-native', file: 'README.md', lang: 'en', cat: 'technical-documentation' },
  { id: 'real-docker-docs', repo: 'docker/docs', file: 'README.md', lang: 'en', cat: 'technical-documentation' },
  { id: 'real-vue-ja', repo: 'vuejs-translations/docs-ja', file: 'README.md', lang: 'ja', cat: 'technical-documentation' }
];

function fetchLatestCommitSha(repo: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = `https://api.github.com/repos/${repo}/commits`;
    const req = https.get(url, {
      headers: { 'User-Agent': 'NodeJS/LightCrawl-Benchmark' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const json = JSON.parse(data);
            resolve(json[0].sha);
          } else {
            resolve('HEAD'); // Fallback
          }
        } catch(e) { resolve('HEAD'); }
      });
    });
    req.on('error', () => resolve('HEAD'));
  });
}

function fetchRaw(repo: string, sha: string, file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = `https://raw.githubusercontent.com/${repo}/${sha}/${file}`;
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        https.get(res.headers.location!, (res2) => {
          let data = '';
          res2.on('data', chunk => data += chunk);
          res2.on('end', () => resolve(data));
        }).on('error', reject);
        return;
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extractFactsFromMarkdown(md: string) {
  const headings = [];
  const codeBlocks = [];
  const facts = [];

  const lines = md.split('\n');
  let inCode = false;
  let currentCode = '';

  for (const line of lines) {
    if (line.startsWith('## ') || line.startsWith('### ')) {
      headings.push(line.replace(/^#+\s+/, '').trim());
    }
    if (line.startsWith('\`\`\`')) {
      if (inCode) {
        if (currentCode.trim().length > 10) codeBlocks.push(currentCode.trim());
        currentCode = '';
      }
      inCode = !inCode;
    } else if (inCode) {
      currentCode += line + '\n';
    } else if (line.match(/^[A-Za-z0-9 ]{20,60}$/)) {
       facts.push(line.trim());
    }
  }

  return {
    requiredHeadings: headings.slice(0, 3),
    requiredCodeFragments: codeBlocks.slice(0, 2),
    requiredFacts: facts.slice(0, 2)
  };
}

async function run() {
  if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir, { recursive: true });

  const manifestPath = path.join(datasetsDir, 'offline-cases.json');
  let manifest: any[] = [];
  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }

  console.log(`Fetching ${OSS_SOURCES.length} real-world OSS documents...`);

  for (const source of OSS_SOURCES) {
    try {
      console.log(`Fetching ${source.id}...`);
      const sha = await fetchLatestCommitSha(source.repo);
      const mdContent = await fetchRaw(source.repo, sha, source.file);
      const htmlContent = marked.parse(mdContent);
      
      const simulatedPageHtml = `
      <!DOCTYPE html>
      <html lang="${source.lang}">
      <head>
        <title>${source.repo} Documentation</title>
        <style>
          .sidebar { width: 250px; float: left; }
          .main-content { margin-left: 260px; }
          .footer { margin-top: 50px; text-align: center; }
          .nav-ad { background: #eee; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="sidebar">
          <nav>
            <ul>
              <li><a href="/">Home</a></li>
              <li><a href="/docs">Docs</a></li>
              <li><a href="/api">API Reference</a></li>
            </ul>
          </nav>
          <div class="nav-ad">Subscribe to our newsletter!</div>
        </div>
        <div class="main-content">
          <article>
            ${htmlContent}
          </article>
        </div>
        <div class="footer">
          <p>&copy; 2026 OSS Project. Open Source MIT License.</p>
          <p>Privacy Policy | Terms of Service</p>
        </div>
      </body>
      </html>
      `;

      const filename = `${source.id}.html`;
      fs.writeFileSync(path.join(fixturesDir, filename), simulatedPageHtml);

      const facts = extractFactsFromMarkdown(mdContent);

      const existingIndex = manifest.findIndex((m: any) => m.id === source.id);
      const entry = {
        id: source.id,
        dataset: "real_world",
        sourceRepository: source.repo,
        sourceCommit: sha,
        sourcePath: source.file,
        license: "MIT",
        language: source.lang,
        category: source.cat,
        fixture: filename,
        ...facts
      };

      if (existingIndex >= 0) {
        manifest[existingIndex] = entry;
      } else {
        manifest.push(entry);
      }
    } catch (e: any) {
      console.error(`Error processing ${source.id}: ${e.message}`);
    }
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('Real-world fixtures generated and manifest updated.');
}

run();
