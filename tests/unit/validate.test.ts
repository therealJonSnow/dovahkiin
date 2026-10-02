import { describe, expect, it } from 'vitest';
import { milestoneSchema, type Milestone } from '../../src/lib/schemas';
import { findBannedWords, findCycle, validateContent, type Entry } from '../../src/lib/validate';
import { loadContent } from './helpers';

const bands = [
  { id: 'a', label: 'A', ageWeeksStart: 0, ageWeeksEnd: 52 },
  { id: 'b', label: 'B', ageWeeksStart: 52, ageWeeksEnd: 104 },
];
const branches = [
  { file: 'body.yml', fileId: 'body', data: { id: 'body', name: 'Body', tagline: '', color: '#ffffff', icon: 'body' as const, order: 1 } },
];
const m = (data: Partial<Milestone> & { id: string }, fileId = data.id): Entry<Milestone> => ({
  file: `${fileId}.md`,
  fileId,
  data: milestoneSchema.parse({
    title: data.id,
    branch: 'body',
    tier: 'minor',
    ageWeeksMin: 0,
    ageWeeksMax: 10,
    gameText: 'x',
    sources: [{ label: 's', url: 'https://example.com' }],
    ...data,
  }),
});

describe('validateContent', () => {
  it('passes the real seed content', () => {
    const c = loadContent();
    const res = validateContent({
      branches: c.branches.map((b) => ({ file: `${b.id}.yml`, fileId: b.id, data: b })),
      milestones: c.milestones.map((x) => ({ file: `${x.id}.md`, fileId: x.id, data: x })),
      bands: c.bands,
    });
    expect(res.errors).toEqual([]);
  });

  it('reports a cycle with its path', () => {
    const res = validateContent({
      branches,
      milestones: [m({ id: 'a', prereqs: ['c'] }), m({ id: 'b', prereqs: ['a'] }), m({ id: 'c', prereqs: ['b'] })],
      bands,
    });
    expect(res.errors.join('\n')).toMatch(/Prerequisite cycle: a → c → b → a/);
  });

  it('reports missing references', () => {
    const res = validateContent({ branches, milestones: [m({ id: 'a', prereqs: ['ghost'], branch: 'nope' })], bands });
    expect(res.errors.join('\n')).toMatch(/prerequisite "ghost" does not exist/);
    expect(res.errors.join('\n')).toMatch(/branch "nope" does not exist/);
  });

  it('reports bad ages, id mismatches, duplicates and keystones without gameText', () => {
    const res = validateContent({
      branches,
      milestones: [
        m({ id: 'a', ageWeeksMin: 20, ageWeeksMax: 10 }),
        m({ id: 'b' }, 'not-b'),
        m({ id: 'k', tier: 'keystone', gameText: '' }),
        m({ id: 'q', quests: [{ id: 'x', type: 'play', title: 't', body: '' }, { id: 'x', type: 'play', title: 't', body: '' }] }),
      ],
      bands,
    });
    const text = res.errors.join('\n');
    expect(text).toMatch(/ageWeeksMin \(20\) is greater than ageWeeksMax \(10\)/);
    expect(text).toMatch(/id "b" does not match the file name "not-b"/);
    expect(text).toMatch(/keystones need gameText/);
    expect(text).toMatch(/quest id "x" is used twice/);
  });

  it('warns (not errors) when a prerequisite starts after its dependent', () => {
    const res = validateContent({
      branches,
      milestones: [m({ id: 'a', ageWeeksMin: 30, ageWeeksMax: 40 }), m({ id: 'b', ageWeeksMin: 5, prereqs: ['a'] })],
      bands,
    });
    expect(res.errors).toEqual([]);
    expect(res.warnings.join('\n')).toMatch(/starts at 30w, after "b"/);
  });

  it('errors when a published node depends on a draft', () => {
    const res = validateContent({ branches, milestones: [m({ id: 'a', draft: true }), m({ id: 'b', prereqs: ['a'] })], bands });
    expect(res.errors.join('\n')).toMatch(/is a draft/);
  });

  it('checks that bands cover 0–104 without gaps', () => {
    const res = validateContent({
      branches,
      milestones: [],
      bands: [
        { id: 'a', label: 'A', ageWeeksStart: 0, ageWeeksEnd: 10 },
        { id: 'b', label: 'B', ageWeeksStart: 12, ageWeeksEnd: 100 },
      ],
    });
    expect(res.errors.join('\n')).toMatch(/gap or overlap/);
    expect(res.errors.join('\n')).toMatch(/must end at 104/);
  });
});

describe('helpers', () => {
  it('findCycle returns null for a DAG', () => {
    expect(findCycle(new Map([['a', []], ['b', ['a']]]))).toBeNull();
  });
  it('findBannedWords matches whole words only', () => {
    expect(findBannedWords('You should relax')).toEqual(['should']);
    expect(findBannedWords('See you later')).toEqual([]);
  });
});
