<script lang="ts">
  import Modal from './Modal.svelte';
  import {
    addMember,
    app,
    removeQuickTitle,
    renameGroup,
    renameMember,
    setMe,
    signOut
  } from '../lib/state.svelte';
  import { syncConfigured } from '../lib/supabase';
  import { syncNow, syncState } from '../lib/sync.svelte';

  let { onclose }: { onclose: () => void } = $props();

  let groupName = $state(app.group?.name ?? '');
  let newMember = $state('');
  let error = $state('');
  let copied = $state(false);

  const statusText = $derived(
    {
      off: 'av',
      idle: 'senast synkad ' + (syncState.lastSyncedAt ? new Date(syncState.lastSyncedAt).toLocaleTimeString('sv-SE') : '–'),
      syncing: 'synkar…',
      offline: 'offline — ändringar skickas när du är uppkopplad igen',
      error: 'fel: ' + syncState.message
    }[syncState.status]
  );

  async function saveGroupName() {
    const name = groupName.trim();
    if (name && name !== app.group?.name) await renameGroup(name);
  }

  async function addPerson() {
    const name = newMember.trim();
    if (!name) return;
    if (app.members.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      error = `${name} finns redan i gruppen.`;
      return;
    }
    await addMember(name);
    newMember = '';
    error = '';
  }

  async function copyInvite() {
    if (!app.group) return;
    try {
      await navigator.clipboard.writeText(app.group.id);
      copied = true;
      setTimeout(() => (copied = false), 1600);
    } catch {
      error = 'Kunde inte kopiera koden.';
    }
  }
</script>

<Modal title="Inställningar" {onclose}>
  <div class="stack">
    <div class="field">
      <span class="label">Gruppnamn</span>
      <input bind:value={groupName} onblur={saveGroupName} autocomplete="off" />
    </div>

    <div class="field">
      <span class="label">Du är</span>
      <div class="chips">
        {#each app.members as m (m.id)}
          <button class="chip" class:selected={app.meId === m.id} onclick={() => setMe(m.id)}>{m.name}</button>
        {/each}
      </div>
    </div>

    <div class="field">
      <span class="label">Personer</span>
      <ul class="list">
        {#each app.members as m (m.id)}
          <li>
            <input
              value={m.name}
              onblur={(e) => renameMember(m.id, e.currentTarget.value.trim() || m.name)}
              aria-label={`Namn på ${m.name}`}
            />
          </li>
        {/each}
      </ul>
      <div class="person">
        <input bind:value={newMember} placeholder="Lägg till en person" autocomplete="off" />
        <button class="btn btn-outline" onclick={addPerson}>Lägg till</button>
      </div>
      {#if error}<p class="error">{error}</p>{/if}
    </div>

    <div class="field">
      <span class="label">Snabbtitlar</span>
      <div class="chips">
        {#each app.quickTitles as q (q.id)}
          <span class="chip removable">
            {q.text}
            <button onclick={() => removeQuickTitle(q.id)} aria-label={`Ta bort ${q.text}`}>✕</button>
          </span>
        {/each}
      </div>
      <p class="muted small">Nya snabbtitlar lägger du till i utgiftsformuläret.</p>
    </div>

    {#if syncConfigured}
      <div class="field">
        <span class="label">Bjud in en telefon</span>
        <p class="muted small">Den andra personen väljer ”Gå med i grupp” och klistrar in koden.</p>
        <code class="code">{app.group?.id}</code>
        <div class="person">
          <button class="btn btn-outline" onclick={copyInvite}>{copied ? 'Kopierat' : 'Kopiera kod'}</button>
        </div>
      </div>

      <div class="field">
        <span class="label">Konto</span>
        <p class="muted small">{app.user?.email} · synk: {statusText}</p>
        <div class="person">
          <button class="btn btn-outline" onclick={syncNow}>Synka nu</button>
          <button class="btn btn-quiet" onclick={signOut}>Logga ut</button>
        </div>
      </div>
    {:else}
      <p class="muted small">Synk är inte konfigurerad — all data ligger bara på den här telefonen.</p>
    {/if}
  </div>
</Modal>

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .person {
    display: flex;
    gap: 8px;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
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

  .chip.removable button {
    border: 0;
    background: none;
    color: var(--muted);
    padding: 0 2px;
  }

  .small {
    margin: 0;
    font-size: 0.85rem;
  }

  .code {
    display: block;
    padding: 10px 12px;
    border: 1px dashed var(--border);
    border-radius: var(--radius);
    background: var(--surface-2);
    font-size: 0.85rem;
    word-break: break-all;
  }

  .error {
    margin: 0;
    color: var(--danger);
    font-size: 0.9rem;
  }
</style>
