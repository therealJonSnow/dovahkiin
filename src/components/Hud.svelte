<script lang="ts">
  import Settings from '@lucide/svelte/icons/settings';
  import Compass from '@lucide/svelte/icons/compass';
  import ListChecks from '@lucide/svelte/icons/list-checks';
  import { useApp } from '../lib/app.svelte';
  import { t } from '../i18n';

  interface Props {
    ontoggleexplore: () => void;
  }
  let { ontoggleexplore }: Props = $props();
  const app = useApp();
  const ready = $derived(app.upNext?.readyNow.length ?? 0);
</script>

<header class="hud">
  <a class="brand" href="/" aria-label="{t('app.name')}, {t('nav.home')}">
    <span class="mark" aria-hidden="true"></span>
    <span class="word">{t('app.name')}</span>
  </a>

  <div class="level">
    <span class="sr-only">{t('hud.level')} {app.level.value}, {app.level.title}</span>
    <span class="lv" aria-hidden="true">
      <span class="k">{t('hud.level')}</span>
      <span class="v">{app.level.value}</span>
    </span>
    <span class="sk-bar" style="--p: {app.level.progress}" aria-hidden="true"></span>
    <span class="title" aria-hidden="true">{app.level.title}</span>
  </div>

  <div class="actions">
    {#if app.age}
      <button
        type="button"
        class="btn btn-sm btn-ghost upnext"
        aria-label={t('hud.upnextReady', { count: ready })}
        aria-haspopup="dialog"
        onclick={() => (app.upNextOpen = true)}
      >
        <ListChecks size={18} aria-hidden="true" />
        <span class="upnext-label" aria-hidden="true">{t('nav.upnext')}</span>
        {#if ready}<span class="badge" aria-hidden="true">{ready}</span>{/if}
      </button>
      <span class="xp" title={app.dadRank.title}>
        <span class="k">{t('hud.dadXp')}</span>
        <span class="v">{app.dadRank.value}</span>
      </span>
      <button
        type="button"
        class="icon-btn"
        class:on={app.exploring}
        aria-pressed={app.exploring}
        aria-label={t('nav.explore')}
        title={t('nav.explore')}
        onclick={ontoggleexplore}
      >
        <Compass size={20} aria-hidden="true" />
      </button>
    {:else if app.hydrated}
      <button type="button" class="btn btn-sm btn-primary start" onclick={() => (app.onboardingOpen = true)}>
        {app.data.settings.onboarding.cta}
      </button>
    {/if}
    <a class="about" href="/about">{t('nav.about')}</a>
    <button
      type="button"
      class="icon-btn"
      aria-label={t('nav.settings')}
      title={t('nav.settings')}
      onclick={() => (app.settingsOpen = true)}
    >
      <Settings size={20} aria-hidden="true" />
    </button>
  </div>
</header>

<style>
  .hud {
    position: sticky;
    top: 0;
    z-index: 40;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 1rem;
    height: var(--hud-h);
    padding: 0 var(--gutter);
    background: linear-gradient(180deg, color-mix(in oklab, var(--bg) 96%, transparent), color-mix(in oklab, var(--bg) 80%, transparent));
    border-bottom: 1px solid var(--rule);
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    color: var(--ink);
    text-decoration: none;
    min-height: 44px;
  }
  .mark {
    width: 14px;
    height: 14px;
    transform: rotate(45deg);
    border: 1.5px solid var(--gold);
    box-shadow:
      0 0 10px color-mix(in oklab, var(--gold) 60%, transparent),
      inset 0 0 6px color-mix(in oklab, var(--gold) 60%, transparent);
  }
  .word {
    font-family: var(--font-display);
    font-size: 1.35rem;
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  .level {
    display: grid;
    grid-template-columns: auto minmax(8rem, 16rem) auto;
    align-items: center;
    gap: 0.75rem;
    --c: var(--gold);
  }
  .lv,
  .xp {
    display: inline-flex;
    align-items: baseline;
    gap: 0.4rem;
    font-family: var(--font-display);
    text-transform: uppercase;
  }
  .k {
    font-size: 0.9rem;
    letter-spacing: 0.12em;
    color: var(--ink-3);
  }
  .v {
    font-size: 1.6rem;
    font-weight: 600;
    line-height: 1;
    color: var(--ink);
  }
  .xp .v {
    font-size: 1.25rem;
    color: var(--gold);
  }
  .title {
    font-family: var(--font-display);
    font-size: 1.15rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--gold);
    white-space: nowrap;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.25rem;
  }
  .xp {
    margin-right: 0.5rem;
  }
  .about {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 0.6rem;
    font-family: var(--font-display);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-2);
    text-decoration: none;
  }
  .about:hover {
    color: var(--ink);
  }
  .upnext {
    gap: 0.4rem;
    margin-right: 0.35rem;
    color: var(--ink-2);
  }
  .badge {
    display: inline-grid;
    place-items: center;
    min-width: 1.35rem;
    height: 1.35rem;
    padding: 0 0.3rem;
    border-radius: 999px;
    font-size: 0.85rem;
    font-weight: 600;
    letter-spacing: 0;
    color: var(--on-gold);
    background: var(--gold);
  }
  .on {
    color: var(--today);
    border-color: color-mix(in oklab, var(--today) 50%, transparent);
  }
  @media (max-width: 1023px) {
    .word,
    .upnext-label {
      display: none;
    }
    .upnext {
      margin-right: 0;
      padding: 0 0.5rem;
    }
    .about {
      display: none;
    }
    .level {
      grid-template-columns: auto minmax(4rem, 9rem);
      gap: 0.5rem;
    }
    .title {
      display: none;
    }
  }
  @media (max-width: 640px) {
    .hud {
      gap: 0.5rem;
      grid-template-columns: auto 1fr auto;
    }
    .level {
      grid-template-columns: auto 1fr;
    }
    .xp .k {
      display: none;
    }
    .xp {
      margin-right: 0.15rem;
    }
    .start {
      padding: 0.3rem 0.7rem;
      font-size: 0.85rem;
    }
  }
</style>
