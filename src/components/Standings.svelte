<script lang="ts">
  import { computeBalances, simplifyDebts } from '../lib/balances';
  import { formatOre, formatSignedOre } from '../lib/money';
  import { app, memberName } from '../lib/state.svelte';

  const balances = $derived(computeBalances(app.members.map((m) => m.id), app.expenses));
  const rows = $derived(
    app.members
      .map((m) => ({ id: m.id, name: m.name, ore: balances.get(m.id) ?? 0 }))
      .sort((a, b) => b.ore - a.ore || a.name.localeCompare(b.name, 'sv'))
  );
  const widest = $derived(Math.max(1, ...rows.map((r) => Math.abs(r.ore))));
  const transfers = $derived(simplifyDebts(balances));
</script>

<section>
  <h2 class="month">SALDON</h2>
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
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
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
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .name {
    font-weight: 600;
  }

  .value {
    font-weight: 650;
    font-variant-numeric: tabular-nums;
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

  .bar.neg {
    background: color-mix(in srgb, var(--danger) 70%, var(--surface-2));
  }

  .settled {
    text-align: center;
  }
</style>
