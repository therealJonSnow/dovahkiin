/**
 * Build-time loader (Astro only): collections → validated, laid-out tree data.
 */
import { getCollection } from 'astro:content';
import { computeLayout, type Layout } from './layout';
import type { ClientNode, TreeData } from './types';

let cache: Promise<TreeData> | null = null;

export function getTreeData(): Promise<TreeData> {
  cache ??= load();
  return cache;
}

async function load(): Promise<TreeData> {
  const [branchEntries, milestoneEntries, bandEntries, settingsEntries] = await Promise.all([
    getCollection('branches'),
    getCollection('milestones'),
    getCollection('bands'),
    getCollection('settings'),
  ]);

  const branches = branchEntries.map((e) => e.data).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const bands = bandEntries.map((e) => e.data).sort((a, b) => a.ageWeeksStart - b.ageWeeksStart);
  const settings = settingsEntries[0]!.data;

  // Drafts are visible in `astro dev` but never in production builds.
  const published = milestoneEntries.filter((e) => import.meta.env.DEV || !e.data.draft);
  const ids = new Set(published.map((e) => e.data.id));

  const nodes: ClientNode[] = published
    .map((e) => {
      const { draft: _draft, sortOffset: _so, label, ...rest } = e.data;
      return {
        ...rest,
        label: label ?? rest.title,
        prereqs: rest.prereqs.filter((p) => ids.has(p)),
        unlocks: [] as string[],
        html: e.rendered?.html ?? '',
      };
    })
    .sort((a, b) => a.ageWeeksMin - b.ageWeeksMin || a.id.localeCompare(b.id));

  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) for (const p of n.prereqs) byId.get(p)?.unlocks.push(n.id);

  const layoutInput = published.map((e) => ({
    id: e.data.id,
    branch: e.data.branch,
    ageWeeksMin: e.data.ageWeeksMin,
    sortOffset: e.data.sortOffset,
    prereqs: e.data.prereqs.filter((p) => ids.has(p)),
  }));
  const columns = branches.map((b) => b.id);
  const layouts: Record<string, Layout> = { all: computeLayout(columns, bands, layoutInput) };
  for (const c of columns) layouts[c] = computeLayout([c], bands, layoutInput);

  return { branches, nodes, bands, layouts, settings };
}
