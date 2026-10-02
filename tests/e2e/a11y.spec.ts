import { expect, test } from '@playwright/test';
import { detail, isoMonthsAgo, openFamily, openNode, seed } from './helpers';

test('keyboard: arrow keys move between nodes, Enter opens, Esc closes and restores focus', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'keyboard flow is checked on desktop');
  await seed(page, { dob: isoMonthsAgo(3), view: 'tree' });
  await page.goto('/');
  await openFamily(page, 'body');
  const first = page.locator('.node[tabindex="0"]');
  await expect(first).toHaveCount(1);
  await first.focus();
  const startId = await first.getAttribute('data-id');
  // The first tabbable node is the earliest ready skill, at the bottom: step up the tree.
  await page.keyboard.press('ArrowUp');
  const movedId = await page.evaluate(() => (document.activeElement as HTMLElement).dataset.id);
  expect(movedId).toBeTruthy();
  expect(movedId).not.toBe(startId);
  // Hover/focus preview for reading longer text without opening anything.
  await expect(page.getByRole('tooltip')).toBeVisible();

  // Details open in the sidebar; Escape closes them and puts focus back on the node.
  await page.keyboard.press('Enter');
  await expect(detail(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(detail(page)).toBeHidden();
  expect(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.id)).toBe(movedId);

  // A second Escape zooms back out to the overview, focusing the family's card.
  await page.keyboard.press('Escape');
  await expect(page.locator('.focus')).toHaveCount(0);
  await expect(page.locator('.card[data-family="body"]')).toBeFocused();
});

test('nodes have descriptive accessible names', async ({ page }) => {
  await seed(page, { dob: isoMonthsAgo(4), view: 'tree' });
  await page.goto('/');
  await expect(page.locator('.card[data-family="body"]')).toHaveAccessibleName(/^The Body: .*\. \d+ of 8 unlocked\./);
  await openFamily(page, 'body');
  await expect(page.locator('#node-rolls-front-to-back')).toHaveAttribute(
    'aria-label',
    'Rolls over, The Body, waiting on a prerequisite, usually 3–6 months',
  );
});

test('reduced motion: no pulsing and no particles', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, { dob: isoMonthsAgo(3), view: 'tree' });
  await page.goto('/');
  await openFamily(page, 'heart');
  const ring = page.locator('#node-social-smile .ring');
  await expect(page.locator('#node-social-smile')).toHaveAttribute('aria-label', /ready/);
  expect(await ring.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');

  await openNode(page, 'social-smile');
  await page.getByRole('button', { name: 'Mark as unlocked' }).click();
  await page.waitForTimeout(400);
  await expect(page.locator('.layer canvas')).toHaveCount(0);
});

test('static skill pages work without JavaScript and carry the disclaimer', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/skills/rolls-front-to-back');
  await expect(page.getByRole('heading', { level: 2, name: /Rolls Over/ })).toBeVisible();
  await expect(page.getByText('Clear the cot')).toBeVisible();
  await expect(page.getByText(/talk to your health visitor or GP/).first()).toBeVisible();
  await page.goto('/about');
  await expect(page.getByText(/talk to your health visitor or GP/).first()).toBeVisible();
  await ctx.close();
});
