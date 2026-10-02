<script lang="ts">
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import { tick } from 'svelte';
  import { useApp } from '../lib/app.svelte';
  import { formatWindow } from '../lib/age';
  import { iconFor } from '../lib/icons';
  import { t } from '../i18n';
  import LiveNodeDetail from './LiveNodeDetail.svelte';
  import UpNext from './UpNext.svelte';

  /**
   * Desktop sidebar for the focused family: what the family is about and
   * what's next in it, or the details of the skill you've opened.
   */
  const app = useApp();
  let scroller = $state<HTMLDivElement>();

  const branch = $derived(app.focus ? app.branchById.get(app.focus) : undefined);
  const node = $derived(app.selectedId ? app.byId.get(app.selectedId) : undefined);
  const Icon = $derived(branch ? iconFor(branch.icon) : undefined);
  const skills = $derived(branch ? app.nodes.filter((n) => n.branch === branch.id) : []);
  const done = $derived(skills.filter((n) => n.id in app.unlocked).length);

  // Opening a skill moves focus to its heading, like the phone sheet does.
  $effect(() => {
    const id = node?.id;
    tick().then(() => {
      scroller?.scrollTo({ top: 0 });
      if (id) document.getElementById('panel-skill-title')?.focus({ preventScroll: true });
    });
  });

  function back() {
    app.select(null);
    const el = app.returnFocus;
    app.returnFocus = null;
    if (el?.isConnected) el.focus();
  }

</script>

{#if branch && Icon}
  <aside class="panel side" style="--c: {branch.color}" aria-label={t('panel.label', { name: branch.name })}>
    <div class="scroll" bind:this={scroller}>
      {#if node}
        <div class="bar">
          <button type="button" class="btn btn-sm btn-ghost" onclick={back}>
            <ArrowLeft size={16} aria-hidden="true" />
            {t('panel.back', { name: branch.name.replace(/^The\s+/i, '') })}
          </button>
          <a class="btn btn-sm btn-ghost" href="/skills/{node.id}">
            {t('detail.fullPage')}
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
        {#key node.id}
          <div class="detail" data-detail>
            <LiveNodeDetail {node} headingId="panel-skill-title" />
          </div>
        {/key}
      {:else}
        <header class="family">
          <span class="sigil" aria-hidden="true"><Icon size={22} strokeWidth={1.6} /></span>
          <div>
            <p class="eyebrow">{t('overview.heading')}</p>
            <h2>{branch.name}</h2>
          </div>
          <p class="tagline">{branch.tagline}</p>
          <div class="progress">
            <span class="sk-bar" style="--p: {skills.length ? done / skills.length : 0}" aria-hidden="true"></span>
            <span class="count">{t('branch.count', { done, total: skills.length })}</span>
          </div>
        </header>

        {#if app.age}
          <UpNext branch={branch.id} />
        {:else}
          <section aria-labelledby="panel-skills">
            <h3 id="panel-skills">{t('panel.skills')}</h3>
            <ol class="skills">
              {#each skills as n (n.id)}
                <li>
                  <button type="button" class="skill" onclick={(e) => app.select(n.id, e.currentTarget)}>
                    <span class="gem tier-{n.tier}" aria-hidden="true"></span>
                    <span class="skill-title">{n.title}</span>
                    <span class="skill-age">{formatWindow(n.ageWeeksMin, n.ageWeeksMax)}</span>
                  </button>
                </li>
              {/each}
            </ol>
            <button type="button" class="btn btn-primary start" onclick={() => (app.onboardingOpen = true)}>
              {app.data.settings.onboarding.cta}
            </button>
            <p class="disclaimer">{app.data.settings.disclaimer}</p>
          </section>
        {/if}
      {/if}
    </div>
  </aside>
{/if}

<style>
  .side {
    position: sticky;
    top: calc(var(--hud-h) + 0.75rem);
    align-self: start;
    margin-top: 0.75rem;
    max-height: calc(100dvh - var(--hud-h) - 1.5rem);
    display: flex;
    flex-direction: column;
    border-top: 3px solid var(--c);
    overflow: hidden;
  }
  .scroll {
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 1.1rem 1.25rem 1.5rem;
  }
  .bar {
    display: flex;
    justify-content: space-between;
    gap: 0.25rem;
    margin: -0.5rem -0.6rem 0.25rem;
  }
  .family {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 0.35rem 0.9rem;
    margin-bottom: 1.4rem;
  }
  .sigil {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    margin: 0 0.15rem;
    color: color-mix(in oklab, var(--c) 75%, var(--ink));
    border: 1px solid color-mix(in oklab, var(--c) 50%, transparent);
    transform: rotate(45deg);
    border-radius: 5px;
    box-shadow: 0 0 18px color-mix(in oklab, var(--c) 30%, transparent);
  }
  .sigil :global(svg) {
    transform: rotate(-45deg);
  }
  .family .eyebrow {
    margin: 0;
    font-size: 0.75rem;
  }
  h2 {
    font-size: 1.9rem;
    line-height: 1.05;
    color: var(--ink);
  }
  .tagline {
    grid-column: 1 / -1;
    margin: 0.4rem 0 0;
    color: var(--ink-2);
  }
  .progress {
    grid-column: 1 / -1;
    display: grid;
    gap: 0.3rem;
  }
  .count {
    font-family: var(--font-display);
    font-size: 0.9rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-3);
  }
  h3 {
    font-size: 1.15rem;
    letter-spacing: 0.12em;
    color: var(--ink-2);
    margin-bottom: 0.6rem;
  }
  .skills {
    list-style: none;
    margin: 0 0 1.25rem;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .skill {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.7rem;
    width: 100%;
    min-height: 44px;
    padding: 0.4rem 0.75rem;
    text-align: left;
    border: 1px solid var(--rule);
    border-left: 3px solid var(--c);
    border-radius: 0.4rem;
    background: color-mix(in oklab, var(--bg) 35%, transparent);
    color: var(--ink);
    cursor: pointer;
  }
  .skill:hover {
    background: color-mix(in oklab, var(--c) 8%, transparent);
  }
  .gem {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: var(--c);
  }
  .gem.tier-keystone {
    border-radius: 2px;
    transform: rotate(45deg);
  }
  .skill-title {
    font-weight: 600;
  }
  .skill-age {
    font-size: 0.85rem;
    color: var(--ink-3);
    white-space: nowrap;
  }
  .start {
    width: 100%;
  }
</style>
