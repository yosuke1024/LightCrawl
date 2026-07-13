import { getEncoding } from 'js-tiktoken';

/**
 * Result of a token count estimation.
 */
export interface TokenCountResult {
  count: number;
  tokenizerName: string;
  tokenizerVersion: string;
  estimated: boolean;
}

// We use the o200k_base encoding as equivalent to gpt-4o which is mainstream,
// or we can fallback to cl100k_base. js-tiktoken supports o200k_base or cl100k_base.
// By default, o200k_base is supported in modern js-tiktoken, else cl100k_base.
const encoding = getEncoding('o200k_base');

/**
 * Counts the estimated number of tokens in a given text using a fixed tokenizer.
 * 
 * @param text The text to tokenize.
 * @param includeInfo Whether to return the full TokenCountResult object.
 * @returns The number of tokens, or the full TokenCountResult object if includeInfo is true.
 */
export function countTokens(text: string): number;
export function countTokens(text: string, includeInfo: true): TokenCountResult;
export function countTokens(text: string, includeInfo = false): number | TokenCountResult {
  if (text == null || text === '') {
    return includeInfo 
      ? { count: 0, tokenizerName: 'js-tiktoken', tokenizerVersion: 'o200k_base', estimated: true }
      : 0;
  }
  
  const tokens = encoding.encode(text);
  
  if (includeInfo) {
    return {
      count: tokens.length,
      tokenizerName: 'js-tiktoken',
      tokenizerVersion: 'o200k_base',
      estimated: true
    };
  }
  
  return tokens.length;
}
