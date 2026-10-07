import { describe, expect, it } from 'vitest';
import { computeStats } from '../src/lib/stats';
import { rangeOf, withinPeriod, type Period } from '../src/lib/period';
import { evenShares } from '../src/lib/balances';
import type { Expense, Tag } from '../src/lib/db';

function expense(
  date: string,
  amountOre: number,
  title: string,
  paidBy: string,
  isSettlement = false,
  tagId = title === 'Hyra' ? 'rent-tag' : 'food-tag'
): Expense {
  return {
    id: `${date}-${title}-${amountOre}`,
    groupId: 'g',
    title,
    tagId: isSettlement ? null : tagId,
    amountOre,
    date,
    paidBy,
    shares: evenShares(['a', 'b']),
    isSettlement,
    updatedAt: `${date}T00:00:00.000Z`,
    deleted: false
  };
}

const expenses = [
  expense('2026-08-03', 20000, 'Mat', 'a'),
  expense('2026-08-20', 10000, 'Mat', 'b'),
  expense('2026-09-01', 60000, 'Hyra', 'a'),
  expense('2026-09-10', 5000, 'Mat', 'a'),
  expense('2026-09-12', 7000, 'Betalning till b', 'a', true)
];

const tags: Tag[] = [
  { id: 'food-tag', groupId: 'g', text: 'Mat', icon: 'fa-utensils', expandTitles: false, updatedAt: '2026-09-01T00:00:00.000Z', deleted: false },
  { id: 'rent-tag', groupId: 'g', text: 'Boende', icon: 'fa-house', expandTitles: true, updatedAt: '2026-09-01T00:00:00.000Z', deleted: false },
  { id: 'home-tag', groupId: 'g', text: 'Hem', icon: 'fa-house', expandTitles: true, updatedAt: '2026-09-01T00:00:00.000Z', deleted: false }
];

describe('computeStats', () => {
  const stats = computeStats(expenses, ['a', 'b'], tags, 'a');

  it('leaves settlements out of the spending total', () => {
    expect(stats.totalOre).toBe(95000);
    expect(stats.count).toBe(4);
    expect(stats.settlementOre).toBe(7000);
    expect(stats.settlementCount).toBe(1);
  });

  it('averages over the months that have expenses', () => {
    expect(stats.months).toBe(2);
    expect(stats.perMonthOre).toBe(47500);
    expect(stats.averageOre).toBe(23750);
  });

  it('groups statistics by tag ID and displays the tag text, largest first', () => {
    expect(stats.categories.map((c) => [c.tagId, c.title, c.totalOre, c.count])).toEqual([
      ['rent-tag', 'Boende', 60000, 1],
      ['food-tag', 'Mat', 35000, 3]
    ]);
  });

  it('aggregates title statistics within a tag, independent of the tag label', () => {
    const homeExpenses = [
      expense('2026-08-01', 80000, 'Rent', 'a', false, 'home-tag'),
      expense('2026-09-01', 20000, 'Rent', 'b', false, 'home-tag'),
      expense('2026-09-10', 12000, 'Furniture', 'a', false, 'home-tag')
    ];
    const homeStats = computeStats(homeExpenses, ['a', 'b'], tags, 'a');
    const home = homeStats.categories[0];

    expect(home.tagId).toBe('home-tag');
    expect(home.title).toBe('Hem');
    expect(home.titles).toEqual([
      { title: 'Rent', totalOre: 100000, count: 2, yoursOre: 50000 },
      { title: 'Furniture', totalOre: 12000, count: 1, yoursOre: 6000 }
    ]);
  });

  it('ranks who paid the most', () => {
    expect(stats.payers).toEqual([
      { memberId: 'a', paidOre: 85000, count: 3 },
      { memberId: 'b', paidOre: 10000, count: 1 }
    ]);
  });

  it('sums your own share', () => {
    expect(stats.yourShareOre).toBe(47500);
  });
});

describe('period', () => {
  const today = new Date(2026, 8, 26); // September 2026

  it('covers the current month', () => {
    expect(rangeOf({ preset: 'month', from: '', to: '' }, today)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30'
    });
  });

  it('covers three months back', () => {
    expect(rangeOf({ preset: 'quarter', from: '', to: '' }, today)).toEqual({
      from: '2026-07-01',
      to: '2026-09-30'
    });
  });

  it('keeps a custom range open-ended when a field is empty', () => {
    const period: Period = { preset: 'custom', from: '2026-08-10', to: '' };
    expect(withinPeriod('2026-08-03', period, today)).toBe(false);
    expect(withinPeriod('2026-12-24', period, today)).toBe(true);
  });

  it('lets everything through by default', () => {
    expect(withinPeriod('2001-01-01', { preset: 'all', from: '', to: '' }, today)).toBe(true);
  });
});
