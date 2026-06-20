import { test, expect } from '@playwright/test';

test('hero communicates the locked promise', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Span AI Solutions — More closing. Less chasing.');
  await expect(
    page.getByRole('heading', { name: 'More closing. Less chasing.' })
  ).toBeVisible();
  await expect(
    page.getByText('An agentic sales support team for every closer.', { exact: true })
  ).toBeVisible();

  const main = page.getByRole('main');
  await expect(main).toBeVisible();

  const hero = page.getByRole('region', { name: 'More closing. Less chasing.' });
  await expect(hero).toBeVisible();

  const heroCta = hero.getByRole('link', { name: 'Email sales' });
  await expect(heroCta).toHaveAttribute('href', 'mailto:sales@spanaisolutions.com');
});

test('support strip lists the six closer-support capabilities', async ({ page }) => {
  await page.goto('/');

  const strip = page.getByRole('region', { name: 'Closer support coverage' });

  for (const item of [
    'CRM Management',
    'SDR Support',
    'Lead Research',
    'Cold Outreach',
    'AI Voice Receptionist',
    'AI Voice Cold Caller',
  ]) {
    await expect(strip.getByText(item, { exact: true })).toBeVisible();
  }
});
