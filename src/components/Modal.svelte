<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    onclose,
    children,
    footer
  }: { title: string; onclose: () => void; children: Snippet; footer?: Snippet } = $props();

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onclose();
  }
</script>

<svelte:window {onkeydown} />

<div class="wrap">
  <button class="backdrop" aria-label="Stäng" onclick={onclose}></button>
  <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
    <header>
      <span class="grabber"></span>
      <div class="row-between">
        <h2>{title}</h2>
        <button class="btn btn-quiet" onclick={onclose}>Stäng</button>
      </div>
    </header>
    <div class="body">
      {@render children()}
    </div>
    {#if footer}
      <div class="footer">{@render footer()}</div>
    {/if}
  </div>
</div>

<style>
  .wrap {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    padding: 0;
    background: rgba(35, 41, 30, 0.38);
    backdrop-filter: blur(2px);
  }

  .sheet {
    position: relative;
    width: min(560px, 100%);
    max-height: 92dvh;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    border: 1px solid var(--border);
    border-bottom: 0;
    border-radius: 26px 26px 0 0;
    box-shadow: var(--shadow);
    animation: rise 0.18s ease-out;
  }

  @keyframes rise {
    from {
      transform: translateY(14px);
      opacity: 0.6;
    }
  }

  header {
    padding: 8px 16px 10px;
    border-bottom: 1px solid var(--border);
  }

  .grabber {
    display: block;
    width: 38px;
    height: 4px;
    margin: 4px auto 10px;
    border-radius: 2px;
    background: var(--border);
  }

  h2 {
    font-size: 1.1rem;
  }

  .body {
    padding: 16px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .footer {
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--border);
    background: var(--surface);
  }
</style>
