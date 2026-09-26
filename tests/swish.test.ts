import { describe, expect, it } from 'vitest';
import { swishLink, swishMessage, swishNumber } from '../src/lib/swish';

describe('swishNumber', () => {
  it('keeps digits only', () => {
    expect(swishNumber('070-123 45 67')).toBe('0701234567');
  });

  it('turns a country code into a leading zero', () => {
    expect(swishNumber('+46 70 123 45 67')).toBe('0701234567');
  });
});

describe('swishMessage', () => {
  it('drops characters Swish does not accept', () => {
    expect(swishMessage('Mat & dryck #3 @hemma')).toBe('Mat dryck 3 hemma');
  });

  it('never exceeds 50 characters', () => {
    expect(swishMessage('a'.repeat(80))).toHaveLength(50);
  });
});

describe('swishLink', () => {
  it('builds a link with number, amount and message', () => {
    const url = new URL(swishLink('070-123 45 67', 42728, 'Vår grupp')!);
    expect(url.origin + url.pathname).toBe('https://app.swish.nu/1/p/');
    expect(url.searchParams.get('sw')).toBe('0701234567');
    expect(url.searchParams.get('amt')).toBe('427.28');
    expect(url.searchParams.get('cur')).toBe('SEK');
    expect(url.searchParams.get('msg')).toBe('Vår grupp');
  });

  it('refuses a number that is too short', () => {
    expect(swishLink('12', 1000, 'Test')).toBeNull();
  });
});
