<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import Download from '@lucide/svelte/icons/download';
  import Upload from '@lucide/svelte/icons/upload';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import { useApp } from '../lib/app.svelte';
  import { daysBetween, parseISODate } from '../lib/age';
  import type { ThemePref } from '../lib/storage';
  import { t } from '../i18n';

  const app = useApp();
  let dialog = $state<HTMLDialogElement>();
  let name = $state('');
  let dob = $state('');
  let due = $state('');
  let message = $state('');
  let error = $state('');
  let confirmReset = $state(false);
  let fileInput = $state<HTMLInputElement>();

  $effect(() => {
    if (!dialog) return;
    if (app.settingsOpen && !dialog.open) {
      name = app.saved.baby?.name ?? '';
      dob = app.saved.baby?.dob ?? '';
      due = app.saved.baby?.dueDate ?? '';
      message = '';
      error = '';
      confirmReset = false;
      dialog.showModal();
    } else if (!app.settingsOpen && dialog.open) dialog.close();
  });

  const theme = $derived(app.saved.prefs.theme ?? 'system');
  const themes: ThemePref[] = ['system', 'dark', 'light'];

  function saveBaby(e: SubmitEvent) {
    e.preventDefault();
    const d = parseISODate(dob);
    const now = parseISODate(app.today)!;
    if (!d) return void (error = t('onboarding.errorDob'));
    if (daysBetween(d, now) < 0) return void (error = t('onboarding.errorFuture'));
    if (due) {
      const dd = parseISODate(due);
      const diff = dd ? daysBetween(d, dd) : NaN;
      if (!dd || diff < -42 || diff > 140) return void (error = t('onboarding.errorDue'));
    }
    error = '';
    app.updateBaby({ dob, ...(due ? { dueDate: due } : {}), ...(name.trim() ? { name: name.trim() } : {}) });
    message = '✓';
  }

  function exportFile() {
    const blob = new Blob([app.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skill-tree-progress-${app.today}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      app.importJSON(await file.text());
      message = t('settings.importDone');
      error = '';
      name = app.saved.baby?.name ?? '';
      dob = app.saved.baby?.dob ?? '';
      due = app.saved.baby?.dueDate ?? '';
    } catch (err) {
      error = (err as Error).message;
    } finally {
      if (fileInput) fileInput.value = '';
    }
  }

  function doReset() {
    app.reset();
    app.settingsOpen = false;
  }
</script>

<dialog bind:this={dialog} class="settings panel" aria-labelledby="settings-title" onclose={() => (app.settingsOpen = false)}>
  <div class="top">
    <h2 id="settings-title">{t('settings.title')}</h2>
    <button type="button" class="icon-btn" aria-label={t('detail.close')} onclick={() => (app.settingsOpen = false)}>
      <X size={22} aria-hidden="true" />
    </button>
  </div>
  <hr class="sk-rule" />

  {#if !app.storageOk}
    <p class="warn" role="status">{t('settings.noStorage')}</p>
  {/if}

  {#if app.saved.baby}
    <form class="group" onsubmit={saveBaby} novalidate>
      <h3>{t('settings.baby')}</h3>
      <label for="st-name">{t('onboarding.name')}</label>
      <input id="st-name" type="text" bind:value={name} maxlength="40" autocomplete="off" />
      <div class="row">
        <div>
          <label for="st-dob">{t('onboarding.dob')}</label>
          <input id="st-dob" type="date" bind:value={dob} max={app.today} />
        </div>
        <div>
          <label for="st-due">{t('onboarding.due')}</label>
          <input id="st-due" type="date" bind:value={due} />
        </div>
      </div>
      <button type="submit" class="btn btn-sm">{t('settings.save')}</button>
    </form>
  {/if}

  <fieldset class="group">
    <legend><h3>{t('settings.theme')}</h3></legend>
    <div class="themes">
      {#each themes as th (th)}
        <label class="radio">
          <input type="radio" name="theme" value={th} checked={theme === th} onchange={() => app.setTheme(th)} />
          <span>{t(`settings.theme.${th}`)}</span>
        </label>
      {/each}
    </div>
  </fieldset>

  <div class="group">
    <h3>{t('settings.data')}</h3>
    <div class="data-actions">
      <button type="button" class="btn btn-sm" onclick={exportFile}><Download size={16} aria-hidden="true" /> {t('settings.export')}</button>
      <button type="button" class="btn btn-sm" onclick={() => fileInput?.click()}><Upload size={16} aria-hidden="true" /> {t('settings.import')}</button>
      <input bind:this={fileInput} type="file" accept="application/json,.json" class="sr-only" tabindex="-1" aria-hidden="true" onchange={importFile} />
    </div>
    <p class="hint">{t('onboarding.privacy')}</p>
    {#if confirmReset}
      <div class="confirm" role="alert">
        <p>{t('settings.resetConfirm')}</p>
        <div class="data-actions">
          <button type="button" class="btn btn-sm danger" onclick={doReset}>{t('settings.resetYes')}</button>
          <button type="button" class="btn btn-sm btn-ghost" onclick={() => (confirmReset = false)}>{t('prompt.cancel')}</button>
        </div>
      </div>
    {:else}
      <button type="button" class="btn btn-sm danger" onclick={() => (confirmReset = true)}><RotateCcw size={16} aria-hidden="true" /> {t('settings.reset')}</button>
    {/if}
  </div>

  <p class="status" role="status" aria-live="polite">
    {#if error}<span class="error">{error}</span>{:else}{message}{/if}
  </p>
</dialog>

<style>
  .settings {
    width: min(30rem, calc(100vw - 2 * var(--gutter)));
    max-height: calc(100dvh - 2rem);
    overflow-y: auto;
    padding: 1rem 1.5rem 1.25rem;
    color: var(--ink);
    background: var(--panel-solid);
    box-shadow: var(--shadow-lg);
  }
  .settings::backdrop {
    background: rgb(2 4 10 / 0.55);
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h2 {
    font-size: 1.8rem;
  }
  .sk-rule {
    margin: 0.5rem 0 1rem;
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0 0 1.25rem;
    padding: 0;
    border: 0;
  }
  legend {
    padding: 0;
    margin-bottom: 0.5rem;
  }
  h3 {
    font-size: 1.05rem;
    letter-spacing: 0.12em;
    color: var(--ink-3);
  }
  label {
    font-weight: 600;
    font-size: 0.92rem;
  }
  .row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: 0.75rem;
  }
  .row label {
    display: block;
    margin-bottom: 0.3rem;
  }
  .group > .btn {
    align-self: flex-start;
  }
  .themes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .radio {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 40px;
    padding: 0 0.85rem;
    border: 1px solid var(--panel-border);
    border-radius: 999px;
    font-weight: 500;
    cursor: pointer;
  }
  .radio:has(input:checked) {
    border-color: var(--gold-2);
    background: color-mix(in oklab, var(--gold) 14%, transparent);
  }
  .radio input {
    accent-color: var(--gold-2);
  }
  .data-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .hint {
    font-size: 0.85rem;
    color: var(--ink-3);
    margin: 0;
  }
  .danger {
    color: var(--danger);
    border-color: color-mix(in oklab, var(--danger) 50%, transparent);
    align-self: flex-start;
  }
  .confirm p {
    color: var(--ink-2);
  }
  .warn {
    padding: 0.5rem 0.75rem;
    border-left: 2px solid var(--danger);
  }
  .status {
    min-height: 1.4em;
    margin: 0;
    color: var(--ink-2);
  }
  .error {
    color: var(--danger);
  }
</style>
