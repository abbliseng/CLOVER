import { describe, expect, it } from 'vitest';
import { evaluateExpression, evaluateToOre } from '../src/lib/calc';
import { clipboardAmount, formatSignedOre } from '../src/lib/money';

describe('evaluateExpression', () => {
  it('handles the four operators and precedence', () => {
    expect(evaluateExpression('2+3*4')).toBe(14);
    expect(evaluateExpression('120÷4')).toBe(30);
    expect(evaluateExpression('10×2-5')).toBe(15);
    expect(evaluateExpression('(2+3)*4')).toBe(20);
  });

  it('accepts a comma as decimal separator', () => {
    expect(evaluateExpression('12,50+7,50')).toBe(20);
  });

  it('rejects incomplete or unsafe input', () => {
    expect(evaluateExpression('12+')).toBeNull();
    expect(evaluateExpression('alert(1)')).toBeNull();
    expect(evaluateExpression('5/0')).toBeNull();
    expect(evaluateExpression('')).toBeNull();
  });
});

describe('evaluateToOre', () => {
  it('rounds to whole öre', () => {
    expect(evaluateToOre('100÷3')).toBe(3333);
    expect(evaluateToOre('19,999')).toBe(2000);
    expect(evaluateToOre('249,50')).toBe(24950);
  });
});

describe('money formatting', () => {
  it('shows even, plus and minus', () => {
    expect(formatSignedOre(0)).toBe('ca$h money gang sleyy');
    expect(formatSignedOre(12345).startsWith('+')).toBe(true);
    expect(formatSignedOre(-12345).startsWith('-')).toBe(true);
  });

  it('copies a bare number', () => {
    expect(clipboardAmount(123450)).toBe('1234,50');
    expect(clipboardAmount(-20000)).toBe('200');
  });
});
