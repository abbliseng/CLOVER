<script lang="ts">
  import Modal from './Modal.svelte';
  import { evaluateToOre } from '../lib/calc';
  import { evenShares, sharesAddUp, percentTotal } from '../lib/balances';
  import { formatOre } from '../lib/money';
  import type { Expense, Share } from '../lib/db';
  import { newId, nowIso, todayIso } from '../lib/id';
  import { normalizeTagIcon, TAG_ICONS, type TagIcon } from '../lib/tags';
  import { addQuickTitle, addTag as createTag, app, deleteExpense, saveExpense } from '../lib/state.svelte';

  let { expense = null, onclose }: { expense?: Expense | null; onclose: () => void } = $props();

  const memberIds = app.members.map((m) => m.id);

  function initialAmount(): string {
    if (!expense) return '';
    const ore = expense.amountOre;
    return ore % 100 === 0 ? String(ore / 100) : (ore / 100).toFixed(2).replace('.', ',');
  }

  function initialPercents(): Record<string, number> {
    const result: Record<string, number> = {};
    const source = expense ? expense.shares : evenShares(memberIds);
    for (const s of source) result[s.memberId] = s.percent;
    return result;
  }

  function initialValues() {
    return {
      amount: initialAmount(),
      title: expense?.title ?? '',
      tagId: expense?.tagId ?? null,
      date: expense?.date ?? todayIso(),
      included: expense ? expense.shares.map((s) => s.memberId) : [...memberIds],
      percents: initialPercents(),
      paidBy: expense?.paidBy ?? app.meId ?? memberIds[0]
    };
  }

  // Snapshot taken once: the form is remounted whenever it is opened.
  const initial = initialValues();

  let amountText = $state(initial.amount);
  let title = $state(initial.title);
  let selectedTagId = $state<string | null>(initial.tagId);
  let date = $state(initial.date);
  let included = $state<string[]>(initial.included);
  let percents = $state<Record<string, number>>(initial.percents);
  let paidBy = $state(initial.paidBy);
  let newTitleText = $state('');
  let addingTitle = $state(false);
  let newTagText = $state('');
  let newTagIcon = $state<TagIcon>('fa-tag');
  let manualTagIcon = $state('');
  let showManualIcon = $state(false);
  let addingTag = $state(false);
  let error = $state('');

  const amountOre = $derived(evaluateToOre(amountText));
  const previewTagIcon = $derived(normalizeTagIcon(manualTagIcon));
  const shares = $derived<Share[]>(included.map((id) => ({ memberId: id, percent: percents[id] ?? 0 })));
  const total = $derived(percentTotal(shares));
  const canSave = $derived(
    amountOre !== null && amountOre > 0 && title.trim() !== '' && included.length > 0 && sharesAddUp(shares)
  );

  function spread(ids: string[]) {
    percents = {};
    for (const s of evenShares(ids)) percents[s.memberId] = s.percent;
  }

  function toggle(id: string) {
    included = included.includes(id) ? included.filter((x) => x !== id) : [...memberIds].filter((x) => included.includes(x) || x === id);
    spread(included);
  }

  function setPercent(id: string, raw: string) {
    const value = Number(raw.replace(',', '.'));
    percents[id] = Number.isFinite(value) ? value : 0;
  }

  function shownPercent(id: string): number {
    return Math.round((percents[id] ?? 0) * 100) / 100;
  }

  function key(char: string) {
    if (char === 'C') {
      amountText = '';
      return;
    }
    if (char === '<') {
      amountText = amountText.slice(0, -1);
      return;
    }
    if (char === '=') {
      const ore = evaluateToOre(amountText);
      if (ore === null) {
        error = 'Uträkningen är inte klar.';
        return;
      }
      error = '';
      amountText = ore % 100 === 0 ? String(ore / 100) : (ore / 100).toFixed(2).replace('.', ',');
      return;
    }
    amountText += char;
  }

  async function addTitleOption() {
    const text = newTitleText.trim();
    if (!text) return;
    const added = await addQuickTitle(text);
    if (!added) {
      error = `"${text}" finns redan som snabbtitel.`;
      return;
    }
    title = text;
    newTitleText = '';
    addingTitle = false;
    error = '';
  }

  async function addTagOption() {
    const icon = showManualIcon ? normalizeTagIcon(manualTagIcon) : newTagIcon;
    if (!icon) {
      error = 'Skriv ett ikonnamn, till exempel fa-burger.';
      return;
    }
    const id = await createTag(newTagText, icon);
    if (!id) return;
    selectedTagId = id;
    newTagText = '';
    manualTagIcon = '';
    showManualIcon = false;
    addingTag = false;
    error = '';
  }

  function advanceOnEnter(event: KeyboardEvent) {
    if (event.key !== 'Enter' || event.defaultPrevented) return;
    if (!(event.target instanceof HTMLInputElement) || event.target.type === 'checkbox') return;
    event.preventDefault();

    const container = event.currentTarget;
    if (!(container instanceof HTMLElement)) return;
    const inputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('input:not([type="checkbox"]):not([type="hidden"]), select, textarea')
    ).filter((input) => !input.disabled);
    const next = inputs[inputs.indexOf(event.target) + 1];
    if (!next) return;
    next.focus();
    if (next instanceof HTMLInputElement && ['text', 'search', 'tel', 'url', 'password', 'email'].includes(next.type)) {
      next.select();
    }
  }

  function keyboardNavigation(node: HTMLFormElement) {
    node.addEventListener('keydown', advanceOnEnter);
    return { destroy: () => node.removeEventListener('keydown', advanceOnEnter) };
  }

  async function save() {
    if (amountOre === null || amountOre <= 0) {
      error = 'Ange en kostnad större än noll.';
      return;
    }
    if (!title.trim()) {
      error = 'Ange en titel.';
      return;
    }
    if (!sharesAddUp(shares)) {
      error = `Procenten blir ${total.toFixed(2).replace(/[.,]00$/, '')} %, inte 100 %.`;
      return;
    }
    await saveExpense({
      id: expense?.id ?? newId(),
      groupId: app.group!.id,
      title: title.trim(),
      tagId: selectedTagId,
      amountOre,
      date,
      paidBy,
      shares,
      isSettlement: expense?.isSettlement ?? false,
      updatedAt: nowIso(),
      deleted: false
    });
    onclose();
  }

  async function remove() {
    if (!expense) return;
    await deleteExpense(expense.id);
    onclose();
  }
</script>

<Modal title={expense ? 'Redigera utgift' : 'Ny utgift'} {onclose}>
  <form class="form" use:keyboardNavigation onsubmit={(event) => event.preventDefault()}>
    <div class="field">
      <span class="label">Titel</span>
      <input bind:value={title} placeholder="Vad gällde det?" autocomplete="off" />
      <div class="chips">
        {#each app.quickTitles as q (q.id)}
          <button
            type="button"
            class="chip"
            class:selected={title.trim().toLowerCase() === q.text.toLowerCase()}
            onclick={() => (title = q.text)}>{q.text}</button
          >
        {/each}
        {#if addingTitle}
          <span class="chip-input">
            <input
              bind:value={newTitleText}
              placeholder="Ny titel"
              autocomplete="off"
              onkeydown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void addTitleOption();
                }
              }}
            />
            <button type="button" class="chip add" onclick={addTitleOption}>Lägg till</button>
          </span>
        {:else}
          <button type="button" class="chip add" onclick={() => (addingTitle = true)}>+</button>
        {/if}
      </div>
    </div>

    <div class="field">
      <span class="label">Tagg</span>
      <div class="chips">
        <button type="button" class="chip" class:selected={selectedTagId === null} onclick={() => (selectedTagId = null)}>
          Ingen
        </button>
        {#each app.tags as tag (tag.id)}
          <button
            type="button"
            class="chip tag-chip"
            class:selected={selectedTagId === tag.id}
            onclick={() => (selectedTagId = tag.id)}
          >
            <i class="fa-solid {tag.icon}" aria-hidden="true"></i>
            {tag.text}
          </button>
        {/each}
        <button type="button" class="chip add" onclick={() => (addingTag = !addingTag)} aria-label="Lägg till tagg">+</button>
      </div>
      {#if addingTag}
        <div class="tag-editor">
          <input bind:value={newTagText} placeholder="Namn" autocomplete="off" />
          <div class="icon-picker" aria-label="Välj ikon">
            {#each TAG_ICONS as item (item.icon)}
              <button
                type="button"
                class="icon-choice"
                class:selected={newTagIcon === item.icon}
                aria-label={`Ikon: ${item.label}`}
                title={item.label}
                onclick={() => (newTagIcon = item.icon)}
              ><i class="fa-solid {item.icon}" aria-hidden="true"></i></button>
            {/each}
          </div>
          <button
            type="button"
            class="manual-icon-toggle"
            aria-expanded={showManualIcon}
            onclick={() => (showManualIcon = !showManualIcon)}
          >{showManualIcon ? 'Ångra' : 'Skriv eget ikonnamn'}</button>
          {#if showManualIcon}
            <label class="manual-icon-field">
              <div class="manual-icon-input">
                <input bind:value={manualTagIcon} placeholder="fa-blah fa-bluh" autocomplete="off" />
                <span class="icon-preview" aria-label="Ikonförhandsvisning">
                  {#if previewTagIcon}<i class="fa-solid {previewTagIcon}" aria-hidden="true"></i>{:else}<i class="fa-solid fa-tag" aria-hidden="true"></i>{/if}
                </span>
              </div>
            </label>
          {/if}
          <button
            type="button"
            class="btn btn-primary"
            disabled={!newTagText.trim()}
            onclick={addTagOption}
          >Lägg till tagg</button>
        </div>
      {/if}
    </div>

    <div class="field">
      <span class="label">Datum</span>
      <input type="date" bind:value={date} />
    </div>

    <div class="field">
      <span class="label">Kostnad (SEK)</span>
      <input
        class="amount"
        inputmode="decimal"
        placeholder="0"
        autocomplete="off"
        bind:value={amountText}
        aria-label="Kostnad i kronor"
      />
      <div class="keypad">
        {#each ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', ',', '0', '<', '+'] as k (k)}
          <button type="button" class="key" class:op={'÷×-+'.includes(k)} onclick={() => key(k)}>
            {k === '<' ? '⌫' : k}
          </button>
        {/each}
        <button type="button" class="key wide" onclick={() => key('C')}>C</button>
        <button type="button" class="key equals" onclick={() => key('=')}>=</button>
      </div>
      <p class="hint">
        {#if amountOre !== null}
          = {formatOre(amountOre)}
        {:else}
          Skriv ett belopp eller en uträkning, t.ex. 120+65÷2.
        {/if}
      </p>
    </div>

    <div class="field">
      <div class="row-between">
        <span class="label">Personer som delar</span>
        <button type="button" class="btn btn-quiet small" onclick={() => spread(included)}>Dela lika</button>
      </div>
      <ul class="people">
        {#each app.members as m (m.id)}
          {@const on = included.includes(m.id)}
          <li class:on>
            <label>
              <input type="checkbox" checked={on} onchange={() => toggle(m.id)} />
              <span>{m.name}</span>
            </label>
            {#if on}
              <span class="pct">
                <input
                  type="number"
                  inputmode="decimal"
                  step="0.01"
                  min="0"
                  max="100"
                  value={shownPercent(m.id)}
                  oninput={(e) => setPercent(m.id, e.currentTarget.value)}
                  aria-label={`Procent för ${m.name}`}
                />
                <span class="sign">%</span>
              </span>
            {/if}
          </li>
        {/each}
      </ul>
      <p class="hint" class:bad={!sharesAddUp(shares)}>
        Totalt {total.toFixed(2).replace(/[.,]00$/, '')} % {sharesAddUp(shares) ? '' : '— måste bli 100 %'}
      </p>
    </div>

    <div class="field">
      <span class="label">Vem betalade</span>
      <div class="chips">
        {#each app.members as m (m.id)}
          <button type="button" class="chip" class:selected={paidBy === m.id} onclick={() => (paidBy = m.id)}>
            {m.name}{app.meId === m.id ? ' (du)' : ''}
          </button>
        {/each}
      </div>
    </div>

    {#if error}
      <p class="error">{error}</p>
    {/if}
  </form>

  {#snippet footer()}
    <div class="actions">
      {#if expense}
        <button type="button" class="btn btn-danger" onclick={remove}>Ta bort</button>
      {/if}
      <button type="button" class="btn btn-primary grow" disabled={!canSave} onclick={save}>
        {expense ? 'Spara ändringar' : 'Lägg till utgift'}
      </button>
    </div>
  {/snippet}
</Modal>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .amount {
    font-size: 1.6rem;
    font-weight: 650;
    text-align: right;
    letter-spacing: -0.01em;
  }

  .keypad {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 7px;
  }

  .key {
    min-height: 48px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    font-size: 1.05rem;
    font-weight: 600;
  }

  .key:active {
    background: var(--matcha-100);
  }

  .key.op {
    background: var(--surface-2);
    color: var(--matcha-600);
  }

  .key.wide {
    grid-column: span 3;
  }

  .key.equals {
    background: var(--matcha-500);
    border-color: var(--matcha-500);
    color: #fff;
  }

  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--muted);
  }

  .hint.bad {
    color: var(--danger);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .chip {
    min-height: 38px;
    padding: 7px 14px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
    font-size: 0.92rem;
    font-weight: 550;
  }

  .chip.selected {
    background: var(--matcha-500);
    border-color: var(--matcha-500);
    color: #fff;
  }

  .chip.add {
    color: var(--matcha-600);
    border-style: dashed;
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }

  .tag-editor {
    display: flex;
    flex-direction: column;
    gap: 9px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .icon-picker {
    display: grid;
    grid-template-columns: repeat(7, minmax(36px, 1fr));
    gap: 6px;
  }

  .icon-choice {
    display: grid;
    place-items: center;
    min-height: 38px;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--surface-2);
    color: var(--muted);
  }

  .icon-choice.selected {
    color: var(--matcha-700);
    border-color: var(--matcha-500);
    background: var(--matcha-100);
  }

  .manual-icon-toggle {
    align-self: flex-start;
    padding: 2px 0;
    border: 0;
    background: transparent;
    color: var(--matcha-700);
    font: inherit;
    font-size: 0.88rem;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .manual-icon-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-size: 0.82rem;
  }

  .manual-icon-input {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .icon-preview {
    display: grid;
    place-items: center;
    flex: none;
    width: 44px;
    height: 44px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--matcha-50);
    color: var(--matcha-700);
    font-size: 1.15rem;
  }

  .chip-input {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }

  .chip-input input {
    min-height: 38px;
    border-radius: 999px;
    width: 9rem;
    padding: 6px 14px;
  }

  .people {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--surface);
  }

  .people li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
  }

  .people li:last-child {
    border-bottom: 0;
  }

  .people li.on {
    background: var(--matcha-50);
  }

  .people label {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-height: 36px;
  }

  .people input[type='checkbox'] {
    width: 22px;
    height: 22px;
    min-height: 22px;
    accent-color: var(--matcha-500);
    appearance: auto;
    flex: none;
  }

  .pct {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .pct input {
    width: 5.2rem;
    text-align: right;
    min-height: 38px;
    padding: 6px 8px;
  }

  .sign {
    color: var(--muted);
  }

  .small {
    min-height: 32px;
    padding: 4px 8px;
    font-size: 0.85rem;
  }

  .error {
    margin: 0;
    color: var(--danger);
    font-size: 0.9rem;
  }

  .actions {
    display: flex;
    gap: 10px;
  }

  .grow {
    flex: 1;
  }

  .btn-primary:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
</style>
