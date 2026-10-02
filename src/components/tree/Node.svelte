<script lang="ts">
  import Lock from '@lucide/svelte/icons/lock';
  import Check from '@lucide/svelte/icons/check';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Hourglass from '@lucide/svelte/icons/hourglass';
  import Clock from '@lucide/svelte/icons/clock';
  import SkipForward from '@lucide/svelte/icons/skip-forward';
  import { formatWindow } from '../../lib/age';
  import type { LayoutNode } from '../../lib/layout';
  import type { NodeState } from '../../lib/state';
  import type { ClientBranch, ClientNode } from '../../lib/types';
  import { t } from '../../i18n';

  interface Props {
    node: ClientNode;
    pos: LayoutNode;
    cols: number;
    branch: ClientBranch;
    nodeState: NodeState;
    skipped: boolean;
    pastWindow: boolean;
    selected: boolean;
    tabbable: boolean;
    animate: boolean;
    onactivate: (id: string, el: HTMLElement) => void;
    onhover: (id: string | null) => void;
    onfocusnode: (id: string | null, keyboard: boolean) => void;
  }

  let {
    node,
    pos,
    cols,
    branch,
    nodeState,
    skipped,
    pastWindow,
    selected,
    tabbable,
    animate,
    onactivate,
    onhover,
    onfocusnode,
  }: Props = $props();

  let justLit = $state(false);
  let prev: NodeState | null = null;
  $effect(() => {
    const s = nodeState;
    if (animate && prev && prev !== 'unlocked' && s === 'unlocked') {
      justLit = true;
      const timer = setTimeout(() => (justLit = false), 900);
      prev = s;
      return () => clearTimeout(timer);
    }
    prev = s;
  });

  const stateText = $derived(skipped ? t('state.skipped') : t(`state.${nodeState}`));
  const aria = $derived(
    t('node.aria', {
      label: node.label,
      branch: branch.name,
      state: stateText,
      window: formatWindow(node.ageWeeksMin, node.ageWeeksMax),
    }),
  );
  const Glyph = $derived(
    skipped
      ? SkipForward
      : { unlocked: Check, ready: Sparkles, waiting: Hourglass, upcoming: Clock, locked: Lock }[nodeState],
  );
</script>

<button
  type="button"
  id="node-{node.id}"
  data-id={node.id}
  class="node tier-{node.tier} st-{nodeState}"
  class:skipped
  class:selected
  class:just-lit={justLit}
  class:past={pastWindow}
  style="--c: {branch.color}; --x: {(pos.col + pos.x) / cols}; --y: {pos.y};"
  tabindex={tabbable ? 0 : -1}
  aria-label={aria}
  aria-haspopup="dialog"
  onclick={(e) => onactivate(node.id, e.currentTarget)}
  onpointerenter={(e) => e.pointerType === 'mouse' && onhover(node.id)}
  onpointerleave={(e) => e.pointerType === 'mouse' && onhover(null)}
  onfocus={(e) => onfocusnode(node.id, e.currentTarget.matches(':focus-visible'))}
  onblur={() => onfocusnode(null, false)}
>
  <span class="star" aria-hidden="true">
    <span class="halo"></span>
    <span class="ring"></span>
    <span class="core"></span>
  </span>
  <span class="label" aria-hidden="true">
    <span class="glyph"><Glyph size={11} strokeWidth={2.5} /></span>
    <span class="text">{node.label}</span>
  </span>
</button>

<style>
  .node {
    --s-size: 14px;
    --c-soft: color-mix(in oklab, var(--c) 55%, transparent);
    --c-faint: color-mix(in oklab, var(--c) 22%, transparent);
    position: absolute;
    left: calc(var(--x) * 100%);
    top: calc(var(--y) * var(--s, 1) * 1px);
    transform: translate(-50%, -22px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    /* Labels can't be wider than ~62% of a column so zig-zagged neighbours never collide. */
    width: min(9.5rem, calc(100% / var(--cols, 6) * 0.64));
    min-width: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    cursor: pointer;
    z-index: 2;
    -webkit-tap-highlight-color: transparent;
  }
  .node:focus-visible {
    outline: none;
  }
  .node:focus-visible .star::after {
    content: '';
    position: absolute;
    inset: -6px;
    border-radius: 999px;
    outline: 2px solid var(--focus);
    outline-offset: 0;
  }
  .tier-major {
    --s-size: 20px;
  }
  .tier-keystone {
    --s-size: 24px;
  }

  .star {
    position: relative;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    flex: none;
  }
  .star > span {
    position: absolute;
    border-radius: 999px;
    transition:
      background 0.5s ease,
      box-shadow 0.5s ease,
      border-color 0.5s ease,
      opacity 0.5s ease,
      transform 0.4s ease;
  }
  .core {
    width: var(--s-size);
    height: var(--s-size);
    background: var(--locked);
    opacity: 0.55;
  }
  .ring {
    width: calc(var(--s-size) + 12px);
    height: calc(var(--s-size) + 12px);
    border: 1.5px solid transparent;
  }
  .halo {
    width: calc(var(--s-size) * 3);
    height: calc(var(--s-size) * 3);
    background: radial-gradient(circle, var(--c-soft), transparent 65%);
    opacity: 0;
  }
  .tier-keystone .core,
  .tier-keystone .ring {
    border-radius: 3px;
    transform: rotate(45deg);
  }
  .tier-keystone .core {
    width: calc(var(--s-size) * 0.8);
    height: calc(var(--s-size) * 0.8);
    background: linear-gradient(135deg, color-mix(in oklab, var(--locked) 60%, white), var(--locked));
  }
  .tier-keystone .ring {
    width: calc(var(--s-size) + 6px);
    height: calc(var(--s-size) + 6px);
  }

  /* upcoming / waiting: faint outline in branch colour */
  .st-upcoming .core,
  .st-waiting .core {
    background: color-mix(in oklab, var(--c) 30%, var(--locked));
    opacity: 0.7;
  }
  .st-upcoming .ring,
  .st-waiting .ring {
    border: 1.5px dashed var(--c-soft);
  }

  /* ready: branch-coloured star with a pulsing ring */
  .st-ready .core {
    background: radial-gradient(circle at 40% 35%, color-mix(in oklab, var(--c) 40%, white), var(--c));
    opacity: 1;
    box-shadow: 0 0 10px var(--c-soft);
  }
  .tier-keystone.st-ready .core {
    background: linear-gradient(135deg, color-mix(in oklab, var(--c) 35%, white), var(--c));
  }
  .st-ready .ring {
    border: 2px solid var(--c);
    animation: pulse 2.4s ease-in-out infinite;
  }
  .st-ready .halo {
    opacity: 0.5;
  }

  /* unlocked: white-hot core, glowing in branch colour */
  .st-unlocked .core {
    background: radial-gradient(circle, var(--star-core) 0 35%, color-mix(in oklab, var(--c) 50%, white) 60%, var(--c));
    opacity: 1;
    box-shadow:
      0 0 8px 1px var(--c),
      0 0 24px 4px var(--c-soft);
  }
  .tier-keystone.st-unlocked .core {
    background: linear-gradient(135deg, var(--star-core), color-mix(in oklab, var(--c) 60%, white) 50%, var(--c));
  }
  .st-unlocked .ring {
    border: 1px solid var(--c-soft);
  }
  .st-unlocked .halo {
    opacity: 1;
  }
  .skipped .core {
    background: transparent;
    box-shadow: none;
    border: 2px solid var(--c);
  }
  .skipped .halo {
    opacity: 0.35;
  }

  .selected .ring {
    border: 2px solid var(--focus);
    animation: none;
  }

  .just-lit .core {
    animation: pop 0.7s cubic-bezier(0.2, 1.6, 0.4, 1);
  }
  .tier-keystone.just-lit .core {
    animation-name: pop-diamond;
  }
  .just-lit .halo {
    animation: flare 0.9s ease-out;
  }

  .label {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 3px;
    max-width: 100%;
    font-family: var(--font-display);
    font-size: 0.95rem;
    font-weight: 500;
    letter-spacing: 0.05em;
    line-height: 1.1;
    text-transform: uppercase;
    text-align: center;
    text-shadow: var(--text-halo);
    color: var(--ink-2);
  }
  .glyph {
    display: inline-flex;
    margin-top: 2px;
    color: var(--ink-3);
  }
  .st-locked .label {
    color: var(--ink-3);
  }
  .st-ready .label,
  .st-unlocked .label {
    color: var(--ink);
  }
  .st-ready .glyph,
  .st-unlocked .glyph {
    color: color-mix(in oklab, var(--c) 70%, var(--ink));
  }
  .node:hover .label,
  .selected .label {
    color: var(--ink);
  }

  /* Compact overview (phones, all branches): icon-only stars. */
  @media (max-width: 640px) {
    :global(.tree.multi) .label {
      display: none;
    }
    :global(.tree.multi) .node {
      transform: translate(-50%, -22px);
      width: 44px;
    }
  }

  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
      opacity: 0.9;
    }
    50% {
      transform: scale(1.18);
      opacity: 0.35;
    }
  }
  @keyframes pop {
    0% {
      transform: scale(0.4);
    }
    60% {
      transform: scale(1.5);
    }
    100% {
      transform: scale(1);
    }
  }
  @keyframes pop-diamond {
    0% {
      transform: rotate(45deg) scale(0.4);
    }
    60% {
      transform: rotate(45deg) scale(1.5);
    }
    100% {
      transform: rotate(45deg) scale(1);
    }
  }
  @keyframes flare {
    0% {
      transform: scale(0.5);
      opacity: 1;
    }
    100% {
      transform: scale(1.6);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .star > span {
      transition: opacity 0.3s ease;
    }
    .st-ready .ring,
    .just-lit .core,
    .just-lit .halo {
      animation: none;
    }
  }
</style>
