<script lang="ts">
  import { useApp } from '../lib/app.svelte';
  import { t } from '../i18n';

  const app = useApp();
  let layer = $state<HTMLDivElement>();
  let banner = $state<{ title: string; keystone: boolean; color: string } | null>(null);
  let announce = $state('');
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const c = app.celebration;
    if (!c || !layer) return;
    const node = app.byId.get(c.id);
    if (!node) return;
    const color = app.branchById.get(node.branch)?.color ?? '#ffd08a';
    announce = t('celebrate.announce', { title: node.title });

    // Top layer, so it shows above an open drawer.
    try {
      if (!layer.matches(':popover-open')) layer.showPopover();
    } catch {
      /* popover unsupported: falls back to fixed positioning */
    }

    banner = { title: node.title, keystone: c.keystone, color };
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      banner = null;
      try {
        layer?.hidePopover();
      } catch {
        /* ignore */
      }
    }, c.keystone ? 3800 : 2200);

    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const origin =
        (document.activeElement as HTMLElement | null)?.closest('dialog') ? document.activeElement : document.getElementById(`node-${c.id}`);
      const rect = (origin as HTMLElement | null)?.getBoundingClientRect();
      const x = rect ? rect.left + rect.width / 2 : innerWidth / 2;
      const y = rect ? rect.top + rect.height / 2 : innerHeight / 3;
      import('../lib/particles').then((m) => {
        if (!layer) return;
        m.burst(layer, x, y, color, c.keystone);
        if (c.keystone) m.burst(layer, innerWidth / 2, innerHeight * 0.3, color, true);
      });
    }
  });
</script>

<div bind:this={layer} class="layer" popover="manual" aria-hidden="true">
  {#if banner}
    {#key banner}
      <div class="banner" class:keystone={banner.keystone} style="--c: {banner.color}">
        <span class="kicker">{banner.keystone ? t('celebrate.keystone') : t('celebrate.skill')}</span>
        <span class="title">{banner.title}</span>
        <span class="rule"></span>
      </div>
    {/key}
  {/if}
</div>
<p class="sr-only" role="status" aria-live="polite">{announce}</p>

<style>
  .layer {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100dvh;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    pointer-events: none;
    overflow: hidden;
    z-index: 60;
  }
  .layer:not(:popover-open) {
    display: none;
  }
  .banner {
    position: absolute;
    left: 50%;
    top: 18%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    width: min(40rem, 92vw);
    padding: 1rem 1.5rem;
    text-align: center;
    background: radial-gradient(ellipse at center, rgb(4 6 14 / 0.85), rgb(4 6 14 / 0) 72%);
    animation: rise 0.5s ease-out both;
  }
  .kicker {
    font-family: var(--font-display);
    font-size: 1rem;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: #e9cf98;
  }
  .title {
    font-family: var(--font-display);
    font-size: clamp(2rem, 7vw, 3.5rem);
    font-weight: 500;
    line-height: 1;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #fffaf0;
    text-shadow:
      0 0 18px var(--c),
      0 2px 4px rgb(0 0 0 / 0.9);
  }
  .rule {
    width: 70%;
    height: 2px;
    margin-top: 0.4rem;
    background: linear-gradient(90deg, transparent, var(--c), #fffaf0, var(--c), transparent);
    box-shadow: 0 0 12px var(--c);
  }
  .keystone .title {
    font-size: clamp(2.6rem, 9vw, 4.75rem);
  }
  .keystone .kicker {
    font-size: 1.15rem;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translate(-50%, 1rem) scale(0.96);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .banner {
      animation: fade 0.3s ease-out both;
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
    }
  }
</style>
