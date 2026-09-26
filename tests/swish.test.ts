import { describe, expect, it } from 'vitest';
import { swishLink, swishMessage, swishNumber } from '../src/lib/swish';
import { newId, UUID_PATTERN } from '../src/lib/id';

describe('newId', () => {
  it('always produces a UUID, which is what the server column expects', () => {
    for (let i = 0; i < 50; i++) expect(newId()).toMatch(UUID_PATTERN);
  });
});

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
  it('follows the documented link format', () => {
    expect(swishLink('070-123 45 67', 42728, 'Vår grupp')).toBe(
      'https://app.swish.nu/1/p/sw/?sw=0701234567&amt=427.28&msg=V%C3%A5r%20grupp&edit=amt,msg'
    );
  });

  it('leaves out the message when there is none', () => {
    expect(swishLink('0701234567', 10000)).toBe('https://app.swish.nu/1/p/sw/?sw=0701234567&amt=100.00&edit=amt');
  });

  it('refuses a short number or a zero amount', () => {
    expect(swishLink('12', 1000)).toBeNull();
    expect(swishLink('0701234567', 0)).toBeNull();
  });
});
