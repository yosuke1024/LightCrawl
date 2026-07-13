import fs from 'fs';
import path from 'path';

const datasetsDir = path.join(__dirname, '../../benchmarks/datasets');
const fixturesDir = path.join(__dirname, '../../benchmarks/fixtures');

function verify() {
  const manifestPath = path.join(datasetsDir, 'offline-cases.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest) || manifest.length === 0) {
    console.error('Manifest is empty or not an array.');
    process.exit(1);
  }

  const ids = new Set();
  let engCount = 0;
  let jaCount = 0;

  for (const item of manifest) {
    if (!item.id || !item.fixture || !item.language) {
      console.error(`Invalid item missing required fields: ${JSON.stringify(item)}`);
      process.exit(1);
    }
    
    if (ids.has(item.id)) {
      console.error(`Duplicate ID found: ${item.id}`);
      process.exit(1);
    }
    ids.add(item.id);

    if (item.language === 'en') engCount++;
    if (item.language === 'ja') jaCount++;

    const htmlPath = path.join(fixturesDir, item.fixture);
    if (!fs.existsSync(htmlPath)) {
      console.error(`Fixture file not found: ${htmlPath}`);
      process.exit(1);
    }

    if (!Array.isArray(item.requiredFacts)) {
      console.error(`requiredFacts must be an array for ${item.id}`);
      process.exit(1);
    }
  }

  if (manifest.length < 12) {
    console.error(`Not enough fixtures. Expected at least 12, got ${manifest.length}`);
    process.exit(1);
  }

  if (engCount < 6) {
    console.error(`Not enough English fixtures. Expected at least 6, got ${engCount}`);
    process.exit(1);
  }

  if (jaCount < 4) {
    console.error(`Not enough Japanese fixtures. Expected at least 4, got ${jaCount}`);
    process.exit(1);
  }

  console.log('Verification passed successfully.');
}

verify();
