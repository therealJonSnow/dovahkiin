<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import { tick } from 'svelte';
  import { useApp } from '../lib/app.svelte';
  import { t } from '../i18n';
  import LiveNodeDetail from './LiveNodeDetail.svelte';

  const app = useApp();
  let dialog = $state<HTMLDialogElement>();
  let scroller = $state<HTMLDivElement>();

  // Phones and tablets only: on wide screens the details live in the sidebar.
  const node = $derived(app.selectedId && !app.wide ? app.byId.get(app.selectedId) : undefined);
  const branch = $derived(node ? app.branchById.get(node.branch)! : undefined);

  $effect(() => {
    if (!dialog) return;
    if (node && !dialog.open) dialog.showModal();
    else if (!node && dialog.open) dialog.close();
  });

  // New node in the same open drawer: back to the top.
  $effect(() => {
    void node?.id;
    tick().then(() => scroller?.scrollTo({ top: 0 }));
  });

  function onclose() {
    // Resizing to desktop hands the open skill over to the sidebar instead of closing it.
    if (app.wide) return;
    app.select(null);
    const el = app.returnFocus;
    app.returnFocus = null;
    if (el?.isConnected) el.focus();
  }

  function onclick(e: MouseEvent) {
    if (e.target === dialog) dialog?.close();
  }
</script>

<dialog bind:this={dialog} class="drawer" aria-labelledby="drawer-title" {onclose} {onclick}>
  {#if node && branch}
    <div class="sheet" style="--c: {branch.color}">
      <div class="bar">
        <span class="handle" aria-hidden="true"></span>
        <a class="btn btn-sm btn-ghost" href="/skills/{node.id}">
          {t('detail.fullPage')}
          <ExternalLink size={14} aria-hidden="true" />
        </a>
        <button type="button" class="icon-btn" onclick={() => dialog?.close()} aria-label={t('detail.close')}>
          <X size={22} aria-hidden="true" />
        </button>
      </div>
      <div class="scroll" bind:this={scroller}>
        <LiveNodeDetail {node} headingId="drawer-title" />
      </div>
    </div>
  {/if}
</dialog>

<style>
  .drawer {
    position: fixed;
    inset: 0 0 0 auto;
    margin: 0;
    width: min(30rem, 100vw);
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
  .drawer[open] {
    animation: slide-in 0.25s ease-out;
  }
  .drawer::backdrop {
    background: rgb(2 4 10 / 0.45);
  }
  .sheet {
    display: flex;
    flex-direction: column;
    height: 100%;
    border-top: 3px solid var(--c);
  }
  .bar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.25rem;
    padding: 0.4rem 0.5rem 0;
  }
  .handle {
    display: none;
  }
  .scroll {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.25rem 1.5rem 2rem;
  }
  @keyframes slide-in {
    from {
      transform: translateX(2rem);
      opacity: 0;
    }
  }
  @keyframes slide-up {
    from {
      transform: translateY(3rem);
      opacity: 0;
    }
  }

  /* Bottom sheet on phones and tablets */
  @media (max-width: 1023px) {
    .drawer {
      inset: auto 0 0 0;
      width: 100vw;
      height: auto;
      max-height: 88dvh;
      border-left: 0;
      border-radius: 1rem 1rem 0 0;
    }
    .drawer[open] {
      animation-name: slide-up;
    }
    .sheet {
      max-height: 88dvh;
      border-radius: 1rem 1rem 0 0;
    }
    .bar {
      position: relative;
    }
    .handle {
      display: block;
      position: absolute;
      left: 50%;
      top: 0.5rem;
      width: 2.5rem;
      height: 4px;
      margin-left: -1.25rem;
      border-radius: 4px;
      background: var(--rule);
    }
    .scroll {
      padding: 0.25rem var(--gutter) calc(1.5rem + env(safe-area-inset-bottom));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .drawer[open] {
      animation: fade 0.2s ease-out;
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
    }
  }
</style>
