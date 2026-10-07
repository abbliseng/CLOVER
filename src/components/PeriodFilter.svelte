<script lang="ts">
  import type { PeriodPreset } from '../lib/period';
  import { app } from '../lib/state.svelte';

  const presets: { key: PeriodPreset; label: string }[] = [
    { key: 'month', label: 'Denna månad' },
    { key: 'quarter', label: '3 mån' },
    { key: 'year', label: 'I år' },
    { key: 'all', label: 'Allt' },
    { key: 'custom', label: 'Egen' }
  ];
</script>

<div class="filter">
  <div class="chips">
    {#each presets as p (p.key)}
      <button class="chip" class:selected={app.period.preset === p.key} onclick={() => (app.period.preset = p.key)}>
        {p.label}
      </button>
    {/each}
  </div>

  {#if app.period.preset === 'custom'}
    <div class="dates">
      <label>
        <span class="label">Från</span>
        <input type="date" bind:value={app.period.from} />
      </label>
      <label>
        <span class="label">Till</span>
        <input type="date" bind:value={app.period.to} />
      </label>
    </div>
  {/if}
</div>

<style>
  .filter {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 4px;
  }

  .chips {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 2px;
  }

  .chips::-webkit-scrollbar {
    display: none;
  }

  .chip {
    flex: none;
    min-height: 34px;
    padding: 5px 13px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
    font-size: 0.88rem;
    font-weight: 550;
    white-space: nowrap;
  }

  .chip.selected {
    background: var(--matcha-500);
    border-color: var(--matcha-500);
    color: #fff;
  }

  .dates {
    display: flex;
    gap: 8px;
  }

  .dates label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
</style>
