<script lang="ts">
  import Modal from './Modal.svelte';
  import { normalizeTagIcon } from '../lib/tags';
  import {
    addMember,
    app,
    removeQuickTitle,
    renameGroup,
    renameMember,
    removeTag,
    setMe,
    setPhone,
    signOut,
    updateTag
  } from '../lib/state.svelte';
  import { syncConfigured } from '../lib/supabase';
  import { syncNow, syncState } from '../lib/sync.svelte';

  let { onclose }: { onclose: () => void } = $props();

  let groupName = $state(app.group?.name ?? '');
  let newMember = $state('');
  let error = $state('');
  let copied = $state(false);
  let tagError = $state('');
  let tagEdits = $state(Object.fromEntries(app.tags.map((tag) => [tag.id, { text: tag.text, icon: tag.icon }])));

  const me = $derived(app.members.find((m) => m.id === app.meId) ?? null);

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

  async function saveTag(id: string) {
    const edit = tagEdits[id];
    if (!edit) return;
    const icon = normalizeTagIcon(edit.icon);
    if (!icon) {
      tagError = 'Ange en giltig Font Awesome-klass, till exempel fa-utensils.';
      return;
    }
    tagError = (await updateTag(id, edit.text, icon)) ?? '';
  }

  async function deleteTag(id: string, text: string) {
    const confirmed = window.confirm(`Ta bort taggen "${text}"? Utgifter med taggen blir otaggade.`);
    if (!confirmed) return;
    await removeTag(id);
    tagError = '';
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
    </div>

    <div class="field">
      <span class="label">Taggar</span>
      <ul class="tag-list">
        {#each app.tags as tag (tag.id)}
          {@const edit = tagEdits[tag.id] ?? { text: tag.text, icon: tag.icon }}
          <li class="tag-row">
            <span class="tag-preview"><i class="fa-solid {normalizeTagIcon(edit.icon) ?? 'fa-tag'}" aria-hidden="true"></i></span>
            <div class="tag-fields">
              <input
                value={edit.text}
                oninput={(event) => (tagEdits[tag.id].text = event.currentTarget.value)}
                aria-label={`Taggnamn: ${tag.text}`}
              />
              <input
                value={edit.icon}
                oninput={(event) => (tagEdits[tag.id].icon = event.currentTarget.value)}
                aria-label={`Font Awesome-klass: ${tag.text}`}
                placeholder="fa-tag"
              />
            </div>
            <button class="icon-action save" onclick={() => saveTag(tag.id)} title="Spara tagg" aria-label={`Spara ${tag.text}`}>
              <i class="fa-solid fa-check" aria-hidden="true"></i>
            </button>
            <button class="icon-action delete" onclick={() => deleteTag(tag.id, tag.text)} title="Ta bort tagg" aria-label={`Ta bort ${tag.text}`}>
              <i class="fa-solid fa-trash" aria-hidden="true"></i>
            </button>
          </li>
        {/each}
      </ul>
      {#if tagError}<p class="error">{tagError}</p>{/if}
    </div>

    {#if syncConfigured}
      <div class="field">
        <span class="label">Bjud in</span>
        <code class="code">{app.group?.id}</code>
        <div class="person">
          <button class="btn btn-outline" onclick={copyInvite}>{copied ? 'Kopierat' : 'Kopiera kod'}</button>
        </div>
      </div>

      <div class="field">
        <span class="label">Konto</span>
        <p class="muted small">{app.user?.email} · synk: {statusText}</p>
        <label class="phone">
          <span class="muted small">Ditt telefonnummer</span>
          <input
            type="tel"
            inputmode="tel"
            autocomplete="tel"
            placeholder="07…"
            value={me?.phone ?? ''}
            onblur={(e) => me && setPhone(me.id, e.currentTarget.value)}
          />
        </label>
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

  .tag-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tag-row {
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr) 38px 38px;
    align-items: center;
    gap: 7px;
  }

  .tag-preview,
  .icon-action {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface-2);
    color: var(--matcha-700);
  }

  .tag-fields {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(84px, 0.9fr);
    gap: 6px;
    min-width: 0;
  }

  .tag-fields input {
    min-width: 0;
    padding: 8px;
    min-height: 40px;
  }

  .icon-action {
    padding: 0;
  }

  .icon-action.delete {
    color: var(--danger);
  }

  .person {
    display: flex;
    gap: 8px;
  }

  .phone {
    display: flex;
    flex-direction: column;
    gap: 5px;
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
