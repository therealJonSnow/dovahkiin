<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import ShieldAlert from '@lucide/svelte/icons/shield-alert';
  import Package from '@lucide/svelte/icons/package';
  import Gamepad from '@lucide/svelte/icons/gamepad-2';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import { formatWeeks } from '../lib/age';
  import WindowMeter from './WindowMeter.svelte';
  import type { NodeState, StateSettings, UnlockRecord } from '../lib/state';
  import { questKey, questSurfaceWeek } from '../lib/state';
  import type { QuestType } from '../lib/schemas';
  import type { ClientBranch, ClientNode } from '../lib/types';
  import { t } from '../i18n';

  interface Related {
    id: string;
    title: string;
    color: string;
  }

  interface Interactive {
    state: NodeState;
    record: UnlockRecord | undefined;
    canEdit: boolean;
    note: string;
    today: string;
    ageWeeks: number;
    pastWindow: boolean;
    /** A baby is set up (or Explore mode is on), so there's an age to mark on the window. */
    hasAge: boolean;
    isDone: (key: string) => boolean;
    onUnlock: (date: string) => void;
    onUndo: () => void;
    onSetDate: (date: string) => void;
    onToggleQuest: (key: string, done: boolean) => void;
    onSelect: (id: string) => void;
  }

  interface Props {
    node: ClientNode;
    branch: ClientBranch;
    prereqs: Related[];
    unlocks: Related[];
    settings: StateSettings & { disclaimer: string; pastWindowNote: string };
    headingId?: string;
    /** Static pages already carry the disclaimer in the site footer. */
    showDisclaimer?: boolean;
    /** Present in the app; absent on static pages. */
    live?: Interactive;
  }

  let { node, branch, prereqs, unlocks, settings, headingId = 'detail-title', showDisclaimer = true, live }: Props = $props();

  let date = $state('');
  let showDate = $state(false);
  $effect(() => {
    if (live && !date) date = live.today;
  });

  const groups: { type: QuestType; Icon: typeof Package }[] = [
    { type: 'safety', Icon: ShieldAlert },
    { type: 'prepare', Icon: Package },
    { type: 'play', Icon: Gamepad },
  ];
  const quests = $derived(
    groups
      .map((g) => ({ ...g, items: node.quests.filter((q) => q.type === g.type) }))
      .filter((g) => g.items.length),
  );

  const stateLabel = $derived(
    live ? (live.record?.skipped ? t('stateLabel.skipped') : t(`stateLabel.${live.state}`)) : null,
  );

  // Where today sits relative to the window, said gently.
  const windowNote = $derived.by(() => {
    if (!live?.hasAge || live.record) return t('window.note');
    if (live.ageWeeks < node.ageWeeksMin) return t('window.before');
    if (live.ageWeeks <= node.ageWeeksMax) return t('window.inside');
    return (live.pastWindow && settings.pastWindowNote) || t('window.after');
  });

  function formatDate(iso: string) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
</script>

<article class="detail" style="--c: {branch.color}">
  <header>
    <p class="eyebrow">
      <span class="branch">{branch.name}</span>
      <span class="tier tier-{node.tier}">{t(`tier.${node.tier}`)}</span>
    </p>
    <h2 id={headingId} tabindex="-1">{node.title}</h2>
    {#if node.gameText}
      <p class="game">{node.gameText}</p>
    {/if}
  </header>

  <WindowMeter min={node.ageWeeksMin} max={node.ageWeeksMax} ageWeeks={live?.hasAge ? live.ageWeeks : undefined} note={windowNote} />

  {#if live}
    <section class="status st-{live.state}" aria-label="Status">
      <p class="state-line">
        <span class="chip">{stateLabel}</span>
        {#if live.record && !live.record.skipped && live.record.date}
          <span class="muted">{t('detail.unlockedOn', { date: formatDate(live.record.date) })}</span>
        {/if}
      </p>
      {#if live.canEdit}
        {#if live.record}
          <div class="actions">
            {#if !live.record.skipped}
              <label class="date-edit">
                <span class="sr-only">{t('detail.date')}</span>
                <input
                  type="date"
                  value={live.record.date}
                  max={live.today}
                  onchange={(e) => e.currentTarget.value && live.onSetDate(e.currentTarget.value)}
                />
              </label>
            {/if}
            <button type="button" class="btn btn-sm" onclick={live.onUndo}>{t('detail.undo')}</button>
          </div>
        {:else}
          <div class="actions">
            <button type="button" class="btn btn-primary" onclick={() => live.onUnlock(date || live.today)}>
              <Check size={18} aria-hidden="true" />
              {t('detail.markUnlocked')}
            </button>
            {#if showDate}
              <label class="date-edit">
                <span class="sr-only">{t('detail.date')}</span>
                <input type="date" bind:value={date} max={live.today} />
              </label>
            {:else}
              <button type="button" class="link-btn" onclick={() => (showDate = true)}>{t('detail.differentDay')}</button>
            {/if}
          </div>
        {/if}
      {:else if live.note}
        <p class="muted small">{live.note}</p>
      {/if}
    </section>
  {/if}

  <!-- Trusted: rendered from repository markdown at build time. -->
  <div class="desc">{@html node.html}</div>

  {#if node.fact}
    <aside class="fact">
      <Lightbulb size={16} aria-hidden="true" />
      <p><span class="sr-only">{t('detail.fact')}: </span>{node.fact}</p>
    </aside>
  {/if}

  {#if quests.length}
    <section class="quests" aria-labelledby="{headingId}-quests">
      <h3 id="{headingId}-quests">{t('detail.quests')}</h3>
      {#each quests as g (g.type)}
        <div class="quest-group q-{g.type}">
          <h4><g.Icon size={15} aria-hidden="true" /> {t(`detail.quest.${g.type}`)}</h4>
          <ul>
            {#each g.items as q (q.id)}
              {@const key = questKey(node.id, q.id)}
              {@const surface = questSurfaceWeek(node, q, settings)}
              <li>
                {#if live?.canEdit}
                  <label class="quest">
                    <input
                      type="checkbox"
                      checked={live.isDone(key)}
                      onchange={(e) => live.onToggleQuest(key, e.currentTarget.checked)}
                    />
                    <span>
                      <strong>{q.title}</strong>
                      {#if q.body}<span class="qbody">{q.body}</span>{/if}
                      {#if q.type !== 'play' && live.ageWeeks < surface}
                        <span class="surf">{t('detail.questSurfaces', { age: formatWeeks(Math.max(0, surface)) })}</span>
                      {/if}
                    </span>
                  </label>
                {:else}
                  <div class="quest">
                    <span class="bullet" aria-hidden="true"></span>
                    <span>
                      <strong>{q.title}</strong>
                      {#if q.body}<span class="qbody">{q.body}</span>{/if}
                    </span>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </section>
  {/if}

  {#if prereqs.length || unlocks.length}
    <section class="path">
      {#each [{ key: 'detail.after' as const, list: prereqs }, { key: 'detail.unlocks' as const, list: unlocks }] as row (row.key)}
        {#if row.list.length}
          <div class="path-row">
            <h3>{t(row.key)}</h3>
            <ul class="related">
              {#each row.list as r (r.id)}
                <li style="--c: {r.color}">
                  {#if live}
                    <button type="button" onclick={() => live.onSelect(r.id)}>{r.title}</button>
                  {:else}
                    <a href="/skills/{r.id}">{r.title}</a>
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      {/each}
    </section>
  {/if}

  <footer>
    {#if node.sources.length}
      <p class="sources">
        <span class="sources-label">{t('detail.sources')}</span>
        {#each node.sources as s, i (s.url)}
          {#if i > 0}<span aria-hidden="true"> · </span>{/if}
          <a href={s.url} target="_blank" rel="noopener noreferrer">
            {s.label}<ExternalLink size={11} aria-hidden="true" /><span class="sr-only">{t('detail.newTab')}</span>
          </a>
        {/each}
      </p>
    {/if}
    {#if showDisclaimer}
      <p class="disclaimer">{settings.disclaimer}</p>
    {/if}
  </footer>
</article>

<style>
  .detail {
    display: flex;
    flex-direction: column;
    gap: 1.35rem;
  }
  header h2 {
    font-size: clamp(1.9rem, 5vw, 2.4rem);
    color: var(--ink);
    margin: 0.2rem 0 0;
  }
  header h2:focus {
    outline: none;
  }
  .eyebrow {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    margin: 0;
  }
  .branch {
    color: color-mix(in oklab, var(--c) 65%, var(--ink));
  }
  .tier {
    padding: 0 0.45rem;
    border: 1px solid var(--panel-border);
    border-radius: 3px;
  }
  .tier-keystone {
    border-color: var(--gold-2);
    color: var(--gold);
  }
  /* Flavour text: a quiet line under the title rather than a box. */
  .game {
    margin: 0.35rem 0 0;
    color: var(--gold);
    font-style: italic;
    font-size: 0.95rem;
    line-height: 1.45;
  }
  .status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem 1rem;
    padding: 0.75rem 0;
    border-block: 1px solid var(--rule);
  }
  .state-line {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin: 0;
  }
  .chip {
    font-family: var(--font-display);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 0.9rem;
    padding: 0.1rem 0.6rem;
    border-radius: 999px;
    border: 1px solid var(--panel-border);
  }
  .st-ready .chip,
  .st-unlocked .chip {
    border-color: var(--c);
    background: color-mix(in oklab, var(--c) 18%, transparent);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: center;
  }
  .date-edit input {
    width: auto;
    min-height: 36px;
  }
  .link-btn {
    background: none;
    border: 0;
    padding: 0.5rem 0.25rem;
    color: var(--gold);
    text-decoration: underline;
    text-underline-offset: 0.18em;
    cursor: pointer;
  }
  .muted {
    color: var(--ink-3);
  }
  .small {
    font-size: 0.9rem;
    margin: 0;
    flex-basis: 100%;
  }
  .desc {
    color: var(--ink-2);
  }
  .desc :global(p:last-child) {
    margin-bottom: 0;
  }
  .fact {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
    margin-top: -0.35rem;
    color: var(--ink-2);
    font-size: 0.95rem;
  }
  .fact :global(svg) {
    flex: none;
    margin-top: 0.2rem;
    color: var(--gold);
  }
  .fact p {
    margin: 0;
  }
  h3 {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 1.05rem;
    letter-spacing: 0.12em;
    color: var(--ink-3);
    margin: 0 0 0.5rem;
  }

  /* Quests: plain lists split by thin rules, no card per item. */
  .quests {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .quests > h3 {
    margin-bottom: -0.2rem;
  }
  .quest-group h4 {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.9rem;
    letter-spacing: 0.12em;
    margin: 0 0 0.15rem;
    color: var(--ink-2);
  }
  .q-safety {
    padding: 0.6rem 0.85rem 0.25rem;
    border-radius: var(--radius);
    background: color-mix(in oklab, var(--danger) 8%, transparent);
    border-left: 2px solid color-mix(in oklab, var(--danger) 60%, transparent);
  }
  .q-safety h4 {
    color: var(--danger);
  }
  .quest-group ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .quest-group li + li {
    border-top: 1px solid var(--rule);
  }
  .quest {
    display: flex;
    gap: 0.65rem;
    align-items: flex-start;
    padding: 0.55rem 0;
    cursor: pointer;
  }
  div.quest {
    cursor: default;
  }
  .quest input {
    margin-top: 0.2rem;
  }
  .quest strong {
    display: block;
    color: var(--ink);
    font-weight: 600;
  }
  .qbody {
    display: block;
    color: var(--ink-2);
    font-size: 0.92rem;
  }
  .surf {
    display: block;
    margin-top: 0.15rem;
    font-size: 0.8rem;
    color: var(--ink-3);
  }
  .bullet {
    width: 7px;
    height: 7px;
    margin: 0.5rem 0.2rem 0;
    flex: none;
    transform: rotate(45deg);
    background: var(--c);
  }

  .path {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .path-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.75rem;
  }
  .path-row h3 {
    margin: 0;
    min-width: 7.5rem;
    font-size: 0.95rem;
  }
  .related {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .related button,
  .related a {
    display: inline-flex;
    align-items: center;
    min-height: 36px;
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    border: 1px solid color-mix(in oklab, var(--c) 50%, transparent);
    background: color-mix(in oklab, var(--c) 10%, transparent);
    color: var(--ink);
    font-size: 0.9rem;
    text-decoration: none;
    cursor: pointer;
  }

  footer {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    border-top: 1px solid var(--rule);
    padding-top: 0.85rem;
    font-size: 0.82rem;
    color: var(--ink-3);
  }
  footer p {
    margin: 0;
  }
  .sources-label {
    margin-right: 0.5rem;
    font-family: var(--font-display);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .sources a {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    min-height: 24px;
  }
</style>
