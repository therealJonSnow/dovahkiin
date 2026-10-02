<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import { useApp } from '../lib/app.svelte';
  import { t } from '../i18n';
  import UpNext from './UpNext.svelte';

  /** Everything coming up across all families, opened from the HUD. */
  const app = useApp();
  let dialog = $state<HTMLDialogElement>();
  let opener: HTMLElement | null = null;

  $effect(() => {
    if (!dialog) return;
    if (app.upNextOpen && !dialog.open) {
      opener = document.activeElement as HTMLElement | null;
      dialog.showModal();
    } else if (!app.upNextOpen && dialog.open) dialog.close();
  });

  function onclose() {
    const picked = !!app.selectedId;
    app.upNextOpen = false;
    // Picking a skill hands focus to its details; otherwise return to the HUD button.
    if (!picked && opener?.isConnected) opener.focus();
    opener = null;
  }

  function onclick(e: MouseEvent) {
    if (e.target === dialog) dialog?.close();
  }
</script>

<dialog bind:this={dialog} class="upnext-dialog" aria-labelledby="upnext-title" {onclose} {onclick}>
  {#if app.upNextOpen}
    <div class="sheet">
      <div class="bar">
        <button type="button" class="icon-btn" onclick={() => dialog?.close()} aria-label={t('detail.close')}>
          <X size={22} aria-hidden="true" />
        </button>
      </div>
      <div class="scroll">
        <UpNext />
      </div>
    </div>
  {/if}
</dialog>

<style>
  .upnext-dialog {
    position: fixed;
    inset: 0 0 0 auto;
    margin: 0;
    width: min(28rem, 100vw);
    max-width: 100vw;
    height: 100dvh;
    max-height: 100dvh;
    padding: 0;
    border: 0;
    border-left: 1px solid var(--panel-border);
    background: var(--panel-solid);
    color: var(--ink);
    box-shadow: var(--shadow-lg);
  }
  .upnext-dialog[open] {
    animation: slide-in 0.25s ease-out;
  }
  .upnext-dialog::backdrop {
    background: rgb(2 4 10 / 0.45);
  }
  .sheet {
    display: flex;
    flex-direction: column;
    height: 100%;
    border-top: 3px solid var(--gold);
  }
  .bar {
    display: flex;
    justify-content: flex-end;
    padding: 0.4rem 0.5rem 0;
  }
  .scroll {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0 1.5rem calc(2rem + env(safe-area-inset-bottom));
  }
  @keyframes slide-in {
    from {
      transform: translateX(2rem);
      opacity: 0;
    }
  }
  @media (max-width: 640px) {
    .scroll {
      padding: 0 var(--gutter) calc(2rem + env(safe-area-inset-bottom));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .upnext-dialog[open] {
      animation: none;
    }
  }
</style>
