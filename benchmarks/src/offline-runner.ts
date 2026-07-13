import fs from 'fs';
import path from 'path';
import { countTokens } from './token-counter';
import { evaluateRetention } from './retention-evaluator';
import { getRawHtml, getBodyText, getLightcrawlFull, getLightcrawlArticle, getLightcrawlAutoCandidate } from './extractors';
import { calculateTokenReduction, calculateMedian } from './statistics';
import os from 'os';

const datasetsDir = path.join(__dirname, '../../benchmarks/datasets');
const fixturesDir = path.join(__dirname, '../../benchmarks/fixtures');
const resultsDir = path.join(__dirname, '../../benchmarks/results');

function run() {
  console.log('Starting offline token efficiency benchmark Phase 1C...');
  
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

  const manifestPath = path.join(datasetsDir, 'offline-cases.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('Manifest not found. Please run verify first.');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const results: any[] = [];
  
  const conditions = ['raw_html', 'body_text', 'lightcrawl_full', 'lightcrawl_article', 'lightcrawl_auto_candidate'];

  const datasets = ['synthetic', 'real_world', 'combined'];

  const aggregations: Record<string, Record<string, any>> = {};
  for (const ds of datasets) {
    aggregations[ds] = {};
    for (const c of conditions) {
      aggregations[ds][c] = {
        totalRequiredFacts: 0, foundFacts: 0,
        totalRequiredCodes: 0, foundCodes: 0,
        totalRequiredHeadings: 0, foundHeadings: 0,
        totalRequiredTables: 0, foundTables: 0,
        totalRequiredLinks: 0, foundLinks: 0,
        factRetentions: [],
        totalTokens: 0, bodyTokens: [], conditionTokens: [], reductions: []
      };
    }
  }

  for (const item of manifest) {
    const dataset = item.dataset || 'synthetic';
    const htmlPath = path.join(fixturesDir, item.fixture);
    if (!fs.existsSync(htmlPath)) {
      console.error(`Fixture not found: ${htmlPath}`);
      continue;
    }

    const html = fs.readFileSync(htmlPath, 'utf8');
    
    const extractions: Record<string, string> = {
      'raw_html': getRawHtml(html),
      'body_text': getBodyText(html),
      'lightcrawl_full': getLightcrawlFull(html, 'http://localhost'),
      'lightcrawl_article': getLightcrawlArticle(html, 'http://localhost'),
      'lightcrawl_auto_candidate': getLightcrawlAutoCandidate(html, 'http://localhost')
    };

    const fixtureResult: any = { id: item.id, category: item.category, language: item.language, dataset, conditions: {} };
    const bodyTokens = countTokens(extractions['body_text']);

    for (const c of conditions) {
      const text = extractions[c];
      const tokens = countTokens(text);
      const retention = evaluateRetention(
        text, 
        item.requiredFacts || [], 
        item.requiredCodeFragments || [], 
        item.requiredHeadings || [], 
        item.requiredTableCells || [], 
        item.requiredLinks || []
      );

      // We only compute token reduction based on factRetentionRate for backward compatibility logic,
      // but realistically we should just use tokens vs bodyTokens directly.
      const reduction = calculateTokenReduction(tokens, bodyTokens, retention.factRetentionRate);

      fixtureResult.conditions[c] = {
        tokens,
        retention,
        tokenReduction: reduction
      };

      const aggsToUpdate = [aggregations[dataset][c], aggregations['combined'][c]];
      for (const agg of aggsToUpdate) {
        agg.totalRequiredFacts += retention.totalRequiredFacts;
        agg.foundFacts += retention.foundFacts;
        agg.totalRequiredCodes += retention.totalRequiredCodeFragments;
        agg.foundCodes += retention.foundCodeFragments;
        agg.totalRequiredHeadings += retention.totalRequiredHeadings;
        agg.foundHeadings += retention.foundHeadings;
        agg.totalRequiredTables += retention.totalRequiredTableCells;
        agg.foundTables += retention.foundTableCells;
        agg.totalRequiredLinks += retention.totalRequiredLinks;
        agg.foundLinks += retention.foundLinks;

        agg.factRetentions.push(retention.factRetentionRate);
        agg.totalTokens += tokens;
        agg.bodyTokens.push(bodyTokens);
        agg.conditionTokens.push(tokens);
        if (reduction !== null) agg.reductions.push(reduction);
      }
    }

    results.push(fixtureResult);
    console.log(`Processed ${item.id} (${dataset})`);
  }

  const datasetMetrics: Record<string, any> = {};
  for (const ds of datasets) {
    datasetMetrics[ds] = {
      fixturesCount: results.filter(r => ds === 'combined' || r.dataset === ds).length,
      conditions: {}
    };
    if (datasetMetrics[ds].fixturesCount === 0) continue;

    const totalBodyTokens = aggregations[ds]['body_text'].totalTokens;
    
    for (const c of conditions) {
      const agg = aggregations[ds][c];
      datasetMetrics[ds].conditions[c] = {
        macro_fact_retention: calculateMedian(agg.factRetentions),
        micro_fact_retention: agg.totalRequiredFacts > 0 ? agg.foundFacts / agg.totalRequiredFacts : 1,
        code_retention_rate: agg.totalRequiredCodes > 0 ? agg.foundCodes / agg.totalRequiredCodes : 1,
        heading_retention_rate: agg.totalRequiredHeadings > 0 ? agg.foundHeadings / agg.totalRequiredHeadings : 1,
        table_cell_retention_rate: agg.totalRequiredTables > 0 ? agg.foundTables / agg.totalRequiredTables : 1,
        link_target_retention_rate: agg.totalRequiredLinks > 0 ? agg.foundLinks / agg.totalRequiredLinks : 1,

        macro_median_reduction: calculateMedian(agg.reductions),
        weighted_total_reduction: totalBodyTokens > 0 ? 1 - (agg.totalTokens / totalBodyTokens) : 0,
        total_tokens: agg.totalTokens
      };
    }
  }

  // Preserve existing agent results if any
  const latestJsonPath = path.join(resultsDir, 'latest.json');
  let existingAgent = null;
  if (fs.existsSync(latestJsonPath)) {
    const existingData = JSON.parse(fs.readFileSync(latestJsonPath, 'utf8'));
    if (existingData.agent) existingAgent = existingData.agent;
  }

  const reportData = {
    metadata: {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      os: os.platform(),
      arch: os.arch(),
      tokenizerName: 'js-tiktoken',
      tokenizerVersion: 'o200k_base'
    },
    offline: {
      datasetMetrics,
      results
    },
    agent: existingAgent
  };

  fs.writeFileSync(latestJsonPath, JSON.stringify(reportData, null, 2));

  console.log('Offline benchmark completed. Results saved to latest.json');
}

run();
