import { test, expect } from '@playwright/test';

const routes = [
  '/', '/custom-ai-solutions', '/ai-consulting', '/ai-voice-agents',
  '/about', '/contact', '/privacy', '/terms',
];

for (const route of routes) {
  test(`${route} renders its own title/H1, shared footer, and fits 375px`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(route);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'sales@spanaisolutions.com' })).toHaveAttribute('href', 'mailto:sales@spanaisolutions.com');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${route} has no horizontal overflow`).toBe(true);
    expect(await page.title()).toContain('Span AI Solutions');
  });
}

test('homepage presents the new offer and service navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Bridging the gap between you and your goals.');
  await expect(page.locator('#services')).toBeVisible();
  await expect(page.locator('main').getByRole('link', { name: 'Start a conversation' }).first()).toHaveAttribute('href', '/contact');
  for (const route of ['/custom-ai-solutions', '/ai-consulting', '/ai-voice-agents']) {
    await expect(page.locator('main').locator(`a[href="${route}"]`).first()).toBeVisible();
  }
  await expect(page.getByText('As featured in El Espectador.')).toBeVisible();
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://spanaisolutions.com/og-image.png');
  expect((await page.locator('main').innerText()).toLowerCase()).not.toMatch(/closer|chasing|sdr|crm hygiene/);
});

test('brand typography matches the existing site at desktop and mobile sizes', async ({ page }) => {
  for (const [width, heroSize, sectionSize] of [[1280, '108px', '51.2px'], [375, '52px', '32px']] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const styles = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const hero = getComputedStyle(document.querySelector('.hero-title')!);
      const section = getComputedStyle(document.querySelector('.section-heading')!);
      return { body: body.fontFamily, hero: hero.fontFamily, heroSize: hero.fontSize, heroLine: hero.lineHeight, section: section.fontFamily, sectionSize: section.fontSize };
    });
    expect(styles.body).toContain('Inter Variable');
    expect(styles.hero).toContain('Space Grotesk');
    expect(styles.section).toContain('Space Grotesk');
    expect(styles.heroSize).toBe(heroSize);
    expect(styles.heroLine).toBe(width === 1280 ? '99.36px' : '47.84px');
    expect(styles.sectionSize).toBe(sectionSize);
  }
});

test('mobile menu opens and routes to the services', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.locator('.mobile-nav summary').click();
  const nav = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(nav).toBeVisible();
  await nav.getByRole('link', { name: 'AI Voice Agents' }).click();
  await expect(page).toHaveURL(/\/ai-voice-agents\/?$/);
});

for (const [service, title] of [
  ['custom', 'Custom AI solution'],
  ['consulting', 'AI consulting'],
  ['voice', 'AI voice agent'],
] as const) {
  test(`contact preselects ${service} from URL`, async ({ page }) => {
    await page.goto(`/contact?service=${service}`);
    await expect(page.locator('#service')).toHaveValue(service);
    await expect(page.locator('#consulting-fields')).toBeVisible({ visible: service === 'consulting' });
    await expect(page.locator('#voice-fields')).toBeVisible({ visible: service === 'voice' });
    await expect(page.getByRole('option', { name: title })).toHaveAttribute('value', service);
  });
}

test('consulting conditional fields change with session type', async ({ page }) => {
  await page.goto('/contact?service=consulting');
  await page.locator('#session-type').selectOption({ label: 'Group' });
  await expect(page.locator('.group-size')).toBeVisible();
  await expect(page.locator('.session-format')).toBeVisible();
  await expect(page.locator('.speaking-fields')).toBeHidden();
  await page.locator('#session-type').selectOption({ label: 'Speaking engagement' });
  await expect(page.locator('.speaking-fields')).toBeVisible();
  await expect(page.locator('.group-size')).toBeHidden();
  await expect(page.locator('input[name="group_size"]')).toBeDisabled();
  await expect(page.locator('input[name="event_name"]')).toBeEnabled();
});

test('preview form cannot submit without delivery and spam protection', async ({ page }) => {
  await page.goto('/contact');
  await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled();
  await expect(page.locator('input[name="updates_opt_in"]')).not.toBeChecked();
  await expect(page.locator('a[href="tel:+16393823319"]').first()).toBeVisible();
  await expect(page.getByText('No information entered here is sent or saved.', { exact: false })).toBeVisible();
});

test('brand images resolve', async ({ request }) => {
  for (const asset of ['/brand/logo-white-text.svg','/favicon.svg','/favicon-32x32.png','/og-image.png']) {
    expect((await request.get(asset)).ok(), asset).toBe(true);
  }
});
