import { describe, it, expect } from 'vitest';
import { calculatePercentile, calculateTokenReduction } from '../src/statistics';

describe('statistics', () => {
  it('should calculate percentile correctly', () => {
    const values = [43, 54, 56, 61, 62, 66, 68, 69, 69, 70, 71, 72, 77, 78, 79, 85, 87, 88, 89, 93, 95, 96, 98, 99, 99];
    // For p50 (median)
    expect(calculatePercentile(values, 50)).toBe(77); // Middle element
    // For p90
    // Math.ceil(25 * 0.90) - 1 = Math.ceil(22.5) - 1 = 23 - 1 = 22 => 98
    expect(calculatePercentile(values, 90)).toBe(98);
  });

  it('should handle single element', () => {
    const values = [42];
    expect(calculatePercentile(values, 50)).toBe(42);
    expect(calculatePercentile(values, 95)).toBe(42);
  });

  it('should handle empty array', () => {
    expect(calculatePercentile([], 50)).toBe(0);
  });

  it('should calculate token reduction correctly', () => {
    // token_reduction_vs_body_text = 1 - lightcrawl_article_tokens / body_text_tokens
    // fact_retention_rate >= 0.95
    expect(calculateTokenReduction(50, 100, 1.0)).toBe(0.5); // 50% reduction
    expect(calculateTokenReduction(50, 100, 0.96)).toBe(0.5); // 50% reduction
    expect(calculateTokenReduction(50, 100, 0.94)).toBe(null); // Too low retention
    expect(calculateTokenReduction(0, 100, 1.0)).toBe(1.0); // 100% reduction
    expect(calculateTokenReduction(50, 0, 1.0)).toBe(0); // Zero division protection
  });
});
