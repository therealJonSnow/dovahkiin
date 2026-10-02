/**
 * Content schemas shared by Astro content collections (src/content.config.ts)
 * and the standalone validation script (scripts/validate-content.ts).
 */
import { z } from 'zod';

export const MAX_AGE_WEEKS = 104;

const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const kebabId = z.string().regex(kebab, 'must be kebab-case, e.g. "rolls-front-to-back"');
const weeks = z.number().min(0).max(MAX_AGE_WEEKS);

/** Optional field that also accepts the `null` / `''` a CMS may write for an empty value. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === null || v === '' ? undefined : v), schema.optional());
/** List that treats `null` as empty. */
const list = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === null ? [] : v), z.array(schema).default([]));
/** String that treats `null` as empty. */
const text = () => z.preprocess((v) => (v === null ? '' : v), z.string().default(''));

export const ICON_KEYS = [
  'body',
  'voice',
  'senses',
  'heart',
  'mind',
  'independence',
  'star',
] as const;

export const branchSchema = z.object({
  id: kebabId,
  name: z.string().min(1),
  tagline: text(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a hex colour like "#F28C38"'),
  icon: z.enum(ICON_KEYS).default('star'),
  order: z.number().int(),
});

export const QUEST_TYPES = ['prepare', 'play', 'safety'] as const;

export const questSchema = z.object({
  id: kebabId,
  type: z.enum(QUEST_TYPES),
  title: z.string().min(1),
  body: text(),
  leadWeeks: optional(z.number().min(0).max(52)),
});

export const sourceSchema = z.object({
  label: z.string().min(1),
  url: z.url(),
});

export const TIERS = ['minor', 'major', 'keystone'] as const;

export const milestoneSchema = z.object({
  id: kebabId,
  title: z.string().min(1),
  /** Short label for the tree. Falls back to the title. */
  label: optional(z.string()),
  branch: kebabId,
  tier: z.enum(TIERS),
  ageWeeksMin: weeks,
  ageWeeksMax: weeks,
  prereqs: list(kebabId),
  gameText: text(),
  fact: optional(z.string()),
  quests: list(questSchema),
  sources: list(sourceSchema),
  sortOffset: optional(z.number()),
  draft: z.boolean().default(false),
});

export const bandSchema = z.object({
  id: kebabId,
  label: z.string().min(1),
  ageWeeksStart: weeks,
  ageWeeksEnd: weeks,
});

export const bandsFileSchema = z.object({
  bands: z.array(bandSchema).min(1),
});

export const titleStepSchema = z.object({
  at: z.number().int().min(0),
  title: z.string().min(1),
});

export const settingsSchema = z.object({
  readyLeadWeeks: z.number().min(0).max(26).default(2),
  horizonWeeks: z.number().min(1).max(52).default(8),
  levelTitles: z.array(titleStepSchema).min(1),
  dadRanks: z.array(titleStepSchema).min(1),
  disclaimer: z.string().min(1),
  pastWindowNote: text(),
  onboarding: z.object({
    heroTitle: z.string(),
    heroBody: z.string(),
    cta: z.string(),
    catchUpIntro: z.string(),
  }),
  footer: text(),
});

export type Branch = z.infer<typeof branchSchema>;
export type Quest = z.infer<typeof questSchema>;
export type QuestType = (typeof QUEST_TYPES)[number];
export type Tier = (typeof TIERS)[number];
export type Milestone = z.infer<typeof milestoneSchema>;
export type Band = z.infer<typeof bandSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type TitleStep = z.infer<typeof titleStepSchema>;
