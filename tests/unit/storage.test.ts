import { describe, expect, it } from 'vitest';
import { createStore, emptyState, exportState, importState, migrate, STORAGE_KEY } from '../../src/lib/storage';

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

class BrokenStorage extends MemoryStorage {
  override setItem(): void {
    throw new Error('QuotaExceeded');
  }
}

describe('storage', () => {
  it('round-trips through localStorage', () => {
    const store = createStore(new MemoryStorage());
    expect(store.available).toBe(true);
    const s = emptyState();
    s.baby = { dob: '2026-01-01', name: 'Bean' };
    s.unlocked.coos = { date: '2026-02-01' };
    s.questsDone['coos:chat-back'] = '2026-02-02';
    expect(store.save(s)).toBe(true);
    expect(store.load()).toEqual(s);
  });

  it('falls back gracefully when storage is unavailable', () => {
    const store = createStore(new BrokenStorage());
    expect(store.available).toBe(false);
    expect(store.load()).toEqual(emptyState());
    expect(store.save(emptyState())).toBe(false);
    expect(createStore(undefined).available).toBe(false);
  });

  it('ignores corrupt stored data', () => {
    const mem = new MemoryStorage();
    mem.setItem(STORAGE_KEY, '{not json');
    expect(createStore(mem).load()).toEqual(emptyState());
  });

  it('migrate drops malformed parts', () => {
    const s = migrate({
      version: 1,
      baby: { dob: '2026-02-30', name: 'X' },
      unlocked: { a: { date: '2026-01-01', skipped: true }, b: 'nope' },
      questsDone: { 'a:q': '2026-01-01', bad: '2026-01-01' },
      prefs: { view: 'tree', theme: 'neon' },
    });
    expect(s.baby).toBeNull();
    expect(s.unlocked).toEqual({ a: { date: '2026-01-01', skipped: true } });
    expect(s.questsDone).toEqual({ 'a:q': '2026-01-01' });
    expect(s.prefs).toEqual({ view: 'tree' });
  });

  it('import rejects unknown files with a readable message', () => {
    expect(() => importState('nope')).toThrow(/valid JSON/);
    expect(() => importState('{"version": 9}')).toThrow(/Unsupported/);
    const s = emptyState();
    expect(importState(exportState(s))).toEqual(s);
  });
});
