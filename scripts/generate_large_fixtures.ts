import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const urls = [
  // Tech Docs
  { url: 'https://react.dev/reference/react/useState', id: 'tech-doc-en-02', category: 'technical-documentation', lang: 'en' },
  { url: 'https://ja.react.dev/reference/react/useState', id: 'tech-doc-ja-02', category: 'technical-documentation', lang: 'ja' },
  // API Reference
  { url: 'https://docs.github.com/en/rest/repos/repos', id: 'api-ref-en-01', category: 'api-reference', lang: 'en' },
  { url: 'https://developer.mozilla.org/ja/docs/Web/API/Fetch_API/Using_Fetch', id: 'api-ref-ja-01', category: 'api-reference', lang: 'ja' },
  // Code Examples
  { url: 'https://expressjs.com/en/starter/hello-world.html', id: 'code-heavy-en-01', category: 'code-heavy', lang: 'en' },
  // Tables
  { url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/table', id: 'table-en-02', category: 'table-heavy', lang: 'en' },
  // Long Blog
  { url: 'https://github.blog/2023-11-08-the-state-of-open-source-and-ai/', id: 'blog-en-02', category: 'blog', lang: 'en' },
  { url: 'https://developer.mozilla.org/ja/docs/Learn/JavaScript/First_steps/What_is_JavaScript', id: 'blog-ja-02', category: 'blog', lang: 'ja' },
  // News
  { url: 'https://news.ycombinator.com/item?id=38173454', id: 'news-en-02', category: 'news', lang: 'en' }, // HN thread
  { url: 'https://ja.wikipedia.org/wiki/JavaScript', id: 'news-ja-02', category: 'news', lang: 'ja' }, // Wikipedia as long article
  // Landing Page
  { url: 'https://nodejs.org/en/', id: 'landing-en-02', category: 'landing-page', lang: 'en' },
  // Ad/Nav Heavy
  { url: 'https://en.wikipedia.org/wiki/Main_Page', id: 'nav-heavy-en-01', category: 'nav-heavy', lang: 'en' },
  // FAQ
  { url: 'https://docs.github.com/en/get-started/quickstart/hello-world', id: 'faq-en-01', category: 'faq', lang: 'en' },
  // README
  { url: 'https://github.com/facebook/react', id: 'readme-en-01', category: 'readme', lang: 'en' },
  // Readability challenges (very little text, mostly UI)
  { url: 'https://example.com/', id: 'hard-readability-en-01', category: 'hard-readability', lang: 'en' },
  // Add some more to hit 24 cases
  { url: 'https://developer.mozilla.org/en-US/docs/Web/CSS', id: 'tech-doc-en-03', category: 'technical-documentation', lang: 'en' },
  { url: 'https://developer.mozilla.org/ja/docs/Web/CSS', id: 'tech-doc-ja-03', category: 'technical-documentation', lang: 'ja' },
  { url: 'https://docs.npmjs.com/cli/v10/commands/npm-install', id: 'api-ref-en-02', category: 'api-reference', lang: 'en' },
  { url: 'https://vuejs.org/guide/introduction.html', id: 'tech-doc-en-04', category: 'technical-documentation', lang: 'en' },
  { url: 'https://ja.vuejs.org/guide/introduction.html', id: 'tech-doc-ja-04', category: 'technical-documentation', lang: 'ja' },
  { url: 'https://golang.org/doc/effective_go', id: 'long-doc-en-01', category: 'technical-documentation', lang: 'en' },
  { url: 'https://python.org/', id: 'landing-en-03', category: 'landing-page', lang: 'en' },
  { url: 'https://jestjs.io/docs/getting-started', id: 'tech-doc-en-05', category: 'technical-documentation', lang: 'en' },
  { url: 'https://webpack.js.org/concepts/', id: 'tech-doc-en-06', category: 'technical-documentation', lang: 'en' }
];

async function generateFacts(html, url, lang) {
  if (!process.env.GEMINI_API_KEY) {
    return { requiredFacts: ["Fact 1", "Fact 2"], requiredCodeFragments: [], requiredHeadings: [] };
  }
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
  const prompt = `Analyze this HTML from ${url}. Extract 2 important factual sentences (requiredFacts) from the main content, 1 code snippet text if present (requiredCodeFragments), and 1 main heading (requiredHeadings). Output JSON strictly: { "requiredFacts": [""], "requiredCodeFragments": [""], "requiredHeadings": [""] }.\n\nHTML (truncated):\n${html.substring(0, 30000)}`;
  
  try {
    const res = await model.generateContent(prompt);
    let text = res.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    console.error('Fact generation failed for', url, e);
    return { requiredFacts: ["Fact 1"], requiredCodeFragments: [], requiredHeadings: [] };
  }
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const fixturesDir = path.join(__dirname, '../benchmarks/fixtures');
  const datasetsDir = path.join(__dirname, '../benchmarks/datasets');
  
  // Keep original cases, but maybe we replace or add to them
  let cases = [];
  try {
    cases = JSON.parse(fs.readFileSync(path.join(datasetsDir, 'offline-cases.json'), 'utf8'));
  } catch(e) {}

  for (const item of urls) {
    // skip if exists
    if (cases.find(c => c.id === item.id)) continue;

    console.log(`Fetching ${item.url}...`);
    try {
      await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      const html = await page.content();
      
      const fixtureName = `${item.id}.html`;
      fs.writeFileSync(path.join(fixturesDir, fixtureName), html);
      
      const facts = await generateFacts(html, item.url, item.lang);
      
      cases.push({
        id: item.id,
        language: item.lang,
        category: item.category,
        fixture: fixtureName,
        ...facts
      });
      
      fs.writeFileSync(path.join(datasetsDir, 'offline-cases.json'), JSON.stringify(cases, null, 2));
    } catch (e) {
      console.error(`Failed ${item.url}:`, e);
    }
  }

  await browser.close();
}

main();
