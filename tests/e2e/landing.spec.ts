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

for (const [service, subject] of [
  ['custom', 'Custom AI solution enquiry'],
  ['consulting', 'AI consulting enquiry'],
  ['voice', 'AI voice agent enquiry'],
] as const) {
  test(`email enquiry preserves ${service} context`, async ({ page }) => {
    await page.goto(`/contact?service=${service}`);
    await expect(page.getByRole('link', { name: 'Email us', exact: true })).toHaveAttribute('href', `mailto:sales@spanaisolutions.com?subject=${encodeURIComponent(subject)}`);
  });
}

test('email-only contact has no intake form and uses the confirmed phone number', async ({ page }) => {
  for (const query of ['', '?service=unknown', '?service=__proto__']) {
    await page.goto(`/contact${query}`);
    await expect(page.getByRole('link', { name: 'Email us', exact: true })).toHaveAttribute('href', 'mailto:sales@spanaisolutions.com');
    await expect(page.locator('form, input, textarea, select')).toHaveCount(0);
    await expect(page.locator('main a[href="tel:+16393823319"]')).toHaveText('+1 (639) 382-3319');
    await expect(page.locator('footer a[href="tel:+16393823319"]')).toHaveText('+1 (639) 382-3319');
  }
});

test('Josh portrait is rendered on About and AI Consulting', async ({ page }) => {
  for (const route of ['/about', '/ai-consulting']) {
    await page.goto(route);
    const photo = page.getByRole('img', { name: 'Josh Muller', exact: true });
    await expect(photo).toHaveAttribute('src', '/images/josh-muller.webp');
    await photo.scrollIntoViewIfNeeded();
    expect(await photo.evaluate(async (node: HTMLImageElement) => { await node.decode(); return [node.naturalWidth, node.naturalHeight]; })).toEqual([640, 480]);
  }
});

test('edited Kamila and joint founder photos render without placeholders', async ({ page }) => {
  await page.goto('/about');
  for (const [name, src, width, height] of [
    ['Kamila Buitrago', '/images/kamila-buitrago.webp', 640, 480],
    ['Span AI Solutions founders Josh Muller and Kamila Buitrago together', '/images/span-founders.webp', 768, 1152],
  ] as const) {
    const photo = page.getByRole('img', { name, exact: true });
    await expect(photo).toHaveAttribute('src', src);
    await photo.scrollIntoViewIfNeeded();
    expect(await photo.evaluate(async (node: HTMLImageElement) => { await node.decode(); return [node.naturalWidth, node.naturalHeight]; })).toEqual([width, height]);
  }
  await expect(page.locator('.portrait-placeholder')).toHaveCount(0);
});

test('brand images resolve', async ({ request }) => {
  for (const asset of ['/brand/logo-white-text.svg','/favicon.svg','/favicon-32x32.png','/og-image.png']) {
    expect((await request.get(asset)).ok(), asset).toBe(true);
  }
});
