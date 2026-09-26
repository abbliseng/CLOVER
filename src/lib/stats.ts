import type { Expense } from './db';
import { splitOre } from './balances';

export interface CategoryStat {
  title: string;
  totalOre: number;
  count: number;
  /** Share of the member this phone belongs to, if known. */
  yoursOre: number;
}

export interface PayerStat {
  memberId: string;
  paidOre: number;
  count: number;
}

export interface Stats {
  totalOre: number;
  count: number;
  months: number;
  perMonthOre: number;
  averageOre: number;
  largest: Expense | null;
  categories: CategoryStat[];
  payers: PayerStat[];
  settlementOre: number;
  settlementCount: number;
  yourShareOre: number;
}

/** Spending figures for a set of expenses; settlements are counted separately, not as spending. */
export function computeStats(expenses: Expense[], memberIds: string[], meId: string | null = null): Stats {
  const spending = expenses.filter((e) => !e.deleted && !e.isSettlement);
  const settlements = expenses.filter((e) => !e.deleted && e.isSettlement);

  const totalOre = spending.reduce((sum, e) => sum + e.amountOre, 0);
  const months = new Set(spending.map((e) => e.date.slice(0, 7))).size || 1;

  const categories = new Map<string, CategoryStat>();
  let yourShareOre = 0;
  for (const e of spending) {
    const key = e.title.trim().toLowerCase() || '—';
    const stat = categories.get(key) ?? { title: e.title.trim() || '—', totalOre: 0, count: 0, yoursOre: 0 };
    stat.totalOre += e.amountOre;
    stat.count += 1;
    if (meId) {
      const share = splitOre(e.amountOre, e.shares).get(meId) ?? 0;
      stat.yoursOre += share;
      yourShareOre += share;
    }
    categories.set(key, stat);
  }

  const payers = memberIds.map((memberId) => ({
    memberId,
    paidOre: spending.filter((e) => e.paidBy === memberId).reduce((sum, e) => sum + e.amountOre, 0),
    count: spending.filter((e) => e.paidBy === memberId).length
  }));

  return {
    totalOre,
    count: spending.length,
    months,
    perMonthOre: Math.round(totalOre / months),
    averageOre: spending.length ? Math.round(totalOre / spending.length) : 0,
    largest: spending.reduce<Expense | null>((best, e) => (!best || e.amountOre > best.amountOre ? e : best), null),
    categories: [...categories.values()].sort((a, b) => b.totalOre - a.totalOre),
    payers: payers.sort((a, b) => b.paidOre - a.paidOre),
    settlementOre: settlements.reduce((sum, e) => sum + e.amountOre, 0),
    settlementCount: settlements.length,
    yourShareOre
  };
}
