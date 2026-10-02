import { expect, test } from '@playwright/test';
import { isoMonthsAgo, openNode, saved, seed } from './helpers';

test.beforeEach(async ({ page }) => {
  await seed(page, { dob: isoMonthsAgo(3), view: 'tree' });
});

test('unlocking a node updates its state and persists across reload', async ({ page }) => {
  await page.goto('/');
  const node = page.locator('#node-social-smile');
  await expect(node).toHaveAttribute('aria-label', /ready/);
  await openNode(page, 'social-smile');

  const drawer = page.getByRole('dialog', { name: 'First Social Smile' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(/talk to your health visitor or GP/)).toBeVisible();
  await drawer.getByRole('button', { name: 'Mark as unlocked' }).click();
  await expect(drawer.getByRole('button', { name: 'Undo' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(node).toHaveAttribute('aria-label', /unlocked/);

  await page.reload();
  await expect(page.locator('#node-social-smile')).toHaveAttribute('aria-label', /unlocked/);
  expect((await saved(page)).unlocked['social-smile'].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test('unlocking out of order asks about prerequisites, and "skipped" counts as satisfied', async ({ page }) => {
  await page.goto('/');
  // Crawls needs Sits ← Rolls ← Steady head ← Lifts head.
  await openNode(page, 'crawls');
  const drawer = page.getByRole('dialog', { name: 'Crawls' });
  await drawer.getByRole('button', { name: 'Mark as unlocked' }).click();

  const prompt = page.getByRole('alertdialog', { name: 'Also mark its prerequisites as unlocked?' });
  await expect(prompt).toBeVisible();
  await expect(prompt.getByRole('listitem')).toHaveCount(4);
  await prompt.getByRole('button', { name: 'No, they skipped them' }).click();
  await expect(prompt).toBeHidden();

  const s = await saved(page);
  expect(s.unlocked['crawls'].skipped).toBeUndefined();
  expect(s.unlocked['sits-without-support'].skipped).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#node-sits-without-support')).toHaveAttribute('aria-label', /skipped/);
  await expect(page.locator('#node-pulls-to-stand')).toHaveAttribute('aria-label', /, (ready|coming up|locked),/);
});

test('quests can be ticked and award Dad XP', async ({ page }) => {
  await page.goto('/');
  await openNode(page, 'rolls-front-to-back');
  const drawer = page.getByRole('dialog', { name: /Rolls Over/ });
  await drawer.getByRole('checkbox', { name: /Clear the cot/ }).check();
  expect(Object.keys((await saved(page)).questsDone)).toContain('rolls-front-to-back:clear-the-cot');
});

test('progress can be exported and imported', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Export progress' }).click()]);
  const path = await download.path();
  const fs = await import('node:fs');
  const exported = JSON.parse(fs.readFileSync(path, 'utf8'));
  expect(exported.version).toBe(1);

  exported.unlocked['coos'] = { date: '2026-01-01' };
  await page.locator('input[type=file]').setInputFiles({
    name: 'progress.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await expect(dialog.getByRole('status')).toHaveText('Progress imported.');
  expect((await saved(page)).unlocked['coos']).toEqual({ date: '2026-01-01' });
});
