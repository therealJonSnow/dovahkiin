import { describe, expect, it } from 'vitest';
import { ageToY, computeLayout, DEFAULT_LAYOUT, yToAge, type Layout } from '../../src/lib/layout';
import { loadContent } from './helpers';

const bands = [
  { id: 'a', label: 'A', ageWeeksStart: 0, ageWeeksEnd: 6 },
  { id: 'b', label: 'B', ageWeeksStart: 6, ageWeeksEnd: 13 },
  { id: 'c', label: 'C', ageWeeksStart: 13, ageWeeksEnd: 104 },
];

function assertNoOverlaps(layout: Layout, minGap = DEFAULT_LAYOUT.rowHeight) {
  const ids = Object.keys(layout.nodes);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = layout.nodes[ids[i]!]!;
      const b = layout.nodes[ids[j]!]!;
      if (a.col !== b.col) continue;
      expect(Math.abs(a.y - b.y), `${ids[i]} vs ${ids[j]}`).toBeGreaterThanOrEqual(minGap - 1);
    }
  }
}

function assertInsideBands(layout: Layout) {
  for (const [id, n] of Object.entries(layout.nodes)) {
    const band = layout.bands.find((b) => b.id === n.band)!;
    expect(n.y, id).toBeGreaterThanOrEqual(band.y + layout.padTop - 1);
    expect(n.y, id).toBeLessThanOrEqual(band.y + band.height - layout.padBottom + 1);
  }
}

describe('computeLayout', () => {
  it('stacks a dense band without overlaps and grows the band to fit', () => {
    const nodes = Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, branch: 'x', ageWeeksMin: 1, prereqs: [] }));
    const layout = computeLayout(['x', 'y'], bands, nodes);
    assertNoOverlaps(layout);
    assertInsideBands(layout);
    const a = layout.bands[0]!;
    expect(a.height).toBeGreaterThanOrEqual(DEFAULT_LAYOUT.padTop + DEFAULT_LAYOUT.padBottom + 5 * DEFAULT_LAYOUT.rowHeight);
  });

  it('orders nodes by age within a column and respects sortOffset', () => {
    const layout = computeLayout(['x'], bands, [
      { id: 'late', branch: 'x', ageWeeksMin: 5, prereqs: [] },
      { id: 'early', branch: 'x', ageWeeksMin: 1, prereqs: [] },
      { id: 'nudged', branch: 'x', ageWeeksMin: 2, sortOffset: 10, prereqs: [] },
    ]);
    expect(layout.nodes.early!.y).toBeLessThan(layout.nodes.late!.y);
    expect(layout.nodes.late!.y).toBeLessThan(layout.nodes.nudged!.y);
  });

  it('marks cross-branch edges and drops edges to missing nodes', () => {
    const layout = computeLayout(['x', 'y'], bands, [
      { id: 'a', branch: 'x', ageWeeksMin: 1, prereqs: [] },
      { id: 'b', branch: 'y', ageWeeksMin: 8, prereqs: ['a', 'ghost'] },
      { id: 'c', branch: 'x', ageWeeksMin: 9, prereqs: ['a'] },
    ]);
    expect(layout.edges).toEqual([
      { from: 'a', to: 'b', cross: true },
      { from: 'a', to: 'c', cross: false },
    ]);
  });

  it('is deterministic', () => {
    const nodes = [
      { id: 'a', branch: 'x', ageWeeksMin: 1, prereqs: [] },
      { id: 'b', branch: 'x', ageWeeksMin: 20, prereqs: ['a'] },
    ];
    expect(computeLayout(['x'], bands, nodes)).toEqual(computeLayout(['x'], bands, nodes));
  });

  it('lays out the real seed content with no overlaps, all views', () => {
    const { branches, milestones, bands: realBands } = loadContent();
    const cols = branches.map((b) => b.id);
    const nodes = milestones.filter((m) => !m.draft);
    const all = computeLayout(cols, realBands, nodes);
    expect(Object.keys(all.nodes)).toHaveLength(nodes.length);
    assertNoOverlaps(all);
    assertInsideBands(all);
    for (const c of cols) {
      const single = computeLayout([c], realBands, nodes);
      assertNoOverlaps(single);
      assertInsideBands(single);
    }
  });
});

describe('ageToY / yToAge', () => {
  const layout = computeLayout(['x'], bands, [{ id: 'a', branch: 'x', ageWeeksMin: 3, prereqs: [] }]);
  it('is monotonic and invertible', () => {
    let prev = -Infinity;
    for (let w = 0; w <= 104; w += 0.5) {
      const y = ageToY(layout, w);
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
      expect(yToAge(layout, y)).toBeCloseTo(w, 5);
    }
  });
  it('clamps beyond the tree', () => {
    expect(ageToY(layout, 200)).toBe(ageToY(layout, 104));
  });
});
