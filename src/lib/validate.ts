/**
 * Pure content checks: references, cycles, age ranges, ids.
 * Used by scripts/validate-content.ts (before every build) and unit tests.
 */
import { MAX_AGE_WEEKS, type Band, type Branch, type Milestone } from './schemas';

export interface Entry<T> {
  /** Id derived from the file name (without extension). */
  fileId: string;
  file: string;
  data: T;
  body?: string;
}

export interface ValidationInput {
  branches: Entry<Branch>[];
  milestones: Entry<Milestone>[];
  bands: Band[];
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

const BANNED = ['should', 'late', 'behind', 'delayed', 'normal range'];

/** Words that are banned in user-facing copy (see the tone guide). */
export function findBannedWords(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED.filter((w) => new RegExp(`\\b${w}\\b`).test(lower));
}

/** Returns one cycle (as a list of ids, first === last) or null. */
export function findCycle(graph: Map<string, string[]>): string[] | null {
  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const colour = new Map<string, number>();
  const stack: string[] = [];

  const visit = (id: string): string[] | null => {
    colour.set(id, GREY);
    stack.push(id);
    for (const next of graph.get(id) ?? []) {
      if (!graph.has(next)) continue;
      const c = colour.get(next) ?? WHITE;
      if (c === GREY) {
        const start = stack.indexOf(next);
        return [...stack.slice(start), next];
      }
      if (c === WHITE) {
        const found = visit(next);
        if (found) return found;
      }
    }
    stack.pop();
    colour.set(id, BLACK);
    return null;
  };

  for (const id of [...graph.keys()].sort()) {
    if ((colour.get(id) ?? WHITE) === WHITE) {
      const found = visit(id);
      if (found) return found;
    }
  }
  return null;
}

export function validateContent(input: ValidationInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Ids match file names and are unique.
  const checkIds = <T extends { id: string }>(kind: string, entries: Entry<T>[]) => {
    const seen = new Map<string, string>();
    for (const e of entries) {
      if (e.data.id !== e.fileId) {
        errors.push(`${e.file}: id "${e.data.id}" does not match the file name "${e.fileId}".`);
      }
      const prev = seen.get(e.data.id);
      if (prev) errors.push(`${kind} id "${e.data.id}" is used twice (${prev} and ${e.file}).`);
      else seen.set(e.data.id, e.file);
    }
  };
  checkIds('Branch', input.branches);
  checkIds('Milestone', input.milestones);

  const branchIds = new Set(input.branches.map((b) => b.data.id));
  const published = input.milestones.filter((m) => !m.data.draft);
  const allById = new Map(input.milestones.map((m) => [m.data.id, m]));

  for (const { file, data: m } of input.milestones) {
    if (!branchIds.has(m.branch)) {
      errors.push(`${file}: branch "${m.branch}" does not exist. Known branches: ${[...branchIds].join(', ')}.`);
    }
    if (m.ageWeeksMin > m.ageWeeksMax) {
      errors.push(`${file}: ageWeeksMin (${m.ageWeeksMin}) is greater than ageWeeksMax (${m.ageWeeksMax}).`);
    }
    for (const v of [m.ageWeeksMin, m.ageWeeksMax]) {
      if (v < 0 || v > MAX_AGE_WEEKS) {
        errors.push(`${file}: age ${v} is outside 0–${MAX_AGE_WEEKS} weeks.`);
      }
    }
    if (m.tier === 'keystone' && !m.gameText.trim()) {
      errors.push(`${file}: keystones need gameText.`);
    }
    const seenPrereqs = new Set<string>();
    for (const p of m.prereqs) {
      if (p === m.id) {
        errors.push(`${file}: "${m.id}" lists itself as a prerequisite.`);
        continue;
      }
      if (seenPrereqs.has(p)) warnings.push(`${file}: prerequisite "${p}" is listed twice.`);
      seenPrereqs.add(p);
      const target = allById.get(p);
      if (!target) {
        errors.push(`${file}: prerequisite "${p}" does not exist.`);
        continue;
      }
      if (!m.draft && target.data.draft) {
        errors.push(`${file}: prerequisite "${p}" is a draft, so it won't be published. Publish it or remove the link.`);
      }
      if (target.data.ageWeeksMin > m.ageWeeksMin) {
        warnings.push(
          `${file}: prerequisite "${p}" starts at ${target.data.ageWeeksMin}w, after "${m.id}" (${m.ageWeeksMin}w).`,
        );
      }
    }
    const questIds = new Set<string>();
    for (const q of m.quests) {
      if (questIds.has(q.id)) errors.push(`${file}: quest id "${q.id}" is used twice.`);
      questIds.add(q.id);
    }
    if (m.tier !== 'keystone' && !m.gameText.trim()) {
      warnings.push(`${file}: no gameText yet.`);
    }
    if (m.sources.length === 0) warnings.push(`${file}: no sources cited.`);

    const copy = [m.title, m.label ?? '', m.gameText, m.fact ?? '', m.body ?? '', ...m.quests.flatMap((q) => [q.title, q.body])].join(
      '\n',
    );
    const banned = findBannedWords(copy);
    if (banned.length) warnings.push(`${file}: avoid ${banned.map((w) => `"${w}"`).join(', ')} in user-facing copy.`);
  }

  // Cycles (over all milestones, drafts included, so drafts can't hide one).
  const graph = new Map<string, string[]>();
  for (const { data: m } of input.milestones) graph.set(m.id, m.prereqs);
  const cycle = findCycle(graph);
  if (cycle) errors.push(`Prerequisite cycle: ${cycle.join(' → ')}.`);

  // Bands: ordered, contiguous, cover 0–104.
  const bands = [...input.bands].sort((a, b) => a.ageWeeksStart - b.ageWeeksStart);
  const bandIds = new Set<string>();
  bands.forEach((b, i) => {
    if (bandIds.has(b.id)) errors.push(`bands.yml: band id "${b.id}" is used twice.`);
    bandIds.add(b.id);
    if (b.ageWeeksStart >= b.ageWeeksEnd) errors.push(`bands.yml: band "${b.id}" must end after it starts.`);
    const prev = bands[i - 1];
    if (prev && prev.ageWeeksEnd !== b.ageWeeksStart) {
      errors.push(`bands.yml: gap or overlap between "${prev.id}" (ends ${prev.ageWeeksEnd}w) and "${b.id}" (starts ${b.ageWeeksStart}w).`);
    }
  });
  if (bands.length) {
    if (bands[0]!.ageWeeksStart !== 0) errors.push('bands.yml: the first band must start at 0 weeks.');
    if (bands[bands.length - 1]!.ageWeeksEnd !== MAX_AGE_WEEKS) {
      errors.push(`bands.yml: the last band must end at ${MAX_AGE_WEEKS} weeks.`);
    }
  }

  if (published.length === 0) warnings.push('No published milestones.');
  return { errors, warnings };
}
