import { expect, test } from '@playwright/test';
import { isoMonthsAgo, saved } from './helpers';

test('onboarding: DOB → catch-up → tree with today line', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/levelling up/i);

  await page.getByRole('button', { name: "Start your baby's tree" }).first().click();
  const dialog = page.getByRole('dialog', { name: "Start your baby's tree" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/talk to your health visitor or GP/)).toBeVisible();

  await dialog.getByLabel("Baby's name or nickname").fill('Bean');
  await dialog.getByLabel('Date of birth').fill(isoMonthsAgo(7, 14));
  await dialog.getByRole('button', { name: 'Continue' }).click();

  // Catch-up: skills whose window has passed, all ticked by default.
  const catchUp = page.getByRole('dialog', { name: 'Quick catch-up' });
  await expect(catchUp).toBeVisible();
  await expect(catchUp.getByLabel('Coos and Gurgles')).toBeChecked();
  await catchUp.getByLabel('First Social Smile').uncheck();
  await catchUp.getByRole('button', { name: 'Show the tree' }).click();
  await expect(catchUp).toBeHidden();

  const state = await saved(page);
  expect(state.baby.name).toBe('Bean');
  expect(state.unlocked['coos']).toBeTruthy();
  expect(state.unlocked['social-smile']).toBeUndefined();

  if (info.project.name === 'mobile') {
    // Up next is the default landing tab on mobile.
    await expect(page.getByRole('tab', { name: 'Up next' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Up next' })).toBeVisible();
    await page.getByRole('tab', { name: 'Tree' }).click();
  }
  await expect(page.locator('[data-today]')).toBeVisible();
  await expect(page.locator('.today-chip')).toHaveText(/Today · 7 months 2 weeks/i);
  // The unticked keystone is still ready, not "late".
  await expect(page.locator('#node-social-smile')).toHaveAttribute('aria-label', /ready/);
});

test('onboarding: corrected age for a baby born early', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: "Start your baby's tree" }).first().click();
  const dialog = page.getByRole('dialog', { name: "Start your baby's tree" });
  await dialog.getByLabel('Date of birth').fill(isoMonthsAgo(3));
  await dialog.getByLabel('Due date').fill(isoMonthsAgo(1, 14));
  await expect(dialog.getByText(/Using corrected age/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Continue' }).click();
  const finish = page.getByRole('button', { name: 'Show the tree' });
  if (await finish.isVisible()) await finish.click();
  await expect(page.locator('dialog.onboarding')).toBeHidden();
  if (await page.getByRole('tab', { name: 'Tree' }).isVisible()) await page.getByRole('tab', { name: 'Tree' }).click();
  await expect(page.locator('.today-chip')).toHaveText(/\(corrected\)/);
});

test('onboarding: validation messages are announced', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: "Start your baby's tree" }).first().click();
  const dialog = page.getByRole('dialog', { name: "Start your baby's tree" });
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Enter a valid date of birth.');
});
