import fs from 'fs';
import path from 'path';
import { getRawHtml, getBodyText, getLightcrawlFull, getLightcrawlArticle } from './src/extractors';

const fixturesDir = path.join(__dirname, 'fixtures');
const offlineCases = JSON.parse(fs.readFileSync(path.join(__dirname, 'datasets/offline-cases.json'), 'utf8'));

const targetIds = ['tech-doc-en-01', 'tech-doc-ja-01'];
const cases = offlineCases.filter((c: any) => targetIds.includes(c.id));

for (const c of cases) {
  const html = fs.readFileSync(path.join(fixturesDir, c.fixture), 'utf8');
  console.log(`\n=== Analyzing ${c.id} ===`);
  
  const article = getLightcrawlArticle(html, 'http://localhost');
  
  console.log(`\n[Missing Facts Check]`);
  for (const fact of c.requiredFacts) {
    const normHtml = html.replace(/\s+/g, ' ');
    const normArticle = article.replace(/\s+/g, ' ');
    const normFact = fact.replace(/\s+/g, ' ');
    
    console.log(`Fact: "${fact}"`);
    console.log(`  - In original HTML? ${normHtml.includes(normFact)}`);
    console.log(`  - In LightCrawl Article? ${normArticle.includes(normFact)}`);
    if (!normArticle.includes(normFact)) {
       // Let's see if full has it
       const full = getLightcrawlFull(html, 'http://localhost').replace(/\s+/g, ' ');
       console.log(`  - In LightCrawl Full? ${full.includes(normFact)}`);
       console.log(`  - Article length: ${normArticle.length}, Full length: ${full.length}`);
    }
  }
}
