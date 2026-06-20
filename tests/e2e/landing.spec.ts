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

test('operating functions section presents five premium support cards', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'What Span actually does' })
  ).toBeVisible();

  for (const title of [
    'Keep the pipeline clean',
    'Research the right leads',
    'Run outbound support',
    'Cover the front door',
    'Coordinate the support layer',
  ]) {
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }
});

test('how it works explains the three-step support model', async ({ page }) => {
  await page.goto('/');

  const section = page.getByRole('region', { name: 'How it works' });
  await expect(section).toBeVisible();
  await expect(section.getByRole('heading', { name: 'How it works' })).toBeVisible();

  const orderedTitles = [
    'Plug into your current sales motion',
    'Span runs the support layer',
    'Closers stay in high-value conversations',
  ];

  const stepList = section.locator('ol');
  await expect(stepList).toHaveCount(1);

  const stepItems = section.locator('ol > li');
  await expect(stepItems).toHaveCount(3);

  const stepHeadings = section.locator('ol > li h3');
  await expect(stepHeadings).toHaveText(orderedTitles);

  for (const title of orderedTitles) {
    await expect(section.getByRole('heading', { name: title })).toBeVisible();
  }

  const stepIndices = section.locator('ol > li .step-card__index');
  await expect(stepIndices).toHaveText(['01', '02', '03']);

  for (let index = 0; index < 3; index += 1) {
    await expect(stepIndices.nth(index)).toHaveAttribute('aria-hidden', 'true');
  }
});
