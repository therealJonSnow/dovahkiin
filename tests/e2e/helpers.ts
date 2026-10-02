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

/** Opens a node's drawer. On the phone overview the first tap zooms into the branch, so tap again. */
export async function openNode(page: Page, id: string) {
  const node = page.locator(`#node-${id}`);
  await node.click();
  const dialog = page.locator('dialog.drawer[open]');
  try {
    await dialog.waitFor({ state: 'visible', timeout: 800 });
  } catch {
    await page.locator(`#node-${id}`).click();
    await dialog.waitFor({ state: 'visible' });
  }
}
