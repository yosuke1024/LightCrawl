import fs from 'fs';
import path from 'path';

const datasetsDir = path.join(__dirname, '../benchmarks/datasets');
const fixturesDir = path.join(__dirname, '../benchmarks/fixtures');

if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir, { recursive: true });

function generateParagraphs(count: number, filler = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. "): string {
  let result = '';
  for(let i=0; i<count; i++) result += `<p>${filler}</p>\n`;
  return result;
}

const cases: any[] = [];

// Helper to create a fixture
function createFixture(id: string, category: string, lang: string, facts: string[], code: string[], headings: string[], paragraphs: number, preBody: string = '', postBody: string = '') {
  let mainContent = '';
  headings.forEach(h => mainContent += `<h2>${h}</h2>\n`);
  mainContent += generateParagraphs(paragraphs / 2);
  facts.forEach(f => mainContent += `<p><strong>${f}</strong></p>\n`);
  mainContent += generateParagraphs(paragraphs / 2);
  code.forEach(c => mainContent += `<pre><code>${c}</code></pre>\n`);

  const html = `<!DOCTYPE html>
<html>
<head><title>${id}</title></head>
<body>
  <header>
    <nav>
      <ul><li>Home</li><li>About</li><li>Contact</li></ul>
      ${generateParagraphs(1, "Nav link ")}
    </nav>
  </header>
  ${preBody}
  <main>
    <article>
      <h1>Main Content for ${id}</h1>
      ${mainContent}
    </article>
  </main>
  ${postBody}
  <aside>
    <h3>Related Links</h3>
    ${generateParagraphs(2, "Sidebar link text that shouldn't be in the article if stripped. ")}
  </aside>
  <footer>
    <p>Copyright 2026. ${generateParagraphs(1, "Footer legal text. ")}</p>
  </footer>
</body>
</html>`;

  fs.writeFileSync(path.join(fixturesDir, `${id}.html`), html);
  cases.push({
    id,
    language: lang,
    category,
    fixture: `${id}.html`,
    requiredFacts: facts,
    requiredCodeFragments: code,
    requiredHeadings: headings
  });
}

// Generate 24 cases
// To reach median 1500 tokens, 1 token ~ 4 chars. So ~6000 chars of body.
// "Lorem ipsum..." is 426 chars. So we need ~15 paragraphs to be safe. Let's use 20.

// Tech Docs (English & Japanese)
createFixture('tech-doc-en-01', 'technical-documentation', 'en', ['The default port is 3000.', 'API_KEY must be set in the environment.'], ['npm run build'], ['Installation Guide'], 20);
createFixture('tech-doc-en-02', 'technical-documentation', 'en', ['Authentication requires a Bearer token.', 'Rate limit is 100 requests per hour.'], ['const auth = new Auth();'], ['Authentication Setup'], 30);
createFixture('tech-doc-en-03', 'technical-documentation', 'en', ['WebSockets run on wss://.', 'Connection timeout is 30s.'], ['socket.connect();'], ['WebSocket API'], 25);
createFixture('tech-doc-ja-01', 'technical-documentation', 'ja', ['デフォルトのタイムアウトは45秒です。', '環境変数 MAX_RETRIES を設定します。'], ['systemctl restart app'], ['設定ガイド'], 20);
createFixture('tech-doc-ja-02', 'technical-documentation', 'ja', ['データベース接続にはTLSが必須です。', 'ポートは5432を使用します。'], ['psql -U admin'], ['データベース設定'], 25);
createFixture('tech-doc-ja-03', 'technical-documentation', 'ja', ['キャッシュの有効期限は1時間です。', 'RedisサーバーのIPを指定します。'], ['redis-cli ping'], ['キャッシュ設定'], 30);

// API Reference
createFixture('api-ref-en-01', 'api-reference', 'en', ['Returns a 200 OK on success.', 'Endpoint is /api/v1/users.'], ['GET /api/v1/users'], ['Endpoints'], 25);
createFixture('api-ref-ja-01', 'api-reference', 'ja', ['成功時には 200 OK を返します。', 'エンドポイントは /api/v1/items です。'], ['GET /api/v1/items'], ['エンドポイント仕様'], 25);

// Code Examples (Heavy Code)
createFixture('code-heavy-en-01', 'code-heavy', 'en', ['This example uses Express.js.', 'App listens on port 8080.'], ['app.listen(8080);', 'const express = require("express");'], ['Express Example'], 20);
createFixture('code-heavy-ja-01', 'code-heavy', 'ja', ['この例ではNext.jsを使用します。', 'ページはSSRでレンダリングされます。'], ['export const getServerSideProps = async () => {};'], ['Next.jsの例'], 25);

// Table Heavy
const tableHtml = `<table><thead><tr><th>Plan</th><th>Price</th></tr></thead><tbody><tr><td>Basic</td><td>$10</td></tr><tr><td>Pro</td><td>$20</td></tr></tbody></table>`;
createFixture('table-en-01', 'table-heavy', 'en', ['Basic plan costs $10.', 'Pro plan costs $20.'], [], ['Pricing Table'], 15, '', tableHtml);
createFixture('table-ja-01', 'table-heavy', 'ja', ['基本プランは1000円です。', 'プロプランは2000円です。'], [], ['料金表'], 15, '', tableHtml.replace('$10', '1000円').replace('$20', '2000円'));

// Long Blog
createFixture('blog-en-01', 'blog', 'en', ['I started learning Rust in 2023.', 'The compiler is very helpful.'], [], ['My Rust Journey'], 40);
createFixture('blog-ja-01', 'blog', 'ja', ['2023年にRustの学習を始めました。', 'コンパイラのエラーメッセージが親切です。'], [], ['Rust学習記'], 40);

// News
createFixture('news-en-01', 'news', 'en', ['Company X has announced its IPO.', 'The share price is set to $50.'], [], ['Company X goes public'], 25);
createFixture('news-ja-01', 'news', 'ja', ['株式会社Yが新規上場しました。', '公開価格は1株あたり5000円です。'], [], ['株式会社Yの上場'], 25);

// Landing Page
createFixture('landing-en-01', 'landing-page', 'en', ['The best app in the world.', 'We guarantee 99.9% uptime.'], [], ['Welcome to SuperApp'], 15);
createFixture('landing-ja-01', 'landing-page', 'ja', ['世界最高のアプリケーションです。', '稼働率99.9%を保証します。'], [], ['SuperAppへようこそ'], 15);

// Nav/Ad Heavy
const adBlock = `<div class="advertisement">${generateParagraphs(10, 'Buy our product now! 50% off! ')}</div>`;
createFixture('nav-heavy-en-01', 'nav-heavy', 'en', ['Actual article content.', 'Important story detail.'], [], ['Real Content'], 20, adBlock, adBlock);
createFixture('nav-heavy-ja-01', 'nav-heavy', 'ja', ['実際の記事コンテンツです。', '重要なニュースの詳細です。'], [], ['実際のニュース'], 20, adBlock, adBlock);

// FAQ
createFixture('faq-en-01', 'faq', 'en', ['You can reset your password from the settings page.', 'Refunds are processed within 5-7 business days.'], [], ['Frequently Asked Questions'], 20);
createFixture('faq-ja-01', 'faq', 'ja', ['設定画面からパスワードをリセットできます。', '返金には5〜7営業日かかります。'], [], ['よくある質問'], 20);

// README
createFixture('readme-en-01', 'readme', 'en', ['This is a popular open source library.', 'To contribute, please read CONTRIBUTING.md.'], ['git clone https://github.com/example/lib.git'], ['Introduction'], 20);

// Hard Readability
createFixture('hard-readability-ja-01', 'hard-readability', 'ja', ['重要なテキストが深くネストされています。', 'これはReadabilityが失敗しやすい構造です。'], [], ['複雑なレイアウト'], 15, '<div><div><div><div>', '</div></div></div></div>');

// Short text (Separate category)
createFixture('short-en-01', 'short-text', 'en', ['Hello world.'], [], ['Short text'], 1);

fs.writeFileSync(path.join(datasetsDir, 'offline-cases.json'), JSON.stringify(cases, null, 2));
console.log(`Generated ${cases.length} synthetic fixtures successfully.`);
