<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { AppStore, setApp } from '../lib/app.svelte';
  import { iconFor } from '../lib/icons';
  import type { TreeData } from '../lib/types';
  import { t } from '../i18n';
  import Hud from './Hud.svelte';
  import Tree from './tree/Tree.svelte';
  import UpNext from './UpNext.svelte';
  import NodeDrawer from './NodeDrawer.svelte';
  import UnlockPrompt from './UnlockPrompt.svelte';
  import Onboarding from './Onboarding.svelte';
  import SettingsDialog from './SettingsDialog.svelte';
  import ExploreSlider from './ExploreSlider.svelte';
  import Celebration from './Celebration.svelte';

  interface Props {
    data: TreeData;
  }
  let { data }: Props = $props();

  // svelte-ignore state_referenced_locally
  const app = new AppStore(data);
  setApp(app);

  let small = $state(false);
  let phone = $state(false);
  let slider = $state<ReturnType<typeof ExploreSlider>>();

  const view = $derived(app.age ? app.saved.prefs.view : 'tree');
  const filter = $derived(small ? (app.saved.prefs.branchFilter ?? 'all') : 'all');
  const layout = $derived(data.layouts[filter] ?? data.layouts.all!);

  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function scrollToToday(behavior: ScrollBehavior = 'auto') {
    const el = document.querySelector<HTMLElement>('[data-today]');
    if (!el || !el.offsetParent) return;
    // Place the line ~30% down the part of the viewport not covered by sticky bars.
    const head = document.querySelector<HTMLElement>('.tree .head');
    const covered = head ? parseFloat(getComputedStyle(head).top) + head.offsetHeight : 0;
    const top = el.getBoundingClientRect().top + scrollY - (covered + (innerHeight - covered) * 0.3);
    scrollTo({ top: Math.max(0, top), behavior: reducedMotion() ? 'auto' : behavior });
  }

  async function focusNodeInView(id: string) {
    await tick();
    const el = document.getElementById(`node-${id}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
    el.focus({ preventScroll: true });
  }

  function onactivate(id: string, el: HTMLElement) {
    const node = app.byId.get(id);
    if (!node) return;
    // Phone overview: first tap zooms into the branch.
    if (phone && filter === 'all') {
      app.setBranchFilter(node.branch);
      focusNodeInView(id);
      return;
    }
    app.select(id, el);
  }

  async function setView(v: 'upnext' | 'tree') {
    app.setView(v);
    await tick();
    if (v === 'tree') scrollToToday();
    else scrollTo({ top: 0 });
  }

  async function setFilter(id: string) {
    app.setBranchFilter(id);
    await tick();
    scrollToToday();
  }

  async function toggleExplore() {
    if (app.exploring) {
      app.exploring = false;
      await tick();
      scrollToToday('smooth');
    } else {
      app.exploreAge = Math.round(app.realAgeWeeks * 2) / 2;
      app.exploring = true;
    }
  }

  async function afterOnboarding() {
    await tick();
    if (small && app.saved.prefs.view === 'upnext') scrollTo({ top: 0 });
    else scrollToToday('smooth');
  }

  onMount(() => {
    app.hydrate();
    const mqSmall = matchMedia('(max-width: 1023px)');
    const mqPhone = matchMedia('(max-width: 640px)');
    const update = () => {
      small = mqSmall.matches;
      phone = mqPhone.matches;
    };
    update();
    mqSmall.addEventListener('change', update);
    mqPhone.addEventListener('change', update);

    const onVisible = () => document.visibilityState === 'visible' && app.refreshToday();
    document.addEventListener('visibilitychange', onVisible);

    const skill = new URLSearchParams(location.search).get('skill');

    tick().then(() => {
      if (skill && app.byId.has(skill)) {
        const el = document.getElementById(`node-${skill}`);
        if (app.age && small) app.setView('tree');
        app.select(skill, el);
        el?.scrollIntoView({ block: 'center' });
      } else if (app.age) {
        if (!small || view === 'tree') scrollToToday();
      } else if (!reducedMotion()) {
        // First visit: light the tree up in a wave.
        slider?.play(0, 30, 3.2);
      }
    });

    return () => {
      mqSmall.removeEventListener('change', update);
      mqPhone.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', onVisible);
    };
  });
</script>

<a class="skip-link" href="#tree">{t('nav.skip')}</a>
<Hud ontoggleexplore={toggleExplore} />

{#if !app.age}
  <section class="hero" aria-labelledby="hero-title">
    <p class="eyebrow">{t('app.tagline')}</p>
    <h1 id="hero-title">{data.settings.onboarding.heroTitle}</h1>
    <hr class="sk-rule" />
    <p class="lede">{data.settings.onboarding.heroBody}</p>
    <div class="cta">
      <button type="button" class="btn btn-primary" onclick={() => (app.onboardingOpen = true)}>
        {data.settings.onboarding.cta}
      </button>
      <a class="btn btn-ghost" href="#tree">{t('landing.or')}</a>
    </div>
    <p class="disclaimer">{data.settings.footer}</p>
  </section>
{/if}

{#if app.hydrated && !app.storageOk}
  <p class="storage-note" role="status">{t('settings.noStorage')}</p>
{/if}

{#if app.age}
  <div class="tabs" role="tablist" aria-label={t('nav.upnext')}>
    <button
      type="button"
      role="tab"
      id="tab-upnext"
      aria-selected={view === 'upnext'}
      aria-controls="panel-upnext"
      onclick={() => setView('upnext')}>{t('nav.upnext')}</button
    >
    <button
      type="button"
      role="tab"
      id="tab-tree"
      aria-selected={view === 'tree'}
      aria-controls="tree"
      onclick={() => setView('tree')}>{t('nav.tree')}</button
    >
  </div>
{/if}

<div class="shell view-{view}" class:has-baby={!!app.age} class:exploring={app.isExplore}>
  <main id="tree" class="main" tabindex="-1">
    <div class="switcher" role="group" aria-label={t('branch.switcher')}>
      <button type="button" class="chip" aria-pressed={filter === 'all'} onclick={() => setFilter('all')}>
        {t('branch.all')}
      </button>
      {#each data.branches as b (b.id)}
        {@const Icon = iconFor(b.icon)}
        <button type="button" class="chip" style="--c: {b.color}" aria-pressed={filter === b.id} onclick={() => setFilter(b.id)}>
          <Icon size={15} aria-hidden="true" />
          {b.name.replace(/^The\s+/i, '')}
        </button>
      {/each}
    </div>
    <Tree {layout} {onactivate} />
  </main>

  <aside id="panel-upnext" class="side" aria-label={app.age ? t('upnext.heading') : t('landing.sideTitle')}>
    <div class="side-inner">
      {#if app.age}
        <UpNext />
      {:else}
        <h2>{t('landing.sideTitle')}</h2>
        <p>{t('landing.sideBody')}</p>
        <button type="button" class="btn btn-primary" onclick={() => (app.onboardingOpen = true)}>
          {data.settings.onboarding.cta}
        </button>
        <p class="disclaimer">{data.settings.disclaimer}</p>
      {/if}
    </div>
  </aside>
</div>

{#if app.isExplore}
  <ExploreSlider bind:this={slider} onexit={toggleExplore} />
{/if}

<NodeDrawer />
<UnlockPrompt />
<Onboarding onfinish={afterOnboarding} />
<SettingsDialog />
<Celebration />

<style>
  .hero {
    max-width: 46rem;
    margin: 0 auto;
    padding: 3.5rem var(--gutter) 1.5rem;
    text-align: center;
  }
  :global(html.has-baby) .hero {
    display: none;
  }
  .hero h1 {
    font-size: clamp(2.6rem, 9vw, 4.8rem);
    font-weight: 500;
    color: var(--ink);
    text-shadow: 0 0 30px color-mix(in oklab, var(--gold) 30%, transparent);
    margin: 0.4rem 0 0.9rem;
  }
  .hero .sk-rule {
    max-width: 24rem;
    margin: 0 auto 1.25rem;
  }
  .lede {
    font-size: 1.1rem;
    color: var(--ink-2);
    max-width: 36rem;
    margin: 0 auto 1.5rem;
  }
  .cta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
    margin-bottom: 1.25rem;
  }
  .storage-note {
    margin: 0;
    padding: 0.4rem var(--gutter);
    text-align: center;
    font-size: 0.9rem;
    color: var(--ink-2);
    background: color-mix(in oklab, var(--danger) 15%, transparent);
  }

  .shell {
    --sticky-top: var(--hud-h);
    display: grid;
    grid-template-columns: minmax(0, 1fr) 25rem;
    gap: 1.5rem;
    max-width: 96rem;
    margin: 0 auto;
    padding: 0 var(--gutter) 6rem;
  }
  .main {
    min-width: 0;
  }
  .main:focus {
    outline: none;
  }
  .side {
    position: sticky;
    top: calc(var(--hud-h) + 0.75rem);
    align-self: start;
    max-height: calc(100dvh - var(--hud-h) - 1.5rem);
    overflow-y: auto;
    margin-top: 0.75rem;
    border: 1px solid var(--panel-border);
    border-radius: var(--radius);
    background: var(--panel);
  }
  .side-inner {
    padding: 1.25rem;
  }
  .side h2 {
    font-size: 1.8rem;
    margin-bottom: 0.75rem;
  }
  .side p {
    color: var(--ink-2);
  }
  .side .btn {
    margin: 0.25rem 0 1rem;
  }

  .tabs,
  .switcher {
    display: none;
  }

  @media (max-width: 1023px) {
    .shell {
      display: block;
      padding: 0 var(--gutter) 7rem;
    }
    .shell.has-baby {
      --sticky-top: calc(var(--hud-h) + 3rem + 3.25rem);
    }
    .shell:not(.has-baby) {
      --sticky-top: calc(var(--hud-h) + 3.25rem);
    }
    .side {
      display: none;
      position: static;
      max-height: none;
      overflow: visible;
      border: 0;
      background: none;
      margin: 0;
    }
    .side-inner {
      padding: 1rem 0;
    }
    .shell.has-baby.view-upnext .side {
      display: block;
    }
    .shell.has-baby.view-upnext .main {
      display: none;
    }
    .tabs {
      position: sticky;
      top: var(--hud-h);
      z-index: 35;
      display: grid;
      grid-template-columns: 1fr 1fr;
      height: 3rem;
      background: var(--bg);
      border-bottom: 1px solid var(--rule);
    }
    .tabs button {
      border: 0;
      background: none;
      font-family: var(--font-display);
      font-size: 1.1rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--ink-3);
      cursor: pointer;
      border-bottom: 2px solid transparent;
    }
    .tabs button[aria-selected='true'] {
      color: var(--ink);
      border-bottom-color: var(--gold);
    }
    .switcher {
      position: sticky;
      top: calc(var(--sticky-top) - 3.25rem);
      z-index: 16;
      display: flex;
      gap: 0.4rem;
      height: 3.25rem;
      align-items: center;
      margin: 0 calc(-1 * var(--gutter));
      padding: 0 var(--gutter);
      overflow-x: auto;
      scrollbar-width: none;
      background: var(--bg);
    }
    .switcher::-webkit-scrollbar {
      display: none;
    }
    .chip {
      --c: var(--gold);
      flex: none;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      min-height: 36px;
      padding: 0 0.85rem;
      border-radius: 999px;
      border: 1px solid var(--panel-border);
      background: transparent;
      font-family: var(--font-display);
      font-size: 1rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ink-2);
      cursor: pointer;
    }
    .chip :global(svg) {
      color: var(--c);
    }
    .chip[aria-pressed='true'] {
      color: var(--ink);
      border-color: var(--c);
      background: color-mix(in oklab, var(--c) 18%, transparent);
    }
  }
</style>
