/**
 * Reactive app store (Svelte 5 runes). One instance per page, shared through
 * context. All derived state comes from the pure functions in state.ts.
 */
import { getContext, setContext } from 'svelte';
import { formatAgeSpan, formatWeeks, getAge, parseISODate, todayISO, type Age } from './age';
import {
  applyUndo,
  applyUnlock,
  buildUpNext,
  computeStates,
  countQuestsDone,
  countUnlocked,
  pendingAncestors,
  simulateUnlocked,
  titleFor,
  type AncestorMode,
  type NodeState,
  type StateSettings,
  type UnlockedMap,
} from './state';
import { createStore, emptyState, exportState, importState, type SavedState, type Store, type ThemePref } from './storage';
import type { ClientBranch, ClientNode, TreeData } from './types';

const KEY = Symbol('app');

export interface PendingUnlock {
  id: string;
  date: string;
  ancestors: string[];
}

export interface Celebration {
  id: string;
  keystone: boolean;
  nonce: number;
}

export class AppStore {
  readonly data: TreeData;
  readonly nodes: ClientNode[];
  readonly byId: Map<string, ClientNode>;
  readonly branchById: Map<string, ClientBranch>;
  readonly stateSettings: StateSettings;
  private store: Store | null = null;

  saved = $state<SavedState>(emptyState());
  hydrated = $state(false);
  storageOk = $state(true);
  today = $state('');

  exploring = $state(false);
  exploreAge = $state(30);

  /** Branch shown in the carousel; null = the zoomed-out overview of every family. */
  focus = $state<string | null>(null);
  selectedId = $state<string | null>(null);
  /** Desktop layout: node details live in the sidebar instead of a modal sheet. */
  wide = $state(true);
  upNextOpen = $state(false);
  pendingUnlock = $state<PendingUnlock | null>(null);
  celebration = $state<Celebration | null>(null);
  onboardingOpen = $state(false);
  settingsOpen = $state(false);
  /** Element to return focus to when a dialog closes. */
  returnFocus: HTMLElement | null = null;

  age = $derived.by((): Age | null => (this.saved.baby && this.today ? getAge(this.saved.baby, this.today) : null));
  isExplore = $derived(this.exploring || !this.age);
  realAgeWeeks = $derived(this.age ? Math.min(this.age.ageWeeks, 104) : 0);
  ageWeeks = $derived(this.isExplore ? this.exploreAge : this.realAgeWeeks);
  unlocked = $derived.by(
    (): UnlockedMap => (this.isExplore ? simulateUnlocked(this.nodes, this.exploreAge) : this.saved.unlocked),
  );
  states = $derived.by((): Record<string, NodeState> => computeStates(this.nodes, this.ageWeeks, this.unlocked, this.stateSettings));
  upNext = $derived.by(() =>
    this.age ? buildUpNext(this.nodes, this.realAgeWeeks, this.saved.unlocked, this.saved.questsDone, this.stateSettings) : null,
  );
  level = $derived.by(() => titleFor(countUnlocked(this.nodes, this.unlocked), this.data.settings.levelTitles));
  dadRank = $derived.by(() => titleFor(countQuestsDone(this.nodes, this.saved.questsDone), this.data.settings.dadRanks));
  ageLabel = $derived.by(() => {
    if (this.isExplore) return formatWeeks(this.exploreAge);
    const a = this.age!;
    return formatAgeSpan(a.from, parseISODate(this.today)!);
  });
  babyName = $derived(this.saved.baby?.name?.trim() || '');

  constructor(data: TreeData) {
    this.data = data;
    this.nodes = data.nodes;
    this.byId = new Map(data.nodes.map((n) => [n.id, n]));
    this.branchById = new Map(data.branches.map((b) => [b.id, b]));
    this.stateSettings = { readyLeadWeeks: data.settings.readyLeadWeeks, horizonWeeks: data.settings.horizonWeeks };
  }

  /** Client-only: load saved state. */
  hydrate() {
    this.store = createStore();
    this.storageOk = this.store.available;
    this.saved = this.store.load();
    this.today = todayISO();
    this.hydrated = true;
    applyTheme(this.saved.prefs.theme ?? 'system');
  }

  refreshToday() {
    const t = todayISO();
    if (t !== this.today) this.today = t;
  }

  private persist() {
    this.store?.save($state.snapshot(this.saved) as SavedState);
  }

  setBaby(baby: SavedState['baby'], catchUp: string[] = []) {
    this.saved.baby = baby;
    const date = this.today || todayISO();
    for (const id of catchUp) if (!(id in this.saved.unlocked)) this.saved.unlocked[id] = { date };
    this.exploring = false;
    this.persist();
  }

  updateBaby(baby: NonNullable<SavedState['baby']>) {
    this.saved.baby = baby;
    this.persist();
  }

  /** Starts an unlock. Opens the prerequisite prompt when needed. */
  requestUnlock(id: string, date: string) {
    if (this.isExplore) return;
    const ancestors = pendingAncestors(id, this.byId, this.saved.unlocked);
    if (ancestors.length) this.pendingUnlock = { id, date, ancestors };
    else this.commitUnlock(id, date, [], 'unlock');
  }

  resolvePending(mode: AncestorMode | null) {
    const p = this.pendingUnlock;
    this.pendingUnlock = null;
    if (p && mode) this.commitUnlock(p.id, p.date, p.ancestors, mode);
  }

  private commitUnlock(id: string, date: string, ancestors: string[], mode: AncestorMode) {
    this.saved.unlocked = applyUnlock(this.saved.unlocked, id, date, ancestors, mode);
    this.persist();
    const node = this.byId.get(id);
    this.celebration = { id, keystone: node?.tier === 'keystone', nonce: Date.now() };
  }

  undo(id: string) {
    this.saved.unlocked = applyUndo(this.saved.unlocked, id);
    this.persist();
  }

  setUnlockDate(id: string, date: string) {
    const rec = this.saved.unlocked[id];
    if (!rec) return;
    this.saved.unlocked[id] = { ...rec, date };
    this.persist();
  }

  isQuestDone(key: string) {
    return key in this.saved.questsDone;
  }

  toggleQuest(key: string, done = !this.isQuestDone(key)) {
    if (done) this.saved.questsDone[key] = this.today || todayISO();
    else delete this.saved.questsDone[key];
    this.persist();
  }

  /** Zooms into one family (or back out to the overview with null). */
  setFocus(branch: string | null) {
    if (branch && !this.branchById.has(branch)) branch = null;
    if (branch !== this.focus) this.selectedId = null;
    this.focus = branch;
  }

  /** Moves the carousel by one family, wrapping round. */
  stepFocus(dir: 1 | -1) {
    const ids = this.data.branches.map((b) => b.id);
    const i = this.focus ? ids.indexOf(this.focus) : -1;
    this.setFocus(ids[(i + dir + ids.length) % ids.length]!);
  }

  setTheme(theme: ThemePref) {
    this.saved.prefs.theme = theme;
    applyTheme(theme);
    this.persist();
  }

  /** Opens a skill's details, bringing its family into focus. */
  select(id: string | null, from?: HTMLElement | null) {
    if (id && from) this.returnFocus = from;
    const node = id ? this.byId.get(id) : undefined;
    if (node) {
      this.focus = node.branch;
      this.upNextOpen = false;
    }
    this.selectedId = node ? node.id : null;
  }

  exportJSON(): string {
    return exportState($state.snapshot(this.saved) as SavedState);
  }

  importJSON(text: string) {
    const next = importState(text);
    this.saved = next;
    applyTheme(next.prefs.theme ?? 'system');
    this.persist();
  }

  reset() {
    this.store?.clear();
    this.saved = emptyState();
    this.exploring = false;
    this.selectedId = null;
    this.focus = null;
    applyTheme('system');
  }
}

export function applyTheme(theme: ThemePref) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}

export function setApp(app: AppStore) {
  setContext(KEY, app);
}

export function useApp(): AppStore {
  return getContext<AppStore>(KEY);
}
