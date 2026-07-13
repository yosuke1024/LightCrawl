import fs from 'fs';
import path from 'path';
import { generateMarkdownReport } from './report-generator';

const resultsDir = path.join(__dirname, '../../benchmarks/results');
const latestJsonPath = path.join(resultsDir, 'latest.json');

if (fs.existsSync(latestJsonPath)) {
  const data = JSON.parse(fs.readFileSync(latestJsonPath, 'utf8'));
  const md = generateMarkdownReport(data);
  fs.writeFileSync(path.join(resultsDir, 'latest.md'), md);
  console.log('Regenerated latest.md from latest.json');
} else {
  console.log('latest.json not found');
}
