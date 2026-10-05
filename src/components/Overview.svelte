<script lang="ts">
  import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
  import { useApp } from '../lib/app.svelte';
  import { ageToY, type Layout } from '../lib/layout';
  import { iconFor } from '../lib/icons';
  import { t } from '../i18n';

  interface Props {
    /** The six-column layout: every family shares one age scale, so the bands and today line line up. */
    layout: Layout;
    onopen: (branch: string) => void;
  }
  let { layout, onopen }: Props = $props();
  const app = useApp();

  const pct = (y: number) => (y / layout.height) * 100;
  const todayPct = $derived(pct(ageToY(layout, app.ageWeeks)));

  const families = $derived(
    layout.columns.map((id, col) => {
      const branch = app.branchById.get(id)!;
      const nodes = app.nodes.filter((n) => layout.nodes[n.id]?.col === col);
      const ids = new Set(nodes.map((n) => n.id));
      return {
        branch,
        nodes,
        edges: layout.edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
        done: nodes.filter((n) => n.id in app.unlocked).length,
        ready: nodes.filter((n) => app.states[n.id] === 'ready').length,
      };
    }),
  );
</script>

<section class="overview" aria-labelledby="overview-title" style="--cols: {layout.columns.length}">
  <header class="intro">
    <h2 id="overview-title">{t('overview.heading')}</h2>
    <p>{t('overview.hint')}</p>
  </header>

  <div class="grid">
    <div class="rail" aria-hidden="true">
      <div class="rail-head"></div>
      <div class="field">
        {#each layout.bands as b (b.id)}
          <span class="band-label" style="--y: {pct(b.y + b.height)}">{b.label}</span>
        {/each}
        <span class="today-tag" style="--y: {todayPct}">
          {app.isExplore ? t('today.preview') : t('today.short')}<br /><strong>{app.ageLabel}</strong>
        </span>
      </div>
    </div>

    {#each families as f (f.branch.id)}
      {@const Icon = iconFor(f.branch.icon)}
      {@const total = f.nodes.length}
      <button
        type="button"
        class="card"
        data-family={f.branch.id}
        style="--c: {f.branch.color}"
        aria-label="{t('overview.card', { name: f.branch.name, tagline: f.branch.tagline, done: f.done, total })}{f.ready
          ? ` ${t('overview.readyAria', { count: f.ready })}`
          : ''}"
        onclick={() => onopen(f.branch.id)}
      >
        <span class="card-head" aria-hidden="true">
          <span class="sigil"><Icon size={18} strokeWidth={1.75} /></span>
          <span class="name">{f.branch.name.replace(/^The\s+/i, '')}</span>
          <span class="count">{f.done}/{total}</span>
          <span class="sk-bar" style="--p: {total ? f.done / total : 0}"></span>
          <span class="tagline">{f.branch.tagline}</span>
          <span class="ready" class:none={!f.ready}><span>{f.ready}</span> <span class="ready-word">{t('overview.ready')}</span></span>
        </span>

        <span class="field" aria-hidden="true">
          {#each layout.bands as b, i (b.id)}
            {#if i > 0}<span class="band-line" style="--y: {pct(b.y + b.height)}"></span>{/if}
          {/each}
          <svg viewBox="0 0 100 {layout.height}" preserveAspectRatio="none" focusable="false">
            {#each f.nodes as n (n.id)}
              {@const p = layout.nodes[n.id]!}
              <line
                class="range"
                x1={p.x * 100}
                y1={p.y}
                x2={p.x * 100}
                y2={Math.min(p.y, ageToY(layout, n.ageWeeksMax))}
                vector-effect="non-scaling-stroke"
              />
            {/each}
            {#each f.edges as e (`${e.from}>${e.to}`)}
              {@const a = layout.nodes[e.from]!}
              {@const z = layout.nodes[e.to]!}
              <line
                class:lit={e.from in app.unlocked && e.to in app.unlocked}
                x1={a.x * 100}
                y1={a.y}
                x2={z.x * 100}
                y2={z.y}
                vector-effect="non-scaling-stroke"
              />
            {/each}
          </svg>
          {#each f.nodes as n (n.id)}
            {@const p = layout.nodes[n.id]!}
            <span
              data-id={n.id}
              class="dot tier-{n.tier} st-{app.states[n.id]}"
              class:skipped={!!app.unlocked[n.id]?.skipped}
              style="--x: {p.x * 100}; --y: {pct(p.y)}"
            ></span>
          {/each}
          <span class="today" style="--y: {todayPct}"></span>
          <span class="open">{t('overview.open')} <ArrowUpRight size={14} /></span>
        </span>
      </button>
    {/each}
  </div>
</section>

<style>
  .overview {
    --rail: 4.75rem;
    --head-h: 8.4rem;
    --field-h: clamp(22rem, calc(100dvh - var(--hud-h) - var(--head-h) - 9rem), 48rem);
    max-width: 96rem;
    margin: 0 auto;
    padding: 1.25rem var(--gutter) 6rem;
  }
  .intro {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 1.25rem;
    margin: 0 0 1rem var(--rail);
  }
  .intro h2 {
    font-size: 1.6rem;
    letter-spacing: 0.1em;
    color: var(--ink);
  }
  .intro p {
    margin: 0;
    color: var(--ink-3);
    font-size: 0.95rem;
  }

  .grid {
    display: grid;
    grid-template-columns: var(--rail) repeat(var(--cols), minmax(0, 1fr));
    gap: 0 0.6rem;
  }
  .rail-head {
    height: var(--head-h);
  }
  .field {
    position: relative;
    display: block;
    height: var(--field-h);
  }

  .band-label {
    position: absolute;
    left: 0;
    right: 0.4rem;
    top: calc(var(--y) * 1%);
    transform: translateY(calc(-100% - 0.35rem));
    font-family: var(--font-display);
    font-size: 0.8rem;
    letter-spacing: 0.1em;
    line-height: 1.15;
    text-transform: uppercase;
    color: var(--ink-3);
    text-shadow: var(--text-halo);
  }
  .today-tag {
    position: absolute;
    right: 0.4rem;
    top: calc(var(--y) * 1%);
    transform: translateY(-50%);
    padding: 0.15rem 0.45rem;
    border-radius: 0.35rem;
    font-family: var(--font-display);
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    line-height: 1.1;
    text-align: right;
    text-transform: uppercase;
    color: var(--on-today);
    background: var(--today);
    box-shadow: 0 0 14px color-mix(in oklab, var(--today) 55%, transparent);
    z-index: 2;
    transition: top 0.25s ease-out;
  }
  .today-tag strong {
    font-size: 0.85rem;
    white-space: nowrap;
  }

  .card {
    --c-soft: color-mix(in oklab, var(--c) 55%, transparent);
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 0;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: color-mix(in oklab, var(--c) 4%, color-mix(in oklab, var(--bg) 45%, transparent));
    color: var(--ink);
    text-align: left;
    cursor: pointer;
    transition:
      border-color 0.2s,
      background 0.2s,
      transform 0.2s;
  }
  .card:hover,
  .card:focus-visible {
    border-color: var(--c-soft);
    background: color-mix(in oklab, var(--c) 10%, color-mix(in oklab, var(--bg) 45%, transparent));
  }
  .card:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 3px;
  }
  .card-head {
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-rows: auto auto auto 1fr;
    align-items: center;
    gap: 0.35rem 0.5rem;
    height: var(--head-h);
    padding: 0.75rem 0.75rem 0.6rem;
    border-bottom: 1px solid var(--rule);
  }
  .sigil {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    color: color-mix(in oklab, var(--c) 75%, var(--ink));
    border: 1px solid color-mix(in oklab, var(--c) 45%, transparent);
    transform: rotate(45deg);
    border-radius: 4px;
  }
  .sigil :global(svg) {
    transform: rotate(-45deg);
  }
  .name {
    min-width: 0;
    font-family: var(--font-display);
    font-size: 1.2rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .count {
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 600;
  }
  .card-head .sk-bar {
    grid-column: 1 / -1;
    height: 8px;
  }
  .tagline {
    grid-column: 1 / -1;
    align-self: start;
    font-size: 0.8rem;
    line-height: 1.3;
    color: var(--ink-3);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .ready {
    grid-column: 1 / -1;
    justify-self: start;
    align-self: end;
    padding: 0 0.45rem;
    border-radius: 999px;
    font-family: var(--font-display);
    font-size: 0.8rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink);
    background: color-mix(in oklab, var(--c) 28%, transparent);
  }
  .ready.none {
    visibility: hidden;
  }

  .card .field {
    overflow: hidden;
    border-radius: 0 0 var(--radius) var(--radius);
  }
  .band-line {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(var(--y) * 1%);
    height: 1px;
    background: var(--rule);
  }
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  line {
    stroke: var(--line-dim);
    stroke-width: 1;
    stroke-linecap: round;
  }
  line.lit {
    stroke: color-mix(in oklab, var(--c) 70%, var(--ink));
    stroke-width: 1.5;
  }
  /* Each skill's age window, rising from its star. */
  line.range {
    stroke: color-mix(in oklab, var(--c) 22%, transparent);
    stroke-width: 6;
  }

  .dot {
    --d: 8px;
    position: absolute;
    left: calc(var(--x) * 1%);
    top: calc(var(--y) * 1%);
    width: var(--d);
    height: var(--d);
    transform: translate(-50%, -50%);
    border-radius: 999px;
    background: var(--locked);
    opacity: 0.55;
    transition:
      background 0.5s,
      opacity 0.5s,
      box-shadow 0.5s;
  }
  .dot.tier-major {
    --d: 11px;
  }
  .dot.tier-keystone {
    --d: 11px;
    border-radius: 2px;
    transform: translate(-50%, -50%) rotate(45deg);
  }
  .dot.st-upcoming,
  .dot.st-waiting {
    background: color-mix(in oklab, var(--c) 35%, var(--locked));
    opacity: 0.8;
  }
  .dot.st-ready {
    background: var(--c);
    opacity: 1;
    box-shadow:
      0 0 0 3px color-mix(in oklab, var(--c) 30%, transparent),
      0 0 12px var(--c);
    animation: pulse 2.2s ease-in-out infinite;
  }
  .dot.st-unlocked {
    background: color-mix(in oklab, var(--c) 35%, var(--star-core));
    opacity: 1;
    box-shadow:
      0 0 0 2px color-mix(in oklab, var(--c) 55%, transparent),
      0 0 14px var(--c);
  }
  .dot.st-unlocked.skipped {
    background: transparent;
    box-shadow: inset 0 0 0 1.5px var(--c);
  }

  .today {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(var(--y) * 1%);
    height: 2px;
    margin-top: -1px;
    background: var(--today);
    box-shadow: 0 0 10px var(--today);
    transition: top 0.25s ease-out;
    z-index: 1;
  }

  .open {
    position: absolute;
    left: 50%;
    bottom: 0.75rem;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.65rem;
    border-radius: 999px;
    transform: translate(-50%, 0.4rem);
    opacity: 0;
    white-space: nowrap;
    font-family: var(--font-display);
    font-size: 0.85rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink);
    background: color-mix(in oklab, var(--c) 30%, var(--panel-solid));
    transition:
      opacity 0.2s,
      transform 0.2s;
    z-index: 2;
  }
  .card:hover .open,
  .card:focus-visible .open {
    opacity: 1;
    transform: translate(-50%, 0);
  }

  @keyframes pulse {
    50% {
      box-shadow:
        0 0 0 5px color-mix(in oklab, var(--c) 18%, transparent),
        0 0 16px var(--c);
    }
  }

  @media (max-width: 1023px) {
    .overview {
      --rail: 3.5rem;
    }
    .grid {
      gap: 0 0.35rem;
    }
    .tagline,
    .open {
      display: none;
    }
    .overview {
      --head-h: 5.4rem;
    }
    .card-head {
      grid-template-rows: auto auto 1fr;
    }
  }
  @media (max-width: 640px) {
    .overview {
      --rail: 2.9rem;
      --head-h: 4.6rem;
      --field-h: clamp(20rem, calc(100dvh - var(--hud-h) - var(--head-h) - 10rem), 40rem);
      padding-top: 1rem;
    }
    .intro {
      margin-left: 0;
    }
    .intro h2 {
      font-size: 1.35rem;
    }
    .grid {
      gap: 0 0.25rem;
    }
    .card-head {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto auto;
      justify-items: center;
      gap: 0.3rem;
      padding: 0.55rem 0.2rem 0.45rem;
    }
    .name {
      display: none;
    }
    .sigil {
      width: 24px;
      height: 24px;
    }
    .count {
      font-size: 0.95rem;
    }
    .card-head .sk-bar {
      grid-column: auto;
      width: 100%;
      height: 6px;
    }
    .ready {
      grid-column: auto;
      justify-self: center;
      min-width: 1.3rem;
      padding: 0 0.3rem;
      text-align: center;
      font-size: 0.8rem;
    }
    .ready-word {
      display: none;
    }
    .band-label {
      font-size: 0.66rem;
      letter-spacing: 0.04em;
      right: 0.2rem;
    }
    .today-tag {
      right: 0.15rem;
      padding: 0.1rem 0.25rem;
      font-size: 0.6rem;
    }
    .today-tag strong {
      font-size: 0.68rem;
      white-space: normal;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .dot.st-ready {
      animation: none;
    }
    .today,
    .today-tag,
    .card {
      transition: none;
    }
  }
</style>
