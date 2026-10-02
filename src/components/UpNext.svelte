<script lang="ts">
  import ShieldAlert from '@lucide/svelte/icons/shield-alert';
  import Package from '@lucide/svelte/icons/package';
  import Gamepad from '@lucide/svelte/icons/gamepad-2';
  import Telescope from '@lucide/svelte/icons/telescope';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import { useApp } from '../lib/app.svelte';
  import { formatWindow, formatWeeks } from '../lib/age';
  import { isPastWindow } from '../lib/state';
  import { t } from '../i18n';

  const app = useApp();
  const up = $derived(app.upNext);
  const weeks = $derived(app.stateSettings.horizonWeeks);
  const color = (branch: string) => app.branchById.get(branch)?.color ?? '#999';

  type QuestItem = NonNullable<typeof up>['prepareSoon'][number];
  // Quests ticked this session stay visible (struck through) so a mis-tap can be undone.
  let kept = $state<Record<string, QuestItem>>({});
  const quests = $derived.by(() => {
    if (!up) return [];
    const keys = new Set(up.prepareSoon.map((q) => q.key));
    return [...up.prepareSoon, ...Object.values(kept).filter((q) => !keys.has(q.key))];
  });
  function toggle(q: QuestItem, done: boolean) {
    if (done) kept[q.key] = q;
    app.toggleQuest(q.key, done);
  }
</script>

<section class="upnext" aria-labelledby="upnext-title">
  <header>
    <h2 id="upnext-title">{t('upnext.heading')}</h2>
    <p class="sub">
      {app.babyName ? `${app.babyName} · ` : ''}{app.ageLabel}{app.age?.corrected ? ` (${t('today.corrected')})` : ''}
      · {t('upnext.subheading', { weeks })}
    </p>
    <div class="dad" style="--c: var(--gold)">
      <span class="dad-label">{t('hud.dadXp')} <strong>{app.dadRank.value}</strong></span>
      <span class="dad-rank">{app.dadRank.title}</span>
      <span class="sk-bar" style="--p: {app.dadRank.progress}" aria-hidden="true"></span>
      {#if app.dadRank.nextTitle}
        <span class="dad-next">{t('hud.nextTitle', { count: app.dadRank.nextAt! - app.dadRank.value, title: app.dadRank.nextTitle })}</span>
      {/if}
    </div>
  </header>

  {#if up}
    <div class="group">
      <h3><Sparkles size={16} aria-hidden="true" /> {t('upnext.ready')} <span class="count">{up.readyNow.length}</span></h3>
      {#if up.readyNow.length}
        <ul class="list">
          {#each up.readyNow as n (n.id)}
            {@const play = n.quests.find((q) => q.type === 'play')}
            <li style="--c: {color(n.branch)}">
              <button type="button" class="item" onclick={(e) => app.select(n.id, e.currentTarget)}>
                <span class="gem tier-{n.tier}" aria-hidden="true"></span>
                <span class="item-body">
                  <span class="item-title">{n.title}</span>
                  <span class="item-meta">
                    {app.branchById.get(n.branch)?.name} · {formatWindow(n.ageWeeksMin, n.ageWeeksMax)}
                    {#if isPastWindow(n, app.realAgeWeeks, app.saved.unlocked)}
                      · {t('upnext.pastWindow')}
                    {/if}
                  </span>
                  {#if play}
                    <span class="play"><Gamepad size={13} aria-hidden="true" /> {t('upnext.playIdea')}: {play.title}</span>
                  {/if}
                </span>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">{t('upnext.readyEmpty')}</p>
      {/if}
    </div>

    <div class="group">
      <h3><Package size={16} aria-hidden="true" /> {t('upnext.prepare')} <span class="count">{up.prepareSoon.length}</span></h3>
      {#if quests.length}
        <ul class="list">
          {#each quests as q (q.key)}
            <li class="quest q-{q.quest.type}" class:done={app.isQuestDone(q.key)} style="--c: {color(q.node.branch)}">
              <label>
                <input
                  type="checkbox"
                  checked={app.isQuestDone(q.key)}
                  onchange={(e) => toggle(q, e.currentTarget.checked)}
                  aria-label={t('upnext.markDone', { title: q.quest.title })}
                />
                <span class="item-body">
                  <span class="item-title">
                    {#if q.quest.type === 'safety'}<ShieldAlert size={14} aria-hidden="true" /><span class="sr-only">Safety: </span>{/if}
                    {q.quest.title}
                  </span>
                  {#if q.quest.body}<span class="qbody">{q.quest.body}</span>{/if}
                </span>
              </label>
              <button type="button" class="for" onclick={(e) => app.select(q.node.id, e.currentTarget)}>
                {t('upnext.forNode', { title: q.node.label })}
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">{t('upnext.prepareEmpty')}</p>
      {/if}
    </div>

    <div class="group">
      <h3><Telescope size={16} aria-hidden="true" /> {t('upnext.horizon')} <span class="count">{up.horizon.length}</span></h3>
      {#if up.horizon.length}
        <ul class="list">
          {#each up.horizon as n (n.id)}
            <li style="--c: {color(n.branch)}">
              <button type="button" class="item" onclick={(e) => app.select(n.id, e.currentTarget)}>
                <span class="gem tier-keystone" aria-hidden="true"></span>
                <span class="item-body">
                  <span class="item-title">{n.title}</span>
                  <span class="item-meta">
                    {t('upnext.opensIn', { weeks: formatWeeks(Math.max(1, n.ageWeeksMin - app.realAgeWeeks)) })}
                  </span>
                </span>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">{t('upnext.horizonEmpty', { weeks })}</p>
      {/if}
    </div>
  {/if}
</section>

<style>
  .upnext {
    display: flex;
    flex-direction: column;
    gap: 1.4rem;
  }
  h2 {
    font-size: 2rem;
    color: var(--ink);
  }
  .sub {
    margin: 0.25rem 0 0.9rem;
    color: var(--ink-3);
    font-size: 0.92rem;
  }
  .dad {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 0.75rem;
    align-items: baseline;
    padding: 0.75rem 0.9rem;
    border: 1px solid var(--panel-border);
    border-radius: var(--radius);
  }
  .dad-label {
    font-family: var(--font-display);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-3);
  }
  .dad-label strong {
    color: var(--ink);
    font-size: 1.2rem;
  }
  .dad-rank {
    font-family: var(--font-display);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--gold);
    text-align: right;
  }
  .dad .sk-bar {
    grid-column: 1 / -1;
  }
  .dad-next {
    grid-column: 1 / -1;
    font-size: 0.8rem;
    color: var(--ink-3);
  }
  h3 {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 1.15rem;
    letter-spacing: 0.12em;
    color: var(--ink-2);
    margin-bottom: 0.6rem;
  }
  .count {
    margin-left: auto;
    font-size: 0.95rem;
    color: var(--ink-3);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }
  .item {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    width: 100%;
    padding: 0.65rem 0.8rem;
    text-align: left;
    border: 1px solid var(--rule);
    border-left: 3px solid var(--c);
    border-radius: 0.4rem;
    background: color-mix(in oklab, var(--bg) 35%, transparent);
    cursor: pointer;
  }
  .item:hover {
    border-color: color-mix(in oklab, var(--c) 60%, transparent);
    background: color-mix(in oklab, var(--c) 8%, transparent);
  }
  .gem {
    width: 12px;
    height: 12px;
    margin-top: 0.35rem;
    flex: none;
    border-radius: 999px;
    background: var(--c);
    box-shadow: 0 0 10px var(--c);
  }
  .gem.tier-keystone {
    border-radius: 2px;
    transform: rotate(45deg);
  }
  .item-body {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }
  .item-title {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-weight: 600;
    color: var(--ink);
  }
  .item-meta,
  .qbody {
    font-size: 0.86rem;
    color: var(--ink-3);
  }
  .qbody {
    color: var(--ink-2);
  }
  .play {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.84rem;
    color: var(--gold);
  }
  .quest {
    padding: 0.65rem 0.8rem;
    border: 1px solid var(--rule);
    border-left: 3px solid var(--c);
    border-radius: 0.4rem;
    background: color-mix(in oklab, var(--bg) 35%, transparent);
  }
  .done .item-title,
  .done .qbody {
    text-decoration: line-through;
    opacity: 0.6;
  }
  .q-safety {
    border-color: color-mix(in oklab, var(--danger) 45%, transparent);
    border-left-color: var(--danger);
  }
  .q-safety .item-title {
    color: var(--danger);
  }
  .quest label {
    display: flex;
    gap: 0.65rem;
    align-items: flex-start;
    cursor: pointer;
  }
  .quest input {
    margin-top: 0.2rem;
  }
  .for {
    margin: 0.35rem 0 0 1.8rem;
    padding: 0.2rem 0;
    min-height: 28px;
    background: none;
    border: 0;
    color: var(--gold);
    font-size: 0.82rem;
    text-decoration: underline;
    text-underline-offset: 0.18em;
    cursor: pointer;
  }
  .empty {
    color: var(--ink-3);
    font-size: 0.92rem;
    margin: 0;
  }
</style>
