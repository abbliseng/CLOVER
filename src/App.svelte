<script lang="ts">
  import BottomBar from './components/BottomBar.svelte';
  import ExpenseForm from './components/ExpenseForm.svelte';
  import Expenses from './components/Expenses.svelte';
  import Login from './components/Login.svelte';
  import SettleDialog from './components/SettleDialog.svelte';
  import Settings from './components/Settings.svelte';
  import Setup from './components/Setup.svelte';
  import Standings from './components/Standings.svelte';
  import type { Expense } from './lib/db';
  import { app, initAuth, loadAll } from './lib/state.svelte';
  import { syncConfigured } from './lib/supabase';
  import { onSyncChanged } from './lib/sync.svelte';

  let editing = $state<Expense | null>(null);
  let formOpen = $state(false);
  let settleOpen = $state(false);
  let settingsOpen = $state(false);

  onSyncChanged(loadAll);
  initAuth();
  loadAll();

  function openNew() {
    editing = null;
    formOpen = true;
  }

  function openEdit(expense: Expense) {
    editing = expense;
    formOpen = true;
  }

  function closeForm() {
    formOpen = false;
    editing = null;
  }
</script>

{#if !app.ready || !app.authReady}
  <div class="splash"><span aria-hidden="true">🍀</span></div>
{:else if syncConfigured && !app.user}
  <Login />
{:else if !app.group || !app.meId}
  <Setup />
{:else}
  <header class="topbar">
    <div class="wrap">
      <h1>{app.group.name}</h1>
      <button class="btn btn-quiet" onclick={() => (settingsOpen = true)} aria-label="Inställningar">⚙︎</button>
    </div>
  </header>

  <main>
    {#if app.tab === 'expenses'}
      <Expenses onedit={openEdit} />
    {:else}
      <Standings />
    {/if}
  </main>

  <BottomBar onadd={openNew} onsettle={() => (settleOpen = true)} />

  {#if formOpen}
    <ExpenseForm expense={editing} onclose={closeForm} />
  {/if}
  {#if settleOpen}
    <SettleDialog onclose={() => (settleOpen = false)} />
  {/if}
  {#if settingsOpen}
    <Settings onclose={() => (settingsOpen = false)} />
  {/if}
{/if}

<style>
  .splash {
    display: grid;
    place-items: center;
    min-height: 100dvh;
    font-size: 2.5rem;
  }

  .topbar {
    position: sticky;
    top: 0;
    z-index: 20;
    background: color-mix(in srgb, var(--bg) 85%, transparent);
    backdrop-filter: blur(12px);
    padding-top: env(safe-area-inset-top);
  }

  .wrap,
  main {
    max-width: 640px;
    margin: 0 auto;
  }

  .wrap {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
  }

  h1 {
    font-size: 1.25rem;
  }

  main {
    padding: 0 16px calc(var(--bar-height) + env(safe-area-inset-bottom));
  }
</style>
