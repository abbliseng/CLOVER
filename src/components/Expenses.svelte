<script lang="ts">
  import PeriodFilter from './PeriodFilter.svelte';
  import type { Expense } from '../lib/db';
  import { splitOre } from '../lib/balances';
  import { formatOre } from '../lib/money';
  import { withinPeriod } from '../lib/period';
  import { app, memberName } from '../lib/state.svelte';

  let { onedit }: { onedit: (expense: Expense) => void } = $props();

  interface MonthGroup {
    key: string;
    label: string;
    items: Expense[];
  }

  function monthLabel(key: string): string {
    const [year, month] = key.split('-').map(Number);
    const name = new Date(year, month - 1, 1)
      .toLocaleDateString('sv-SE', { month: 'short' })
      .replace(/[^\p{L}]/gu, '')
      .toUpperCase();
    return `${name} ${year}`;
  }

  function byMonth(list: Expense[]): MonthGroup[] {
    const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
    const groups: MonthGroup[] = [];
    for (const e of sorted) {
      const key = e.date.slice(0, 7);
      let current = groups.at(-1);
      if (!current || current.key !== key) {
        current = { key, label: monthLabel(key), items: [] };
        groups.push(current);
      }
      current.items.push(e);
    }
    return groups;
  }

  function dayLabel(date: string): string {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
  }

  function myShare(e: Expense): number {
    if (!app.meId) return 0;
    return splitOre(e.amountOre, e.shares).get(app.meId) ?? 0;
  }

  const shown = $derived(app.expenses.filter((e) => withinPeriod(e.date, app.period)));
  const months = $derived(byMonth(shown));
  const totalOre = $derived(shown.filter((e) => !e.isSettlement).reduce((sum, e) => sum + e.amountOre, 0));
</script>

<section>
  <PeriodFilter />

  {#if months.length === 0}
    <div class="empty card">
      <h2>Inga utgifter {app.period.preset === 'all' ? 'än' : 'i perioden'}</h2>
      <p class="muted">
        {app.period.preset === 'all' ? 'Tryck på + för att lägga till den första.' : 'Prova en annan period.'}
      </p>
    </div>
  {:else}
    <p class="summary muted">{shown.length} poster · {formatOre(totalOre)} i utgifter</p>
  {/if}

  {#each months as group (group.key)}
    <h2 class="month">{group.label}</h2>
    <ul class="list card">
      {#each group.items as e (e.id)}
        <li>
          <button class="row" onclick={() => onedit(e)}>
            <span class="icon" class:settlement={e.isSettlement} aria-hidden="true">
              {e.isSettlement ? '↔' : e.title.trim().charAt(0).toUpperCase()}
            </span>
            <span class="text">
              <span class="title">{e.title}</span>
              <span class="sub muted">
                {dayLabel(e.date)} · {app.meId === e.paidBy ? 'Du' : memberName(e.paidBy)} betalade
              </span>
            </span>
            <span class="amounts">
              <span class="amount">{formatOre(e.amountOre)}</span>
              {#if !e.isSettlement && app.meId}
                <span class="sub muted">din del {formatOre(myShare(e))}</span>
              {/if}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/each}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .month {
    margin: 18px 4px 6px;
    font-size: 0.78rem;
    letter-spacing: 0.12em;
    color: var(--muted);
  }

  .summary {
    margin: 12px 4px 0;
    font-size: 0.85rem;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  .list li + li {
    border-top: 1px solid var(--border);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 14px;
    background: none;
    border: 0;
    text-align: left;
  }

  .row:active {
    background: var(--matcha-50);
  }

  .icon {
    flex: none;
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: var(--matcha-100);
    color: var(--matcha-700);
    font-weight: 700;
  }

  .icon.settlement {
    background: var(--surface-2);
    color: var(--muted);
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .title {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .amounts {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    flex: none;
  }

  .amount {
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }

  .sub {
    font-size: 0.8rem;
  }

  .empty {
    margin-top: 24px;
    padding: 28px 20px;
    text-align: center;
  }

  .empty p {
    margin: 6px 0 0;
  }
</style>
