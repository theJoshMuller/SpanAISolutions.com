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

test('human-first positioning is explicit and trust-building', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Human-first by design' })).toBeVisible();
  await expect(page.getByText(/amplify human closers/i)).toBeVisible();
});

test('who it is for identifies the four target buyer groups', async ({ page }) => {
  await page.goto('/');

  const section = page.getByRole('region', { name: "Who it's for" });
  await expect(section).toBeVisible();

  const audienceList = section.getByRole('list');
  await expect(audienceList).toBeVisible();

  const audienceItems = audienceList.getByRole('listitem');
  await expect(audienceItems).toHaveCount(4);
  await expect(audienceItems).toHaveText([
    'Founder-led sales teams',
    'High-ticket service companies',
    'Agencies with closers and outreach processes',
    'Businesses that need more sales throughput without more administrative drag',
  ]);
});

test('final CTA offers a direct email path with visible fallback text', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Ready for more closing and less chasing?' })
  ).toBeVisible();

  const regions = page.getByRole('region', {
    name: 'Ready for more closing and less chasing?',
  });
  await expect(regions).toHaveCount(1);

  const finalSection = regions.first();
  await expect(
    finalSection.getByRole('heading', { name: 'Ready for more closing and less chasing?' })
  ).toBeVisible();
  await expect(finalSection.getByRole('link', { name: 'Email sales' })).toHaveAttribute(
    'href',
    'mailto:sales@spanaisolutions.com'
  );
  await expect(
    finalSection.getByText('Prefer a direct conversation? Reach us at sales@spanaisolutions.com.')
  ).toBeVisible();
});

test('metadata is present and the mobile layout does not overflow', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'Human-first AI sales support for every closer — from CRM management and lead research to outreach support and AI voice coverage.'
  );

  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    'https://spanaisolutions.com/'
  );

  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://spanaisolutions.com/og-card.svg'
  );

  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://spanaisolutions.com/'
  );

  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });

  expect(hasOverflow).toBe(false);
});
