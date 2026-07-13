/**
 * Calculates a given percentile from an array of numbers.
 * @param values Array of numbers
 * @param p Percentile (0 to 100)
 * @returns The percentile value
 */
export function calculatePercentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * (p / 100)) - 1;
  
  // Math.ceil can give -1 if p=0, so cap at 0
  return sorted[Math.max(0, index)];
}

/**
 * Calculates the token reduction rate of lightcrawl_article vs body_text.
 * Requires at least 95% fact retention.
 * 
 * @param lightcrawlTokens Estimated tokens in lightcrawl output
 * @param bodyTextTokens Estimated tokens in body_text output
 * @param factRetentionRate The calculated fact retention rate (0.0 to 1.0)
 * @returns Token reduction rate (0.0 to 1.0), or null if fact retention is too low.
 */
export function calculateTokenReduction(
  lightcrawlTokens: number,
  bodyTextTokens: number,
  factRetentionRate: number
): number | null {
  if (factRetentionRate < 0.95) {
    return null;
  }
  
  if (bodyTextTokens === 0) {
    return 0; // Avoid division by zero
  }

  const ratio = lightcrawlTokens / bodyTextTokens;
  return 1 - ratio;
}

export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  return calculatePercentile(values, 50);
}

export function calculateConfidenceInterval(values: number[], iterations: number = 1000): { lower: number, upper: number } {
  if (values.length < 2) return { lower: 0, upper: 0 };
  const means: number[] = [];
  for (let i = 0; i < iterations; i++) {
    let sum = 0;
    for (let j = 0; j < values.length; j++) {
      const randIdx = Math.floor(Math.random() * values.length);
      sum += values[randIdx];
    }
    means.push(sum / values.length);
  }
  means.sort((a, b) => a - b);
  return {
    lower: means[Math.floor(iterations * 0.025)],
    upper: means[Math.ceil(iterations * 0.975) - 1]
  };
}
