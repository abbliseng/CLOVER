<script lang="ts">
  import { app, signOut, updatePassword } from '../lib/state.svelte';

  let password = $state('');
  let repeat = $state('');
  let busy = $state(false);
  let message = $state('');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (password.length < 6) {
      message = 'Lösenordet måste vara minst 6 tecken.';
      return;
    }
    if (password !== repeat) {
      message = 'Lösenorden är inte lika.';
      return;
    }
    busy = true;
    const error = await updatePassword(password);
    busy = false;
    message = error ?? '';
  }

  async function cancel() {
    app.recovery = false;
    await signOut();
  }
</script>

<main>
  <div class="hero">
    <span class="logo" aria-hidden="true">🍀</span>
    <h1>Nytt lösenord</h1>
    <p class="muted">{app.user?.email ?? 'Välj ett nytt lösenord.'}</p>
  </div>

  <form class="card panel" onsubmit={submit}>
    <div class="field">
      <span class="label">Nytt lösenord</span>
      <input type="password" bind:value={password} autocomplete="new-password" />
    </div>
    <div class="field">
      <span class="label">Upprepa lösenordet</span>
      <input type="password" bind:value={repeat} autocomplete="new-password" />
    </div>

    {#if message}<p class="message">{message}</p>{/if}

    <button type="submit" class="btn btn-primary" disabled={busy}>Spara lösenord</button>
    <button type="button" class="btn btn-quiet" onclick={cancel}>Avbryt</button>
  </form>
</main>

<style>
  main {
    max-width: 460px;
    margin: 0 auto;
    padding: 48px 16px calc(24px + env(safe-area-inset-bottom));
  }

  .hero {
    text-align: center;
    margin-bottom: 26px;
  }

  .logo {
    font-size: 2.6rem;
  }

  h1 {
    font-size: 1.8rem;
    margin-top: 6px;
  }

  .hero p {
    margin: 4px 0 0;
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
  }

  .message {
    margin: 0;
    font-size: 0.9rem;
    color: var(--danger);
  }
</style>
