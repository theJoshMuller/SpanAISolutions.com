# Span AI Solutions Landing Page Implementation Plan

> **For Hermes:** Use `software-development:subagent-driven-development` to execute this plan task-by-task. Read this file once, extract every task up front, then dispatch one fresh implementer subagent per task with spec review first and code-quality review second.

**Goal:** Replace the temporary static placeholder with the approved premium Astro one-page site for Span AI Solutions and deploy it through the existing GitHub → Netlify pipeline.

**Architecture:** Build a static Astro site with one route at `/`, a shared `BaseLayout`, centralized content in a single `src/data/site.ts` module, one component per approved section, and a token-driven global stylesheet. Keep JavaScript optional for the core experience, use bundled local font packages for Inter + Space Grotesk, and add a small Playwright smoke suite to verify locked copy, section presence, CTA behavior, and mobile-safe layout.

**Tech Stack:** Astro 6, TypeScript config, vanilla CSS, `@fontsource-variable/inter`, `@fontsource/space-grotesk`, `@playwright/test`, Netlify static deploys.

---

## Current repo state

- Repo path: `/home/yeshu/projects/SpanAISolutions.com`
- Current live deploy is still the placeholder in `public/index.html`
- `netlify.toml` currently publishes `public/`
- There is **no** Astro app yet (`package.json`, `astro.config.mjs`, `tsconfig.json`, and `src/` are all missing)
- Existing approved spec: `docs/superpowers/specs/2026-06-19-span-ai-solutions-design.md`

## Critical implementation note discovered during planning

**Delete `public/index.html` in Task 1.** In Astro static builds, a file in `public/index.html` shadows `src/pages/index.astro`. This was verified in a throwaway scaffold build: Astro emits a warning and skips the real page component if both exist.

## Locked content and structure to preserve

- Headline: **More closing. Less chasing.**
- Subhead: **An agentic sales support team for every closer.**
- CTA label: **Email sales**
- CTA target: `mailto:sales@spanaisolutions.com`
- Visual direction: Night-Ops Command Center / dark premium / forest green accents
- Sections, in order:
  1. Hero
  2. Closer Support Strip
  3. What Span Actually Does
  4. How It Works
  5. Human-First Positioning
  6. Who It’s For
  7. Final CTA

## Execution rules for subagents

- Execute **sequentially**, not in parallel. Most tasks touch `src/pages/index.astro`, `src/data/site.ts`, or `src/styles/global.css`.
- Every behavior task must follow RED → GREEN → REFACTOR.
- Reviewer order is fixed:
  1. spec compliance review
  2. code quality review
- No task is complete until its verification command has been re-run fresh.

---

### Task 1: Create the Astro baseline and remove the placeholder conflict

**Objective:** Turn the repo into a working Astro project that builds to `dist/` on Netlify.

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `src/pages/index.astro`
- Modify: `netlify.toml`
- Delete: `public/index.html`

**Step 1: Capture the failing baseline**

Run:

```bash
npm run build
```

Expected: FAIL — missing `package.json` / no build script.

**Step 2: Write the Astro baseline**

Create `package.json`:

```json
{
  "name": "spanaisolutions-com",
  "type": "module",
  "version": "0.0.1",
  "engines": {
    "node": ">=22.12.0"
  },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@fontsource-variable/inter": "^5.2.8",
    "@fontsource/space-grotesk": "^5.2.10",
    "astro": "^6.4.8"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.9",
    "@playwright/test": "^1.61.0",
    "typescript": "^6.0.3"
  }
}
```

Create `astro.config.mjs`:

```js
// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://spanaisolutions.com',
  output: 'static',
});
```

Create `tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

Create a temporary stub `src/pages/index.astro`:

```astro
---
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>Span AI Solutions</title>
  </head>
  <body>
    <main>Span AI Solutions</main>
  </body>
</html>
```

Replace `netlify.toml` with:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "22"
```

Delete `public/index.html`.

**Step 3: Install dependencies**

Run:

```bash
npm install
```

Expected: PASS — `node_modules/` and `package-lock.json` created.

**Step 4: Verify the build now works**

Run:

```bash
npm run build
```

Expected: PASS — Astro builds `dist/index.html`.

**Step 5: Commit**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json src/pages/index.astro netlify.toml public/index.html
git commit -m "build: replace placeholder bootstrap with Astro baseline"
```

---

### Task 2: Create the shared content model and layout shell

**Objective:** Centralize locked copy and establish the shared page layout, font imports, and global tokens.

**Files:**
- Create: `src/data/site.ts`
- Create: `src/layouts/BaseLayout.astro`
- Create: `src/styles/global.css`
- Modify: `src/pages/index.astro`

**Step 1: Force the missing-module failure**

Replace `src/pages/index.astro` with imports that do not exist yet:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { siteMeta } from '../data/site';
---

<BaseLayout title={siteMeta.title} description={siteMeta.description}>
  <main class="page-shell">
    <p>Span AI Solutions</p>
  </main>
</BaseLayout>
```

Run:

```bash
npm run check
```

Expected: FAIL — module not found errors for `BaseLayout` and `site`.

**Step 2: Create the site data module**

Create `src/data/site.ts`:

```ts
export const siteMeta = {
  title: 'Span AI Solutions — More closing. Less chasing.',
  description:
    'Human-first AI sales support for every closer — from CRM management and lead research to outreach support and AI voice coverage.',
  contactEmail: 'sales@spanaisolutions.com',
  heroHeadline: 'More closing. Less chasing.',
  heroSubhead: 'An agentic sales support team for every closer.',
} as const;

export const supportItems = [
  'CRM Management',
  'SDR Support',
  'Lead Research',
  'Cold Outreach',
  'AI Voice Receptionist',
  'AI Voice Cold Caller',
] as const;

export const operatingFunctions = [
  {
    title: 'Keep the pipeline clean',
    body: 'CRM hygiene, context, and ownership upkeep so closers are working from reality instead of stale records.',
  },
  {
    title: 'Research the right leads',
    body: 'Lead research and list preparation aimed at surfacing people worth a closer’s time.',
  },
  {
    title: 'Run outbound support',
    body: 'Cold outreach support and follow-up systems that keep momentum alive between live conversations.',
  },
  {
    title: 'Cover the front door',
    body: 'AI voice reception and first-response coverage so inbound attention gets handled quickly.',
  },
  {
    title: 'Coordinate the support layer',
    body: 'Workflow support around the closer so the sales engine stays sharp without adding more admin drag.',
  },
] as const;

export const processSteps = [
  {
    title: 'Plug into your current sales motion',
    body: 'Span fits around the sales process you already run instead of forcing a brand-new operating model.',
  },
  {
    title: 'Span runs the support layer',
    body: 'Research, outreach support, CRM upkeep, and voice coverage happen around the closer instead of on top of them.',
  },
  {
    title: 'Closers stay in high-value conversations',
    body: 'Your team spends more energy on real selling and less on chasing, logging, and coordination overhead.',
  },
] as const;

export const audiences = [
  'Founder-led sales teams',
  'High-ticket service companies',
  'Agencies with closers and outreach processes',
  'Businesses that need more sales throughput without more administrative drag',
] as const;
```

**Step 3: Create the layout shell**

Create `src/layouts/BaseLayout.astro`:

```astro
---
import '@fontsource-variable/inter';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '../styles/global.css';

interface Props {
  title: string;
  description: string;
}

const { title, description } = Astro.props;
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content={description} />
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>
```

Create `src/styles/global.css` with the baseline token layer:

```css
:root {
  color-scheme: dark;
  --bg: #040806;
  --bg-elevated: #08110d;
  --panel: rgba(255, 255, 255, 0.04);
  --panel-strong: rgba(255, 255, 255, 0.07);
  --border: rgba(255, 255, 255, 0.1);
  --text: #f3f7f3;
  --muted: #a8b6ad;
  --accent: #2db56f;
  --accent-soft: #9be4b9;
  --shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
  --radius-lg: 24px;
  --radius-md: 18px;
  --radius-sm: 12px;
  --space-1: 0.5rem;
  --space-2: 0.75rem;
  --space-3: 1rem;
  --space-4: 1.5rem;
  --space-5: 2rem;
  --space-6: 3rem;
  --space-7: 4.5rem;
  --space-8: 6rem;
  --max-width: 1200px;
  --font-body: 'Inter Variable', Inter, ui-sans-serif, system-ui, sans-serif;
  --font-display: 'Space Grotesk', 'Inter Variable', ui-sans-serif, system-ui, sans-serif;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: var(--font-body);
  color: var(--text);
  background:
    radial-gradient(circle at 80% 10%, rgba(45, 181, 111, 0.18), transparent 30%),
    radial-gradient(circle at 15% 85%, rgba(20, 86, 57, 0.18), transparent 25%),
    linear-gradient(160deg, #020403 0%, #06100b 42%, #040806 100%);
}

a { color: inherit; }
img { max-width: 100%; display: block; }
button, input, textarea, select { font: inherit; }
:focus-visible {
  outline: 2px solid var(--accent-soft);
  outline-offset: 3px;
}

.page-shell {
  width: min(calc(100% - 32px), var(--max-width));
  margin: 0 auto;
}

.section {
  padding: var(--space-8) 0;
}

.section-heading {
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 3.25rem);
  line-height: 1;
  letter-spacing: -0.03em;
  margin: 0 0 var(--space-3);
}

.section-copy {
  color: var(--muted);
  max-width: 62ch;
  line-height: 1.7;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

**Step 4: Re-run the type/layout check**

Run:

```bash
npm run check
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/data/site.ts src/layouts/BaseLayout.astro src/styles/global.css src/pages/index.astro
git commit -m "feat: add shared content model and layout shell"
```

---

### Task 3: Implement the header and hero with Playwright-first TDD

**Objective:** Ship the approved header/hero and prove the locked copy/CTA in browser tests.

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/landing.spec.ts`
- Create: `src/components/SiteHeader.astro`
- Create: `src/components/HeroSection.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`

**Step 1: Write the failing hero smoke test**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4321',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
```

Create `tests/e2e/landing.spec.ts`:

```ts
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

  const heroCta = page.getByRole('link', { name: 'Email sales' }).first();
  await expect(heroCta).toHaveAttribute('href', 'mailto:sales@spanaisolutions.com');
});
```

Install the browser once:

```bash
npx playwright install chromium
```

Run:

```bash
npm run test:e2e -- --grep "hero communicates the locked promise"
```

Expected: FAIL — the stub page does not yet contain the approved hero.

**Step 2: Implement the header and hero**

Create `src/components/SiteHeader.astro`:

```astro
---
import { siteMeta } from '../data/site';
---

<header class="site-header page-shell">
  <a class="wordmark" href="/">Span AI Solutions</a>
  <a class="button button--ghost" href={`mailto:${siteMeta.contactEmail}`}>Email sales</a>
</header>
```

Create `src/components/HeroSection.astro`:

```astro
---
import { siteMeta } from '../data/site';
---

<section class="hero section page-shell" aria-labelledby="hero-title">
  <div class="hero__panel">
    <p class="hero__kicker">Human-first AI sales support</p>
    <h1 id="hero-title" class="hero__title">{siteMeta.heroHeadline}</h1>
    <p class="hero__subhead">{siteMeta.heroSubhead}</p>
    <a class="button button--primary" href={`mailto:${siteMeta.contactEmail}`}>Email sales</a>
  </div>
</section>
```

Update `src/pages/index.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import SiteHeader from '../components/SiteHeader.astro';
import HeroSection from '../components/HeroSection.astro';
import { siteMeta } from '../data/site';
---

<BaseLayout title={siteMeta.title} description={siteMeta.description}>
  <SiteHeader />
  <HeroSection />
</BaseLayout>
```

Append the needed CSS to `src/styles/global.css`:

```css
.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 0 0;
}

.wordmark {
  font-family: var(--font-display);
  font-weight: 500;
  letter-spacing: -0.03em;
  text-decoration: none;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 48px;
  padding: 0 18px;
  border-radius: 999px;
  border: 1px solid var(--border);
  text-decoration: none;
  font-weight: 600;
  transition: transform 160ms ease, border-color 160ms ease, background-color 160ms ease;
}

.button:hover {
  transform: translateY(-1px);
}

.button--primary {
  background: linear-gradient(180deg, #1d8c57 0%, #16613d 100%);
  border-color: rgba(155, 228, 185, 0.35);
  box-shadow: 0 18px 40px rgba(10, 35, 23, 0.32);
}

.button--ghost {
  background: rgba(255, 255, 255, 0.03);
}

.hero {
  padding-top: var(--space-7);
}

.hero__panel {
  padding: clamp(32px, 5vw, 72px);
  border: 1px solid var(--border);
  border-radius: 32px;
  background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
  box-shadow: var(--shadow);
}

.hero__kicker {
  margin: 0 0 var(--space-4);
  color: var(--accent-soft);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 0.78rem;
  font-weight: 700;
}

.hero__title {
  margin: 0;
  max-width: 11ch;
  font-family: var(--font-display);
  font-size: clamp(3.25rem, 10vw, 6.75rem);
  line-height: 0.92;
  letter-spacing: -0.04em;
}

.hero__subhead {
  margin: calc(var(--space-4) + 22px) 0 0;
  max-width: 32ch;
  color: #dbe6de;
  font-size: clamp(1.1rem, 2.4vw, 1.5rem);
  line-height: 1.45;
}

.hero .button {
  margin-top: var(--space-5);
}

@media (max-width: 720px) {
  .site-header {
    padding-top: 18px;
    gap: 12px;
  }

  .hero__title {
    max-width: none;
  }
}
```

**Step 3: Re-run the hero test**

Run:

```bash
npm run test:e2e -- --grep "hero communicates the locked promise"
```

Expected: PASS.

**Step 4: Commit**

```bash
git add playwright.config.ts tests/e2e/landing.spec.ts src/components/SiteHeader.astro src/components/HeroSection.astro src/pages/index.astro src/styles/global.css
git commit -m "feat: implement approved hero section"
```

---

### Task 4: Implement the Closer Support Strip with TDD

**Objective:** Add the six-item support strip in the approved order and responsive behavior.

**Files:**
- Create: `src/components/CapabilityStrip.astro`
- Modify: `tests/e2e/landing.spec.ts`
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`

**Step 1: Extend the smoke test first**

Append to `tests/e2e/landing.spec.ts`:

```ts
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
```

Run:

```bash
npm run test:e2e -- --grep "support strip lists the six closer-support capabilities"
```

Expected: FAIL.

**Step 2: Implement the strip**

Create `src/components/CapabilityStrip.astro`:

```astro
---
import { supportItems } from '../data/site';
---

<section class="section page-shell" aria-labelledby="closer-support-title">
  <h2 id="closer-support-title" class="sr-only">Closer support coverage</h2>
  <ul class="capability-strip" role="list">
    {supportItems.map((item) => <li class="capability-pill">{item}</li>)}
  </ul>
</section>
```

Insert it below `<HeroSection />` in `src/pages/index.astro`.

Append CSS:

```css
.capability-strip {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
  list-style: none;
  padding: 0;
  margin: 0;
}

.capability-pill {
  padding: 14px 16px;
  text-align: center;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--muted);
  font-size: 0.95rem;
}

@media (max-width: 900px) {
  .capability-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
```

**Step 3: Re-run the test**

```bash
npm run test:e2e -- --grep "support strip lists the six closer-support capabilities"
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/components/CapabilityStrip.astro src/pages/index.astro src/styles/global.css tests/e2e/landing.spec.ts
git commit -m "feat: add closer support capability strip"
```

---

### Task 5: Implement “What Span Actually Does” with TDD

**Objective:** Add the five operating-function cards defined in the spec.

**Files:**
- Create: `src/components/OperatingFunctionsSection.astro`
- Modify: `tests/e2e/landing.spec.ts`
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`

**Step 1: Write the failing test**

Append to `tests/e2e/landing.spec.ts`:

```ts
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
```

Run:

```bash
npm run test:e2e -- --grep "operating functions section presents five premium support cards"
```

Expected: FAIL.

**Step 2: Implement the section**

Create `src/components/OperatingFunctionsSection.astro`:

```astro
---
import { operatingFunctions } from '../data/site';
---

<section class="section page-shell" aria-labelledby="operating-functions-title">
  <h2 id="operating-functions-title" class="section-heading">What Span actually does</h2>
  <p class="section-copy">
    Span operates behind the closer — keeping the pipeline clean, surfacing the right leads, and running the support motion that keeps revenue work moving.
  </p>

  <div class="card-grid card-grid--three-up">
    {operatingFunctions.map((card) => (
      <article class="feature-card">
        <h3>{card.title}</h3>
        <p>{card.body}</p>
      </article>
    ))}
  </div>
</section>
```

Insert it below `<CapabilityStrip />` in `src/pages/index.astro`.

Append CSS:

```css
.card-grid {
  display: grid;
  gap: 18px;
  margin-top: var(--space-5);
}

.card-grid--three-up {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.feature-card {
  padding: 24px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
}

.feature-card h3 {
  margin: 0 0 12px;
  font-family: var(--font-display);
  font-size: 1.35rem;
  letter-spacing: -0.02em;
}

.feature-card p {
  margin: 0;
  color: var(--muted);
  line-height: 1.65;
}

@media (max-width: 960px) {
  .card-grid--three-up {
    grid-template-columns: 1fr;
  }
}
```

**Step 3: Re-run the test**

```bash
npm run test:e2e -- --grep "operating functions section presents five premium support cards"
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/components/OperatingFunctionsSection.astro src/pages/index.astro src/styles/global.css tests/e2e/landing.spec.ts
git commit -m "feat: add operating functions section"
```

---

### Task 6: Implement “How It Works” with TDD

**Objective:** Add the three-step operating-flow section.

**Files:**
- Create: `src/components/HowItWorksSection.astro`
- Modify: `tests/e2e/landing.spec.ts`
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`

**Step 1: Write the failing test**

Append:

```ts
test('how it works explains the three-step support model', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible();

  for (const title of [
    'Plug into your current sales motion',
    'Span runs the support layer',
    'Closers stay in high-value conversations',
  ]) {
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }
});
```

Run:

```bash
npm run test:e2e -- --grep "how it works explains the three-step support model"
```

Expected: FAIL.

**Step 2: Implement the section**

Create `src/components/HowItWorksSection.astro`:

```astro
---
import { processSteps } from '../data/site';
---

<section class="section page-shell" aria-labelledby="how-it-works-title">
  <h2 id="how-it-works-title" class="section-heading">How it works</h2>
  <div class="steps-grid">
    {processSteps.map((step, index) => (
      <article class="step-card">
        <p class="step-card__index">0{index + 1}</p>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
      </article>
    ))}
  </div>
</section>
```

Insert it below `<OperatingFunctionsSection />` in `src/pages/index.astro`.

Append CSS:

```css
.steps-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-top: var(--space-5);
}

.step-card {
  padding: 24px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.025);
}

.step-card__index {
  margin: 0 0 14px;
  color: var(--accent-soft);
  font-family: var(--font-display);
  font-size: 0.95rem;
  letter-spacing: 0.08em;
}

.step-card h3 {
  margin: 0 0 12px;
  font-family: var(--font-display);
  font-size: 1.3rem;
}

.step-card p:last-child {
  margin: 0;
  color: var(--muted);
  line-height: 1.65;
}

@media (max-width: 960px) {
  .steps-grid {
    grid-template-columns: 1fr;
  }
}
```

**Step 3: Re-run the test**

```bash
npm run test:e2e -- --grep "how it works explains the three-step support model"
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/components/HowItWorksSection.astro src/pages/index.astro src/styles/global.css tests/e2e/landing.spec.ts
git commit -m "feat: add how it works section"
```

---

### Task 7: Implement Human-First + Who It’s For with TDD

**Objective:** Add the philosophy section and the 2x2 audience grid.

**Files:**
- Create: `src/components/HumanFirstSection.astro`
- Create: `src/components/WhoItsForSection.astro`
- Modify: `tests/e2e/landing.spec.ts`
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`

**Step 1: Write the failing tests**

Append:

```ts
test('human-first positioning is explicit and trust-building', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Human-first by design' })).toBeVisible();
  await expect(page.getByText(/amplify human closers/i)).toBeVisible();
});

test('who it is for identifies the four target buyer groups', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: "Who it's for" })).toBeVisible();

  for (const audience of [
    'Founder-led sales teams',
    'High-ticket service companies',
    'Agencies with closers and outreach processes',
    'Businesses that need more sales throughput without more administrative drag',
  ]) {
    await expect(page.getByText(audience, { exact: true })).toBeVisible();
  }
});
```

Run:

```bash
npm run test:e2e -- --grep "human-first|who it is for"
```

Expected: FAIL.

**Step 2: Implement the sections**

Create `src/components/HumanFirstSection.astro`:

```astro
<section class="section page-shell" aria-labelledby="human-first-title">
  <div class="statement-panel">
    <h2 id="human-first-title" class="section-heading">Human-first by design</h2>
    <p class="section-copy">
      Span exists to amplify human closers, not flatten them into scripts. The support layer removes friction, inconsistency, and repetitive load so strong sellers can operate at a higher level.
    </p>
  </div>
</section>
```

Create `src/components/WhoItsForSection.astro`:

```astro
---
import { audiences } from '../data/site';
---

<section class="section page-shell" aria-labelledby="audience-title">
  <h2 id="audience-title" class="section-heading">Who it's for</h2>
  <div class="audience-grid">
    {audiences.map((audience) => (
      <article class="audience-card">
        <p>{audience}</p>
      </article>
    ))}
  </div>
</section>
```

Insert both below `<HowItWorksSection />` in `src/pages/index.astro`.

Append CSS:

```css
.statement-panel {
  padding: clamp(24px, 4vw, 40px);
  border-radius: 32px;
  border: 1px solid rgba(155, 228, 185, 0.18);
  background: linear-gradient(180deg, rgba(13, 42, 28, 0.55), rgba(255, 255, 255, 0.03));
}

.audience-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin-top: var(--space-5);
}

.audience-card {
  padding: 22px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: rgba(255,255,255,0.03);
}

.audience-card p {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.6;
}

@media (max-width: 900px) {
  .audience-grid {
    grid-template-columns: 1fr;
  }
}
```

**Step 3: Re-run the tests**

```bash
npm run test:e2e -- --grep "human-first|who it is for"
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/components/HumanFirstSection.astro src/components/WhoItsForSection.astro src/pages/index.astro src/styles/global.css tests/e2e/landing.spec.ts
git commit -m "feat: add positioning and audience sections"
```

---

### Task 8: Implement the final CTA with visible email fallback using TDD

**Objective:** Add the closing section with a direct CTA and visible plain-text email.

**Files:**
- Create: `src/components/FinalCtaSection.astro`
- Modify: `tests/e2e/landing.spec.ts`
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`

**Step 1: Write the failing test**

Append:

```ts
test('final CTA offers a direct email path with visible fallback text', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Ready for more closing and less chasing?' })
  ).toBeVisible();

  const finalSection = page.getByRole('region', {
    name: 'Ready for more closing and less chasing?',
  });

  await expect(finalSection.getByRole('link', { name: 'Email sales' })).toHaveAttribute(
    'href',
    'mailto:sales@spanaisolutions.com'
  );
  await expect(
    finalSection.getByText('Prefer a direct conversation? Reach us at sales@spanaisolutions.com.')
  ).toBeVisible();
});
```

Run:

```bash
npm run test:e2e -- --grep "final CTA offers a direct email path with visible fallback text"
```

Expected: FAIL.

**Step 2: Implement the CTA section**

Create `src/components/FinalCtaSection.astro`:

```astro
---
import { siteMeta } from '../data/site';
---

<section class="section page-shell" aria-labelledby="final-cta-title">
  <div class="cta-panel" role="region" aria-labelledby="final-cta-title">
    <h2 id="final-cta-title" class="section-heading">Ready for more closing and less chasing?</h2>
    <p class="section-copy">
      If you want an elite support layer around your closers, start with a direct conversation.
    </p>
    <a class="button button--primary" href={`mailto:${siteMeta.contactEmail}`}>Email sales</a>
    <p class="cta-note">Prefer a direct conversation? Reach us at {siteMeta.contactEmail}.</p>
  </div>
</section>
```

Insert it at the end of `src/pages/index.astro`.

Append CSS:

```css
.cta-panel {
  padding: clamp(28px, 5vw, 56px);
  border-radius: 32px;
  border: 1px solid rgba(155, 228, 185, 0.2);
  background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.025));
  box-shadow: var(--shadow);
}

.cta-note {
  margin: 18px 0 0;
  color: var(--muted);
}
```

**Step 3: Re-run the test**

```bash
npm run test:e2e -- --grep "final CTA offers a direct email path with visible fallback text"
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/components/FinalCtaSection.astro src/pages/index.astro src/styles/global.css tests/e2e/landing.spec.ts
git commit -m "feat: add final call-to-action section"
```

---

### Task 9: Add metadata, social placeholder, and mobile-safe polish with TDD

**Objective:** Finish the production shell: metadata, favicon/OG placeholder, and a regression check against mobile overflow.

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/styles/global.css`
- Modify: `tests/e2e/landing.spec.ts`
- Create: `public/og-card.svg`
- Replace: `public/favicon.svg`

**Step 1: Write the failing test first**

Append:

```ts
test('metadata is present and the mobile layout does not overflow', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'Human-first AI sales support for every closer — from CRM management and lead research to outreach support and AI voice coverage.'
  );

  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    '/og-card.svg'
  );

  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg');

  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });

  expect(hasOverflow).toBe(false);
});
```

Run:

```bash
npm run test:e2e -- --grep "metadata is present and the mobile layout does not overflow"
```

Expected: FAIL — the page does not yet expose the final OG image / favicon metadata.

**Step 2: Finish the production shell**

Update `src/layouts/BaseLayout.astro` to include favicon and OG metadata:

```astro
---
import '@fontsource-variable/inter';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '../styles/global.css';

interface Props {
  title: string;
  description: string;
}

const { title, description } = Astro.props;
const canonical = Astro.site ? new URL(Astro.url.pathname, Astro.site).toString() : Astro.url.toString();
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content={description} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="website" />
    <meta property="og:url" content={canonical} />
    <meta property="og:image" content="/og-card.svg" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>
```

Create `public/og-card.svg`:

```astro
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" fill="none">
  <rect width="1200" height="630" fill="#040806" />
  <rect x="44" y="44" width="1112" height="542" rx="32" fill="#08110d" stroke="rgba(155,228,185,0.28)" />
  <circle cx="1010" cy="120" r="110" fill="#1d8c57" opacity="0.16" />
  <circle cx="170" cy="520" r="120" fill="#145639" opacity="0.18" />
  <text x="96" y="140" fill="#9BE4B9" font-family="Inter, Arial, sans-serif" font-size="26" letter-spacing="4">SPAN AI SOLUTIONS</text>
  <text x="96" y="275" fill="#F3F7F3" font-family="Space Grotesk, Inter, Arial, sans-serif" font-size="86" font-weight="700">More closing.</text>
  <text x="96" y="365" fill="#F3F7F3" font-family="Space Grotesk, Inter, Arial, sans-serif" font-size="86" font-weight="700">Less chasing.</text>
  <text x="96" y="450" fill="#D7E3DA" font-family="Inter, Arial, sans-serif" font-size="34">An agentic sales support team for every closer.</text>
</svg>
```

Replace `public/favicon.svg` with:

```astro
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none">
  <rect width="64" height="64" rx="16" fill="#08110d" />
  <path d="M20 18H44V24H28V29H40V35H28V40H44V46H20V18Z" fill="#9BE4B9" />
</svg>
```

If the mobile test reveals overflow, add this exact guardrail block to `src/styles/global.css` before making any other spacing tweaks:

```css
body {
  overflow-x: hidden;
}

.page-shell,
.hero__panel,
.cta-panel,
.feature-card,
.step-card,
.audience-card {
  min-width: 0;
}

@media (max-width: 720px) {
  .page-shell {
    width: min(calc(100% - 24px), var(--max-width));
  }

  .site-header {
    flex-wrap: wrap;
  }
}
```

**Step 3: Re-run the test**

```bash
npm run test:e2e -- --grep "metadata is present and the mobile layout does not overflow"
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/layouts/BaseLayout.astro src/styles/global.css tests/e2e/landing.spec.ts public/og-card.svg public/favicon.svg
git commit -m "feat: add production metadata and responsive polish"
```

---

### Task 10: Update project docs, run the full verification stack, and verify the live Netlify deploy

**Objective:** Leave the repo and deployment state clean, documented, and proven.

**Files:**
- Modify: `README.md`

**Step 1: Update README**

Replace the placeholder README body with:

~~~~md
# SpanAISolutions.com

Premium one-page Astro marketing site for Span AI Solutions.

## Stack

- Astro
- Vanilla CSS
- Playwright smoke tests
- Netlify deployment via GitHub

## Local development

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run check
npm run build
npm run test:e2e
```

## Deployment

Pushes to `main` trigger Netlify production deploys for:

- `https://spanaisolutions.netlify.app`
~~~~

**Step 2: Run the full verification stack**

Run, in order:

```bash
npm run check
npm run build
npm run test:e2e
```

Expected:
- `npm run check` → PASS
- `npm run build` → PASS
- `npm run test:e2e` → PASS

**Step 3: Commit the final docs and any last cleanups**

```bash
git add README.md
git commit -m "docs: update Span AI site development workflow"
```

**Step 4: Push and verify production**

```bash
git push
```

Then verify the live site:

```bash
curl -L --silent https://spanaisolutions.netlify.app | grep -F "More closing. Less chasing."
```

Expected: PASS — the live HTML contains the locked headline.

Then verify the latest deploy is ready:

```bash
netlify api listSiteDeploys --data '{"site_id":"a64be413-1281-44d2-aae8-ab56576d334c","page":1,"per_page":1}'
```

Expected: latest deploy has `"state": "ready"`.

**Step 5: Final commit-state verification**

```bash
git status -sb
```

Expected: clean working tree, branch aligned with `origin/main`.

---

## Final review checklist for the controller

Before declaring implementation complete, the controller must verify all of the following with fresh evidence:

- [ ] `public/index.html` is gone
- [ ] `netlify.toml` now builds to `dist`
- [ ] `src/pages/index.astro` renders the approved section order
- [ ] Header has only wordmark + one CTA button
- [ ] Hero headline/subhead exactly match the locked copy
- [ ] Capability strip contains exactly six items
- [ ] Operating functions section contains exactly five cards
- [ ] How It Works contains exactly three steps
- [ ] Human-first language is present and non-replacement framing is clear
- [ ] Who It’s For contains the four approved audience groups
- [ ] Final CTA includes both the mailto button and visible fallback email text
- [ ] `npm run check` passes
- [ ] `npm run build` passes
- [ ] `npm run test:e2e` passes
- [ ] Live Netlify page contains the locked headline after push

## Recommended next action after this plan

Once this plan is approved for execution, use `software-development:subagent-driven-development` and execute **Task 1 → Task 10 in order**, with one fresh implementer subagent per task and the normal two-stage review loop after each task.
