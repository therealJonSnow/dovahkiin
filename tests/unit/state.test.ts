import { describe, expect, it } from 'vitest';
import {
  applyUndo,
  applyUnlock,
  buildUpNext,
  catchUpCandidates,
  computeNodeState,
  computeStates,
  countUnlocked,
  isPastWindow,
  isQuestActive,
  pendingAncestors,
  questKey,
  simulateUnlocked,
  titleFor,
  type StateNode,
} from '../../src/lib/state';

const S = { readyLeadWeeks: 2, horizonWeeks: 8 };

const node = (id: string, min: number, max: number, prereqs: string[] = [], extra: Partial<StateNode> = {}): StateNode => ({
  id,
  tier: 'major',
  ageWeeksMin: min,
  ageWeeksMax: max,
  prereqs,
  quests: [],
  ...extra,
});

const head = node('head', 8, 17);
const roll = node('roll', 13, 26, ['head'], {
  quests: [
    { id: 'table', type: 'prepare', title: 'Table', body: '', leadWeeks: 3 },
    { id: 'tempt', type: 'play', title: 'Tempt', body: '' },
    { id: 'cot', type: 'safety', title: 'Cot', body: '' },
  ],
});
const sit = node('sit', 17, 40, ['roll'], { tier: 'keystone' });
const crawl = node('crawl', 22, 58, ['sit']);
const all = [head, roll, sit, crawl];
const byId = new Map(all.map((n) => [n.id, n]));

describe('computeNodeState', () => {
  it('unlocked wins over everything', () => {
    expect(computeNodeState(roll, 0, { roll: { date: '2026-01-01' } }, S)).toBe('unlocked');
  });

  it('is ready when prereqs are satisfied and the window opens within the lead', () => {
    expect(computeNodeState(head, 6, {}, S)).toBe('ready');
    expect(computeNodeState(head, 5.9, {}, S)).toBe('upcoming');
  });

  it('counts skipped prerequisites as satisfied', () => {
    expect(computeNodeState(roll, 12, { head: { date: '', skipped: true } }, S)).toBe('ready');
  });

  it('is waiting when old enough but a prerequisite is pending', () => {
    expect(computeNodeState(roll, 12, {}, S)).toBe('waiting');
    // Long past the window: still waiting, never "late".
    expect(computeNodeState(roll, 60, {}, S)).toBe('waiting');
  });

  it('is upcoming within the horizon, locked beyond it', () => {
    expect(computeNodeState(sit, 9, {}, S)).toBe('upcoming'); // opens in 8 weeks
    expect(computeNodeState(sit, 8.9, {}, S)).toBe('locked');
  });

  it('stays ready past the end of its window', () => {
    expect(computeNodeState(head, 40, {}, S)).toBe('ready');
    expect(isPastWindow(head, 40, {})).toBe(true);
    expect(isPastWindow(head, 40, { head: { date: 'x' } })).toBe(false);
  });

  it('computeStates maps every node', () => {
    const st = computeStates(all, 15, { head: { date: 'x' } }, S);
    expect(st).toEqual({ head: 'unlocked', roll: 'ready', sit: 'waiting', crawl: 'upcoming' });
  });
});

describe('unlocking out of order', () => {
  it('lists every pending ancestor, earliest first', () => {
    expect(pendingAncestors('crawl', byId, {})).toEqual(['head', 'roll', 'sit']);
    expect(pendingAncestors('crawl', byId, { roll: { date: 'x' } })).toEqual(['sit']);
    expect(pendingAncestors('head', byId, {})).toEqual([]);
  });

  it('can mark ancestors unlocked or skipped', () => {
    const anc = pendingAncestors('crawl', byId, {});
    const yes = applyUnlock({}, 'crawl', '2026-10-02', anc, 'unlock');
    expect(yes.sit).toEqual({ date: '2026-10-02' });
    const skip = applyUnlock({}, 'crawl', '2026-10-02', anc, 'skip');
    expect(skip.sit).toEqual({ date: '2026-10-02', skipped: true });
    expect(skip.crawl).toEqual({ date: '2026-10-02' });
  });

  it('does not overwrite existing records', () => {
    const next = applyUnlock({ head: { date: '2026-01-01' } }, 'roll', '2026-02-01', ['head'], 'skip');
    expect(next.head).toEqual({ date: '2026-01-01' });
  });

  it('undo removes only that node', () => {
    const next = applyUndo({ head: { date: 'a' }, roll: { date: 'b' } }, 'head');
    expect(next).toEqual({ roll: { date: 'b' } });
  });
});

describe('quests', () => {
  const [table, tempt, cot] = roll.quests;

  it('prepare surfaces leadWeeks before the window opens', () => {
    expect(isQuestActive(roll, table!, 'locked', 9.9, S)).toBe(false);
    expect(isQuestActive(roll, table!, 'upcoming', 10, S)).toBe(true);
  });

  it('safety defaults to two weeks of lead', () => {
    expect(isQuestActive(roll, cot!, 'upcoming', 10.9, S)).toBe(false);
    expect(isQuestActive(roll, cot!, 'ready', 11, S)).toBe(true);
  });

  it('play is only active while ready', () => {
    expect(isQuestActive(roll, tempt!, 'ready', 14, S)).toBe(true);
    expect(isQuestActive(roll, tempt!, 'waiting', 14, S)).toBe(false);
    expect(isQuestActive(roll, tempt!, 'unlocked', 14, S)).toBe(false);
  });

  it('prepare/safety go stale once unlocked and past the window', () => {
    expect(isQuestActive(roll, cot!, 'unlocked', 20, S)).toBe(true);
    expect(isQuestActive(roll, cot!, 'unlocked', 27, S)).toBe(false);
  });
});

describe('buildUpNext', () => {
  it('groups ready nodes, surfaced quests and upcoming keystones', () => {
    const up = buildUpNext(all, 11, { head: { date: 'x' } }, {}, S);
    expect(up.readyNow.map((n) => n.id)).toEqual(['roll']);
    expect(up.prepareSoon.map((q) => q.key)).toEqual(['roll:cot', 'roll:table']); // safety first
    expect(up.horizon.map((n) => n.id)).toEqual(['sit']);
  });

  it('hides done quests', () => {
    const up = buildUpNext(all, 11, { head: { date: 'x' } }, { [questKey('roll', 'cot')]: '2026-10-02' }, S);
    expect(up.prepareSoon.map((q) => q.key)).toEqual(['roll:table']);
  });

  it('does not repeat a keystone that is already ready', () => {
    const up = buildUpNext(all, 16, { head: { date: 'x' }, roll: { date: 'x' } }, {}, S);
    expect(up.readyNow.map((n) => n.id)).toContain('sit');
    expect(up.horizon).toEqual([]);
  });
});

describe('levels and helpers', () => {
  const steps = [
    { at: 0, title: 'Fresh Spawn' },
    { at: 3, title: 'Wobbly Recruit' },
    { at: 8, title: 'Floor Explorer' },
  ];
  it('picks the right title and progress', () => {
    expect(titleFor(0, steps)).toMatchObject({ title: 'Fresh Spawn', nextAt: 3, progress: 0 });
    expect(titleFor(5, steps)).toMatchObject({ title: 'Wobbly Recruit', nextTitle: 'Floor Explorer', progress: 0.4 });
    expect(titleFor(99, steps)).toMatchObject({ title: 'Floor Explorer', nextTitle: null, progress: 1 });
  });

  it('counts unlocked nodes that still exist', () => {
    expect(countUnlocked(all, { head: { date: 'x' }, gone: { date: 'x' } })).toBe(1);
  });

  it('simulates explore mode by window start', () => {
    expect(Object.keys(simulateUnlocked(all, 17)).sort()).toEqual(['head', 'roll', 'sit']);
  });

  it('lists catch-up candidates whose window has passed', () => {
    expect(catchUpCandidates(all, 27).map((n) => n.id)).toEqual(['head', 'roll']);
  });
});
