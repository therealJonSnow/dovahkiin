import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import YAML from 'yaml';
import { bandsFileSchema, branchSchema, milestoneSchema, type Band, type Branch, type Milestone } from '../../src/lib/schemas';

const dir = join(import.meta.dirname, '../../src/content');

export function loadContent(): { branches: Branch[]; milestones: Milestone[]; bands: Band[] } {
  const branches = readdirSync(join(dir, 'branches')).map((f) =>
    branchSchema.parse(YAML.parse(readFileSync(join(dir, 'branches', f), 'utf8'))),
  );
  const milestones = readdirSync(join(dir, 'milestones')).map((f) =>
    milestoneSchema.parse(matter(readFileSync(join(dir, 'milestones', f), 'utf8')).data),
  );
  const { bands } = bandsFileSchema.parse(YAML.parse(readFileSync(join(dir, 'bands/bands.yml'), 'utf8')));
  return { branches: branches.sort((a, b) => a.order - b.order), milestones, bands };
}
