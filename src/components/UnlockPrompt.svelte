<script lang="ts">
  import { useApp } from '../lib/app.svelte';
  import { t } from '../i18n';

  const app = useApp();
  let dialog = $state<HTMLDialogElement>();
  let resolved = false;

  const pending = $derived(app.pendingUnlock);
  const node = $derived(pending ? app.byId.get(pending.id) : undefined);
  const ancestors = $derived(pending ? pending.ancestors.map((id) => app.byId.get(id)!).filter(Boolean) : []);

  $effect(() => {
    if (!dialog) return;
    if (pending && !dialog.open) {
      resolved = false;
      dialog.showModal();
    } else if (!pending && dialog.open) dialog.close();
  });

  function choose(mode: 'unlock' | 'skip' | null) {
    resolved = true;
    app.resolvePending(mode);
  }

  function onclose() {
    if (!resolved) app.resolvePending(null);
  }
</script>

<dialog bind:this={dialog} class="prompt panel" role="alertdialog" aria-labelledby="prompt-title" aria-describedby="prompt-body" {onclose}>
  {#if node}
    <h2 id="prompt-title">{t('prompt.title')}</h2>
    <p id="prompt-body">{t('prompt.body', { title: node.title })}</p>
    <ul>
      {#each ancestors as a (a.id)}
        <li style="--c: {app.branchById.get(a.branch)?.color}">{a.title}</li>
      {/each}
    </ul>
    <div class="actions">
      <button type="button" class="btn btn-primary" onclick={() => choose('unlock')}>{t('prompt.yes')}</button>
      <button type="button" class="btn" onclick={() => choose('skip')}>
        {ancestors.length > 1 ? t('prompt.skipMany') : t('prompt.skip')}
      </button>
      <button type="button" class="btn btn-ghost" onclick={() => choose(null)}>{t('prompt.cancel')}</button>
    </div>
  {/if}
</dialog>

<style>
  .prompt {
    width: min(28rem, calc(100vw - 2 * var(--gutter)));
    padding: 1.5rem;
    color: var(--ink);
    background: var(--panel-solid);
    box-shadow: var(--shadow-lg);
  }
  .prompt::backdrop {
    background: rgb(2 4 10 / 0.55);
  }
  h2 {
    font-size: 1.6rem;
    margin-bottom: 0.75rem;
  }
  p {
    color: var(--ink-2);
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0 0 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-weight: 600;
  }
  li::before {
    content: '';
    width: 9px;
    height: 9px;
    transform: rotate(45deg);
    background: var(--c);
    box-shadow: 0 0 8px var(--c);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
</style>
