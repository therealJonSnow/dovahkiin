import { expect, test, type Page } from '@playwright/test';
import { isoMonthsAgo, openFamily, seed } from './helpers';

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

test('375px: overview → one family at a time → bottom-sheet details', async ({ page }) => {
  await seed(page, { dob: isoMonthsAgo(5) });
  await page.goto('/');
  await expect(page.locator('.card')).toHaveCount(6);
  expect(await noHorizontalScroll(page)).toBe(true);

  // Zoom into one family: only its skills are on screen, with no sidebar.
  await openFamily(page, 'voice');
  await expect(page.getByRole('heading', { name: 'The Voice' })).toBeVisible();
  await expect(page.locator('.node')).toHaveCount(3);
  await expect(page.locator('aside.side')).toHaveCount(0);
  expect(await noHorizontalScroll(page)).toBe(true);

  // The carousel moves on to the next family.
  await page.getByRole('button', { name: /^Next family/ }).click();
  await expect(page.getByRole('heading', { name: 'The Senses' })).toBeVisible();
  await page.getByRole('button', { name: /^Previous family/ }).click();
  await expect(page.getByRole('heading', { name: 'The Voice' })).toBeVisible();

  await page.locator('#node-babbles').click();
  const sheet = page.getByRole('dialog', { name: 'Babbles' });
  await expect(sheet).toBeVisible();
  // Measure after the slide-up animation has finished.
  await sheet.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  const box = await sheet.boundingBox();
  const vp = page.viewportSize()!;
  expect(Math.round(box!.width)).toBe(vp.width);
  expect(Math.round(box!.y + box!.height)).toBe(vp.height);
});

test('375px: swiping moves between families', async ({ page }) => {
  await seed(page, { dob: isoMonthsAgo(5) });
  await page.goto('/?family=body');
  await expect(page.getByRole('heading', { name: 'The Body' })).toBeVisible();
  const stage = page.locator('.stage');
  const box = (await stage.boundingBox())!;
  const y = Math.min(box.y + 200, 600);
  await stage.dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: 300, clientY: y }] });
  await stage.dispatchEvent('touchend', { changedTouches: [{ identifier: 1, clientX: 120, clientY: y + 10 }] });
  await expect(page.getByRole('heading', { name: 'The Voice' })).toBeVisible();
});
