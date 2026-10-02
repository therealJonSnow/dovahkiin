import { defineCollection } from 'astro:content';
import YAML from 'yaml';
import { file, glob } from 'astro/loaders';
import { bandSchema, branchSchema, milestoneSchema, settingsSchema } from './lib/schemas';

const branches = defineCollection({
  loader: glob({ pattern: '*.yml', base: './src/content/branches' }),
  schema: branchSchema,
});

const milestones = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/milestones' }),
  schema: milestoneSchema,
});

const bands = defineCollection({
  loader: file('./src/content/bands/bands.yml', {
    parser: (text) => {
      // The file holds `{ bands: [...] }` so Sveltia can edit it as one file.
      return (YAML.parse(text) as { bands: unknown[] }).bands as Record<string, unknown>[];
    },
  }),
  schema: bandSchema,
});

const settings = defineCollection({
  loader: file('./src/content/settings/site.yml', {
    parser: (text) => [{ id: 'site', ...(YAML.parse(text) as object) }],
  }),
  schema: settingsSchema,
});

export const collections = { branches, milestones, bands, settings };
