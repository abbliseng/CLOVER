import { describe, expect, it } from 'vitest';
import { iconForTag, normalizeTagIcon, tagIdFor } from '../src/lib/tags';

describe('tag IDs', () => {
  it('are stable across devices and case-insensitive within a group', () => {
    expect(tagIdFor('group-a', 'Mat')).toBe(tagIdFor('group-a', ' mat '));
    expect(tagIdFor('group-a', 'Mat')).not.toBe(tagIdFor('group-b', 'Mat'));
  });
});

describe('default tag icon selection', () => {
  it('recognizes common categories and safely falls back to a tag icon', () => {
    expect(iconForTag('Mat')).toBe('fa-utensils');
    expect(iconForTag('Hyra')).toBe('fa-house');
    expect(iconForTag('El')).toBe('fa-bolt');
    expect(iconForTag('Something new')).toBe('fa-tag');
  });
});

describe('manual Font Awesome icon names', () => {
  it('accepts a bare name or class string and stores one normalized token', () => {
    expect(normalizeTagIcon('burger')).toBe('fa-burger');
    expect(normalizeTagIcon('fa-burger')).toBe('fa-burger');
    expect(normalizeTagIcon('fa-solid fa-burger')).toBe('fa-burger');
  });

  it('rejects malformed class names', () => {
    expect(normalizeTagIcon('')).toBeNull();
    expect(normalizeTagIcon('fa-burger; color:red')).toBeNull();
  });
});
