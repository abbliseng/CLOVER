<script lang="ts">
  import { sendPasswordReset, signIn, signUp } from '../lib/state.svelte';

  let email = $state('');
  let password = $state('');
  let mode = $state<'in' | 'up'>('in');
  let busy = $state(false);
  let message = $state('');

  const swedish: Record<string, string> = {
    'Invalid login credentials': 'Fel e-post eller lösenord.',
    'User already registered': 'Det finns redan ett konto med den e-posten.',
    'Email not confirmed': 'Bekräfta e-postadressen först — kolla inkorgen.'
  };

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!email.trim() || password.length < 6) {
      message = 'Fyll i e-post och ett lösenord på minst 6 tecken.';
      return;
    }
    busy = true;
    message = '';
    const error = mode === 'in' ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    busy = false;
    if (error) {
      message = swedish[error] ?? error;
    } else if (mode === 'up') {
      message = 'Konto skapat. Bekräfta e-postadressen om du får ett mejl, logga sedan in.';
      mode = 'in';
    }
  }

  async function forgot() {
    if (!email.trim()) {
      message = 'Fyll i din e-post först.';
      return;
    }
    busy = true;
    const error = await sendPasswordReset(email.trim());
    busy = false;
    message = error ?? 'Ett återställningsmejl är på väg. Öppna länken på den här enheten.';
  }
</script>

<main>
  <div class="hero">
    <span class="logo" aria-hidden="true">🍀</span>
    <h1>Clover</h1>
  </div>

  <form class="card panel" onsubmit={submit}>
    <div class="field">
      <span class="label">E-post</span>
      <input type="email" bind:value={email} autocomplete="email" inputmode="email" />
    </div>
    <div class="field">
      <span class="label">Lösenord</span>
      <input
        type="password"
        bind:value={password}
        autocomplete={mode === 'in' ? 'current-password' : 'new-password'}
      />
    </div>

    {#if message}<p class="message">{message}</p>{/if}

    <button type="submit" class="btn btn-primary" disabled={busy}>
      {mode === 'in' ? 'Logga in' : 'Skapa konto'}
    </button>
    <button type="button" class="btn btn-quiet" onclick={() => (mode = mode === 'in' ? 'up' : 'in')}>
      {mode === 'in' ? 'Har du inget konto? Skapa ett' : 'Har du redan ett konto? Logga in'}
    </button>
    {#if mode === 'in'}
      <button type="button" class="btn btn-quiet" onclick={forgot} disabled={busy}>Glömt lösenordet?</button>
    {/if}
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
    font-size: 2rem;
    margin-top: 6px;
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
