/**
 * Validates src/content before every build. Exits 1 with readable messages
 * on errors; prints warnings but carries on.
 *
 *   pnpm validate
 */
import { readFileSync, readdirSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import YAML from 'yaml';
import type { z } from 'zod';
import {
  bandsFileSchema,
  branchSchema,
  milestoneSchema,
  settingsSchema,
  type Branch,
  type Milestone,
} from '../src/lib/schemas';
import { validateContent, type Entry } from '../src/lib/validate';

const root = fileURLToPath(new URL('..', import.meta.url));
const contentDir = join(root, 'src/content');
const rel = (p: string) => relative(root, p);

const errors: string[] = [];

function formatZod(file: string, err: z.ZodError): string[] {
  return err.issues.map((i) => `${file}: ${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`);
}

function parse<T>(file: string, schema: z.ZodType<T>, data: unknown): T | null {
  const res = schema.safeParse(data);
  if (res.success) return res.data;
  errors.push(...formatZod(file, res.error));
  return null;
}

function readYaml(path: string): unknown {
  try {
    return YAML.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    errors.push(`${rel(path)}: invalid YAML (${(e as Error).message.split('\n')[0]})`);
    return null;
  }
}

const listFiles = (dir: string, ext: string[]) =>
  readdirSync(dir)
    .filter((f) => ext.includes(extname(f)))
    .sort()
    .map((f) => join(dir, f));

const branches: Entry<Branch>[] = [];
for (const path of listFiles(join(contentDir, 'branches'), ['.yml', '.yaml'])) {
  const data = parse(rel(path), branchSchema, readYaml(path));
  if (data) branches.push({ file: rel(path), fileId: basename(path, extname(path)), data });
}

const milestones: Entry<Milestone>[] = [];
for (const path of listFiles(join(contentDir, 'milestones'), ['.md'])) {
  let fm: matter.GrayMatterFile<string>;
  try {
    fm = matter(readFileSync(path, 'utf8'));
  } catch (e) {
    errors.push(`${rel(path)}: invalid frontmatter (${(e as Error).message.split('\n')[0]})`);
    continue;
  }
  const data = parse(rel(path), milestoneSchema, fm.data);
  if (data) milestones.push({ file: rel(path), fileId: basename(path, '.md'), data, body: fm.content });
}

const bandsFile = parse('src/content/bands/bands.yml', bandsFileSchema, readYaml(join(contentDir, 'bands/bands.yml')));
parse('src/content/settings/site.yml', settingsSchema, readYaml(join(contentDir, 'settings/site.yml')));

const result = validateContent({ branches, milestones, bands: bandsFile?.bands ?? [] });
errors.push(...result.errors);

const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

for (const w of result.warnings) console.warn(yellow(`  warn  ${w}`));
if (errors.length) {
  console.error(red(`\nContent validation failed with ${errors.length} error(s):\n`));
  for (const e of errors) console.error(red(`  ✗ ${e}`));
  console.error('\nFix these in the CMS (/admin) or in src/content, then rebuild.\n');
  process.exit(1);
}
const published = milestones.filter((m) => !m.data.draft).length;
console.log(
  `✓ Content OK: ${branches.length} branches, ${published} published milestones` +
    `${milestones.length - published ? ` (+${milestones.length - published} drafts)` : ''}, ` +
    `${bandsFile?.bands.length ?? 0} bands, ${result.warnings.length} warning(s).`,
);
