<script lang="ts">
  import { useApp } from '../../lib/app.svelte';
  import { ageToY, type Layout } from '../../lib/layout';
  import { isPastWindow } from '../../lib/state';
  import { iconFor } from '../../lib/icons';
  import { formatWindow } from '../../lib/age';
  import { t } from '../../i18n';
  import Node from './Node.svelte';
  import Connectors from './Connectors.svelte';
  import HoverCard from './HoverCard.svelte';

  interface Props {
    layout: Layout;
    onactivate: (id: string, el: HTMLElement) => void;
  }

  let { layout, onactivate }: Props = $props();
  const app = useApp();

  const cols = $derived(layout.columns.length);
  const branches = $derived(layout.columns.map((id) => app.branchById.get(id)!));
  const visible = $derived(app.nodes.filter((n) => n.id in layout.nodes));
  const colors = $derived(Object.fromEntries(app.data.branches.map((b) => [b.id, b.color])));
  const branchOf = $derived(Object.fromEntries(app.nodes.map((n) => [n.id, n.branch])));

  let hoverId = $state<string | null>(null);
  let focusId = $state<string | null>(null);
  let focusKeyboard = $state(false);
  let activeId = $state<string | null>(null);

  // Roving tabindex: one node in the tree is tabbable.
  const defaultActive = $derived.by(() => {
    const ready = visible
      .filter((n) => app.states[n.id] === 'ready')
      .sort((a, b) => layout.nodes[a.id]!.y - layout.nodes[b.id]!.y)[0];
    return ready?.id ?? visible[0]?.id ?? null;
  });
  const tabbableId = $derived(activeId && activeId in layout.nodes ? activeId : defaultActive);

  const cardId = $derived(app.selectedId ? null : (hoverId ?? (focusKeyboard ? focusId : null)));
  const barId = $derived(hoverId ?? focusId ?? app.selectedId);
  const barNode = $derived(barId && barId in layout.nodes ? app.byId.get(barId) : undefined);

  const todayY = $derived(ageToY(layout, app.ageWeeks));
  const todayText = $derived.by(() => {
    if (app.isExplore) return t('today.exploring', { age: app.ageLabel });
    if (app.age?.beyondTree) return t('today.complete', { age: app.ageLabel });
    const base = t('today.label', { age: app.ageLabel });
    return app.age?.corrected ? `${base} (${t('today.corrected')})` : base;
  });

  const counts = $derived(
    Object.fromEntries(
      layout.columns.map((c) => {
        const inBranch = app.nodes.filter((n) => n.branch === c);
        return [c, { done: inBranch.filter((n) => n.id in app.unlocked).length, total: inBranch.length }];
      }),
    ),
  );

  const byColumn = $derived.by(() => {
    const out: string[][] = layout.columns.map(() => []);
    for (const n of visible) out[layout.nodes[n.id]!.col]!.push(n.id);
    for (const list of out) list.sort((a, b) => layout.nodes[a]!.y - layout.nodes[b]!.y);
    return out;
  });

  function focusNode(id: string | undefined) {
    if (!id) return;
    activeId = id;
    document.getElementById(`node-${id}`)?.focus();
  }

  function onkeydown(e: KeyboardEvent) {
    const id = (e.target as HTMLElement).closest<HTMLElement>('[data-id]')?.dataset.id;
    if (!id) return;
    const pos = layout.nodes[id]!;
    const column = byColumn[pos.col]!;
    const i = column.indexOf(id);
    const nearestIn = (col: number) => {
      const list = byColumn[col] ?? [];
      let best: string | undefined;
      let bestD = Infinity;
      for (const other of list) {
        const d = Math.abs(layout.nodes[other]!.y - pos.y);
        if (d < bestD) {
          bestD = d;
          best = other;
        }
      }
      return best;
    };
    const step = (dir: 1 | -1) => {
      for (let c = pos.col + dir; c >= 0 && c < cols; c += dir) {
        const found = nearestIn(c);
        if (found) return found;
      }
      return undefined;
    };
    let next: string | undefined;
    switch (e.key) {
      case 'ArrowDown':
        next = column[i + 1];
        break;
      case 'ArrowUp':
        next = column[i - 1];
        break;
      case 'ArrowRight':
        next = step(1);
        break;
      case 'ArrowLeft':
        next = step(-1);
        break;
      case 'Home':
        next = column[0];
        break;
      case 'End':
        next = column[column.length - 1];
        break;
      default:
        return;
    }
    e.preventDefault();
    focusNode(next);
  }

  function onfocusnode(id: string | null, keyboard: boolean) {
    focusId = id;
    focusKeyboard = keyboard;
    if (id) activeId = id;
  }
</script>

<div class="tree" class:multi={cols > 1} style="--cols: {cols}; --h: {layout.height};">
  <div class="head">
    <div class="rail-spacer"></div>
    <div class="head-cols">
      {#each branches as b (b.id)}
        {@const Icon = iconFor(b.icon)}
        {@const c = counts[b.id]!}
        <div class="col-head" style="--c: {b.color}">
          <span class="sigil" aria-hidden="true"><Icon size={18} strokeWidth={1.75} /></span>
          <span class="col-name">{b.name.replace(/^The\s+/i, '')}</span>
          <span class="col-count" aria-label={t('branch.count', c)}>{c.done}<span aria-hidden="true">/</span>{c.total}</span>
          <span class="sk-bar" style="--p: {c.total ? c.done / c.total : 0}" aria-hidden="true"></span>
        </div>
      {/each}
    </div>
  </div>

  <div class="body">
    <div class="rail" aria-hidden="true">
      {#each layout.bands as b (b.id)}
        <div class="band-label" style="--y: {b.y}">{b.label}</div>
      {/each}
    </div>

    <!-- Arrow keys are delegated from the node buttons inside this group. -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="canvas" role="group" aria-label={t('app.tagline')} aria-describedby="tree-help" {onkeydown}>
      <p id="tree-help" class="sr-only">{t('tree.help')}</p>
      {#each layout.bands as b, i (b.id)}
        {#if i > 0}<div class="band-line" style="--y: {b.y}"></div>{/if}
      {/each}
      {#each branches as b, i (b.id)}
        {@const Icon = iconFor(b.icon)}
        <div class="col-sigil" style="--c: {b.color}; --i: {i}" aria-hidden="true"><Icon size={120} strokeWidth={0.6} /></div>
      {/each}

      <Connectors {layout} states={app.states} unlocked={app.unlocked} {colors} {branchOf} highlight={barId} />

      {#if barNode}
        {@const p = layout.nodes[barNode.id]!}
        {@const y1 = ageToY(layout, barNode.ageWeeksMin)}
        {@const y2 = ageToY(layout, barNode.ageWeeksMax)}
        <div
          class="window-bar"
          style="--c: {colors[barNode.branch]}; --x: {(p.col + p.x) / cols}; --y1: {y1}; --y2: {y2};"
          aria-hidden="true"
        >
          <span>{formatWindow(barNode.ageWeeksMin, barNode.ageWeeksMax)}</span>
        </div>
      {/if}

      <div class="today" class:explore={app.isExplore} style="--y: {todayY}" data-today>
        <span class="today-chip">{todayText}</span>
      </div>

      {#each visible as node (node.id)}
        <Node
          {node}
          pos={layout.nodes[node.id]!}
          {cols}
          branch={app.branchById.get(node.branch)!}
          nodeState={app.states[node.id]!}
          skipped={!!app.unlocked[node.id]?.skipped}
          pastWindow={!app.isExplore && isPastWindow(node, app.ageWeeks, app.unlocked)}
          selected={app.selectedId === node.id}
          tabbable={tabbableId === node.id}
          animate={app.hydrated}
          {onactivate}
          onhover={(id) => (hoverId = id)}
          {onfocusnode}
        />
      {/each}

      {#if cardId && layout.nodes[cardId]}
        {@const n = app.byId.get(cardId)!}
        <HoverCard
          node={n}
          branch={app.branchById.get(n.branch)!}
          pos={layout.nodes[cardId]!}
          {cols}
          nodeState={app.states[cardId]!}
          skipped={!!app.unlocked[cardId]?.skipped}
          pastWindow={!app.isExplore && isPastWindow(n, app.ageWeeks, app.unlocked)}
          pastNote={app.data.settings.pastWindowNote}
        />
      {/if}
    </div>
  </div>
</div>

<style>
  .tree {
    --s: 1;
    --rail: 4.75rem;
    position: relative;
  }
  .head {
    position: sticky;
    top: var(--sticky-top, var(--hud-h));
    z-index: 15;
    display: grid;
    grid-template-columns: var(--rail) 1fr;
    padding: 0.6rem 0 0.5rem;
    background: linear-gradient(180deg, var(--bg) 0%, color-mix(in oklab, var(--bg) 85%, transparent) 75%, transparent);
  }
  .head-cols {
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
  }
  .col-head {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.15rem 0.4rem;
    padding: 0 0.5rem;
    min-width: 0;
  }
  .sigil {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    color: color-mix(in oklab, var(--c) 75%, var(--ink));
    border: 1px solid color-mix(in oklab, var(--c) 45%, transparent);
    transform: rotate(45deg);
    border-radius: 4px;
  }
  .sigil :global(svg) {
    transform: rotate(-45deg);
  }
  .col-name {
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: var(--text-halo);
  }
  .col-count {
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--ink);
    text-shadow: var(--text-halo);
  }
  .col-head .sk-bar {
    grid-column: 1 / -1;
    height: 8px;
  }

  .body {
    display: grid;
    grid-template-columns: var(--rail) 1fr;
  }
  .rail {
    position: relative;
  }
  .band-label {
    position: absolute;
    top: calc(var(--y) * var(--s) * 1px + 0.5rem);
    left: 0;
    right: 0.5rem;
    font-family: var(--font-display);
    font-size: 0.85rem;
    letter-spacing: 0.12em;
    line-height: 1.15;
    text-transform: uppercase;
    color: var(--ink-3);
    text-shadow: var(--text-halo);
  }
  .canvas {
    position: relative;
    height: calc(var(--h) * var(--s) * 1px + 2rem);
    --cols-w: calc(100% / var(--cols));
  }
  .band-line {
    position: absolute;
    left: calc(-1 * var(--rail));
    right: 0;
    top: calc(var(--y) * var(--s) * 1px);
    height: 1px;
    background: linear-gradient(90deg, var(--rule), color-mix(in oklab, var(--rule) 40%, transparent) 70%, transparent);
  }
  .col-sigil {
    position: absolute;
    top: 2.5rem;
    left: calc((var(--i) + 0.5) / var(--cols) * 100%);
    transform: translateX(-50%);
    color: var(--c);
    opacity: 0.09;
    pointer-events: none;
  }

  .window-bar {
    position: absolute;
    left: calc(var(--x) * 100% - 34px);
    top: calc(var(--y1) * var(--s) * 1px);
    height: max(4px, calc((var(--y2) - var(--y1)) * var(--s) * 1px));
    width: 4px;
    border-radius: 4px;
    background: linear-gradient(180deg, color-mix(in oklab, var(--c) 70%, transparent), color-mix(in oklab, var(--c) 15%, transparent));
    z-index: 1;
    pointer-events: none;
  }
  .window-bar span {
    position: absolute;
    bottom: -1.3rem;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    font-family: var(--font-display);
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-3);
    text-shadow: var(--text-halo);
  }

  .today {
    position: absolute;
    left: calc(-1 * var(--rail));
    right: 0;
    top: 0;
    /* transform, not top: moving the line never causes layout shift */
    transform: translateY(calc(var(--y) * var(--s) * 1px));
    height: 2px;
    z-index: 3;
    pointer-events: none;
    background: linear-gradient(90deg, transparent, var(--today) 6%, var(--today) 94%, transparent);
    box-shadow:
      0 0 10px var(--today),
      0 0 30px color-mix(in oklab, var(--today) 50%, transparent);
    transition: transform 0.25s ease-out;
  }
  .today.explore {
    opacity: 0.85;
    background: linear-gradient(90deg, transparent, var(--today) 6%, var(--today) 94%, transparent);
  }
  .today-chip {
    position: absolute;
    left: 0.25rem;
    top: -1.65rem;
    padding: 0.1rem 0.6rem;
    border-radius: 999px;
    font-family: var(--font-display);
    font-size: 0.9rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--on-today);
    background: var(--today);
    box-shadow: 0 0 16px color-mix(in oklab, var(--today) 60%, transparent);
  }

  @media (max-width: 1023px) {
    .tree {
      --rail: 3.25rem;
    }
    .band-label {
      font-size: 0.72rem;
      letter-spacing: 0.06em;
    }
    .col-name {
      font-size: 1rem;
    }
  }
  @media (max-width: 640px) {
    .tree.multi {
      --s: 0.62;
    }
    .tree.multi .col-head {
      grid-template-columns: 1fr;
      justify-items: center;
      padding: 0 0.15rem;
    }
    .tree.multi .col-name {
      display: none;
    }
    .tree.multi .col-count {
      font-size: 0.9rem;
    }
    .tree.multi .sigil {
      width: 26px;
      height: 26px;
    }
    .tree.multi .col-sigil {
      display: none;
    }
    .tree:not(.multi) .col-head {
      padding: 0 0.25rem;
    }
    .today {
      transition: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .today {
      transition: none;
    }
  }
</style>
