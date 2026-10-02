<script lang="ts">
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import LayoutGrid from '@lucide/svelte/icons/layout-grid';
  import { fly } from 'svelte/transition';
  import { useApp } from '../lib/app.svelte';
  import { iconFor } from '../lib/icons';
  import type { Layout } from '../lib/layout';
  import { t } from '../i18n';
  import Tree from './tree/Tree.svelte';

  interface Props {
    layouts: Record<string, Layout>;
    onactivate: (id: string, el: HTMLElement) => void;
    onoverview: () => void;
  }
  let { layouts, onactivate, onoverview }: Props = $props();
  const app = useApp();

  const branches = $derived(app.data.branches);
  const index = $derived(Math.max(0, branches.findIndex((b) => b.id === app.focus)));
  const branch = $derived(branches[index]!);
  const prev = $derived(branches[(index - 1 + branches.length) % branches.length]!);
  const next = $derived(branches[(index + 1) % branches.length]!);
  const layout = $derived(layouts[branch.id] ?? layouts.all!);
  const Icon = $derived(iconFor(branch.icon));
  const inBranch = $derived(app.nodes.filter((n) => n.branch === branch.id));
  const done = $derived(inBranch.filter((n) => n.id in app.unlocked).length);

  // Slide direction for the carousel: +1 when moving right (the shorter way round).
  let dir = $state(1);
  let lastIndex = -1;
  $effect.pre(() => {
    const i = index;
    if (lastIndex >= 0 && i !== lastIndex) {
      const n = branches.length;
      dir = (i - lastIndex + n) % n <= n / 2 ? 1 : -1;
    }
    lastIndex = i;
  });
  const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const go = (d: 1 | -1) => app.stepFocus(d);

  // Horizontal swipe on touch screens moves between families.
  let touch: { x: number; y: number } | null = null;
  function ontouchstart(e: TouchEvent) {
    const p = e.touches[0];
    touch = e.touches.length === 1 && p ? { x: p.clientX, y: p.clientY } : null;
  }
  function ontouchend(e: TouchEvent) {
    const p = e.changedTouches[0];
    if (!touch || !p) return;
    const dx = p.clientX - touch.x;
    const dy = p.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > 1.6 * Math.abs(dy)) go(dx < 0 ? 1 : -1);
  }
</script>

<div class="focus" style="--c: {branch.color}">
  <div class="bar">
    <button type="button" class="btn btn-sm btn-ghost back" aria-label={t('focus.overview')} onclick={onoverview}>
      <LayoutGrid size={16} aria-hidden="true" />
      <span aria-hidden="true">{t('focus.overview')}</span>
    </button>

    <div class="nav">
      <button type="button" class="icon-btn" aria-label={t('focus.prev', { name: prev.name })} onclick={() => go(-1)}>
        <ChevronLeft size={22} aria-hidden="true" />
      </button>
      <div class="title" aria-live="polite">
        <span class="sigil" aria-hidden="true"><Icon size={18} strokeWidth={1.75} /></span>
        <span class="title-text">
          <h2 id="family-title">{branch.name}</h2>
          <span class="meta">
            <span class="sr-only">{t('focus.position', { index: index + 1, total: branches.length })}. </span>
            {t('branch.count', { done, total: inBranch.length })}
          </span>
        </span>
      </div>
      <button type="button" class="icon-btn" aria-label={t('focus.next', { name: next.name })} onclick={() => go(1)}>
        <ChevronRight size={22} aria-hidden="true" />
      </button>
    </div>

    <div class="dots" role="group" aria-label={t('focus.pick')}>
      {#each branches as b, i (b.id)}
        <button
          type="button"
          class="dot"
          style="--c: {b.color}"
          aria-label={b.name}
          aria-current={i === index ? 'true' : undefined}
          onclick={() => app.setFocus(b.id)}
        ></button>
      {/each}
    </div>
    <span class="sk-bar progress" style="--p: {inBranch.length ? done / inBranch.length : 0}" aria-hidden="true"></span>
  </div>

  <p class="tagline">{branch.tagline}<span class="sr-only"> {t('focus.swipe')}</span></p>

  <!-- Swipe is a shortcut for the arrow buttons above, so it needs no role of its own. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="stage" {ontouchstart} {ontouchend}>
    {#key branch.id}
      <div class="slide" in:fly={{ x: dir * 56, duration: reduced() ? 0 : 280, opacity: 0 }}>
        <Tree {layout} {onactivate} />
      </div>
    {/key}
  </div>
</div>

<style>
  .focus {
    position: relative;
  }
  .bar {
    position: sticky;
    top: var(--hud-h);
    z-index: 15;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 0.25rem 0.75rem;
    padding: 0.5rem 0 0.6rem;
    background: linear-gradient(180deg, var(--bg) 0%, color-mix(in oklab, var(--bg) 88%, transparent) 80%, transparent);
  }
  .back {
    justify-self: start;
    color: var(--ink-2);
  }
  .nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }
  .title-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .sigil {
    flex: none;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    color: color-mix(in oklab, var(--c) 75%, var(--ink));
    border: 1px solid color-mix(in oklab, var(--c) 50%, transparent);
    transform: rotate(45deg);
    border-radius: 4px;
    box-shadow: 0 0 14px color-mix(in oklab, var(--c) 30%, transparent);
  }
  .sigil :global(svg) {
    transform: rotate(-45deg);
  }
  h2 {
    font-size: 1.6rem;
    font-weight: 500;
    letter-spacing: 0.08em;
    line-height: 1.05;
    white-space: nowrap;
    color: var(--ink);
    text-shadow: var(--text-halo);
  }
  .meta {
    font-family: var(--font-display);
    font-size: 0.9rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-3);
  }
  .dots {
    justify-self: end;
    display: flex;
    gap: 0.1rem;
  }
  .dot {
    position: relative;
    width: 24px;
    height: 32px;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
  }
  .dot::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 8px;
    height: 8px;
    transform: translate(-50%, -50%) rotate(45deg);
    border-radius: 1px;
    border: 1px solid color-mix(in oklab, var(--c) 70%, transparent);
    transition:
      background 0.2s,
      transform 0.2s;
  }
  .dot:hover::after {
    background: color-mix(in oklab, var(--c) 45%, transparent);
  }
  .dot[aria-current='true']::after {
    background: var(--c);
    box-shadow: 0 0 10px var(--c);
    transform: translate(-50%, -50%) rotate(45deg) scale(1.3);
  }
  .progress {
    grid-column: 1 / -1;
    width: min(22rem, 100%);
    height: 6px;
    justify-self: center;
  }
  .tagline {
    margin: 0.1rem 0 0;
    text-align: center;
    color: var(--ink-3);
    font-size: 0.95rem;
  }

  .stage {
    max-width: 48rem;
    margin: 0 auto;
    overflow-x: clip;
    touch-action: pan-y;
  }

  @media (max-width: 1023px) {
    .bar {
      grid-template-columns: auto 1fr;
    }
    .nav {
      justify-content: flex-end;
    }
    .dots {
      grid-column: 1 / -1;
      justify-self: center;
    }
    .back span {
      display: none;
    }
    .back {
      padding: 0 0.6rem;
    }
  }
  @media (max-width: 640px) {
    .bar {
      gap: 0 0.25rem;
    }
    .nav {
      gap: 0.1rem;
    }
    h2 {
      font-size: 1.3rem;
    }
    .meta {
      font-size: 0.78rem;
    }
    .sigil {
      width: 26px;
      height: 26px;
    }
    .title {
      gap: 0.55rem;
    }
    .tagline {
      font-size: 0.88rem;
    }
  }
</style>
