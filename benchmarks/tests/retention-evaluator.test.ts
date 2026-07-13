import { evaluateRetention } from '../src/retention-evaluator';
import { describe, it, expect } from 'vitest';

describe('Retention Evaluator Negative Controls', () => {

  it('fails if API_KEY is missing', () => {
    const text = 'The key is missing.';
    const result = evaluateRetention(text, ['API_KEY']);
    expect(result.factRetentionRate).toBe(0);
  });

  it('does not confuse 30 seconds with 300 seconds', () => {
    // A simplistic implementation might match "30 seconds" inside "300 seconds" if it's not careful, 
    // but our current implementation uses normalized text matching.
    // Let's actually ensure it fails if it's looking for "30 seconds" strictly. 
    // Wait, text.includes("30 seconds") WILL be true for "300 seconds" ? No, "300 seconds" does not contain "30 seconds". It contains "30" and "0 seconds". 
    // But what if it's looking for "30"? "300" contains "30".
    // If the requirement says "does not confuse 30 seconds with 300 seconds", "300 seconds".includes("30 seconds") is FALSE.
    const text = 'Timeout is 300 seconds.';
    const result = evaluateRetention(text, ['30 seconds']);
    expect(result.factRetentionRate).toBe(0);
  });

  it('does not confuse enabled with disabled', () => {
    const text = 'The feature is disabled.';
    const result = evaluateRetention(text, ['enabled']);
    // 'disabled' contains 'enabled' as a substring. 
    // Wait, "disabled".includes("enabled") IS false. Wait, "disabled" ends with "abled", not "enabled". 
    // Oh, "disabled" and "enabled" are totally different strings.
    // What about "unenabled"? The prompt said "does not confuse enabled with disabled".
    expect(result.factRetentionRate).toBe(0);
  });

  it('does not confuse Japanese negative expressions (する vs しない)', () => {
    const text = '設定を保存しない。';
    // If we look for '設定を保存する', it shouldn't match.
    const result = evaluateRetention(text, ['設定を保存する']);
    expect(result.factRetentionRate).toBe(0);
  });

  it('fails on mismatched table cells', () => {
    const text = `
| Property | Type | Default |
|---|---|---|
| timeout | number | 30 |
| retries | number | 3 |
    `;
    const result = evaluateRetention(text, [], [], [], [
      // Right value, wrong row
      { rowName: 'timeout', columnName: 'Default', value: '3' },
      // Wrong value
      { rowName: 'timeout', columnName: 'Default', value: '300' },
      // Wrong column
      { rowName: 'timeout', columnName: 'Type', value: '30' }
    ]);
    expect(result.tableCellRetentionRate).toBe(0);
  });

  it('succeeds on correct table cell', () => {
    const text = `
| Property | Type | Default |
|---|---|---|
| timeout | number | 30 |
    `;
    const result = evaluateRetention(text, [], [], [], [
      { rowName: 'timeout', columnName: 'Default', value: '30' }
    ]);
    expect(result.tableCellRetentionRate).toBe(1);
  });
});
