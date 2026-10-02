<script lang="ts">
  import Play from '@lucide/svelte/icons/play';
  import Pause from '@lucide/svelte/icons/pause';
  import { useApp } from '../lib/app.svelte';
  import { formatWeeks } from '../lib/age';
  import { t } from '../i18n';

  interface Props {
    onexit?: () => void;
  }
  let { onexit }: Props = $props();

  const app = useApp();
  let playing = $state(false);
  let raf = 0;

  /** Scrubs the age forwards: the whole tree lights up in a wave. */
  export function play(from?: number, to = 104, seconds = 9) {
    cancelAnimationFrame(raf);
    if (from !== undefined) app.exploreAge = from;
    if (app.exploreAge >= to - 0.5) app.exploreAge = 0;
    playing = true;
    const start = performance.now();
    const a0 = app.exploreAge;
    const total = ((to - a0) / 104) * seconds * 1000;
    const tickFn = (now: number) => {
      const p = Math.min(1, (now - start) / Math.max(1, total));
      app.exploreAge = Math.round((a0 + (to - a0) * p) * 2) / 2;
      if (p < 1 && playing) raf = requestAnimationFrame(tickFn);
      else playing = false;
    };
    raf = requestAnimationFrame(tickFn);
  }

  function pause() {
    playing = false;
    cancelAnimationFrame(raf);
  }

  // Client-only cleanup ($effect never runs during SSR).
  $effect(() => () => cancelAnimationFrame(raf));
</script>

<div class="explore panel" role="region" aria-label={t('explore.label')}>
  <button
    type="button"
    class="icon-btn play"
    aria-label={playing ? t('explore.pause') : t('explore.play')}
    onclick={() => (playing ? pause() : play())}
  >
    {#if playing}<Pause size={20} aria-hidden="true" />{:else}<Play size={20} aria-hidden="true" />{/if}
  </button>
  <div class="track">
    <label for="explore-age" class="lbl">
      <span class="eyebrow">{t('explore.label')}</span>
      <span class="age">{formatWeeks(app.exploreAge)}</span>
    </label>
    <input
      id="explore-age"
      type="range"
      min="0"
      max="104"
      step="0.5"
      bind:value={app.exploreAge}
      oninput={pause}
      aria-valuetext={formatWeeks(app.exploreAge)}
      aria-describedby="explore-hint"
    />
    <p id="explore-hint" class="sr-only">{t('explore.hint')}</p>
  </div>
  {#if app.age && onexit}
    <button type="button" class="btn btn-sm" onclick={onexit}>{t('nav.backToToday')}</button>
  {/if}
</div>

<style>
  .explore {
    position: fixed;
    left: 50%;
    bottom: calc(0.75rem + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: min(40rem, calc(100vw - 2 * var(--gutter)));
    padding: 0.5rem 0.9rem 0.5rem 0.5rem;
    background: var(--panel-solid);
    box-shadow: var(--shadow-lg);
  }
  .play {
    flex: none;
    color: var(--ink);
    border-color: var(--panel-border);
  }
  .track {
    flex: 1;
    min-width: 0;
  }
  .lbl {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .eyebrow {
    font-size: 0.75rem;
  }
  .age {
    font-family: var(--font-display);
    font-size: 1.1rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--today);
  }
  input[type='range'] {
    width: 100%;
    height: 28px;
    accent-color: var(--today);
    margin: 0;
  }
  @media (min-width: 1024px) {
    .explore {
      left: calc(50% - 13rem);
    }
  }
</style>
