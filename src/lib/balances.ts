import type { Expense, Share } from './db';

export interface Transfer {
  from: string;
  to: string;
  amountOre: number;
}

/**
 * Splits an amount over shares. Each share is rounded down to whole öre and the
 * leftover öre are handed out one at a time, largest remainder first, so the
 * parts always add up to the exact amount.
 */
export function splitOre(amountOre: number, shares: Share[]): Map<string, number> {
  const parts = new Map<string, number>();
  if (shares.length === 0) return parts;

  const exact = shares.map((s) => (amountOre * s.percent) / 100);
  const floored = exact.map((v) => Math.floor(v));
  let leftover = amountOre - floored.reduce((a, b) => a + b, 0);

  const order = shares
    .map((_, i) => i)
    .sort((a, b) => exact[b] - floored[b] - (exact[a] - floored[a]) || exact[b] - exact[a] || a - b);

  for (let k = 0; leftover > 0 && order.length > 0; k++, leftover--) {
    floored[order[k % order.length]] += 1;
  }

  shares.forEach((s, i) => parts.set(s.memberId, (parts.get(s.memberId) ?? 0) + floored[i]));
  return parts;
}

/** balance = what the member paid minus their share of everything. Sums to zero over the group. */
export function computeBalances(memberIds: string[], expenses: Expense[]): Map<string, number> {
  const balances = new Map<string, number>(memberIds.map((id) => [id, 0]));
  for (const e of expenses) {
    if (e.deleted) continue;
    balances.set(e.paidBy, (balances.get(e.paidBy) ?? 0) + e.amountOre);
    for (const [id, ore] of splitOre(e.amountOre, e.shares)) {
      balances.set(id, (balances.get(id) ?? 0) - ore);
    }
  }
  return balances;
}

/** Fewest possible payments: repeatedly pair the largest debtor with the largest creditor. */
export function simplifyDebts(balances: Map<string, number>): Transfer[] {
  const debtors = [...balances]
    .filter(([, ore]) => ore < 0)
    .map(([id, ore]) => ({ id, ore: -ore }))
    .sort((a, b) => b.ore - a.ore || a.id.localeCompare(b.id));
  const creditors = [...balances]
    .filter(([, ore]) => ore > 0)
    .map(([id, ore]) => ({ id, ore }))
    .sort((a, b) => b.ore - a.ore || a.id.localeCompare(b.id));

  const transfers: Transfer[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].ore, creditors[c].ore);
    if (amount > 0) transfers.push({ from: debtors[d].id, to: creditors[c].id, amountOre: amount });
    debtors[d].ore -= amount;
    creditors[c].ore -= amount;
    if (debtors[d].ore === 0) d++;
    if (creditors[c].ore === 0) c++;
  }
  return transfers;
}

/** Even split kept at full precision, so the öre split stays exact for any number of people. */
export function evenShares(memberIds: string[]): Share[] {
  const n = memberIds.length;
  if (n === 0) return [];
  return memberIds.map((memberId) => ({ memberId, percent: 100 / n }));
}

export function percentTotal(shares: Share[]): number {
  return shares.reduce((sum, s) => sum + (Number.isFinite(s.percent) ? s.percent : 0), 0);
}

export function sharesAddUp(shares: Share[]): boolean {
  return Math.abs(percentTotal(shares) - 100) < 0.005;
}
