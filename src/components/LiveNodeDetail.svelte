<script lang="ts">
  import { useApp } from '../lib/app.svelte';
  import { isPastWindow } from '../lib/state';
  import type { ClientNode } from '../lib/types';
  import { t } from '../i18n';
  import NodeDetail from './NodeDetail.svelte';

  /** NodeDetail wired to the app store. Used by the phone sheet and the desktop sidebar. */
  interface Props {
    node: ClientNode;
    headingId: string;
  }
  let { node, headingId }: Props = $props();
  const app = useApp();

  const branch = $derived(app.branchById.get(node.branch)!);
  const related = (ids: string[]) =>
    ids
      .map((id) => app.byId.get(id))
      .filter((n) => !!n)
      .map((n) => ({ id: n.id, title: n.title, color: app.branchById.get(n.branch)?.color ?? '#999' }));

  const settings = $derived({
    ...app.stateSettings,
    disclaimer: app.data.settings.disclaimer,
    pastWindowNote: app.data.settings.pastWindowNote,
  });
</script>

<NodeDetail
  {node}
  {branch}
  prereqs={related(node.prereqs)}
  unlocks={related(node.unlocks)}
  {settings}
  {headingId}
  live={{
    state: app.states[node.id]!,
    record: app.isExplore ? undefined : app.saved.unlocked[node.id],
    canEdit: !app.isExplore,
    note: t('detail.noBabyNote'),
    today: app.today,
    ageWeeks: app.ageWeeks,
    hasAge: !!app.age && !app.isExplore,
    pastWindow: !app.isExplore && isPastWindow(node, app.ageWeeks, app.unlocked),
    isDone: (key) => app.isQuestDone(key),
    onUnlock: (date) => app.requestUnlock(node.id, date),
    onUndo: () => app.undo(node.id),
    onSetDate: (date) => app.setUnlockDate(node.id, date),
    onToggleQuest: (key, done) => app.toggleQuest(key, done),
    onSelect: (id) => app.select(id),
  }}
/>
{#if !app.age}
  <button type="button" class="btn btn-primary start" onclick={() => {
      app.select(null);
      app.onboardingOpen = true;
    }}>
    {app.data.settings.onboarding.cta}
  </button>
{/if}

<style>
  .start {
    margin-top: 1rem;
    width: 100%;
  }
</style>
