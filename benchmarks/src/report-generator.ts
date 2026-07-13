import fs from 'fs';
import path from 'path';
import { bootstrapConfidenceInterval } from './statistics';

export function generateMarkdownReport(data: any): string {
  let md = `# LightCrawl Benchmark Report (Phase 1C & 2B)\n\n`;
  md += `Generated at: ${data.metadata.timestamp}\n`;
  md += `Node Version: ${data.metadata.nodeVersion}\n`;
  md += `Tokenizer: ${data.metadata.tokenizerName}@${data.metadata.tokenizerVersion}\n\n`;

  // OFFLINE BENCHMARK
  if (data.offline && data.offline.datasetMetrics) {
    const dsMetrics = data.offline.datasetMetrics;
    const datasets = ['synthetic', 'real_world', 'combined'];

    for (const ds of datasets) {
      if (!dsMetrics[ds]) continue;
      const m = dsMetrics[ds];
      md += `## Offline Token Efficiency - ${ds.toUpperCase()} Dataset\n\n`;
      md += `* **Fixtures Evaluated:** ${m.fixturesCount}\n`;

      md += `\n| Condition | Total Tokens | Fact Ret% | Code Ret% | Heading Ret% | Table Ret% | Link Ret% | Token Reduction |\n`;
      md += `|---|---|---|---|---|---|---|---|\n`;
      
      const conditions = ['raw_html', 'body_text', 'lightcrawl_full', 'lightcrawl_article', 'lightcrawl_auto_candidate'];
      for (const c of conditions) {
        if (!m.conditions[c]) continue;
        const cData = m.conditions[c];
        const red = (cData.weighted_total_reduction * 100).toFixed(2);
        const fact = (cData.micro_fact_retention * 100).toFixed(2);
        const code = (cData.code_retention_rate * 100).toFixed(2);
        const heading = (cData.heading_retention_rate * 100).toFixed(2);
        const table = (cData.table_cell_retention_rate * 100).toFixed(2);
        const link = (cData.link_target_retention_rate * 100).toFixed(2);
        
        md += `| ${c} | ${cData.total_tokens} | ${fact}% | ${code}% | ${heading}% | ${table}% | ${link}% | ${red}% |\n`;
      }
      md += '\n';
    }

    // Offline Claim Validation
    let claimValid = false;
    let offlineReason = '';
    const rw = dsMetrics['real_world'];
    if (rw && rw.fixturesCount >= 20) {
      const art = rw.conditions['lightcrawl_article'];
      if (
        art.micro_fact_retention >= 0.95 &&
        art.code_retention_rate >= 0.95 &&
        art.table_cell_retention_rate >= 0.90 &&
        art.weighted_total_reduction >= 0.10
      ) {
        // Check ja/en reduction
        const results = data.offline.results;
        let jaRed = 0, jaBody = 0, enRed = 0, enBody = 0;
        for (const r of results) {
          if (r.dataset === 'real_world') {
             const bodyT = r.conditions.body_text.tokens;
             const artT = r.conditions.lightcrawl_article.tokens;
             if (r.language === 'ja') { jaBody += bodyT; jaRed += (bodyT - artT); }
             if (r.language === 'en') { enBody += bodyT; enRed += (bodyT - artT); }
          }
        }
        if (jaRed > 0 && enRed > 0) claimValid = true;
        else offlineReason = `Language reduction failed. JA: ${jaRed}, EN: ${enRed}`;
      } else {
        offlineReason = `Metrics not met: Fact=${art.micro_fact_retention}, Code=${art.code_retention_rate}, Table=${art.table_cell_retention_rate}, Reduction=${art.weighted_total_reduction}`;
      }
    } else {
       offlineReason = `Insufficient real-world fixtures (${rw ? rw.fixturesCount : 0} < 20)`;
    }

    md += `### Offline Token Claim\n`;
    if (claimValid) {
      md += `✅ **EVIDENCE MET**: Real-world benchmarks demonstrate >= 10% token reduction while maintaining >95% fact/code retention and >90% table retention across both EN/JA languages.\n\n`;
    } else {
      md += `❌ **insufficient_evidence**: ${offlineReason}\n\n`;
    }
  }

  // AGENT BENCHMARK
  if (data.agent && data.agent.results && data.agent.results.length > 0) {
    const results = data.agent.results;
    md += `## Agent Efficiency Benchmark\n\n`;
    md += `* **Total Runs Completed:** ${results.length}\n`;
    const totalReqs = results.reduce((sum: number, r: any) => sum + (r.api_request_count || 0), 0);
    const totalCost = results.reduce((sum: number, r: any) => sum + (r.estimated_cost_usd || 0), 0);
    md += `* **Total API Requests:** ${totalReqs}\n`;
    md += `* **Estimated Cost:** $${totalCost.toFixed(4)}\n\n`;

    const conditions = ['body_text', 'lightcrawl_article', 'lightcrawl_full', 'lightcrawl_auto_candidate'];
    
    // Group by condition
    md += `### Condition Summary\n\n`;
    md += `| Condition | Runs | Success | Median Total T. | Median Input T. | Median Out T. | Median T2G (ms) | Turns | Test Attempts |\n`;
    md += `|---|---|---|---|---|---|---|---|---|\n`;

    const conditionStats: any = {};

    for (const c of conditions) {
      const runs = results.filter((r: any) => r.condition === c);
      if (runs.length === 0) continue;
      
      const successes = runs.filter((r: any) => r.success);
      const succRate = successes.length / runs.length;
      
      const totalT = runs.map((r: any) => r.total_tokens || 0).sort((a: number,b: number) => a-b);
      const inputT = runs.map((r: any) => r.prompt_input_tokens || 0).sort((a: number,b: number) => a-b);
      const outT = runs.map((r: any) => (r.output_tokens || 0) + (r.thinking_tokens || 0)).sort((a: number,b: number) => a-b);
      
      const t2g = successes.map((r: any) => r.time_to_green_ms).sort((a: number,b: number) => a-b);
      
      const medTotal = totalT[Math.floor(totalT.length / 2)] || 0;
      const medInput = inputT[Math.floor(inputT.length / 2)] || 0;
      const medOut = outT[Math.floor(outT.length / 2)] || 0;
      const medT2G = t2g.length > 0 ? t2g[Math.floor(t2g.length / 2)] : 0;

      const turns = runs.map((r: any) => r.turn_count || 1).sort((a: number,b: number) => a-b);
      const medTurns = turns[Math.floor(turns.length / 2)] || 0;
      
      const tests = runs.map((r: any) => r.test_attempt_count || 1).sort((a: number,b: number) => a-b);
      const medTests = tests[Math.floor(tests.length / 2)] || 0;

      conditionStats[c] = { runs: runs.length, succRate, medTotal, medT2G, t2gArr: t2g, totalArr: totalT };

      md += `| ${c} | ${runs.length} | ${(succRate * 100).toFixed(1)}% | ${medTotal} | ${medInput} | ${medOut} | ${medT2G} | ${medTurns} | ${medTests} |\n`;
    }
    md += '\n';

    // Agent Claim Validation
    let agentValid = false;
    let agentReason = '';
    
    if (results.length >= 80) {
       const body = conditionStats['body_text'];
       const art = conditionStats['lightcrawl_article'];
       
       if (body && art && body.runs >= 20 && art.runs >= 20) {
         if (art.succRate >= body.succRate - 0.05) {
            const tokenReduction = (body.medTotal - art.medTotal) / body.medTotal;
            const timeReduction = body.medT2G > 0 ? (body.medT2G - art.medT2G) / body.medT2G : 0;
            if (tokenReduction >= 0.10 && timeReduction >= 0.10) {
               agentValid = true;
            } else {
               agentReason = `Reductions insufficient: Token=${(tokenReduction*100).toFixed(2)}%, Time=${(timeReduction*100).toFixed(2)}%`;
            }
         } else {
            agentReason = `Success rate dropped too much: Body=${(body.succRate*100).toFixed(1)}%, Art=${(art.succRate*100).toFixed(1)}%`;
         }
       } else {
         agentReason = `Insufficient condition runs`;
       }
    } else {
       agentReason = `Insufficient total runs (${results.length} < 80)`;
    }

    md += `### Agent Efficiency Claim\n`;
    if (agentValid) {
      md += `✅ **EVIDENCE MET**: LightCrawl maintained success rate while decreasing Total Tokens and Time-to-Green by >= 10%.\n\n`;
    } else {
      md += `❌ **insufficient_evidence**: ${agentReason}\n\n`;
    }

  }

  return md;
}

if (require.main === module) {
  const resultsDir = path.join(__dirname, '../../benchmarks/results');
  const latestJsonPath = path.join(resultsDir, 'latest.json');
  if (fs.existsSync(latestJsonPath)) {
    const data = JSON.parse(fs.readFileSync(latestJsonPath, 'utf8'));
    fs.writeFileSync(path.join(resultsDir, 'latest.md'), generateMarkdownReport(data));
    console.log('Report generated.');
  }
}
