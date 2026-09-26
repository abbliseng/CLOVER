<script lang="ts">
  import { app, createGroup, joinGroup, previewGroup, setMe, type GroupPreview } from '../lib/state.svelte';
  import { syncConfigured } from '../lib/supabase';

  let choice = $state<'create' | 'join'>('create');
  let groupName = $state('Vår grupp');
  let names = $state<string[]>(['', '']);
  let meIndex = $state(0);
  let error = $state('');

  let inviteCode = $state('');
  let preview = $state<GroupPreview | null>(null);
  let busy = $state(false);

  const filled = $derived(names.map((n) => n.trim()).filter(Boolean));

  function addRow() {
    names = [...names, ''];
  }

  function removeRow(i: number) {
    names = names.filter((_, index) => index !== i);
    if (meIndex >= names.length) meIndex = 0;
  }

  async function start() {
    const cleaned = names.map((n) => n.trim()).filter(Boolean);
    if (!groupName.trim()) {
      error = 'Ge gruppen ett namn.';
      return;
    }
    if (cleaned.length < 2) {
      error = 'Lägg till minst två personer.';
      return;
    }
    if (new Set(cleaned.map((n) => n.toLowerCase())).size !== cleaned.length) {
      error = 'Två personer har samma namn.';
      return;
    }
    const meName = names[meIndex]?.trim();
    await createGroup(groupName.trim(), cleaned, Math.max(0, cleaned.indexOf(meName ?? cleaned[0])));
  }

  async function lookUp() {
    busy = true;
    error = '';
    preview = await previewGroup(inviteCode);
    busy = false;
    if (!preview) error = 'Hittade ingen grupp med den koden.';
  }

  async function claim(memberId: string) {
    busy = true;
    const failure = await joinGroup(inviteCode, memberId);
    busy = false;
    if (failure) error = failure;
  }
</script>

<main>
  <div class="hero">
    <span class="logo" aria-hidden="true">🍀</span>
    <h1>Clover</h1>
  </div>

  {#if !app.group}
    {#if syncConfigured}
      <div class="tabs">
        <button class:active={choice === 'create'} onclick={() => (choice = 'create')}>Skapa grupp</button>
        <button class:active={choice === 'join'} onclick={() => (choice = 'join')}>Gå med i grupp</button>
      </div>
    {/if}

    {#if choice === 'create' || !syncConfigured}
      <div class="card panel">
        <div class="field">
          <span class="label">Gruppnamn</span>
          <input bind:value={groupName} autocomplete="off" />
        </div>

        <div class="field">
          <span class="label">Personer</span>
          {#each names as _name, i (i)}
            <div class="person">
              <input bind:value={names[i]} placeholder={`Person ${i + 1}`} autocomplete="off" />
              {#if names.length > 2}
                <button class="btn btn-quiet" onclick={() => removeRow(i)} aria-label="Ta bort person">✕</button>
              {/if}
            </div>
          {/each}
          <button class="btn btn-outline" onclick={addRow}>Lägg till person</button>
        </div>

        {#if filled.length > 0}
          <div class="field">
            <span class="label">Vem är du?</span>
            <div class="chips">
              {#each names as n, i (i)}
                {#if n.trim()}
                  <button class="chip" class:selected={meIndex === i} onclick={() => (meIndex = i)}>{n.trim()}</button>
                {/if}
              {/each}
            </div>
          </div>
        {/if}

        {#if error}<p class="error">{error}</p>{/if}
        <button class="btn btn-primary" onclick={start}>Skapa grupp</button>
      </div>
    {:else}
      <div class="card panel">
        <div class="field">
          <span class="label">Inbjudningskod</span>
          <p class="muted small">Koden finns under Inställningar på telefonen som skapade gruppen.</p>
          <input bind:value={inviteCode} placeholder="t.ex. 0b4f…" autocomplete="off" spellcheck="false" />
        </div>
        <button class="btn btn-outline" onclick={lookUp} disabled={busy}>Hämta grupp</button>

        {#if preview}
          <div class="field">
            <span class="label">{preview.groupName} — vem är du?</span>
            <div class="chips">
              {#each preview.members as m (m.id)}
                <button class="chip" disabled={m.claimed || busy} onclick={() => claim(m.id)}>
                  {m.name}{m.claimed ? ' (upptagen)' : ''}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        {#if error}<p class="error">{error}</p>{/if}
      </div>
    {/if}
  {:else}
    <div class="card panel">
      <div class="field">
        <span class="label">Vem är du?</span>
        <p class="muted small">Den här telefonen visar saldot för personen du väljer.</p>
        <div class="chips">
          {#each app.members as m (m.id)}
            <button class="chip" onclick={() => setMe(m.id)}>{m.name}</button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</main>

<style>
  main {
    max-width: 560px;
    margin: 0 auto;
    padding: 40px 16px calc(24px + env(safe-area-inset-bottom));
  }

  .hero {
    text-align: center;
    margin-bottom: 26px;
  }

  .logo {
    font-size: 2.6rem;
  }

  h1 {
    font-size: 2rem;
    margin-top: 6px;
  }

  .tabs {
    display: flex;
    gap: 4px;
    padding: 4px;
    margin-bottom: 14px;
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
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 20px;
  }

  .person {
    display: flex;
    gap: 8px;
    align-items: center;
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
    font-weight: 550;
  }

  .chip.selected {
    background: var(--matcha-500);
    border-color: var(--matcha-500);
    color: #fff;
  }

  .chip:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .small {
    margin: 0;
    font-size: 0.85rem;
  }

  .error {
    margin: 0;
    color: var(--danger);
  }
</style>
