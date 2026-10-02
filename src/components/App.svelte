<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { scale } from 'svelte/transition';
  import { AppStore, setApp } from '../lib/app.svelte';
  import type { TreeData } from '../lib/types';
  import { t } from '../i18n';
  import Hud from './Hud.svelte';
  import Overview from './Overview.svelte';
  import FocusView from './FocusView.svelte';
  import FamilyPanel from './FamilyPanel.svelte';
  import UpNextDialog from './UpNextDialog.svelte';
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

  let slider = $state<ReturnType<typeof ExploreSlider>>();

  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const zoom = (start: number) => ({ start, opacity: 0, duration: reducedMotion() ? 0 : 220 });

  function scrollToToday(behavior: ScrollBehavior = 'auto') {
    const el = document.querySelector<HTMLElement>('[data-today]');
    if (!el || !el.offsetParent) return;
    // The tree grows upwards, so put the line ~60% down the part of the viewport
    // not covered by sticky bars: more of what's coming next is in view above it.
    const bar = document.querySelector<HTMLElement>('.focus .bar');
    const covered = bar ? bar.getBoundingClientRect().bottom : 0;
    const top = el.getBoundingClientRect().top + scrollY - (covered + (innerHeight - covered) * 0.6);
    scrollTo({ top: Math.max(0, top), behavior: reducedMotion() ? 'auto' : behavior });
  }

  function onactivate(id: string, el: HTMLElement) {
    app.select(id, el);
  }

  async function showOverview() {
    const from = app.focus;
    app.setFocus(null);
    await tick();
    document.querySelector<HTMLElement>(`[data-family="${from}"]`)?.focus({ preventScroll: true });
  }

  // Keeps ?family= in the URL, so Back zooms out and a focused family can be shared.
  function syncUrl(focus: string | null) {
    const url = new URL(location.href);
    const current = url.searchParams.get('family');
    if (current === focus) return;
    if (focus) url.searchParams.set('family', focus);
    else url.searchParams.delete('family');
    const hadSkill = url.searchParams.has('skill');
    url.searchParams.delete('skill');
    // Moving through the carousel replaces the entry; zooming in or out adds one.
    if ((current && focus) || hadSkill) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
  }

  $effect(() => {
    const focus = app.focus;
    if (!app.hydrated) return;
    syncUrl(focus);
    tick().then(() => {
      if (!focus) return scrollTo({ top: 0 });
      const id = app.selectedId;
      const node = id ? document.getElementById(`node-${id}`) : null;
      if (node) node.scrollIntoView({ block: 'center' });
      else scrollToToday();
    });
  });

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

  function afterOnboarding() {
    scrollTo({ top: 0 });
  }

  function onkeydown(e: KeyboardEvent) {
    // Escape steps back out: skill details → family → overview. Open dialogs handle their own.
    if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('dialog[open]')) return;
    if (app.selectedId && app.wide) {
      app.select(null);
      const el = app.returnFocus;
      app.returnFocus = null;
      if (el?.isConnected) el.focus();
    } else if (app.focus && !app.selectedId) {
      showOverview();
    } else return;
    e.preventDefault();
  }

  onMount(() => {
    app.hydrate();
    const mqWide = matchMedia('(min-width: 1024px)');
    const update = () => (app.wide = mqWide.matches);
    update();
    mqWide.addEventListener('change', update);

    const onVisible = () => document.visibilityState === 'visible' && app.refreshToday();
    document.addEventListener('visibilitychange', onVisible);
    const onPop = () => app.setFocus(new URLSearchParams(location.search).get('family'));
    addEventListener('popstate', onPop);

    const params = new URLSearchParams(location.search);
    const skill = params.get('skill');
    const family = params.get('family');
    if (skill && app.byId.has(skill)) {
      tick().then(() => app.select(skill, null));
    } else if (family) {
      app.setFocus(family);
    } else if (!app.age && !reducedMotion()) {
      // First visit: light the families up in a wave.
      tick().then(() => slider?.play(0, 30, 3.2));
    }

    return () => {
      mqWide.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', onVisible);
      removeEventListener('popstate', onPop);
    };
  });
</script>

<svelte:window {onkeydown} />

<a class="skip-link" href="#tree">{t('nav.skip')}</a>
<Hud ontoggleexplore={toggleExplore} />

{#if !app.age && !app.focus}
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

<div class="shell" class:focused={!!app.focus} class:exploring={app.isExplore}>
  <main id="tree" class="main" tabindex="-1">
    {#if app.focus}
      <div in:scale={zoom(0.94)}>
        <FocusView layouts={data.layouts} {onactivate} onoverview={showOverview} />
      </div>
    {:else}
      <div in:scale={zoom(1.04)}>
        <Overview layout={data.layouts.all!} onopen={(id) => app.setFocus(id)} />
      </div>
    {/if}
  </main>
  {#if app.focus && app.wide}
    <FamilyPanel />
  {/if}
</div>

{#if app.isExplore}
  <ExploreSlider bind:this={slider} onexit={toggleExplore} />
{/if}

<UpNextDialog />
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

  .main {
    min-width: 0;
  }
  .main:focus {
    outline: none;
  }
  /* Zoomed in: the family carousel, with its sidebar on wide screens. */
  .shell.focused {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 25rem;
    gap: 1.5rem;
    max-width: 96rem;
    margin: 0 auto;
    padding: 0 var(--gutter) 6rem;
  }

  @media (max-width: 1023px) {
    .shell.focused {
      display: block;
      padding: 0 var(--gutter) 7rem;
    }
  }
</style>
