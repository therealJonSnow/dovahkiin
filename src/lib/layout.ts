/**
 * Build-time layout model for the vertical tree.
 *
 * Y = age (non-linear: each band is tall enough for its densest column),
 * X = branch column. Within a column, nodes zig-zag a little either side of
 * the centre line so connectors read like constellations.
 */

export interface LayoutInputNode {
  id: string;
  branch: string;
  ageWeeksMin: number;
  prereqs: string[];
  sortOffset?: number;
}

export interface LayoutInputBand {
  id: string;
  label: string;
  ageWeeksStart: number;
  ageWeeksEnd: number;
}

export interface LayoutOptions {
  /** Minimum vertical distance between two nodes in the same column (px). */
  rowHeight: number;
  /** Room at the top of each band (for its label). */
  /** padTop + padBottom must be >= rowHeight so nodes either side of a band boundary can't collide. */
  padTop: number;
  padBottom: number;
  minBandHeight: number;
  /** Extra band height per week of age covered. */
  pxPerWeek: number;
  /** Max horizontal offset from the column centre, as a fraction of column width. */
  zigzag: number;
}

export const DEFAULT_LAYOUT: LayoutOptions = {
  rowHeight: 92,
  padTop: 44,
  padBottom: 48,
  minBandHeight: 170,
  pxPerWeek: 3,
  zigzag: 0.2,
};

export interface LayoutBand extends LayoutInputBand {
  y: number;
  height: number;
}

export interface LayoutNode {
  col: number;
  /** Centre, as a fraction (0–1) of the column width. */
  x: number;
  y: number;
  band: string;
}

export interface LayoutEdge {
  from: string;
  to: string;
  cross: boolean;
}

export interface Layout {
  columns: string[];
  bands: LayoutBand[];
  nodes: Record<string, LayoutNode>;
  edges: LayoutEdge[];
  height: number;
  padTop: number;
  padBottom: number;
}

/** Small deterministic hash (FNV-1a) → [0, 1). */
export function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x1_0000_0000;
}

export function bandFor<B extends LayoutInputBand>(bands: B[], weeks: number): B {
  for (const b of bands) if (weeks >= b.ageWeeksStart && weeks < b.ageWeeksEnd) return b;
  return weeks < bands[0]!.ageWeeksStart ? bands[0]! : bands[bands.length - 1]!;
}

const position = (n: LayoutInputNode) => n.ageWeeksMin + (n.sortOffset ?? 0);

export function computeLayout(
  columns: string[],
  bandsIn: LayoutInputBand[],
  nodesIn: LayoutInputNode[],
  opts: LayoutOptions = DEFAULT_LAYOUT,
): Layout {
  if (opts.padTop + opts.padBottom < opts.rowHeight) throw new Error('layout: padTop + padBottom must be >= rowHeight');
  const colIndex = new Map(columns.map((c, i) => [c, i]));
  const nodes = nodesIn.filter((n) => colIndex.has(n.branch));
  const sortedBands = [...bandsIn].sort((a, b) => a.ageWeeksStart - b.ageWeeksStart);

  // Group by band, then column.
  const groups = new Map<string, Map<number, LayoutInputNode[]>>();
  for (const b of sortedBands) groups.set(b.id, new Map());
  for (const n of nodes) {
    const band = bandFor(sortedBands, n.ageWeeksMin);
    const byCol = groups.get(band.id)!;
    const col = colIndex.get(n.branch)!;
    if (!byCol.has(col)) byCol.set(col, []);
    byCol.get(col)!.push(n);
  }

  const bands: LayoutBand[] = [];
  const out: Record<string, LayoutNode> = {};
  let y = 0;

  for (const b of sortedBands) {
    const byCol = groups.get(b.id)!;
    let densest = 0;
    for (const list of byCol.values()) densest = Math.max(densest, list.length);
    const needed = opts.padTop + opts.padBottom + Math.max(0, densest - 1) * opts.rowHeight;
    const height = Math.max(opts.minBandHeight + (b.ageWeeksEnd - b.ageWeeksStart) * opts.pxPerWeek, needed);
    const band: LayoutBand = { ...b, y, height };
    bands.push(band);

    const top = y + opts.padTop;
    const bottom = y + height - opts.padBottom;
    const span = Math.max(1e-9, b.ageWeeksEnd - b.ageWeeksStart);

    for (const [col, list] of byCol) {
      list.sort((p, q) => position(p) - position(q) || p.id.localeCompare(q.id));
      const ideal = list.map((n) => {
        const frac = Math.min(1, Math.max(0, (position(n) - b.ageWeeksStart) / span));
        return top + frac * (bottom - top);
      });
      // Forward pass: keep a minimum gap. Backward pass: stay inside the band.
      const ys = [...ideal];
      for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i]!, ys[i - 1]! + opts.rowHeight);
      if (ys.length) ys[ys.length - 1] = Math.min(ys[ys.length - 1]!, bottom);
      for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.min(ys[i]!, ys[i + 1]! - opts.rowHeight);
      list.forEach((n, i) => {
        out[n.id] = { col, x: 0.5, y: Math.round(ys[i]!), band: b.id };
      });
    }
    y += height;
  }

  // Zig-zag: alternate sides down each column, magnitude varied per node.
  for (let col = 0; col < columns.length; col++) {
    const inCol = nodes.filter((n) => colIndex.get(n.branch) === col).sort((p, q) => out[p.id]!.y - out[q.id]!.y);
    inCol.forEach((n, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const mag = opts.zigzag * (0.35 + 0.65 * hash01(n.id));
      out[n.id]!.x = Math.round((0.5 + side * mag) * 1000) / 1000;
    });
  }

  const edges: LayoutEdge[] = [];
  for (const n of nodes) {
    for (const p of n.prereqs) {
      const from = nodes.find((m) => m.id === p);
      if (!from) continue;
      edges.push({ from: p, to: n.id, cross: from.branch !== n.branch });
    }
  }

  return { columns, bands, nodes: out, edges, height: y, padTop: opts.padTop, padBottom: opts.padBottom };
}

/** Maps an age (weeks) to a y position, linear within its band. */
export function ageToY(layout: Pick<Layout, 'bands' | 'padTop' | 'padBottom' | 'height'>, weeks: number): number {
  const bands = layout.bands;
  if (!bands.length) return 0;
  const first = bands[0]!;
  const last = bands[bands.length - 1]!;
  if (weeks <= first.ageWeeksStart) return first.y + layout.padTop;
  if (weeks >= last.ageWeeksEnd) return last.y + last.height - layout.padBottom;
  const b = bandFor(bands, weeks);
  const top = b.y + layout.padTop;
  const bottom = b.y + b.height - layout.padBottom;
  return top + ((weeks - b.ageWeeksStart) / (b.ageWeeksEnd - b.ageWeeksStart)) * (bottom - top);
}

/** Inverse of ageToY (used to scrub age by dragging). */
export function yToAge(layout: Pick<Layout, 'bands' | 'padTop' | 'padBottom'>, y: number): number {
  const bands = layout.bands;
  for (const b of bands) {
    if (y < b.y + b.height) {
      const top = b.y + layout.padTop;
      const bottom = b.y + b.height - layout.padBottom;
      const frac = Math.min(1, Math.max(0, (y - top) / (bottom - top)));
      return b.ageWeeksStart + frac * (b.ageWeeksEnd - b.ageWeeksStart);
    }
  }
  return bands.length ? bands[bands.length - 1]!.ageWeeksEnd : 0;
}
