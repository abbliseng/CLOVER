<script lang="ts">
  import PeriodFilter from './PeriodFilter.svelte';
  import { computeBalances, simplifyDebts } from '../lib/balances';
  import { formatOre, formatSignedOre } from '../lib/money';
  import { withinPeriod } from '../lib/period';
  import { computeStats } from '../lib/stats';
  import { app, memberName } from '../lib/state.svelte';

  const memberIds = $derived(app.members.map((m) => m.id));
  const shown = $derived(app.expenses.filter((e) => withinPeriod(e.date, app.period)));
  const filtered = $derived(app.period.preset !== 'all');

  const balances = $derived(computeBalances(memberIds, shown));
  const rows = $derived(
    app.members
      .map((m) => ({ id: m.id, name: m.name, ore: balances.get(m.id) ?? 0 }))
      .sort((a, b) => b.ore - a.ore || a.name.localeCompare(b.name, 'sv'))
  );
  const widest = $derived(Math.max(1, ...rows.map((r) => Math.abs(r.ore))));
  const transfers = $derived(simplifyDebts(balances));
  const stats = $derived(computeStats(shown, memberIds, app.meId));

  const share = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
</script>

<section>
  <PeriodFilter />

  <h2 class="month">SALDON{filtered ? ' (VALD PERIOD)' : ''}</h2>
  <ul class="list card">
    {#each rows as r (r.id)}
      <li>
        <div class="row">
          <span class="name">{r.name}{app.meId === r.id ? ' (du)' : ''}</span>
          <span class="value" class:amount-pos={r.ore > 0} class:amount-neg={r.ore < 0}>
            {formatSignedOre(r.ore)}
          </span>
        </div>
        <div class="track" aria-hidden="true">
          <span
            class="bar"
            class:neg={r.ore < 0}
            style:width={`${(Math.abs(r.ore) / widest) * 50}%`}
            style:left={r.ore < 0 ? 'auto' : '50%'}
            style:right={r.ore < 0 ? '50%' : 'auto'}
          ></span>
        </div>
      </li>
    {/each}
  </ul>
  {#if filtered}
    <p class="hint muted">Saldon räknas bara på perioden ovan. Välj Allt för de riktiga skulderna.</p>
  {/if}

  <h2 class="month">FÖRESLAGNA BETALNINGAR</h2>
  <ul class="list card">
    {#if transfers.length === 0}
      <li class="settled muted">Alla är jämna.</li>
    {/if}
    {#each transfers as t (t.from + t.to)}
      <li class="row">
        <span class="name">
          {app.meId === t.from ? 'Du' : memberName(t.from)} → {app.meId === t.to ? 'dig' : memberName(t.to)}
        </span>
        <span class="value">{formatOre(t.amountOre)}</span>
      </li>
    {/each}
  </ul>

  <h2 class="month">ÖVERSIKT</h2>
  <ul class="list card">
    {#if stats.count === 0}
      <li class="settled muted">Inga utgifter i perioden.</li>
    {:else}
      <li class="row"><span class="name">Totalt</span><span class="value">{formatOre(stats.totalOre)}</span></li>
      <li class="row">
        <span class="name">Snitt per månad<span class="sub muted"> · {stats.months} mån</span></span>
        <span class="value">{formatOre(stats.perMonthOre)}</span>
      </li>
      <li class="row">
        <span class="name">Antal utgifter<span class="sub muted"> · snitt {formatOre(stats.averageOre)}</span></span>
        <span class="value">{stats.count}</span>
      </li>
      {#if app.meId}
        <li class="row">
          <span class="name">Din del<span class="sub muted"> · {share(stats.yourShareOre, stats.totalOre)} %</span></span>
          <span class="value">{formatOre(stats.yourShareOre)}</span>
        </li>
      {/if}
      {#if stats.largest}
        <li class="row">
          <span class="name">Största utgiften<span class="sub muted"> · {stats.largest.title}</span></span>
          <span class="value">{formatOre(stats.largest.amountOre)}</span>
        </li>
      {/if}
      {#if stats.settlementCount > 0}
        <li class="row">
          <span class="name">Uppgörelser<span class="sub muted"> · {stats.settlementCount} st</span></span>
          <span class="value">{formatOre(stats.settlementOre)}</span>
        </li>
      {/if}
    {/if}
  </ul>

  {#if stats.categories.length > 0}
    <h2 class="month">PER KATEGORI</h2>
    <ul class="list card">
      {#each stats.categories as c (c.title)}
        <li>
          <div class="row">
            <span class="name">{c.title}<span class="sub muted"> · {c.count} st</span></span>
            <span class="value">{formatOre(c.totalOre)}</span>
          </div>
          <div class="track" aria-hidden="true">
            <span class="bar left" style:width={`${share(c.totalOre, stats.totalOre)}%`}></span>
          </div>
          <p class="sub muted">
            {share(c.totalOre, stats.totalOre)} % av utgifterna · {formatOre(Math.round(c.totalOre / stats.months))}/mån
          </p>
        </li>
      {/each}
    </ul>
  {/if}

  {#if stats.count > 0}
    <h2 class="month">VEM LÄGGER UT</h2>
    <ul class="list card">
      {#each stats.payers as p (p.memberId)}
        <li>
          <div class="row">
            <span class="name">{memberName(p.memberId)}<span class="sub muted"> · {p.count} st</span></span>
            <span class="value">{formatOre(p.paidOre)}</span>
          </div>
          <div class="track" aria-hidden="true">
            <span class="bar left" style:width={`${share(p.paidOre, stats.totalOre)}%`}></span>
          </div>
          <p class="sub muted">{share(p.paidOre, stats.totalOre)} % av allt som lagts ut</p>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    padding-bottom: 8px;
  }

  .month {
    margin: 18px 4px 6px;
    font-size: 0.78rem;
    letter-spacing: 0.12em;
    color: var(--muted);
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  .list > li {
    padding: 12px 14px;
  }

  .list > li + li {
    border-top: 1px solid var(--border);
  }

  .row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  .name {
    font-weight: 600;
  }

  .value {
    font-weight: 650;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .sub {
    font-weight: 500;
    font-size: 0.82rem;
    padding-left: 4px;
  }

  p.sub {
    margin: 6px 0 0;
    padding-left: 0;
  }

  .track {
    position: relative;
    height: 6px;
    margin-top: 8px;
    border-radius: 3px;
    background: var(--surface-2);
  }

  .bar {
    position: absolute;
    top: 0;
    height: 100%;
    border-radius: 3px;
    background: var(--matcha-400);
  }

  .bar.left {
    left: 0;
  }

  .bar.neg {
    background: color-mix(in srgb, var(--danger) 70%, var(--surface-2));
  }

  .settled {
    text-align: center;
  }

  .hint {
    margin: 8px 4px 0;
    font-size: 0.82rem;
  }
</style>
