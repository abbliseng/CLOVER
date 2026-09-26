<script lang="ts">
  import { computeBalances } from '../lib/balances';
  import { formatSignedOre } from '../lib/money';
  import { app } from '../lib/state.svelte';

  let { onadd, onsettle }: { onadd: () => void; onsettle: () => void } = $props();

  const balances = $derived(computeBalances(app.members.map((m) => m.id), app.expenses));
  const myBalance = $derived(app.meId ? (balances.get(app.meId) ?? 0) : 0);
</script>

<nav class="bar">
  <div class="status">
    <span class="balance" class:amount-pos={myBalance > 0} class:amount-neg={myBalance < 0}>
      {formatSignedOre(myBalance)}
    </span>
    {#if myBalance < 0}
      <button class="btn settle" onclick={onsettle}>Betala</button>
    {/if}
  </div>

  <div class="controls">
    <div class="tabs" role="tablist">
      <button
        role="tab"
        aria-selected={app.tab === 'expenses'}
        class:active={app.tab === 'expenses'}
        onclick={() => (app.tab = 'expenses')}>Utgifter</button
      >
      <button
        role="tab"
        aria-selected={app.tab === 'standings'}
        class:active={app.tab === 'standings'}
        onclick={() => (app.tab = 'standings')}>Statistik</button
      >
    </div>
    <button class="fab" onclick={onadd} aria-label="Lägg till utgift">+</button>
  </div>
</nav>

<style>
  .bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--surface) 88%, transparent);
    backdrop-filter: blur(14px);
    border-top: 1px solid var(--border);
  }

  .status {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
  }

  .balance {
    font-size: 1.15rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .caption {
    font-size: 0.85rem;
    flex: 1;
  }

  .settle {
    align-self: center;
    min-height: 34px;
    padding: 6px 16px;
    background: var(--matcha-500);
    color: #fff;
    border-radius: 999px;
    font-size: 0.9rem;
    box-shadow: 0 2px 8px rgba(94, 127, 62, 0.3);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
  }

  .tabs {
    display: flex;
    flex: 1;
    gap: 4px;
    padding: 4px;
    border-radius: 999px;
    background: var(--surface-2);
  }

  .tabs button {
    flex: 1;
    min-height: 40px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    font-weight: 600;
    color: var(--muted);
  }

  .tabs button.active {
    background: var(--surface);
    color: var(--matcha-700);
    box-shadow: 0 1px 3px rgba(35, 41, 30, 0.12);
  }

  .fab {
    flex: none;
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--matcha-500);
    color: #fff;
    font-size: 1.9rem;
    font-weight: 400;
    line-height: 1;
    box-shadow: 0 4px 14px rgba(94, 127, 62, 0.35);
  }

  .fab:active {
    transform: scale(0.96);
  }
</style>
