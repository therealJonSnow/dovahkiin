<script lang="ts">
  import type { LayoutNode } from '../../lib/layout';
  import type { NodeState } from '../../lib/state';
  import type { ClientBranch, ClientNode } from '../../lib/types';
  import { t } from '../../i18n';
  import WindowMeter from '../WindowMeter.svelte';

  interface Props {
    node: ClientNode;
    branch: ClientBranch;
    pos: LayoutNode;
    cols: number;
    nodeState: NodeState;
    skipped: boolean;
    pastWindow: boolean;
    pastNote: string;
    ageWeeks?: number;
  }

  let { node, branch, pos, cols, nodeState, skipped, pastWindow, pastNote, ageWeeks }: Props = $props();

  const fx = $derived((pos.col + pos.x) / cols);
  const side = $derived(fx > 0.55 ? 'left' : 'right');
  const excerpt = $derived(/<p>([\s\S]*?)<\/p>/.exec(node.html)?.[1] ?? '');
  const stateLabel = $derived(skipped ? t('stateLabel.skipped') : t(`stateLabel.${nodeState}`));
</script>

<div
  class="card panel side-{side} st-{nodeState}"
  style="--c: {branch.color}; --fx: {fx}; --y: {pos.y};"
  role="tooltip"
  id="hovercard"
>
  <p class="eyebrow">{branch.name} · {t(`tier.${node.tier}`)}</p>
  <h3>{node.title}</h3>
  <p class="meta">
    <span class="chip">{stateLabel}</span>
  </p>
  <div class="win">
    <WindowMeter min={node.ageWeeksMin} max={node.ageWeeksMax} {ageWeeks} compact />
  </div>
  {#if node.gameText}
    <p class="game">{node.gameText}</p>
  {/if}
  {#if excerpt}
    <!-- Trusted: rendered from repository markdown at build time. -->
    <p class="desc">{@html excerpt}</p>
  {/if}
  {#if pastWindow && pastNote}
    <p class="soft">{pastNote}</p>
  {/if}
  <p class="hint">{t('node.hoverHint')}</p>
</div>

<style>
  .card {
    position: absolute;
    top: calc(var(--y) * var(--s, 1) * 1px);
    width: min(22rem, 46vw);
    max-height: 70vh;
    overflow: hidden;
    padding: 1rem 1.1rem 0.85rem;
    z-index: 20;
    pointer-events: none;
    box-shadow: var(--shadow-lg);
    border-top: 2px solid var(--c);
    transform: translateY(-1.5rem);
    animation: fade 0.15s ease-out;
    background: var(--panel-solid);
  }
  .side-right {
    left: calc(var(--fx) * 100% + 2.25rem);
  }
  .side-left {
    right: calc((1 - var(--fx)) * 100% + 2.25rem);
  }
  h3 {
    font-size: 1.5rem;
    margin: 0.15rem 0 0.4rem;
    color: var(--ink);
  }
  .eyebrow {
    margin: 0;
    color: color-mix(in oklab, var(--c) 65%, var(--ink));
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.6rem;
    font-size: 0.85rem;
    color: var(--ink-3);
    margin-bottom: 0.6rem;
  }
  .chip {
    font-family: var(--font-display);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 0.8rem;
    padding: 0.05rem 0.5rem;
    border-radius: 999px;
    border: 1px solid var(--panel-border);
    color: var(--ink-2);
  }
  .st-ready .chip,
  .st-unlocked .chip {
    border-color: var(--c);
    color: var(--ink);
  }
  .win {
    margin-bottom: 0.7rem;
  }
  .game {
    font-style: italic;
    color: var(--gold);
    font-size: 0.95rem;
  }
  .desc {
    color: var(--ink-2);
    font-size: 0.92rem;
    display: -webkit-box;
    -webkit-line-clamp: 6;
    line-clamp: 6;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .soft {
    font-size: 0.85rem;
    color: var(--ink-3);
  }
  .hint {
    margin: 0.4rem 0 0;
    font-size: 0.75rem;
    color: var(--ink-3);
    font-family: var(--font-display);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .card {
      animation: none;
    }
  }
</style>
