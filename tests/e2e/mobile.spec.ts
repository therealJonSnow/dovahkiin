import { expect, test, type Page } from '@playwright/test';
import { isoMonthsAgo, seed } from './helpers';

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'mobile', 'mobile-only checks');
});

const noHorizontalScroll = async (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test('375px: no horizontal scroll on the landing page', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
  expect(await noHorizontalScroll(page)).toBe(true);
});

test('375px: tabs, branch switcher and bottom-sheet drawer', async ({ page }) => {
  await seed(page, { dob: isoMonthsAgo(5), view: 'upnext' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Up next' })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  await page.getByRole('tab', { name: 'Tree' }).click();
  await expect(page.locator('#node-first-word')).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  // Pick one branch: only its nodes are shown, full width.
  await page.getByRole('button', { name: 'Voice', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Voice', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.node')).toHaveCount(3);
  expect(await noHorizontalScroll(page)).toBe(true);

  await page.locator('#node-babbles').click();
  const sheet = page.getByRole('dialog', { name: 'Babbles' });
  await expect(sheet).toBeVisible();
  const box = await sheet.boundingBox();
  const vp = page.viewportSize()!;
  expect(Math.round(box!.width)).toBe(vp.width);
  expect(Math.round(box!.y + box!.height)).toBe(vp.height);
});

test('375px: tapping a node in the overview zooms into its branch', async ({ page }) => {
  await seed(page, { dob: isoMonthsAgo(5), view: 'tree' });
  await page.goto('/');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.locator('#node-laughs').click();
  await expect(page.getByRole('button', { name: 'Heart', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('dialog')).toBeHidden();
});
