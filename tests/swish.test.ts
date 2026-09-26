import { describe, expect, it } from 'vitest';
import { swishNumber } from '../src/lib/swish';

describe('swishNumber', () => {
  it('keeps digits only', () => {
    expect(swishNumber('070-123 45 67')).toBe('0701234567');
  });

  it('turns a country code into a leading zero', () => {
    expect(swishNumber('+46 70 123 45 67')).toBe('0701234567');
  });
});
