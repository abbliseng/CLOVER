<script lang="ts">
  import Modal from './Modal.svelte';
  import { computeBalances, simplifyDebts } from '../lib/balances';
  import { clipboardAmount, formatOre } from '../lib/money';
  import { evaluateToOre } from '../lib/calc';
  import { newId, nowIso, todayIso } from '../lib/id';
  import { swishLink } from '../lib/swish';
  import { app, memberName, saveExpense } from '../lib/state.svelte';

  let { onclose }: { onclose: () => void } = $props();

  const balances = $derived(computeBalances(app.members.map((m) => m.id), app.expenses));
  const myDebts = $derived(simplifyDebts(balances).filter((t) => t.from === app.meId));

  let amounts = $state<Record<string, string>>({});
  let copied = $state<string | null>(null);
  let error = $state('');

  function amountFor(to: string, fullOre: number): string {
    return amounts[to] ?? (fullOre % 100 === 0 ? String(fullOre / 100) : (fullOre / 100).toFixed(2).replace('.', ','));
  }

  function phoneFor(to: string): string | null {
    return app.members.find((m) => m.id === to)?.phone ?? null;
  }

  /** Pre-filled Swish link for whatever amount is in the field right now. */
  function linkFor(to: string, fullOre: number): string | null {
    const phone = phoneFor(to);
    const ore = evaluateToOre(amountFor(to, fullOre));
    if (!phone || ore === null) return null;
    return swishLink(phone, ore, app.group?.name ?? '');
  }

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      copied = key;
      setTimeout(() => (copied = null), 1600);
    } catch {
      error = `Kunde inte kopiera. Värdet är ${text}.`;
    }
  }

  async function markPaid(to: string, fullOre: number) {
    const ore = evaluateToOre(amountFor(to, fullOre));
    if (ore === null || ore <= 0) {
      error = 'Ange ett belopp större än noll.';
      return;
    }
    await saveExpense({
      id: newId(),
      groupId: app.group!.id,
      title: `Betalning till ${memberName(to)}`,
      amountOre: ore,
      date: todayIso(),
      paidBy: app.meId!,
      shares: [{ memberId: to, percent: 100 }],
      isSettlement: true,
      updatedAt: nowIso(),
      deleted: false
    });
    delete amounts[to];
    error = '';
    if (myDebts.length === 0) onclose();
  }
</script>

<Modal title="Betala" {onclose}>
  {#if myDebts.length === 0}
    <p class="muted">Inget att betala</p>
  {:else}
    <ul class="list">
      {#each myDebts as t (t.to)}
        {@const link = linkFor(t.to, t.amountOre)}
        <li>
          <p class="line">Betala <strong>{memberName(t.to)}</strong> <strong>{formatOre(t.amountOre)}</strong></p>
          <div class="controls">
            <label class="partial">
              <span class="label">Belopp</span>
              <input
                inputmode="decimal"
                value={amountFor(t.to, t.amountOre)}
                oninput={(e) => (amounts[t.to] = e.currentTarget.value)}
                aria-label={`Belopp att betala till ${memberName(t.to)}`}
              />
            </label>
            {#if link}
              <a class="btn swish" href={link} rel="noopener">Öppna Swish</a>
            {/if}
            <button class="btn btn-outline" onclick={() => copyText(t.to, clipboardAmount(t.amountOre))}>
              {copied === t.to ? 'Kopierat' : 'Kopiera belopp'}
            </button>
            <button class="btn btn-primary" onclick={() => markPaid(t.to, t.amountOre)}>Markera som betald</button>
          </div>
          {#if !link}
            <p class="muted hint">{memberName(t.to)} har inte sparat något telefonnummer än.</p>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  {#if error}
    <p class="error">{error}</p>
  {/if}
</Modal>

<style>
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .list li {
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
  }

  .line {
    margin: 0 0 10px;
    font-size: 1.05rem;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 8px;
  }

  .partial {
    display: flex;
    flex-direction: column;
    gap: 5px;
    width: 7.5rem;
  }

  .partial input {
    text-align: right;
  }

  .swish {
    text-decoration: none;
    background: var(--matcha-500);
    color: #fff;
  }

  .hint {
    margin: 8px 0 0;
    font-size: 0.85rem;
  }

  .error {
    color: var(--danger);
    font-size: 0.9rem;
  }
</style>
