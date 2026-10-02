import type { Page } from '@playwright/test';

export const STORAGE_KEY = 'levelup:v1';

/** ISO date `months` months and `days` days before today (local time). */
export function isoMonthsAgo(months: number, days = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setDate(d.getDate() - days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface Seed {
  dob: string;
  name?: string;
  unlocked?: Record<string, { date: string; skipped?: boolean }>;
  view?: 'upnext' | 'tree';
}

/** Seeds saved progress before any page script runs (first navigation only). */
export async function seed(page: Page, s: Seed) {
  const state = {
    version: 1,
    baby: { dob: s.dob, ...(s.name ? { name: s.name } : {}) },
    unlocked: s.unlocked ?? {},
    questsDone: {},
    prefs: { view: s.view ?? 'tree' },
  };
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem('__seeded')) {
        localStorage.setItem(key, value);
        sessionStorage.setItem('__seeded', '1');
      }
    },
    [STORAGE_KEY, JSON.stringify(state)] as const,
  );
}

export async function saved(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);
}

/** Zooms from the overview into a family's carousel slide. */
export async function openFamily(page: Page, branch: string) {
  await page.locator(`.card[data-family="${branch}"]`).click();
  await page.locator('.focus .bar').waitFor();
}

/** Zooms into the family holding a skill (if needed), then opens its details. */
export async function openNode(page: Page, id: string) {
  const node = page.locator(`#node-${id}`);
  if (!(await node.isVisible())) await page.locator(`.card:has([data-id="${id}"])`).click();
  await node.click();
  await detail(page).first().waitFor();
}

/** A skill's details: the sidebar on desktop, the bottom sheet on phones. */
export function detail(page: Page, name?: string | RegExp) {
  const where = page.locator('aside.side:has([data-detail]), dialog.drawer[open]');
  return name ? where.filter({ has: page.getByRole('heading', { level: 2, name }) }) : where;
}
