import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { GoogleGenAI } from '@google/genai';
import { getBodyText, getLightcrawlArticle, getLightcrawlFull, getLightcrawlAutoCandidate } from './extractors';
import { countTokens } from './token-counter';

const tasksDir = path.join(__dirname, '../../benchmarks/agent/tasks');
const resultsDir = path.join(__dirname, '../../benchmarks/results');
const latestJsonPath = path.join(resultsDir, 'latest.json');

// Configuration
const MAX_COST_USD = parseFloat(process.env.BENCHMARK_MAX_COST_USD || '5');
const MAX_API_REQUESTS = parseInt(process.env.BENCHMARK_MAX_API_REQUESTS || '300', 10);
const MAX_TOTAL_TOKENS = parseInt(process.env.BENCHMARK_MAX_TOTAL_TOKENS || '2000000', 10);
const MAX_RUNS = parseInt(process.env.BENCHMARK_MAX_RUNS || '80', 10);

// Pricing for gemini-2.5-flash (approximate per 1M tokens)
const COST_PER_1M_INPUT = parseFloat(process.env.BENCHMARK_COST_1M_INPUT || '0.075');
const COST_PER_1M_OUTPUT = parseFloat(process.env.BENCHMARK_COST_1M_OUTPUT || '0.30');

function calculateCost(input: number, output: number) {
  return (input / 1000000) * COST_PER_1M_INPUT + (output / 1000000) * COST_PER_1M_OUTPUT;
}

function extractCodeBlock(text: string): string {
  const match = text.match(/```(?:javascript|js)?\n([\s\S]*?)```/);
  return match ? match[1] : text;
}

function loadExistingResults() {
  if (fs.existsSync(latestJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(latestJsonPath, 'utf8'));
      if (data.agent && data.agent.results) return { data, results: data.agent.results };
    } catch(e) {}
  }
  return { data: { metadata: { timestamp: new Date().toISOString() } }, results: [] };
}

function saveResults(data: any, results: any[], tasksCount: number) {
  data.agent = { tasksCount, results };
  fs.writeFileSync(latestJsonPath, JSON.stringify(data, null, 2));
}

async function run() {
  console.log('Starting Agent Development Benchmark Phase 2B...');
  console.log(`Safety Limits: Cost=$${MAX_COST_USD}, API Req=${MAX_API_REQUESTS}, Tokens=${MAX_TOTAL_TOKENS}, Runs=${MAX_RUNS}`);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('Skipping Agent Benchmark: GEMINI_API_KEY is not set.');
    process.exit(0);
  }

  const modelName = process.env.BENCHMARK_MODEL || 'gemini-2.5-flash';
  const repetitions = parseInt(process.env.BENCHMARK_REPETITIONS || '5', 10);
  const ai = new GoogleGenAI({ apiKey });

  const tasks = fs.readdirSync(tasksDir).filter(f => fs.statSync(path.join(tasksDir, f)).isDirectory());
  const { data, results } = loadExistingResults();
  
  let currentCost = results.reduce((acc: number, r: any) => acc + (r.estimated_cost_usd || 0), 0);
  let currentRequests = results.reduce((acc: number, r: any) => acc + (r.api_request_count || 0), 0);
  let currentTokens = results.reduce((acc: number, r: any) => acc + (r.total_tokens || 0), 0);
  let runCount = results.length;

  for (const taskId of tasks) {
    const taskPath = path.join(tasksDir, taskId);
    const taskJson = JSON.parse(fs.readFileSync(path.join(taskPath, 'task.json'), 'utf8'));
    const docHtml = fs.readFileSync(path.join(taskPath, 'documentation.html'), 'utf8');
    const starterJs = fs.readFileSync(path.join(taskPath, 'starter/index.js'), 'utf8');
    const testJs = fs.readFileSync(path.join(taskPath, 'tests/test.js'), 'utf8');

    for (let runIndex = 1; runIndex <= repetitions; runIndex++) {
      const conditions = ['body_text', 'lightcrawl_article', 'lightcrawl_full', 'lightcrawl_auto_candidate'];

      for (const condition of conditions) {
        if (runCount >= MAX_RUNS || currentCost >= MAX_COST_USD || currentRequests >= MAX_API_REQUESTS || currentTokens >= MAX_TOTAL_TOKENS) {
          console.log(`Safety limit reached. Stopping execution.`);
          saveResults(data, results, tasks.length);
          process.exit(0);
        }

        const alreadyDone = results.some((r: any) => r.task_id === taskId && r.condition === condition && r.repetition === runIndex);
        if (alreadyDone) continue;

        console.log(`Task: ${taskId} | Rep: ${runIndex} | Condition: ${condition}`);
        
        let docContent = '';
        if (condition === 'body_text') docContent = getBodyText(docHtml);
        else if (condition === 'lightcrawl_article') docContent = getLightcrawlArticle(docHtml, 'http://localhost');
        else if (condition === 'lightcrawl_full') docContent = getLightcrawlFull(docHtml, 'http://localhost');
        else if (condition === 'lightcrawl_auto_candidate') docContent = getLightcrawlAutoCandidate(docHtml, 'http://localhost');

        const docTokens = countTokens(docContent);
        const promptTemplate = `Documentation Context:\n{{DOC}}\n\nTask Instructions:\n${taskJson.prompt}\n\nCurrent index.js:\n\`\`\`javascript\n${starterJs}\n\`\`\`\n\nOutput ONLY the updated complete index.js code, wrapped in \`\`\`javascript code block.`;
        
        const otherPromptTokens = countTokens(promptTemplate.replace('{{DOC}}', ''));
        const prompt = promptTemplate.replace('{{DOC}}', docContent);
        
        const runStartTime = Date.now();
        let apiRequestCount = 0;
        let success = false;
        let inputTokens = 0;
        let outputTokens = 0;
        let cachedTokens = null;
        let thinkingTokens = null;
        let totalTokens = 0;
        let estimatedCost = 0;
        let generatedCode = '';
        let generationDurationMs = 0;
        let testDurationMs = 0;
        let errorCategory: string | null = null;
        let modelVersion = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            apiRequestCount++;
            currentRequests++;
            const genStartTime = Date.now();
            
            const result = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config: {
                temperature: 0.0,
                topP: 0.95,
                maxOutputTokens: 8192
              }
            });

            generationDurationMs += (Date.now() - genStartTime);
            
            if (result.text) generatedCode = extractCodeBlock(result.text);
            
            if (result.usageMetadata) {
              inputTokens = result.usageMetadata.promptTokenCount || 0;
              outputTokens = result.usageMetadata.candidatesTokenCount || 0;
              totalTokens = result.usageMetadata.totalTokenCount || 0;
              cachedTokens = result.usageMetadata.cachedContentTokenCount || null;
            }
            if (result.modelVersion) modelVersion = result.modelVersion;

            estimatedCost = calculateCost(inputTokens, outputTokens);
            currentTokens += totalTokens;
            currentCost += estimatedCost;
            break; 
          } catch (e: any) {
            console.error(`Attempt ${attempt} failed:`, e.message);
            if (e.status === 429) {
              errorCategory = 'rate_limit';
              await new Promise(r => setTimeout(r, 20000));
            } else if (e.name === 'AbortError' || e.message.includes('timeout')) {
              errorCategory = 'api_timeout';
            } else {
              errorCategory = 'invalid_model_output';
            }
            
            if (attempt === 3) {
               break;
            }
          }
        }

        if (!errorCategory && generatedCode) {
          const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `lightcrawl-agent-${taskId}-`));
          fs.writeFileSync(path.join(tempDir, 'index.js'), generatedCode);
          fs.writeFileSync(path.join(tempDir, 'test.js'), testJs.replace('../index.js', './index.js'));

          const testStartTime = Date.now();
          try {
            const output = execSync('node test.js', { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
            if (output.includes('PASS')) {
              success = true;
            } else {
              errorCategory = 'test_failure';
            }
          } catch (e) {
            success = false;
            errorCategory = 'test_failure';
          } finally {
            testDurationMs = Date.now() - testStartTime;
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
        }

        const timeToGreenMs = success ? (Date.now() - runStartTime) : null;

        results.push({
          task_id: taskId,
          condition,
          repetition: runIndex,
          success,
          documentation_estimated_tokens: docTokens,
          prompt_input_tokens: inputTokens || docTokens + otherPromptTokens,
          cached_input_tokens: cachedTokens,
          output_tokens: outputTokens,
          thinking_tokens: thinkingTokens,
          total_tokens: totalTokens,
          api_request_count: apiRequestCount,
          turn_count: 1,
          test_attempt_count: 1,
          generation_duration_ms: generationDurationMs,
          test_duration_ms: testDurationMs,
          time_to_green_ms: timeToGreenMs,
          error_category: errorCategory,
          estimated_cost_usd: estimatedCost,
          model_requested: modelName,
          model_version: modelVersion,
          sdk_version: '@google/genai@2.11.0'
        });

        runCount++;
        saveResults(data, results, tasks.length);
        console.log(`[Cost: $${currentCost.toFixed(4)}] Finished run ${runCount}/${MAX_RUNS}`);
      }
    }
  }

  saveResults(data, results, tasks.length);
  console.log(`Agent benchmark completed. Total Cost: $${currentCost.toFixed(4)}`);
}

run();
