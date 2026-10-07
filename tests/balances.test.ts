import { describe, expect, it } from 'vitest';
import { computeBalances, evenShares, simplifyDebts, splitOre } from '../src/lib/balances';
import type { Expense } from '../src/lib/db';

function expense(partial: Partial<Expense> & Pick<Expense, 'amountOre' | 'paidBy' | 'shares'>): Expense {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    groupId: 'g',
    title: partial.title ?? 'Test',
    tagId: partial.tagId ?? null,
    date: partial.date ?? '2026-09-01',
    isSettlement: partial.isSettlement ?? false,
    updatedAt: '2026-09-01T00:00:00.000Z',
    deleted: partial.deleted ?? false,
    ...partial
  } as Expense;
}

describe('splitOre', () => {
  it('splits evenly without losing öre', () => {
    const parts = splitOre(10000, evenShares(['a', 'b', 'c']));
    expect([...parts.values()].reduce((a, b) => a + b, 0)).toBe(10000);
    expect([...parts.values()].sort()).toEqual([3333, 3333, 3334]);
  });

  it('hands leftover öre to the largest remainder', () => {
    const parts = splitOre(1001, [
      { memberId: 'a', percent: 50 },
      { memberId: 'b', percent: 50 }
    ]);
    expect(parts.get('a')! + parts.get('b')!).toBe(1001);
    expect(Math.abs(parts.get('a')! - parts.get('b')!)).toBe(1);
  });

  it('respects uneven percentages', () => {
    const parts = splitOre(10000, [
      { memberId: 'a', percent: 70 },
      { memberId: 'b', percent: 30 }
    ]);
    expect(parts.get('a')).toBe(7000);
    expect(parts.get('b')).toBe(3000);
  });
});

describe('evenShares', () => {
  it('always adds up to 100 percent', () => {
    for (const n of [1, 2, 3, 6, 7, 11]) {
      const ids = Array.from({ length: n }, (_, i) => `m${i}`);
      const total = evenShares(ids).reduce((sum, s) => sum + s.percent, 0);
      expect(Math.round(total * 100) / 100).toBe(100);
    }
  });
});

describe('computeBalances', () => {
  const ids = ['a', 'b', 'c'];

  it('gives the payer credit and everyone their share', () => {
    const balances = computeBalances(
      ids,
      [expense({ amountOre: 30000, paidBy: 'a', shares: evenShares(ids) })]
    );
    expect(balances.get('a')).toBe(20000);
    expect(balances.get('b')).toBe(-10000);
    expect(balances.get('c')).toBe(-10000);
  });

  it('always sums to zero', () => {
    const balances = computeBalances(ids, [
      expense({ amountOre: 12345, paidBy: 'a', shares: evenShares(ids) }),
      expense({ amountOre: 777, paidBy: 'b', shares: evenShares(['b', 'c']) }),
      expense({ amountOre: 5000, paidBy: 'c', shares: [{ memberId: 'a', percent: 100 }] })
    ]);
    expect([...balances.values()].reduce((x, y) => x + y, 0)).toBe(0);
  });

  it('ignores deleted expenses', () => {
    const balances = computeBalances(ids, [
      expense({ amountOre: 30000, paidBy: 'a', shares: evenShares(ids), deleted: true })
    ]);
    expect(balances.get('a')).toBe(0);
  });

  it('brings both sides towards zero when a settlement is recorded', () => {
    const expenses = [
      expense({ amountOre: 20000, paidBy: 'a', shares: evenShares(['a', 'b']) }),
      expense({ amountOre: 10000, paidBy: 'b', shares: [{ memberId: 'a', percent: 100 }], isSettlement: true })
    ];
    const balances = computeBalances(['a', 'b'], expenses);
    expect(balances.get('a')).toBe(0);
    expect(balances.get('b')).toBe(0);
  });
});

describe('simplifyDebts', () => {
  it('pairs the largest debtor with the largest creditor', () => {
    const transfers = simplifyDebts(new Map([['a', 10000], ['b', -6000], ['c', -4000]]));
    expect(transfers).toEqual([
      { from: 'b', to: 'a', amountOre: 6000 },
      { from: 'c', to: 'a', amountOre: 4000 }
    ]);
  });

  it('splits a debt over two creditors when needed', () => {
    const transfers = simplifyDebts(new Map([['a', -10000], ['b', 5000], ['c', 5000]]));
    expect(transfers).toHaveLength(2);
    expect(transfers.every((t) => t.from === 'a')).toBe(true);
    expect(transfers.reduce((sum, t) => sum + t.amountOre, 0)).toBe(10000);
  });

  it('returns nothing when everyone is even', () => {
    expect(simplifyDebts(new Map([['a', 0], ['b', 0]]))).toEqual([]);
  });
});
