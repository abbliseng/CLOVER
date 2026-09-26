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

  function swishFor(to: string, fullOre: number): string | null {
    const phone = app.members.find((m) => m.id === to)?.phone;
    const ore = evaluateToOre(amountFor(to, fullOre));
    if (!phone || ore === null || ore <= 0) return null;
    return swishLink(phone, ore, app.group?.name ?? 'Clover');
  }

  async function copy(to: string, ore: number) {
    const text = clipboardAmount(ore);
    try {
      await navigator.clipboard.writeText(text);
      copied = to;
      setTimeout(() => (copied = null), 1600);
    } catch {
      error = `Kunde inte kopiera. Beloppet är ${text}.`;
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
            <button class="btn btn-outline" onclick={() => copy(t.to, t.amountOre)}>
              {copied === t.to ? 'Kopierat' : 'Kopiera belopp'}
            </button>
            {#if swishFor(t.to, t.amountOre)}
              <a class="btn btn-outline swish" href={swishFor(t.to, t.amountOre)} rel="noopener">Öppna Swish</a>
            {/if}
            <button class="btn btn-primary" onclick={() => markPaid(t.to, t.amountOre)}>Markera som betald</button>
          </div>
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
    color: var(--matcha-700);
    border-color: var(--matcha-300);
  }

  .error {
    color: var(--danger);
    font-size: 0.9rem;
  }
</style>
