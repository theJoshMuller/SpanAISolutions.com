import { test, expect } from '@playwright/test';

for (const width of [375, 1280]) {
  test(`quiz is absent from the live-site surfaces at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/about', '/contact']) {
      await page.goto(path);
      await expect(page.locator('a[href^="/quiz"]')).toHaveCount(0);
      await expect(page.locator('header')).not.toContainText('AI Level Quiz');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.goto('/');
    await expect(page.locator('main a[href="/contact"]').first()).toBeVisible();
    if (width === 375) {
      await page.locator('.mobile-nav summary').click();
      await expect(page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'About', exact: true })).toBeVisible();
    }
  });
}

test('parked quiz pages are not generated as static public pages', async ({ request }) => {
  // Astro preview has no Netlify Functions; production redirects are covered by function tests and live checks.
  for (const path of ['/quiz', '/quiz/subscribed', '/_quiz', '/_quiz/subscribed']) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});
