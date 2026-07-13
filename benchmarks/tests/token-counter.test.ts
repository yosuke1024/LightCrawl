import { describe, it, expect } from 'vitest';
import { countTokens } from '../src/token-counter';

describe('token-counter', () => {
  it('should be deterministic', () => {
    const text = 'This is a test sentence for tokenization.';
    const count1 = countTokens(text);
    const count2 = countTokens(text);
    expect(count1).toBe(count2);
    expect(count1).toBeGreaterThan(0);
  });

  it('should safely process empty strings', () => {
    expect(countTokens('')).toBe(0);
  });

  it('should return 0 for undefined or null (if coerced to string or handled)', () => {
    expect(countTokens(undefined as any)).toBe(0);
    expect(countTokens(null as any)).toBe(0);
  });

  it('should use o200k_base or equivalent and return tokenizer info', () => {
    const { count, tokenizerName, estimated } = countTokens('Hello world', true) as any;
    expect(tokenizerName).toBe('js-tiktoken');
    expect(estimated).toBe(true);
    expect(typeof count).toBe('number');
  });
});
