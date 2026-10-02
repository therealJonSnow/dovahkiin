<script lang="ts">
  import type { Layout } from '../../lib/layout';
  import type { NodeState, UnlockedMap } from '../../lib/state';

  interface Props {
    layout: Layout;
    states: Record<string, NodeState>;
    unlocked: UnlockedMap;
    colors: Record<string, string>;
    branchOf: Record<string, string>;
    highlight: string | null;
  }

  let { layout, states, unlocked, colors, branchOf, highlight }: Props = $props();

  const cols = $derived(layout.columns.length);
  const lines = $derived(
    layout.edges
      .map((e) => {
        const a = layout.nodes[e.from];
        const b = layout.nodes[e.to];
        if (!a || !b) return null;
        const lit = e.from in unlocked && e.to in unlocked;
        const active = !lit && e.from in unlocked && states[e.to] === 'ready';
        return {
          key: `${e.from}>${e.to}`,
          x1: (a.col + a.x) * 100,
          y1: a.y,
          x2: (b.col + b.x) * 100,
          y2: b.y,
          cross: e.cross,
          lit,
          active,
          hot: highlight === e.from || highlight === e.to,
          color: colors[branchOf[e.to] ?? ''] ?? 'currentColor',
        };
      })
      .filter((l) => l !== null),
  );
</script>

<svg
  class="links"
  viewBox="0 0 {cols * 100} {layout.height}"
  preserveAspectRatio="none"
  aria-hidden="true"
  focusable="false"
>
  {#each lines as l (l.key)}
    <g class="edge" class:lit={l.lit} class:active={l.active} class:cross={l.cross} class:hot={l.hot} style="--c: {l.color}">
      {#if l.lit || l.active || l.hot}
        <line class="glow" x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} vector-effect="non-scaling-stroke" />
      {/if}
      <line class="core" x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} vector-effect="non-scaling-stroke" />
    </g>
  {/each}
</svg>

<style>
  .links {
    position: absolute;
    inset: 0 0 auto 0;
    width: 100%;
    height: calc(var(--h) * var(--s, 1) * 1px);
    overflow: visible;
    pointer-events: none;
    z-index: 1;
  }
  line {
    stroke-linecap: round;
    fill: none;
  }
  .core {
    stroke: var(--line-dim);
    stroke-width: 1.25;
    transition: stroke 0.6s ease;
  }
  .cross .core {
    stroke-dasharray: 3 7;
    opacity: 0.7;
  }
  .glow {
    stroke: color-mix(in oklab, var(--c) 45%, transparent);
    stroke-width: 6;
    opacity: 0.5;
  }
  .lit .core {
    stroke: var(--line-lit);
    stroke-width: 1.75;
  }
  .lit .glow {
    stroke: color-mix(in oklab, var(--c) 55%, transparent);
    opacity: 0.6;
  }
  .active .core {
    stroke: color-mix(in oklab, var(--c) 75%, var(--ink));
    stroke-width: 1.5;
    stroke-dasharray: 2 6;
    animation: flow 1.6s linear infinite;
  }
  .active .glow {
    opacity: 0.35;
  }
  .hot .core {
    stroke: color-mix(in oklab, var(--c) 60%, var(--ink));
    stroke-width: 2;
  }
  .hot .glow {
    opacity: 0.8;
  }
  @keyframes flow {
    to {
      stroke-dashoffset: -16;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .active .core {
      animation: none;
    }
  }
</style>
