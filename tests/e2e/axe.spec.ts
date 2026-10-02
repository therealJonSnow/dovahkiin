import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { isoMonthsAgo, openNode, seed } from './helpers';

const scan = (page: import('@playwright/test').Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();

for (const scheme of ['dark', 'light'] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('landing has no WCAG A/AA violations', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');
      const { violations } = await scan(page);
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
    });

    test('tree with a baby and the open drawer have no WCAG A/AA violations', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await seed(page, { dob: isoMonthsAgo(6), view: 'tree' });
      await page.goto('/');
      let res = await scan(page);
      expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
      await openNode(page, 'sits-without-support');
      res = await scan(page);
      expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
    });
  });
}

test('static pages have no WCAG A/AA violations', async ({ page }) => {
  for (const url of ['/skills/first-word', '/about']) {
    await page.goto(url);
    const { violations } = await scan(page);
    expect(violations.map((v) => `${url} ${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  }
});
