const fs = require('fs');
const path = require('path');

const fixturesDir = path.join(__dirname, '../benchmarks/fixtures');
const datasetsDir = path.join(__dirname, '../benchmarks/datasets');

if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir, { recursive: true });
if (!fs.existsSync(datasetsDir)) fs.mkdirSync(datasetsDir, { recursive: true });

const cases = [
  {
    id: 'tech-doc-en-01',
    language: 'en',
    category: 'technical-documentation',
    html: `<!DOCTYPE html><html><head><title>Installation Guide</title></head><body><nav>Links</nav><main><h1>Installation Guide</h1><p>The default port is 3000.</p><p>You must set API_KEY in env.</p><pre><code>npm run build</code></pre></main><footer>Footer</footer></body></html>`,
    requiredFacts: ['The default port is 3000.', 'API_KEY'],
    requiredCodeFragments: ['npm run build'],
    requiredHeadings: ['Installation Guide']
  },
  {
    id: 'tech-doc-ja-01',
    language: 'ja',
    category: 'technical-documentation',
    html: `<!DOCTYPE html><html lang="ja"><head><title>設定ガイド</title></head><body><header>Logo</header><article><h1>設定ガイド</h1><p>デフォルトのタイムアウトは45秒です。</p><pre><code>systemctl restart app</code></pre><h2>環境変数</h2><table><tr><td>MAX_RETRIES</td><td>3</td></tr></table></article></body></html>`,
    requiredFacts: ['デフォルトのタイムアウトは45秒です。', 'MAX_RETRIES'],
    requiredCodeFragments: ['systemctl restart app'],
    requiredHeadings: ['設定ガイド', '環境変数']
  },
  {
    id: 'blog-en-01',
    language: 'en',
    category: 'blog',
    html: `<!DOCTYPE html><html><body><h1>My Journey</h1><p>I started learning Rust in 2023.</p><p>It has been a wild ride.</p></body></html>`,
    requiredFacts: ['learning Rust in 2023'],
    requiredCodeFragments: [],
    requiredHeadings: ['My Journey']
  },
  {
    id: 'blog-ja-01',
    language: 'ja',
    category: 'blog',
    html: `<!DOCTYPE html><html><body><div class="sidebar">Ads Ads Ads</div><main><h1>春の旅行記</h1><p>京都に行ってきました。桜が満開でした。</p><p>美味しい抹茶パフェを食べました。</p></main></body></html>`,
    requiredFacts: ['京都に行ってきました', '抹茶パフェ'],
    requiredCodeFragments: [],
    requiredHeadings: ['春の旅行記']
  },
  {
    id: 'news-en-01',
    language: 'en',
    category: 'news',
    html: `<!DOCTYPE html><html><body><header>BREAKING NEWS</header><article><h1>Company X goes public</h1><p>Company X has announced its IPO at $50 per share today.</p></article><aside>More news</aside></body></html>`,
    requiredFacts: ['Company X has announced its IPO', '$50 per share'],
    requiredCodeFragments: [],
    requiredHeadings: ['Company X goes public']
  },
  {
    id: 'news-ja-01',
    language: 'ja',
    category: 'news',
    html: `<!DOCTYPE html><html><body><h1>新製品の発表</h1><p>株式会社Yは、次世代スマートフォンを発表しました。価格は10万円からです。</p></body></html>`,
    requiredFacts: ['株式会社Y', '次世代スマートフォン', '10万円'],
    requiredCodeFragments: [],
    requiredHeadings: ['新製品の発表']
  },
  {
    id: 'landing-en-01',
    language: 'en',
    category: 'landing-page',
    html: `<!DOCTYPE html><html><body><h1>Welcome to SuperApp</h1><p>The best app in the world.</p><button>Sign Up Now</button><div>Feature 1: Lightning fast</div><div>Feature 2: Secure</div></body></html>`,
    requiredFacts: ['The best app in the world', 'Lightning fast', 'Secure'],
    requiredCodeFragments: [],
    requiredHeadings: ['Welcome to SuperApp']
  },
  {
    id: 'landing-ja-01',
    language: 'ja',
    category: 'landing-page',
    html: `<!DOCTYPE html><html><body><h1>最高のサービス</h1><p>今すぐ無料で始めましょう。</p><ul><li>特徴A: 使いやすい</li><li>特徴B: 高速</li></ul></body></html>`,
    requiredFacts: ['無料で始めましょう', '特徴A: 使いやすい'],
    requiredCodeFragments: [],
    requiredHeadings: ['最高のサービス']
  },
  {
    id: 'ad-heavy-en-01',
    language: 'en',
    category: 'ad-heavy',
    html: `<!DOCTYPE html><html><body><div class="ad">Buy this!</div><article><h1>Real Content</h1><p>Here is the actual story.</p><div class="ad">Another ad</div><p>More story details.</p></article><div class="ad">Bottom ad</div></body></html>`,
    requiredFacts: ['actual story', 'More story details'],
    requiredCodeFragments: [],
    requiredHeadings: ['Real Content']
  },
  {
    id: 'table-en-01',
    language: 'en',
    category: 'table-heavy',
    html: `<!DOCTYPE html><html><body><h1>Pricing</h1><table><tr><th>Plan</th><th>Price</th></tr><tr><td>Basic</td><td>$10</td></tr><tr><td>Pro</td><td>$20</td></tr></table></body></html>`,
    requiredFacts: ['Basic', '$10', 'Pro', '$20'],
    requiredCodeFragments: [],
    requiredHeadings: ['Pricing']
  },
  {
    id: 'short-en-01',
    language: 'en',
    category: 'short-text',
    html: `<!DOCTYPE html><html><body><p>Hello world.</p></body></html>`,
    requiredFacts: ['Hello world.'],
    requiredCodeFragments: [],
    requiredHeadings: []
  },
  {
    id: 'hard-readability-ja-01',
    language: 'ja',
    category: 'hard-readability',
    html: `<!DOCTYPE html><html><body><div><div><div><span>重要なテキストが深くネストされています。</span></div></div></div></body></html>`,
    requiredFacts: ['重要なテキストが深くネストされています。'],
    requiredCodeFragments: [],
    requiredHeadings: []
  }
];

const manifest = cases.map(c => {
  const filename = `${c.id}.html`;
  fs.writeFileSync(path.join(fixturesDir, filename), c.html);
  
  return {
    id: c.id,
    language: c.language,
    category: c.category,
    fixture: filename,
    requiredFacts: c.requiredFacts,
    requiredCodeFragments: c.requiredCodeFragments,
    requiredHeadings: c.requiredHeadings
  };
});

fs.writeFileSync(path.join(datasetsDir, 'offline-cases.json'), JSON.stringify(manifest, null, 2));

console.log('Fixtures generated.');
