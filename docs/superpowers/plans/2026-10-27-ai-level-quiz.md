# AI Level Quiz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/quiz` — "What's Your AI Level, and What's It Costing You?" — a branching quiz that scores visitors 0–100, estimates their win-back, segments them, emails results, writes them to Twenty, and alerts Kami.

**Architecture:** Static Astro page with a vanilla-TS quiz engine whose scoring lives in pure, shared modules. Netlify Functions validate, re-score, sign opt-in tokens and forward to n8n (with a Blobs outbox for outages). n8n workflows — whose Code-node logic is authored and unit-tested in this repo and injected by a deploy script — write to Twenty, call Claude for ideas, send Gmail via the `hello@` alias, and alert Kami.

**Tech Stack:** Astro 6 (static), TypeScript, vanilla CSS, Vitest (new), Playwright, Netlify Functions v2 + `@netlify/blobs`, Python/Pillow (gauge PNGs), n8n REST API, Twenty REST + metadata API, Gmail API, Anthropic Messages API.

**Spec:** `docs/superpowers/specs/2026-10-27-ai-level-quiz-design.md`

## Global Constraints

- Work on branch `feat/ai-level-quiz`; pushes to `main` deploy production.
- No new frontend framework; no runtime deps except `@netlify/blobs` (functions only). Dev deps: `vitest`, `@netlify/functions` (types).
- Reuse `src/styles/global.css` tokens (`--bg`, `--accent #2db56f`, `--accent-soft #9be4b9`, `--font-display` Space Grotesk, `--font-body` Inter) and `BaseLayout`.
- Copy: headline "What's your AI level, and what's it costing you?"; eyebrow `AI LEVEL QUIZ · 3 MINUTES`; never tell the lead Kami will call.
- Calendar URL: `https://calendar.app.google/bNDHFsbv5cj88RzPA`. Sender: `"Josh & Kami at Span" <hello@spanaisolutions.com>`. Kami: `kamila@spanaisolutions.com`. Footer address: `23-4900 Optimist Dr, Regina, SK`.
- Win-back constants: midpoints `{'<2':1,'2-5':3.5,'5-10':7.5,'10-20':15,'20+':25}`, 48 weeks, 0.60 automation share, default rate $40, slider $20–$200 step $5, Discovery threshold ≥ 5 team-hours/week.
- Rounding: `aiLevel` = `Math.round`; `hoursPerYear` = `Math.round`; `dollarsPerYear` = rounded to nearest 100.
- Text limits: C1 10–280 chars, C4 ≤ 280, D2 ≤ 500, C3 integer 1–500, first name ≤ 80, org ≤ 120, phone ≤ 40.
- Pinned IDs: n8n creds — Twenty `vFmo7UyOTXRAI3LH`, Gmail `WHqx5RVIqdWt1t9l`; Twenty workspace members — Kami `b5eee740-b5e0-40ba-9d82-1eba46e08899`, Josh `e28865e9-6380-488f-a91f-b272bb830c63`. Twenty base `https://crm.spanaisolutions.com/rest`.
- Secrets never committed. Local scripts read `~/.hermes/.env` (`SPAN_TWENTY_API_URL`, `SPAN_TWENTY_API_KEY`) and `/home/yeshu/n8n.joshmuller.ca-KEY`.
- Gates before every commit that touches code: `npm run test:unit`, `npm run check`; before merge also `npm run build` and `npm run test:e2e`.

## Review Focus

1. **Switching role mid-quiz via Back** (Leader → Individual) must drop C3/D1/D2 and the gate's org/phone fields; segment comes from the current path. → test in Task 2 (`pruneForPath`).
2. **Double submit / retry** (double-click, refresh on gate, outbox replay after a slow-but-successful n8n call) must produce one Note and one Kami alert per `submissionId`. → client test in Task 4, n8n dedupe in Task 8.
3. **Hostile or messy free text** (`<script>`, `"quotes"`, emoji, 280-char strings, newlines) must render escaped in the lead email, Kami alert and Note. → test in Task 7.
4. **Email casing/whitespace** (`" Jane@Acme.ORG "`) must normalise to `jane@acme.org` before HMAC signing and CRM matching, so opt-in links verify. → test in Task 5.
5. **n8n hanging** must not hang the visitor: forward times out at 4 s, payload goes to the outbox, response is still 200. → test in Task 5.

---

### Task 1: Quiz config + scoring core (with Vitest)

**Files:**
- Create: `vitest.config.ts`, `src/quiz/config.ts`, `src/quiz/scoring.ts`
- Modify: `package.json` (add `"test:unit": "vitest run"`, dev dep `vitest@^5`)
- Test: `tests/unit/scoring.test.ts`

**Interfaces:**
- Produces (`src/quiz/config.ts`):
  - `type Path = 'leader' | 'individual'`; `type Segment = 'discovery' | 'nurture-leader' | 'course'`
  - `type RoleKey = 'owner'|'executive'|'manager'|'member'|'freelancer'|'student'`; `type TeamKey = 'solo'|'2-9'|'10-49'|'50-249'|'250+'`; `type HoursKey = '<2'|'2-5'|'5-10'|'10-20'|'20+'`; `type HelpKey = 'diy'|'with'|'for'|'curious'`; `type PainChip = 'followups'|'data-entry'|'same-questions'|'reports'|'scheduling'|'content'`; `type Points = 0|1|2|3|4`
  - `interface Answers { A1?: RoleKey; A2?: TeamKey; B1?: Points; B2?: Points; B3?: Points; B4?: Points; B5?: Points; C1?: string; C1chip?: PainChip|null; C2?: HoursKey; C3?: number; C4?: string|null; D1?: HelpKey; D2?: string|null }`
  - `type QuestionId = keyof Answers` minus `'C1chip'`
  - `interface Question { id: QuestionId; part: 'A'|'B'|'C'|'D'; kind: 'choice'|'text'|'number'; paths: Path[]; prompt: Record<Path,string>; helper?: string; options?: { value: string|number; label: Record<Path,string>|string }[]; chips?: { value: PainChip; label: string }[]; required: boolean; maxLength?: number }`
  - `QUESTIONS: Question[]` (all copy verbatim from spec §4; Leader wording uses "your team"), `BANDS: {key, label, emoji, min, max, color, description}[]`, `SKILLS: {key:'habits'|'context'|'prompting'|'automation'|'reliability', question:'B1'..'B5', label, tips: [string,string,string,string,string]}[]` (tip per score 0–4), constants listed in Global Constraints as named exports (`HOURS_MIDPOINT`, `WEEKS_PER_YEAR`, `AUTOMATION_SHARE`, `DEFAULT_RATE`, `RATE_MIN`, `RATE_MAX`, `RATE_STEP`, `DISCOVERY_MIN_TEAM_HOURS`, `CALENDAR_URL`, `TEXT_LIMITS`).
- Produces (`src/quiz/scoring.ts`):
  - `getPath(a: Pick<Answers,'A1'|'A2'>): Path`
  - `aiLevel(a: Answers): number`
  - `bandFor(level: number): Band`
  - `skillScores(a: Answers): { key: SkillKey; label: string; value: number; tip: string }[]` (value = points × 25)
  - `winBack(a: Answers, rate?: number): { teamHoursPerWeek: number; hoursPerYear: number; dollarsPerYear: number; rate: number }`
  - `segmentFor(a: Answers): Segment`
  - `interface QuizResult { path; aiLevel; band: BandKey; bandLabel: string; skills; teamHoursPerWeek; hoursPerYear; dollarsPerYear; rate; segment }`
  - `scoreAll(a: Answers, rate?: number): QuizResult`
  - `validateAnswers(input: unknown): { ok: true; answers: Answers } | { ok: false; errors: string[] }` — checks enum membership, path-required questions present, text limits; trims strings; empty optional text → `null`; forces `C3 = 1` on Individual path.

- [ ] **Step 1: Install Vitest, add config (`include: ['tests/unit/**/*.test.ts']`, `environment: 'node'`) and the `test:unit` script.**

- [ ] **Step 2: Write failing persona tests in `tests/unit/scoring.test.ts`**

```ts
const leader = { A1:'executive', A2:'10-49' } as const;
test('true power user scores 100, Full Speed', () => {
  const r = scoreAll({ A1:'freelancer', A2:'solo', B1:4,B2:4,B3:4,B4:4,B5:4, C1:'Client onboarding emails', C2:'2-5' });
  expect(r.aiLevel).toBe(100); expect(r.band).toBe('full-speed'); expect(r.segment).toBe('course');
});
test('beginner ED with team pain who wants it built → discovery', () => {
  const r = scoreAll({ ...leader, B1:1,B2:0,B3:1,B4:0,B5:1, C1:'Copying donor forms into our CRM', C2:'5-10', C3:3, D1:'for' });
  expect(r.aiLevel).toBe(15); expect(r.band).toBe('parked');
  expect(r.teamHoursPerWeek).toBe(22.5); expect(r.hoursPerYear).toBe(648); expect(r.dollarsPerYear).toBe(25900);
  expect(r.segment).toBe('discovery');
});
test('leader just curious → nurture-leader', () => expect(segmentFor({ ...leader, C2:'20+', C3:2, D1:'curious' })).toBe('nurture-leader'));
test('leader wanting help but < 5 team-hours → nurture-leader', () => expect(segmentFor({ ...leader, C2:'2-5', C3:1, D1:'with' })).toBe('nurture-leader'));
test('owner of a solo business is individual path', () => expect(getPath({ A1:'owner', A2:'solo' })).toBe('individual'));
test('manager of 2-9 is leader path', () => expect(getPath({ A1:'manager', A2:'2-9' })).toBe('leader'));
test.each([[20,'parked'],[21,'first-gear'],[40,'first-gear'],[41,'cruising'],[60,'cruising'],[61,'accelerating'],[80,'accelerating'],[81,'full-speed']])('band %i → %s', (n,b) => expect(bandFor(n).key).toBe(b));
test('custom rate recomputes dollars', () => expect(winBack({ A1:'member', A2:'10-49', C2:'<2' }, 100).dollarsPerYear).toBe(2900)); // 1×48×0.6=28.8→29h; 28.8×100=2880→2900
test('validateAnswers trims, nulls empty optionals, rejects bad enums and short C1', ...);
test('validateAnswers forces C3=1 and drops D1/D2 on individual path', ...);
```
(Write the last two with concrete inputs/assertions: `C4:'  '` → `null`; `B1:7` → error; `C1:'short'` with no chip → error; `{A1:'member',…,C3:9,D1:'for'}` → `C3===1`, `D1===undefined`.)

Note: `dollarsPerYear` uses unrounded hours × rate, then rounds to nearest 100.

- [ ] **Step 3: Run `npm run test:unit` — expect FAIL (modules missing).**

- [ ] **Step 4: Implement `config.ts` and `scoring.ts` to the interfaces above.**

- [ ] **Step 5: Run `npm run test:unit` — expect PASS; `npm run check` clean.**

- [ ] **Step 6: Commit** — `feat(quiz): add question config and scoring core with unit tests`

---

### Task 2: Quiz flow (branching + navigation, pure)

**Files:**
- Create: `src/quiz/flow.ts`
- Test: `tests/unit/flow.test.ts`

**Interfaces:**
- Consumes: `QUESTIONS`, `Answers`, `QuestionId`, `getPath` (Task 1).
- Produces:
  - `sequenceFor(a: Answers): QuestionId[]` — A1, A2, then (once A1+A2 known) the path's questions in spec order. Individual: A1,A2,B1–B5,C1,C2,C4 (9). Leader: A1,A2,B1–B5,C1,C2,C3,C4,D1,D2 (12).
  - `nextStep(a: Answers, current: QuestionId): QuestionId | 'gate'`
  - `prevStep(a: Answers, current: QuestionId): QuestionId | 'intro'`
  - `pruneForPath(a: Answers): Answers` — removes answers not in `sequenceFor(a)`.
  - `progress(a: Answers, current: QuestionId): number` (0–1)

- [ ] **Step 1: Write failing tests** — lengths 9/12 for each path; `nextStep` after D2 → `'gate'`, after C4 on individual → `'gate'`; `prevStep` on A1 → `'intro'`; **Review Focus 1:** answers `{A1:'owner',A2:'10-49',C3:4,D1:'for',D2:'x'}` then A1 changed to `'student'` → `pruneForPath` result has no `C3`, `D1`, `D2`.
- [ ] **Step 2: Run `npm run test:unit` — FAIL.**
- [ ] **Step 3: Implement `flow.ts`.**
- [ ] **Step 4: Run `npm run test:unit` — PASS.**
- [ ] **Step 5: Commit** — `feat(quiz): add branching flow`

---

### Task 3: Gauge (SVG for page, PNGs for email)

**Files:**
- Create: `src/quiz/gauge.ts`, `scripts/generate_gauge_pngs.py`, `public/quiz/gauge/0.png … 100.png` (generated, committed)
- Test: `tests/unit/gauge.test.ts`

**Interfaces:**
- Produces:
  - `needleAngle(level: number): number` — degrees, −90 at 0 → +90 at 100, clamped.
  - `renderGauge(container: HTMLElement, opts: { size?: 'mini'|'full'; label?: string }): { set(level: number, animate: boolean): void }` — inline SVG semicircle, gradient stops `#d64545` (0) → `#e8a33d` (40%) → `#e3cf4f` (60%) → `#2db56f` (80%) → `#9be4b9` (100%); numeral in `--font-display`; `role="img"`, `aria-label` "AI Level {n} of 100, {band}". Animation: 1.2 s ease-out with ~4% overshoot via `requestAnimationFrame`; when `matchMedia('(prefers-reduced-motion: reduce)')` matches, sets final state with no animation.
  - PNG URL convention: `https://spanaisolutions.com/quiz/gauge/{n}.png`, 600×340, dark `#040806` background, band label under numeral.

- [ ] **Step 1: Failing tests** — `needleAngle(0)===-90`, `(50)===0`, `(100)===90`, `(-5)===-90`, `(130)===90`; test that `public/quiz/gauge/` has exactly 101 files `0.png`–`100.png` (fs check).
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement `gauge.ts`; write the Pillow script mirroring the SVG (follow `scripts/generate_brand_assets.py` style: `ROOT = Path(__file__).resolve().parents[1]`); run `python3 scripts/generate_gauge_pngs.py`.** Fonts: load Space Grotesk from `node_modules/@fontsource/space-grotesk/files/*700*.woff` is not Pillow-readable — use a TTF via `fc-match 'Space Grotesk:bold' --format=%{file}`, falling back to DejaVu Sans Bold.
- [ ] **Step 4: Run — PASS. Open `public/quiz/gauge/0.png`, `63.png`, `100.png` and check visually.**
- [ ] **Step 5: Commit** — `feat(quiz): add SVG gauge and email gauge PNGs`

---

### Task 4: Quiz page — intro, questions, teaser, gate, results

**Files:**
- Create: `src/pages/quiz/index.astro`, `src/quiz/ui.ts`, `src/quiz/api.ts`, `src/styles/quiz.css`
- Modify: `playwright.config.ts` only if needed for the new spec file (testDir already `./tests/e2e`)
- Test: `tests/e2e/quiz.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces (`src/quiz/api.ts`):
  - `interface SubmissionPayload { submissionId: string; startedAt: string; answers: Answers; contact: { firstName: string; email: string; organization: string|null; phone: string|null }; attribution: { utm_source: string|null; utm_medium: string|null; utm_campaign: string|null; referrer: string|null; landingPath: string }; website: string }`
  - `submitQuiz(p: SubmissionPayload): Promise<{ ok: true; optinToken: string } | { ok: false }>` — `POST /api/quiz`, 8 s timeout.
  - `optIn(body: { submissionId: string; email: string; token: string }): Promise<boolean>` — `POST /api/optin`.
- `ui.ts` exports `mountQuiz(root: HTMLElement): void`. State `{ screen, answers, submissionId (crypto.randomUUID), startedAt, contact, optinToken }` saved to `sessionStorage['span-quiz']` inside try/catch (works without storage). UTM params captured on load.

Page behaviour (spec §6): intro → questions (progress = thin bar + mini gauge from `renderGauge({size:'mini'})` driven by `progress()`, not score; chips with letter badges A–E, keys 1–5, auto-advance 250 ms for choice; Next for text/number; Back always; `aria-live="polite"` region announces "Question n of N") → teaser (gauge animates, band + description, blurred skills/win-back) → gate (first name, email, org when Leader, phone when Discovery, hidden `website` honeypot with `tabindex=-1` and `autocomplete=off`) → results (skills bars with tips, win-back card with rate slider recalculating via `winBack`, "📬 Your 2 tailored ideas are on their way to your inbox.", segment CTAs per spec §6 with `CALENDAR_URL`, opt-in button → "✓ You're on the list"). Results render from local state regardless of submit outcome; gate button disabled while submitting; if `submitQuiz` fails, opt-in button shows "Try again".

- [ ] **Step 1: Write failing Playwright tests** (mock `/api/quiz` and `/api/optin` with `page.route`):
  - `individual path: 9 questions, no org/phone, Course CTA` — complete with keyboard only (`1`–`5`, Enter, Tab); assert progress text "Question 9 of 9", gate has no Organization field, results show "Notify me when the free AI agents course launches"; clicking it posts `{submissionId,email,token}` and shows "✓ You're on the list".
  - `leader discovery path: 12 questions, org + phone, calendar CTA` — assert primary link href = calendar URL and no text matching `/Kami will|we'll call/i`.
  - `back from Leader to Individual drops org field` (Review Focus 1).
  - `double-click on Show my results sends exactly one POST` (Review Focus 2) — count route hits.
  - `results still render when /api/quiz returns 500`.
  - `rate slider updates $/year` — set slider to 100, assert text contains computed `dollarsPerYear`.
  - `reduced motion shows final score immediately` — `page.emulateMedia({ reducedMotion: 'reduce' })`.
  - `375px has no horizontal overflow` on intro, a question and results.
- [ ] **Step 2: Run `npx playwright test tests/e2e/quiz.spec.ts` — FAIL.**
- [ ] **Step 3: Implement page, `ui.ts`, `api.ts`, `quiz.css`.** Page `<title>`: "What's Your AI Level? | Span AI Solutions". Load `ui.ts` with an Astro `<script>`.
- [ ] **Step 4: Run e2e — PASS; `npm run check` clean.**
- [ ] **Step 5: Screenshot intro, a question, teaser, results at 1280 and 375 into `docs/review/quiz-*.png` (gitignored) and review against spec §6 and the site style.**
- [ ] **Step 6: Commit** — `feat(quiz): add /quiz page with branching UI, gate and results`

---

### Task 5: Netlify Functions — submit, opt-in, replay

**Files:**
- Create: `netlify/lib/token.ts`, `netlify/lib/quiz-handler.ts`, `netlify/functions/quiz.ts`, `netlify/functions/optin.ts`, `netlify/functions/quiz-replay.ts`
- Modify: `netlify.toml` (`[functions] directory = "netlify/functions"`, `node_bundler = "esbuild"`), `package.json` (dep `@netlify/blobs`, dev dep `@netlify/functions`)
- Test: `tests/unit/token.test.ts`, `tests/unit/quiz-handler.test.ts`

**Interfaces:**
- Consumes: `validateAnswers`, `scoreAll` (Task 1), `SubmissionPayload` (Task 4).
- Produces:
  - `normalizeEmail(e: string): string` (trim + lowercase) — in `token.ts`
  - `signOptin(submissionId: string, email: string, key: string): string` — hex HMAC-SHA256 of `${submissionId}:${normalizeEmail(email)}`
  - `verifyOptin(submissionId, email, token, key): boolean` — `timingSafeEqual`
  - `interface KV { get(k:string):Promise<string|null>; set(k:string,v:string):Promise<void>; delete(k:string):Promise<void>; list(prefix:string):Promise<string[]> }`
  - `interface QuizEnv { N8N_QUIZ_WEBHOOK_URL; N8N_OPTIN_WEBHOOK_URL; N8N_QUIZ_SECRET; OPTIN_SIGNING_KEY; CONTEXT: string }`
  - `interface Envelope extends SubmissionPayload { result: QuizResult; optinToken: string; test: boolean; receivedAt: string }` — the n8n contract (contact.email normalised; `website` removed)
  - `handleQuizSubmission(body: unknown, ctx: { ip: string; now: number; env: QuizEnv; fetch: typeof fetch; outbox: KV; rate: KV }): Promise<{ status: number; body: { ok: boolean; optinToken?: string; errors?: string[] } }>`
  - `handleOptin(body: unknown, ctx: { env; fetch }): Promise<{ status: number; body: { ok: boolean } }>`
  - `replayOutbox(ctx: { env; fetch; outbox: KV }): Promise<{ sent: number; failed: number }>`

Rules: honeypot non-empty or `now − startedAt < 20 000 ms` → `202 {ok:true}` and nothing forwarded; > 5 submissions per IP in the current hour (`rate` key `${ip}:${YYYYMMDDHH}`) → `429`; invalid → `400 {errors}`; forward `POST` with header `X-Span-Quiz-Secret`, 4 s `AbortSignal.timeout`; non-2xx or timeout → `outbox.set(submissionId, JSON)`; either way `200 {ok:true, optinToken}`. `test` = `CONTEXT !== 'production'` or email local part contains `+quiztest`. Opt-in: bad token → `403`; good → forward `{submissionId, email, optedInAt}` to opt-in webhook with the secret header → `200`. Function wrappers use `getStore('quiz-outbox')` / `getStore('quiz-rate')`, `context.ip`, `export const config = { path: '/api/quiz' }` / `'/api/optin'` / `{ schedule: '*/10 * * * *' }`.

- [ ] **Step 1: Failing tests** with in-memory `KV` and a fake `fetch`:
  - token round-trip; tampered token fails; **Review Focus 4:** `signOptin(id,' Jane@Acme.ORG ',k) === signOptin(id,'jane@acme.org',k)` and the forwarded envelope email is `jane@acme.org`.
  - client sends `segment` / tampered `result` → envelope `result` equals `scoreAll(answers)`.
  - honeypot filled → 202, fetch not called; elapsed 5 s → 202, fetch not called.
  - 6th submission same IP/hour → 429.
  - n8n 500 → outbox has entry, response 200 with token.
  - **Review Focus 5:** fetch never resolves → resolves within 5 s (fake timers), outbox has entry, 200.
  - `replayOutbox` sends and deletes on 2xx, keeps on failure.
  - opt-in bad token → 403, good → 200 and forward body correct.
- [ ] **Step 2: Run `npm run test:unit` — FAIL.**
- [ ] **Step 3: Implement lib modules and thin function wrappers.**
- [ ] **Step 4: Run — PASS. `npx netlify build` (or `npm run build` + `npx netlify functions:build --src netlify/functions`) bundles the three functions without errors.**
- [ ] **Step 5: Commit** — `feat(quiz): add submit, opt-in and outbox replay functions`

---

### Task 6: `/quiz/subscribed`, nav, homepage CTA, privacy

**Files:**
- Create: `src/pages/quiz/subscribed.astro`
- Modify: `src/components/SiteHeader.astro` (add `['AI Level Quiz', '/quiz']` to `nav`), `src/pages/index.astro:16-17` (add third hero link `button--ghost` "What's your AI level? Take the quiz →" → `/quiz`), `src/pages/privacy.astro` (real notice), `tests/e2e/landing.spec.ts` (add `/quiz`, `/quiz/subscribed` to `routes`)
- Test: `tests/e2e/quiz.spec.ts` (append)

**Interfaces:**
- Consumes: `optIn` (Task 4).

Subscribed page reads `s`, `e`, `t` query params, calls `optIn`, shows "You're on the list ✓" / "This link didn't work — try the button on your results again." / retry on network error. Privacy notice sections: what the quiz collects (answers, name, email, organisation, phone, UTM/referrer), why (send results, follow up about services you asked about, course notification only if you opt in), where it's stored (our self-hosted CRM), email providers (Google Workspace), retention, how to request access/deletion (`hello@spanaisolutions.com`), mailing address. Keep it plain; no legal claims beyond these facts.

- [ ] **Step 1: Failing tests** — subscribed with valid mocked response shows confirmation; with 403 shows the error copy; header nav contains "AI Level Quiz" → `/quiz`; homepage has link to `/quiz`; `/privacy` no longer contains "being updated".
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run full `npm run test:e2e` — PASS (existing landing tests included).**
- [ ] **Step 5: Commit** — `feat(quiz): add opt-in confirmation page, nav link, homepage CTA and privacy notice`

---

### Task 7: n8n Code-node logic (authored + tested in repo)

**Files:**
- Create: `n8n/src/templates.js`, `n8n/src/ideas.js`, `n8n/src/mime.js`
- Test: `tests/unit/n8n-templates.test.ts`, `tests/unit/n8n-ideas.test.ts`

Each file is plain JS with top-level `export function` declarations and **no imports** (the deploy script in Task 8 strips `export ` and inlines the source into Code nodes).

**Interfaces:**
- Consumes: `Envelope` shape (Task 5).
- Produces:
  - `escapeHtml(s: string): string`
  - `renderResultEmail(env: Envelope, ideas: Idea[], opts: { optinUrl: string }): { subject: string; html: string; text: string }` — subject `Your AI Level: {aiLevel} · {bandLabel}, and ≈${dollars}/yr on the table` (dollars with thousands separator); gauge `<img src="https://spanaisolutions.com/quiz/gauge/{aiLevel}.png" width="300">`; CTAs by segment per spec §9; footer "You're getting this because you asked for your AI Level results." + `23-4900 Optimist Dr, Regina, SK` + privacy link. Table-based, inline-styled HTML, dark header band, max-width 600.
  - `renderKamiAlert(env: Envelope, personUrl: string|null): { to: string; subject: string; html: string }` — `to` = `josh@spanaisolutions.com` when `env.test`, else `kamila@spanaisolutions.com`; subject prefix `🔥 Discovery` / `🌤 Nurture-Leader` / `🎓 Course` (+ `[TEST] ` when test), then `: {firstName}, {org||'—'} — ≈${dollars}/yr, AI Level {aiLevel}`; body includes `tel:` link when phone present.
  - `renderNoteMarkdown(env: Envelope): { title: string; markdown: string }` — title `AI Level Quiz · {aiLevel} {bandLabel} · {submissionId}` (prefix `[TEST] ` when test); markdown lists every asked question's prompt and chosen label, win-back maths, D2, attribution, submissionId.
  - `type Idea = { title: string; whatItDoes: string; tools: string[]; hoursSavedPerWeek: number }`
  - `ideasPrompt(env: Envelope): { system: string; user: string }` — asks for exactly 2 ideas as a JSON array, grounded in C1, C2, C3, C4, path, skills; forbids promises, guarantees and prices.
  - `parseIdeas(text: string): Idea[] | null` — extracts the first JSON array, validates 2 items with the fields above, else `null`.
  - `fallbackIdeas(chip: PainChip|null): Idea[]` — 2 canned ideas per chip + a generic pair for `null`.
  - `buildRawMime({ from, to, subject, html, text }): string` — multipart/alternative, RFC 2047 UTF-8 encoded subject (emoji-safe), base64url output for Gmail `messages.send`.

- [ ] **Step 1: Failing tests:**
  - **Review Focus 3:** envelope with `C1 = '<script>alert(1)</script> "quotes" 🚀\nline2'` and a 280-char `D2` → result email, Kami alert and note contain `&lt;script&gt;` and never `<script>`; emoji preserved.
  - Discovery email has calendar link and no `/call you|reach out/i`; Course email has `optinUrl` button and no calendar as primary.
  - Kami alert `to` switches on `env.test`; subject prefixes per segment.
  - `parseIdeas` handles fenced ```json blocks, rejects 1-item arrays and missing fields; `fallbackIdeas` returns 2 for every chip and `null`.
  - `buildRawMime` decodes (base64url → string) to headers containing `From: "Josh & Kami at Span" <hello@spanaisolutions.com>` and `Subject: =?UTF-8?B?`.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement the three modules.**
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** — `feat(quiz): add n8n email, note and ideas logic with tests`

---

### Task 8: Twenty fields + n8n workflows + deploy script

**Files:**
- Create: `scripts/twenty_quiz_fields.mjs`, `scripts/n8n_deploy.mjs`, `n8n/span-quiz-intake.json`, `n8n/span-quiz-optin.json`, `n8n/span-quiz-errors.json`

**Interfaces:**
- Consumes: Task 7 modules; envelope (Task 5); pinned IDs (Global Constraints).
- Produces: three n8n workflows (inactive), webhook paths `span-quiz-intake-<random>` and `span-quiz-optin-<random>` recorded in the deploy output; n8n credential "Span Quiz Webhook Secret" (`httpHeaderAuth`, header `X-Span-Quiz-Secret`).

`twenty_quiz_fields.mjs` (idempotent; reads env from `~/.hermes/.env`): on Person create, if missing — `leadSource` SELECT (QUIZ, WEBSITE, REFERRAL, OUTBOUND, OTHER), `segment` SELECT (DISCOVERY, NURTURE_LEADER, COURSE), `aiLevel` NUMBER, `estAnnualValue` CURRENCY, `leadStatus` SELECT (NEW, CONTACTED, IN_CONVERSATION, MEETING_BOOKED, NOT_INTERESTED, CLIENT), `courseOptIn` BOOLEAN default false, `courseOptInAt` DATE_TIME. Uses `POST /rest/metadata/fields`; prints created/skipped.

`n8n_deploy.mjs`: reads each `n8n/*.json`, replaces Code-node `jsCode` placeholders `/*@include templates.js*/` etc. with the stripped module source, then upserts by workflow `name` via `/api/v1/workflows` (PUT if exists, POST otherwise). Never activates. `--dry-run` prints the resolved JSON.

**Intake workflow** ("Span · Quiz Intake"), nodes in order:
1. Webhook (POST, Header Auth credential above, respond immediately 200).
2. Config (Set): `ALERT_SEGMENTS=["discovery","nurture-leader","course"]`, `CALENDAR_URL`, `TWENTY_BASE`, `KAMI_MEMBER_ID`, `SITE=https://spanaisolutions.com`.
3. Dedupe: `GET {TWENTY_BASE}/notes?filter=title[like]:%25{submissionId}%25` → if found, stop (Review Focus 2).
4. If segment ∈ ALERT_SEGMENTS → Code `renderKamiAlert` → `buildRawMime` → HTTP Gmail send (cred `WHqx5RVIqdWt1t9l`, `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send`). Person URL omitted at this point (speed first).
5. Twenty Person upsert: `GET /people?filter=emails.primaryEmail[eq]:{email}` → PATCH or POST (`name.firstName`, `emails.primaryEmail`, `phones.primaryPhoneNumber` if given, `jobTitle` = A1 label, `leadSource=QUIZ`, `segment`, `aiLevel`, `estAnnualValue {amountMicros: dollars×1e6, currencyCode:'CAD'}`; `leadStatus=NEW` **only on create**). Company (Leader with org): find by `name[eq]` → create if missing → set `companyId`.
6. Note: `POST /notes {title, bodyV2:{markdown}}` → `POST /noteTargets {noteId, targetPersonId}`.
7. If Discovery: `POST /tasks {title:'Call {firstName} — {org} (≈${dollars}/yr)', assigneeId: KAMI_MEMBER_ID, dueAt: receivedAt+1h, status:'TODO', bodyV2:{markdown: C1/C4/D2}}` → `POST /taskTargets {taskId, targetPersonId}`.
8. Ideas: HTTP `POST https://api.anthropic.com/v1/messages` (existing Anthropic credential, model `claude-sonnet-5-5`, `max_tokens` 1200, timeout 30 s) with `ideasPrompt` → Code `parseIdeas` ?? `fallbackIdeas(C1chip)`.
9. Result email: Code `renderResultEmail` (optinUrl = `{SITE}/quiz/subscribed?s={id}&e={encodeURIComponent(email)}&t={optinToken}`) → `buildRawMime` → Gmail send.
10. If Discovery or Nurture-Leader and org present: Tavily search (`@tavily/n8n-nodes-tavily` regular node, existing `tavilyApi` credential) `"{org}" {email domain}` → Code summarise to 5 bullets → `PATCH /notes/{id}` appending "## Company research".
Nodes 5–10: Settings → On Error → Continue. Workflow settings: `errorWorkflow` = Errors workflow id.

**Opt-in workflow** ("Span · Quiz Course Opt-in"): Webhook (Header Auth) → find Person by email → PATCH `courseOptIn=true`, `courseOptInAt` → respond 200; if no person, create one with `leadSource=QUIZ`, `courseOptIn=true`.

**Errors workflow** ("Span · Quiz Errors"): Error Trigger → Code builds plain email (workflow name, failed node, error message, execution URL, submissionId if present) → MIME → Gmail send to `josh@spanaisolutions.com`.

- [ ] **Step 1: Run `node scripts/twenty_quiz_fields.mjs`; re-run and confirm all 7 report "skipped". Verify with `GET /rest/metadata/objects` that Person has the fields.**
- [ ] **Step 2: Generate `N8N_QUIZ_SECRET` (`openssl rand -hex 32`) and create the "Span Quiz Webhook Secret" credential via `POST /api/v1/credentials` (store the secret in the local `.env` as `N8N_QUIZ_SECRET` for Task 9; `.env` is gitignored).**
- [ ] **Step 3: Author the three workflow JSON files; run `node scripts/n8n_deploy.mjs --dry-run` and check every placeholder resolved (no `/*@include` remaining).**
- [ ] **Step 4: Run `node scripts/n8n_deploy.mjs`; confirm the three workflows exist and are inactive via `GET /api/v1/workflows`.**
- [ ] **Step 5: Commit** — `feat(quiz): add Twenty field setup, n8n workflows and deploy script`

---

### Task 9: Live end-to-end verification (test mode) and launch

**Files:**
- Create: `scripts/quiz_live_test.mjs`
- Modify: `netlify.toml` only if function config needs it

**Interfaces:**
- Consumes: everything above.

`quiz_live_test.mjs`: builds three envelopes via `scoreAll` + `signOptin` for personas (Discovery leader, Nurture-Leader, Course), emails `josh+quiztest-<segment>-<ts>@spanaisolutions.com`, `test: true`; POSTs them to the intake webhook with the secret; waits 60 s; asserts in Twenty: Person exists with `segment`, `aiLevel`, `leadStatus=NEW`; one Note whose title contains the submissionId; Discovery has a Task assigned to Kami's member id; then POSTs the Discovery envelope **again** and asserts still one Note (Review Focus 2); then calls the opt-in webhook and asserts `courseOptIn=true`. `--cleanup` deletes every Person/Note/Task whose email or title contains `quiztest`.

- [ ] **Step 1: Activate the three workflows (`POST /api/v1/workflows/{id}/activate`).**
- [ ] **Step 2: Run `node scripts/quiz_live_test.mjs` — all assertions PASS. In Josh's inbox confirm: 3 result emails from "Josh & Kami at Span <hello@…>" rendering the gauge and ideas, 3 `[TEST]` alerts, no error emails.**
- [ ] **Step 3: Run `node scripts/quiz_live_test.mjs --cleanup`; confirm zero `quiztest` records remain.**
- [ ] **Step 4: Set Netlify env vars (`N8N_QUIZ_WEBHOOK_URL`, `N8N_OPTIN_WEBHOOK_URL`, `N8N_QUIZ_SECRET`, `OPTIN_SIGNING_KEY` = new `openssl rand -hex 32`) via `npx netlify env:set` (or ask Josh to set them in the Netlify UI if the CLI isn't linked). Push the branch, open the deploy preview, complete the quiz once on the preview with a `+quiztest` email, and confirm the preview's submission reaches n8n (test mode, alert to Josh).**
- [ ] **Step 5: Run all gates: `npm run test:unit && npm run check && npm run build && npm run test:e2e` — all PASS.**
- [ ] **Step 6: Open a PR to `main` with the summary, test evidence and the remaining manual items (Kami send-as, OAuth publish check `SpanAISolutions_com-q97`). Merge only after Josh approves.**
- [ ] **Step 7: After merge, take the quiz once on production with a `+quiztest` address (test flag via email), verify, then run `--cleanup`. File follow-up beads issues from spec §13.**
