import type { Expense, Tag } from './db';
import { splitOre } from './balances';

export interface CategoryStat {
  tagId: string | null;
  title: string;
  icon: string;
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
export function computeStats(
  expenses: Expense[],
  memberIds: string[],
  tags: Tag[],
  meId: string | null = null
): Stats {
  const spending = expenses.filter((e) => !e.deleted && !e.isSettlement);
  const settlements = expenses.filter((e) => !e.deleted && e.isSettlement);

  const totalOre = spending.reduce((sum, e) => sum + e.amountOre, 0);
  const months = new Set(spending.map((e) => e.date.slice(0, 7))).size || 1;

  const categories = new Map<string, CategoryStat>();
  const tagsById = new Map(tags.map((tag) => [tag.id, tag]));
  let yourShareOre = 0;
  for (const e of spending) {
    const tag = e.tagId ? tagsById.get(e.tagId) : undefined;
    const key = e.tagId ?? 'untagged';
    const stat = categories.get(key) ?? {
      tagId: e.tagId,
      title: tag?.text ?? 'Otaggat',
      icon: tag?.icon ?? 'fa-tag',
      totalOre: 0,
      count: 0,
      yoursOre: 0
    };
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
