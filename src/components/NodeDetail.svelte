<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import ShieldAlert from '@lucide/svelte/icons/shield-alert';
  import Package from '@lucide/svelte/icons/package';
  import Gamepad from '@lucide/svelte/icons/gamepad-2';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import { formatWeeks, formatWindowSentence } from '../lib/age';
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
    /** Present in the app; absent on static pages. */
    live?: Interactive;
  }

  let { node, branch, prereqs, unlocks, settings, headingId = 'detail-title', live }: Props = $props();

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
    <h2 id={headingId}>{node.title}</h2>
    <p class="window">{formatWindowSentence(node.ageWeeksMin, node.ageWeeksMax)}</p>
  </header>

  {#if node.gameText}
    <blockquote class="game">{node.gameText}</blockquote>
  {/if}

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
              <button type="button" class="link-btn" onclick={() => (showDate = true)}>Different day?</button>
            {/if}
          </div>
        {/if}
      {:else if live.note}
        <p class="muted small">{live.note}</p>
      {/if}
      {#if live.pastWindow && settings.pastWindowNote}
        <p class="soft">{settings.pastWindowNote}</p>
      {/if}
    </section>
  {/if}

  <!-- Trusted: rendered from repository markdown at build time. -->
  <div class="desc">{@html node.html}</div>

  <section class="links-grid">
    <div>
      <h3>{t('detail.prereqs')}</h3>
      {#if prereqs.length}
        <ul class="related">
          {#each prereqs as p (p.id)}
            <li style="--c: {p.color}">
              {#if live}
                <button type="button" onclick={() => live.onSelect(p.id)}>{p.title}</button>
              {:else}
                <a href="/skills/{p.id}">{p.title}</a>
              {/if}
            </li>
          {/each}
        </ul>
      {:else}
        <p class="muted small">{t('detail.none')}</p>
      {/if}
    </div>
    {#if unlocks.length}
      <div>
        <h3>{t('detail.unlocks')}</h3>
        <ul class="related">
          {#each unlocks as u (u.id)}
            <li style="--c: {u.color}">
              {#if live}
                <button type="button" onclick={() => live.onSelect(u.id)}>{u.title}</button>
              {:else}
                <a href="/skills/{u.id}">{u.title}</a>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </section>

  {#if quests.length}
    <section class="quests">
      <h3>{t('detail.quests')}</h3>
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

  {#if node.fact}
    <aside class="fact">
      <h3><Lightbulb size={15} aria-hidden="true" /> {t('detail.fact')}</h3>
      <p>{node.fact}</p>
    </aside>
  {/if}

  {#if node.sources.length}
    <section class="sources">
      <h3>{t('detail.sources')}</h3>
      <ul>
        {#each node.sources as s (s.url)}
          <li>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.label}<ExternalLink size={12} aria-hidden="true" /><span class="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <footer>
    <p class="disclaimer">{settings.disclaimer}</p>
  </footer>
</article>

<style>
  .detail {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }
  header h2 {
    font-size: clamp(1.9rem, 5vw, 2.4rem);
    color: var(--ink);
    margin: 0.2rem 0 0.25rem;
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
  .window {
    margin: 0;
    color: var(--ink-2);
  }
  .game {
    margin: 0;
    padding: 0.75rem 1rem;
    border-left: 2px solid var(--c);
    background: color-mix(in oklab, var(--c) 8%, transparent);
    color: var(--gold);
    font-style: italic;
    border-radius: 0 0.4rem 0.4rem 0;
  }
  .status {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.85rem 1rem;
    border: 1px solid var(--panel-border);
    border-radius: var(--radius);
    background: color-mix(in oklab, var(--bg) 40%, transparent);
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
  }
  .soft {
    margin: 0;
    font-size: 0.9rem;
    color: var(--ink-2);
  }
  .desc {
    color: var(--ink-2);
  }
  .desc :global(p:last-child) {
    margin-bottom: 0;
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
  .links-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 1rem;
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
  .quests {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .quest-group h4 {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.95rem;
    letter-spacing: 0.12em;
    margin: 0 0 0.35rem;
    color: var(--ink-2);
  }
  .q-safety h4 {
    color: var(--danger);
  }
  .quest-group ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .quest {
    display: flex;
    gap: 0.65rem;
    align-items: flex-start;
    padding: 0.6rem 0.75rem;
    border-radius: 0.4rem;
    border: 1px solid var(--rule);
    background: color-mix(in oklab, var(--bg) 35%, transparent);
    cursor: pointer;
  }
  div.quest {
    cursor: default;
  }
  .q-safety .quest {
    border-color: color-mix(in oklab, var(--danger) 40%, transparent);
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
    width: 8px;
    height: 8px;
    margin-top: 0.5rem;
    flex: none;
    transform: rotate(45deg);
    background: var(--c);
  }
  .fact {
    padding: 0.85rem 1rem;
    border-radius: var(--radius);
    border: 1px dashed var(--panel-border);
  }
  .fact p {
    margin: 0;
    color: var(--ink-2);
  }
  .sources ul {
    margin: 0;
    padding-left: 1rem;
    font-size: 0.85rem;
  }
  .sources a {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  footer {
    border-top: 1px solid var(--rule);
    padding-top: 0.85rem;
  }
  footer .disclaimer {
    margin: 0;
  }
</style>
