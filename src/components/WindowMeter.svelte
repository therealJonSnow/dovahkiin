<script lang="ts">
  import { formatWindow } from '../lib/age';
  import { t } from '../i18n';

  /**
   * The age window on a 0–24 month track. The range is feathered at both ends:
   * it's when most babies get there, not a date to hit.
   */
  interface Props {
    min: number;
    max: number;
    /** Baby's age in weeks. Omitted on static pages and before onboarding. */
    ageWeeks?: number;
    /** The line under the range. */
    note?: string;
    /** Hover cards: the bar and its numbers, no note. */
    compact?: boolean;
  }

  let { min, max, ageWeeks, note = t('window.note'), compact = false }: Props = $props();

  const SPAN = 104;
  const pct = (w: number) => (Math.min(SPAN, Math.max(0, w)) / SPAN) * 100;
  const ticks = [
    { w: 0, label: '0' },
    { w: 26, label: '6m' },
    { w: 52, label: '1y' },
    { w: 78, label: '18m' },
    { w: 104, label: '2y' },
  ];
  const label = $derived(formatWindow(min, max));
</script>

<figure class="meter" class:compact>
  <figcaption class="range">{t('window.most', { window: label })}</figcaption>
  <div class="track" aria-hidden="true">
    <span class="band" style="--a: {pct(min)}; --b: {pct(max)}"></span>
    {#each ticks as tk (tk.w)}
      <span class="tick" style="--p: {pct(tk.w)}"><span>{tk.label}</span></span>
    {/each}
    {#if ageWeeks !== undefined}
      <span class="now" style="--p: {pct(ageWeeks)}"><span>{t('today.short')}</span></span>
    {/if}
  </div>
  {#if !compact}<p class="note">{note}</p>{/if}
</figure>

<style>
  .meter {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }
  .range {
    color: var(--ink);
    font-weight: 500;
  }
  .note {
    margin: 0;
    color: var(--ink-3);
    font-size: 0.88rem;
  }
  .track {
    position: relative;
    height: 1.9rem;
    margin: 0 0.5rem;
  }
  /* Baseline */
  .track::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 0.55rem;
    height: 2px;
    border-radius: 2px;
    background: var(--rule);
  }
  /* Feathered range: solid in the middle, fading out at both ends. */
  .band {
    position: absolute;
    top: 0.2rem;
    height: 0.75rem;
    left: calc(var(--a) * 1%);
    width: max(0.75rem, calc((var(--b) - var(--a)) * 1%));
    border-radius: 999px;
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in oklab, var(--c) 55%, transparent) 22%,
      color-mix(in oklab, var(--c) 70%, transparent) 50%,
      color-mix(in oklab, var(--c) 55%, transparent) 78%,
      transparent
    );
  }
  .tick {
    position: absolute;
    left: calc(var(--p) * 1%);
    top: 0.35rem;
    width: 1px;
    height: 0.45rem;
    background: var(--rule);
  }
  .tick span {
    position: absolute;
    top: 0.65rem;
    left: 50%;
    transform: translateX(-50%);
    font-family: var(--font-display);
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-3);
    white-space: nowrap;
  }
  .now {
    position: absolute;
    left: calc(var(--p) * 1%);
    top: -0.1rem;
    width: 2px;
    height: 1.25rem;
    margin-left: -1px;
    border-radius: 2px;
    background: var(--today);
    box-shadow: 0 0 6px color-mix(in oklab, var(--today) 60%, transparent);
  }
  .now span {
    position: absolute;
    top: 1.15rem;
    left: 50%;
    transform: translateX(-50%);
    padding: 0 0.3rem;
    border-radius: 999px;
    font-family: var(--font-display);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--on-today);
    background: var(--today);
  }
  .compact .range {
    font-size: 0.85rem;
    color: var(--ink-2);
  }
  .compact .track {
    height: 1.7rem;
    margin: 0;
  }
</style>
