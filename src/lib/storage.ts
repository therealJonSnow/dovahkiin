/**
 * Device-only persistence. Nothing here ever leaves the browser.
 */
import { parseISODate } from './age';
import type { QuestsDoneMap, UnlockedMap } from './state';

export const STORAGE_KEY = 'levelup:v1';

export type ThemePref = 'system' | 'dark' | 'light';

export interface SavedState {
  version: 1;
  baby: { name?: string; dob: string; dueDate?: string } | null;
  unlocked: UnlockedMap;
  questsDone: QuestsDoneMap;
  prefs: { view: 'upnext' | 'tree'; branchFilter?: string; theme?: ThemePref };
}

export function emptyState(): SavedState {
  return { version: 1, baby: null, unlocked: {}, questsDone: {}, prefs: { view: 'upnext' } };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isDate = (v: unknown): v is string => typeof v === 'string' && parseISODate(v) !== null;

/**
 * Turns anything (a stored blob, an imported file) into a valid SavedState,
 * dropping malformed parts. Migrations are keyed on `version`.
 * Throws only when the input is not recognisable at all.
 */
export function migrate(raw: unknown): SavedState {
  if (!isObj(raw)) throw new Error('Not a saved progress file.');
  const version = raw.version;
  if (version !== 1) throw new Error(`Unsupported progress version: ${String(version)}.`);

  const out = emptyState();
  if (isObj(raw.baby) && isDate(raw.baby.dob)) {
    out.baby = { dob: raw.baby.dob };
    if (typeof raw.baby.name === 'string' && raw.baby.name.trim()) out.baby.name = raw.baby.name.trim().slice(0, 40);
    if (isDate(raw.baby.dueDate)) out.baby.dueDate = raw.baby.dueDate;
  }
  if (isObj(raw.unlocked)) {
    for (const [id, rec] of Object.entries(raw.unlocked)) {
      if (!isObj(rec)) continue;
      const date = isDate(rec.date) ? rec.date : '';
      out.unlocked[id] = rec.skipped === true ? { date, skipped: true } : { date };
    }
  }
  if (isObj(raw.questsDone)) {
    for (const [key, date] of Object.entries(raw.questsDone)) {
      if (key.includes(':') && typeof date === 'string') out.questsDone[key] = date;
    }
  }
  if (isObj(raw.prefs)) {
    const p = raw.prefs;
    if (p.view === 'tree' || p.view === 'upnext') out.prefs.view = p.view;
    if (typeof p.branchFilter === 'string') out.prefs.branchFilter = p.branchFilter;
    if (p.theme === 'dark' || p.theme === 'light' || p.theme === 'system') out.prefs.theme = p.theme;
  }
  return out;
}

export interface Store {
  load(): SavedState;
  save(state: SavedState): boolean;
  clear(): void;
  /** False when localStorage is unavailable (private mode, blocked). */
  readonly available: boolean;
}

function probe(storage: Storage | undefined): boolean {
  if (!storage) return false;
  try {
    const k = '__levelup_probe__';
    storage.setItem(k, '1');
    storage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function createStore(storage: Storage | undefined = globalThis.localStorage): Store {
  const available = probe(storage);
  return {
    available,
    load() {
      if (!available) return emptyState();
      try {
        const raw = storage!.getItem(STORAGE_KEY);
        return raw ? migrate(JSON.parse(raw)) : emptyState();
      } catch {
        return emptyState();
      }
    },
    save(state) {
      if (!available) return false;
      try {
        storage!.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      try {
        storage?.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    },
  };
}

export function exportState(state: SavedState): string {
  return JSON.stringify(state, null, 2);
}

export function importState(text: string): SavedState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  return migrate(parsed);
}
