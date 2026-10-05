/**
 * Pure state logic (spec §7). No DOM, no storage: everything here is
 * deterministic given the node list, the baby's age and saved progress.
 *
 * States, evaluated in order:
 *  1. unlocked  – the parent marked it (or marked it skipped).
 *  2. ready     – every prerequisite is satisfied and the window opens within
 *                 `readyLeadWeeks`. A node past its window stays ready (never "late").
 *  3. waiting   – old enough, but a prerequisite isn't satisfied yet.
 *                 (Closes the gap in the spec where `upcoming` had no lower bound.)
 *  4. upcoming  – the window opens within `horizonWeeks`.
 *  5. locked    – everything else.
 */
import type { QuestType, Tier, TitleStep } from './schemas';

export type NodeState = 'unlocked' | 'ready' | 'waiting' | 'upcoming' | 'locked';

export interface StateQuest {
  id: string;
  type: QuestType;
  title: string;
  body: string;
  leadWeeks?: number;
}

export interface StateNode {
  id: string;
  tier: Tier;
  ageWeeksMin: number;
  ageWeeksMax: number;
  prereqs: string[];
  quests: StateQuest[];
}

export interface UnlockRecord {
  date: string;
  skipped?: boolean;
}

export type UnlockedMap = Record<string, UnlockRecord>;
export type QuestsDoneMap = Record<string, string>;

export interface StateSettings {
  readyLeadWeeks: number;
  horizonWeeks: number;
}

export const DEFAULT_PREPARE_LEAD = 4;
export const DEFAULT_SAFETY_LEAD = 2;

export const isSatisfied = (unlocked: UnlockedMap, id: string) => id in unlocked;

export function prereqsSatisfied(node: StateNode, unlocked: UnlockedMap): boolean {
  return node.prereqs.every((p) => isSatisfied(unlocked, p));
}

export function computeNodeState(
  node: StateNode,
  ageWeeks: number,
  unlocked: UnlockedMap,
  s: StateSettings,
): NodeState {
  if (isSatisfied(unlocked, node.id)) return 'unlocked';
  const oldEnough = ageWeeks >= node.ageWeeksMin - s.readyLeadWeeks;
  if (oldEnough) return prereqsSatisfied(node, unlocked) ? 'ready' : 'waiting';
  if (node.ageWeeksMin - ageWeeks <= s.horizonWeeks) return 'upcoming';
  return 'locked';
}

export function computeStates(
  nodes: StateNode[],
  ageWeeks: number,
  unlocked: UnlockedMap,
  s: StateSettings,
): Record<string, NodeState> {
  const out: Record<string, NodeState> = {};
  for (const n of nodes) out[n.id] = computeNodeState(n, ageWeeks, unlocked, s);
  return out;
}

/** True when a not-yet-unlocked node is past the end of its typical window. */
export function isPastWindow(node: StateNode, ageWeeks: number, unlocked: UnlockedMap): boolean {
  return !isSatisfied(unlocked, node.id) && ageWeeks > node.ageWeeksMax;
}

/** Prerequisites (direct) that aren't satisfied yet. */
export function pendingPrereqs(node: StateNode, unlocked: UnlockedMap): string[] {
  return node.prereqs.filter((p) => !isSatisfied(unlocked, p));
}

/**
 * Every unsatisfied ancestor of `id` (walking through unsatisfied nodes only),
 * ordered earliest window first. These are what "Also mark its prerequisites
 * as unlocked?" offers to tick in one go.
 */
export function pendingAncestors(
  id: string,
  byId: Map<string, StateNode>,
  unlocked: UnlockedMap,
): string[] {
  const out = new Set<string>();
  const walk = (nid: string) => {
    const node = byId.get(nid);
    if (!node) return;
    for (const p of node.prereqs) {
      if (isSatisfied(unlocked, p) || out.has(p) || !byId.has(p)) continue;
      out.add(p);
      walk(p);
    }
  };
  walk(id);
  return [...out].sort((a, b) => {
    const na = byId.get(a)!;
    const nb = byId.get(b)!;
    return na.ageWeeksMin - nb.ageWeeksMin || a.localeCompare(b);
  });
}

export type AncestorMode = 'unlock' | 'skip';

/** Marks `id` unlocked, plus `ancestors` as unlocked or skipped. Returns a new map. */
export function applyUnlock(
  unlocked: UnlockedMap,
  id: string,
  date: string,
  ancestors: string[] = [],
  mode: AncestorMode = 'unlock',
): UnlockedMap {
  const next: UnlockedMap = { ...unlocked };
  for (const a of ancestors) {
    if (a in next) continue;
    next[a] = mode === 'skip' ? { date, skipped: true } : { date };
  }
  next[id] = { date };
  return next;
}

export function applyUndo(unlocked: UnlockedMap, id: string): UnlockedMap {
  const next = { ...unlocked };
  delete next[id];
  return next;
}

/** Preview (no baby yet): pretend everything whose window has opened is unlocked. */
export function simulateUnlocked(nodes: StateNode[], ageWeeks: number): UnlockedMap {
  const out: UnlockedMap = {};
  for (const n of nodes) if (n.ageWeeksMin <= ageWeeks) out[n.id] = { date: '' };
  return out;
}

export const questKey = (milestoneId: string, questId: string) => `${milestoneId}:${questId}`;

/** The age (weeks) at which a quest first surfaces. */
export function questSurfaceWeek(node: StateNode, quest: StateQuest, s: StateSettings): number {
  switch (quest.type) {
    case 'prepare':
      return node.ageWeeksMin - (quest.leadWeeks ?? DEFAULT_PREPARE_LEAD);
    case 'safety':
      return node.ageWeeksMin - (quest.leadWeeks ?? DEFAULT_SAFETY_LEAD);
    case 'play':
      return node.ageWeeksMin - s.readyLeadWeeks;
  }
}

/**
 * Whether a quest is currently relevant.
 * - prepare/safety: from their surfacing week, and stay relevant until done,
 *   except once the node is unlocked *and* its window has passed (stale).
 * - play: while the node is ready.
 */
export function isQuestActive(
  node: StateNode,
  quest: StateQuest,
  state: NodeState,
  ageWeeks: number,
  s: StateSettings,
): boolean {
  if (quest.type === 'play') return state === 'ready';
  if (ageWeeks < questSurfaceWeek(node, quest, s)) return false;
  return !(state === 'unlocked' && ageWeeks > node.ageWeeksMax);
}

export interface QuestRef<N extends StateNode = StateNode> {
  node: N;
  quest: StateQuest;
  key: string;
}

export interface UpNext<N extends StateNode = StateNode> {
  readyNow: N[];
  prepareSoon: QuestRef<N>[];
  horizon: N[];
}

export function buildUpNext<N extends StateNode>(
  nodes: N[],
  ageWeeks: number,
  unlocked: UnlockedMap,
  questsDone: QuestsDoneMap,
  s: StateSettings,
): UpNext<N> {
  const states = computeStates(nodes, ageWeeks, unlocked, s);
  const byWindow = (a: N, b: N) => a.ageWeeksMin - b.ageWeeksMin || a.id.localeCompare(b.id);

  const readyNow = nodes.filter((n) => states[n.id] === 'ready').sort(byWindow);

  const prepareSoon: QuestRef<N>[] = [];
  for (const node of nodes) {
    for (const quest of node.quests) {
      if (quest.type === 'play') continue;
      const key = questKey(node.id, quest.id);
      if (key in questsDone) continue;
      if (isQuestActive(node, quest, states[node.id]!, ageWeeks, s)) prepareSoon.push({ node, quest, key });
    }
  }
  prepareSoon.sort(
    (a, b) =>
      (a.quest.type === 'safety' ? 0 : 1) - (b.quest.type === 'safety' ? 0 : 1) ||
      questSurfaceWeek(a.node, a.quest, s) - questSurfaceWeek(b.node, b.quest, s) ||
      a.key.localeCompare(b.key),
  );

  const horizon = nodes
    .filter((n) => {
      if (n.tier !== 'keystone') return false;
      const st = states[n.id];
      if (st === 'unlocked' || st === 'ready') return false;
      const until = n.ageWeeksMin - ageWeeks;
      return until > 0 && until <= s.horizonWeeks;
    })
    .sort(byWindow);

  return { readyNow, prepareSoon, horizon };
}

export interface TitleProgress {
  value: number;
  title: string;
  nextTitle: string | null;
  nextAt: number | null;
  /** 0–1 progress from the current title step to the next. */
  progress: number;
}

/** Maps a count (unlocked nodes, or quests done) onto a list of title steps. */
export function titleFor(value: number, steps: TitleStep[]): TitleProgress {
  const sorted = [...steps].sort((a, b) => a.at - b.at);
  let i = 0;
  while (i + 1 < sorted.length && sorted[i + 1]!.at <= value) i++;
  const cur = sorted[i]!;
  const next = sorted[i + 1] ?? null;
  const progress = next ? Math.min(1, (value - cur.at) / (next.at - cur.at)) : 1;
  return { value, title: cur.title, nextTitle: next?.title ?? null, nextAt: next?.at ?? null, progress };
}

/** Number of unlocked (including skipped) nodes that exist in the current tree. */
export function countUnlocked(nodes: StateNode[], unlocked: UnlockedMap): number {
  return nodes.reduce((n, node) => n + (isSatisfied(unlocked, node.id) ? 1 : 0), 0);
}

/** Done quests that still exist in the current content. */
export function countQuestsDone(nodes: StateNode[], done: QuestsDoneMap): number {
  let n = 0;
  for (const node of nodes) for (const q of node.quests) if (questKey(node.id, q.id) in done) n++;
  return n;
}

/** Nodes whose window has fully passed at `ageWeeks` (onboarding catch-up list). */
export function catchUpCandidates<N extends StateNode>(nodes: N[], ageWeeks: number): N[] {
  return nodes
    .filter((n) => n.ageWeeksMax < ageWeeks)
    .sort((a, b) => a.ageWeeksMin - b.ageWeeksMin || a.id.localeCompare(b.id));
}
