import { describe, it, expect } from 'vitest';
import { generateMarkdownReport, generateCsvReport } from '../src/report-generator';

describe('report-generator', () => {
  const sampleData = {
    metadata: {
      timestamp: '2023-10-01T00:00:00Z',
      nodeVersion: 'v20.0.0',
      os: 'linux',
      arch: 'x64',
      tokenizerName: 'js-tiktoken',
      tokenizerVersion: 'o200k_base'
    },
    offline: {
      fixturesCount: 1,
      overallTokenReduction: 0.5,
      overallFactRetention: 1.0,
      results: [
        {
          id: 'test-1',
          tokenReduction: 0.5,
          factRetentionRate: 1.0,
          rawTokens: 1000,
          bodyTokens: 500,
          articleTokens: 250
        }
      ]
    },
    agent: null
  };

  it('should generate markdown report', () => {
    const sampleData = {
      metadata: {
        timestamp: '2023-10-01T00:00:00Z'
      },
      offline: {
        fixturesCount: 1,
        conditionMetrics: {
          lightcrawl_article: {
            macro_fact_retention: 0.5,
            micro_fact_retention: 0.5,
            macro_median_reduction: 0.5,
            weighted_total_reduction: 0.5,
            total_tokens: 500
          }
        },
        results: []
      },
      agent: null
    };

    const md = generateMarkdownReport(sampleData as any);
    expect(md).toContain('# LightCrawl Benchmark Report');
    expect(md).toContain('50.00%');
  });

  it('should generate csv report', () => {
    const csv = generateCsvReport({} as any);
    expect(csv).toContain('CSV report not fully implemented in Phase 1B');
  });
});
