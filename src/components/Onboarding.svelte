<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import { useApp } from '../lib/app.svelte';
  import { daysBetween, getAge, parseISODate, shouldCorrect, todayISO } from '../lib/age';
  import { catchUpCandidates } from '../lib/state';
  import { t } from '../i18n';

  interface Props {
    onfinish: () => void;
  }
  let { onfinish }: Props = $props();

  const app = useApp();
  let dialog = $state<HTMLDialogElement>();
  let step = $state<'details' | 'catchup'>('details');
  let name = $state('');
  let dob = $state('');
  let due = $state('');
  let error = $state('');
  let ticked = $state<Record<string, boolean>>({});

  const today = $derived(app.today || todayISO());
  const age = $derived(parseISODate(dob) ? getAge({ dob, dueDate: due || undefined }, today) : null);
  const corrected = $derived.by(() => {
    const d = parseISODate(dob);
    return d && shouldCorrect(d, parseISODate(due)) && !age?.beyondTree ? Math.round(age!.correctionWeeks) : 0;
  });
  const candidates = $derived(age && age.ageWeeks > 6 ? catchUpCandidates(app.nodes, Math.min(age.ageWeeks, 104)) : []);
  const grouped = $derived(
    app.data.branches
      .map((b) => ({ branch: b, nodes: candidates.filter((n) => n.branch === b.id) }))
      .filter((g) => g.nodes.length),
  );

  $effect(() => {
    if (!dialog) return;
    if (app.onboardingOpen && !dialog.open) {
      step = 'details';
      error = '';
      dialog.showModal();
    } else if (!app.onboardingOpen && dialog.open) dialog.close();
  });

  function validate(): string {
    const d = parseISODate(dob);
    if (!d) return t('onboarding.errorDob');
    const now = parseISODate(today)!;
    if (daysBetween(d, now) < 0) return t('onboarding.errorFuture');
    if (due) {
      const dd = parseISODate(due);
      if (!dd) return t('onboarding.errorDue');
      const diff = daysBetween(d, dd);
      if (diff < -42 || diff > 140) return t('onboarding.errorDue');
    }
    return '';
  }

  function next(e: SubmitEvent) {
    e.preventDefault();
    error = validate();
    if (error) {
      document.getElementById('ob-error')?.focus();
      return;
    }
    if (candidates.length) {
      ticked = Object.fromEntries(candidates.map((n) => [n.id, true]));
      step = 'catchup';
      queueMicrotask(() => document.getElementById('catchup-title')?.focus());
    } else finish();
  }

  function finish() {
    const ids = step === 'catchup' ? Object.entries(ticked).filter(([, v]) => v).map(([k]) => k) : [];
    app.setBaby({ dob, ...(due ? { dueDate: due } : {}), ...(name.trim() ? { name: name.trim() } : {}) }, ids);
    app.onboardingOpen = false;
    onfinish();
  }

  const setAll = (v: boolean) => (ticked = Object.fromEntries(candidates.map((n) => [n.id, v])));
</script>

<dialog bind:this={dialog} class="onboarding panel" aria-labelledby="ob-title" onclose={() => (app.onboardingOpen = false)}>
  <div class="top">
    <p class="eyebrow">{step === 'details' ? '1' : '2'} / 2</p>
    <button type="button" class="icon-btn" aria-label={t('detail.close')} onclick={() => (app.onboardingOpen = false)}>
      <X size={22} aria-hidden="true" />
    </button>
  </div>

  {#if step === 'details'}
    <form onsubmit={next} novalidate>
      <h2 id="ob-title">{t('onboarding.title')}</h2>
      <hr class="sk-rule" />
      <div class="field">
        <label for="ob-name">{t('onboarding.name')}</label>
        <input id="ob-name" type="text" bind:value={name} maxlength="40" autocomplete="off" aria-describedby="ob-name-hint" />
        <p id="ob-name-hint" class="hint">{t('onboarding.nameHint')}</p>
      </div>
      <div class="field">
        <label for="ob-dob">{t('onboarding.dob')}</label>
        <input id="ob-dob" type="date" bind:value={dob} max={today} required aria-invalid={!!error} aria-describedby="ob-error" />
      </div>
      <div class="field">
        <label for="ob-due">{t('onboarding.due')}</label>
        <input id="ob-due" type="date" bind:value={due} aria-describedby="ob-due-hint" />
        <p id="ob-due-hint" class="hint">{t('onboarding.dueHint')}</p>
      </div>
      {#if corrected}
        <p class="note">{t('onboarding.correctedNote', { weeks: corrected })}</p>
      {/if}
      {#if age?.beyondTree}
        <p class="note">{t('onboarding.beyondNote')}</p>
      {/if}
      <p id="ob-error" class="error" role="alert" tabindex="-1">{error}</p>
      <p class="privacy">{t('onboarding.privacy')}</p>
      <p class="disclaimer">{app.data.settings.disclaimer}</p>
      <div class="actions">
        <button type="submit" class="btn btn-primary">{t('onboarding.next')}</button>
      </div>
    </form>
  {:else}
    <h2 id="catchup-title" tabindex="-1">{t('onboarding.catchUp')}</h2>
    <hr class="sk-rule" />
    <p class="intro">{app.data.settings.onboarding.catchUpIntro}</p>
    <div class="bulk">
      <button type="button" class="btn btn-sm" onclick={() => setAll(true)}>{t('onboarding.selectAll')}</button>
      <button type="button" class="btn btn-sm" onclick={() => setAll(false)}>{t('onboarding.selectNone')}</button>
    </div>
    <div class="catchup">
      {#each grouped as g (g.branch.id)}
        <fieldset style="--c: {g.branch.color}">
          <legend>{g.branch.name}</legend>
          {#each g.nodes as n (n.id)}
            <label class="check">
              <input type="checkbox" bind:checked={ticked[n.id]} />
              <span>{n.title}</span>
            </label>
          {/each}
        </fieldset>
      {/each}
    </div>
    <p class="disclaimer">{app.data.settings.disclaimer}</p>
    <div class="actions">
      <button type="button" class="btn btn-ghost" onclick={() => (step = 'details')}>{t('onboarding.back')}</button>
      <button type="button" class="btn btn-primary" onclick={finish}>{t('onboarding.finish')}</button>
    </div>
  {/if}
</dialog>

<style>
  .onboarding {
    width: min(32rem, calc(100vw - 2 * var(--gutter)));
    max-height: calc(100dvh - 2rem);
    overflow-y: auto;
    padding: 1rem 1.5rem 1.5rem;
    color: var(--ink);
    background: var(--panel-solid);
    box-shadow: var(--shadow-lg);
  }
  .onboarding::backdrop {
    background: rgb(2 4 10 / 0.6);
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h2 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }
  h2:focus {
    outline: none;
  }
  .sk-rule {
    margin-bottom: 1rem;
  }
  .field {
    margin-bottom: 1rem;
  }
  label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.3rem;
  }
  .hint {
    font-size: 0.85rem;
    color: var(--ink-3);
    margin: 0.3rem 0 0;
  }
  .note {
    padding: 0.5rem 0.75rem;
    border-left: 2px solid var(--gold);
    color: var(--ink-2);
    font-size: 0.92rem;
  }
  .error {
    color: var(--danger);
    font-weight: 600;
    min-height: 1.2em;
    margin: 0 0 0.5rem;
  }
  .error:empty {
    min-height: 0;
    margin: 0;
  }
  .privacy {
    font-size: 0.88rem;
    color: var(--ink-2);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1rem;
  }
  .intro {
    color: var(--ink-2);
  }
  .bulk {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .catchup {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  fieldset {
    margin: 0;
    padding: 0.5rem 0.75rem 0.6rem;
    border: 1px solid var(--rule);
    border-left: 3px solid var(--c);
    border-radius: 0.4rem;
  }
  legend {
    font-family: var(--font-display);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: color-mix(in oklab, var(--c) 65%, var(--ink));
    padding: 0 0.3rem;
  }
  .check {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    font-weight: 400;
    min-height: 40px;
    margin: 0;
    cursor: pointer;
  }
  @media (max-width: 640px) {
    .onboarding {
      width: 100vw;
      max-width: 100vw;
      height: 100dvh;
      max-height: 100dvh;
      margin: 0;
      border-radius: 0;
      padding: 0.75rem var(--gutter) 1.5rem;
    }
  }
</style>
