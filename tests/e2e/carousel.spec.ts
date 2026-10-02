import { expect, test } from '@playwright/test';
import { detail, isoMonthsAgo, openFamily, seed } from './helpers';

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'sidebar layout is desktop-only');
});

test('lands on the overview with no sidebar, then zooms into a family with one', async ({ page }) => {
  await seed(page, { dob: isoMonthsAgo(4) });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Skill families' })).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(6);
  await expect(page.locator('aside.side')).toHaveCount(0);
  await expect(page.locator('.node')).toHaveCount(0);

  await openFamily(page, 'body');
  await expect(page).toHaveURL(/\?family=body$/);
  const side = page.getByRole('complementary', { name: 'About The Body' });
  await expect(side).toBeVisible();
  await expect(side.getByText('Ready now')).toBeVisible();
  // Only this family's skills are in the tree.
  await expect(page.locator('.node')).toHaveCount(8);

  // Arrows move through the carousel, wrapping round, and the sidebar follows.
  await page.getByRole('button', { name: 'Previous family: The Independence' }).click();
  await expect(page.getByRole('complementary', { name: 'About The Independence' })).toBeVisible();
  await expect(page).toHaveURL(/\?family=independence$/);
  await page.getByRole('button', { name: 'The Mind', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'The Mind' }).first()).toBeVisible();

  // Back to the overview with the button, or the browser's Back button.
  await page.getByRole('button', { name: 'All families' }).click();
  await expect(page.locator('aside.side')).toHaveCount(0);
  await openFamily(page, 'heart');
  await page.goBack();
  await expect(page.locator('.focus')).toHaveCount(0);
});

test('the tree grows upwards: earlier skills sit lower on screen', async ({ page }) => {
  await seed(page, { dob: isoMonthsAgo(4) });
  await page.goto('/?family=body');
  const y = async (id: string) => (await page.locator(`#node-${id}`).boundingBox())!.y;
  expect(await y('lifts-head-tummy-time')).toBeGreaterThan(await y('rolls-front-to-back'));
  expect(await y('rolls-front-to-back')).toBeGreaterThan(await y('walks-alone'));
});

test('skill details open in the sidebar and link across families', async ({ page }) => {
  await seed(page, { dob: isoMonthsAgo(7) });
  await page.goto('/?family=body');
  await page.locator('#node-crawls').click();
  const panel = detail(page, 'Crawls');
  await expect(panel).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Back to Body' }).click();
  await expect(page.getByRole('complementary', { name: 'About The Body' }).getByText('Motor skills', { exact: false })).toBeVisible();
});

test('Up next opens from the HUD and jumps to a skill in its family', async ({ page }) => {
  await seed(page, { dob: isoMonthsAgo(3) });
  await page.goto('/');
  await page.getByRole('button', { name: /^Up next, \d+ ready now$/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Up next' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /First Social Smile/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\?family=heart$/);
  await expect(detail(page, 'First Social Smile')).toBeVisible();
});
