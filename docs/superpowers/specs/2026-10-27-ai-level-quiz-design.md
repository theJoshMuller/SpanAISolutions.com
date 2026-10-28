# AI Level Quiz — Design Spec

**Date:** 2026-10-27
**Project:** spanaisolutions.com `/quiz` lead magnet + qualifier
**Status:** Draft for review
**Tracking:** beads `SpanAISolutions_com-izs`

## 1. Summary

A branching, ~3-minute quiz at **`spanaisolutions.com/quiz`** titled **"What's Your AI Level, and What's It Costing You?"** Visitors get a 0–100 AI Level shown on a speedometer gauge, a 5-skill breakdown, and an estimate of the hours and dollars a year they could win back by automating their biggest time drain.

Behind the fun result, the quiz **segments** every contact:

- **Discovery** — decision makers with real pain who want help building → booking a discovery call (pipeline step 1 → 2).
- **Nurture-Leader** — decision makers not ready yet → future prospects.
- **Course** — everyone else → optional one-click opt-in to the free 3-video "AI agents from zero" course (not yet built; this is a launch-notification list).

Every submission is emailed its results, written to Twenty CRM (`crm.spanaisolutions.com`), and triggers an instant alert email to Kami.

## 2. Locked decisions

| Topic | Decision |
|---|---|
| Architecture | Approach A: static Astro page + quiz engine in vanilla TS → Netlify Function → n8n → Twenty + Gmail |
| URL / title | `/quiz` · "What's Your AI Level, and What's It Costing You?" |
| Contact gate | Teaser (gauge + level) shown free; name + email unlocks full results |
| Phone | Asked only of Discovery-segment leads, optional |
| Booking link | Kami's Google Calendar: `https://calendar.app.google/bNDHFsbv5cj88RzPA` |
| Kami calling | Never mentioned to the lead — a surprise. Lead email offers only "Grab a time" |
| Course list | Not automatic. One-click opt-in (email button + results-page button) |
| CRM | Twenty: add custom Person fields + a Note per submission + Task for Kami on Discovery |
| Email sending | n8n → Gmail (Google Workspace), from shared alias `hello@spanaisolutions.com`, signed "Josh & Kami" |
| Kami alerts | All segments for now; configurable list in n8n |
| Qualification | Self-selected via "what would help most" (D1) + team-hours of pain; no budget/timeline questions |

## 3. Goals and non-goals

**Goals**
1. Turn site traffic into segmented CRM contacts.
2. Get Discovery leads in front of Kami within minutes.
3. Make the pain tangible: hours and dollars per year, in the lead's own words.
4. Feel on-brand (Night-Ops dark, forest green, Space Grotesk/Inter), fun, and credible.
5. Own the whole stack so the engine can become a reusable Span asset.

**Non-goals for v1** (filed as follow-ups)
- Funnel analytics (per-question drop-off)
- Shareable score cards / social images
- Showing AI-written ideas on the page (email only in v1)
- Building the 3-video course or its nurture sequence
- Opportunity records / pipeline automation in Twenty

## 4. The quiz

One question per screen. Chips = tappable answer cards with letter badges and keys 1–5. Single-choice auto-advances after ~250 ms; Back is always available. Text inputs have a Next button. Progress persists in `sessionStorage`.

### Part A — About you (sets the branch)

**A1. What best describes your role?**
Owner / founder · Executive director / C-suite · Director / manager · Team member · Freelancer / solo · Student / exploring

**A2. How many people are on your team or in your organization?**
Just me · 2–9 · 10–49 · 50–249 · 250+

**Branch rule:** A1 ∈ {Owner/founder, Executive, Director/manager} **and** A2 ≠ "Just me" → **Leader path**. Otherwise → **Individual path**. Paths share the scored questions; Leader wording uses "your team", Individual uses "you".

### Part B — AI level (scored, 0–4 each)

**B1 · Habits — Which of these is part of your (team's) normal week?** (most advanced that's true)
0 I rarely use AI · 1 Ask ChatGPT/Claude questions now and then · 2 Use AI daily to write, summarize or analyze · 3 Custom instructions, Projects or GPTs I reuse · 4 AI is connected to my tools (docs, inbox, CRM) or runs automations

**B2 · Context — How does the AI know about your work?**
0 It doesn't; I start fresh every time · 1 I paste in background when I remember · 2 A saved prompt or instructions I reuse · 3 Projects set up with our docs, examples and style · 4 Connected directly to our files and systems

**B3 · Prompting — Scenario: you need a proposal for a new client in your organization's voice.**
0 Write it myself · 1 "Write me a proposal for X" and edit · 2 Detailed instructions: tone, client, structure · 3 Instructions + 2–3 past proposals as examples · 4 A reusable setup that drafts these from our templates and the client's info

**B4 · Automation — Scenario: every Monday someone exports a report, pastes numbers into a sheet and emails a summary.**
0 That's just part of the job · 1 AI helps write the summary · 2 I know it could be automated but not where to start · 3 I'd sketch it as trigger → steps → output in Zapier/Make/n8n · 4 Things like this already run on their own for us

**B5 · Reliability — When AI gets something wrong, what do you do?**
0 Stop trusting it for that task · 1 Ask again and hope · 2 Fix my prompt: detail, examples, constraints · 3 Build in a check: review step, checklist, second pass · 4 Test it systematically against known-good examples before relying on it

### Part C — Your biggest time drain

**C1. If you could hand one recurring task to a reliable AI teammate tomorrow, what would it be?** Text, required (≥ 10 chars or a chip). Chips prefill the box: Follow-ups & chasing · Data entry between tools · Answering the same questions · Building reports · Scheduling & intake · Writing content. Max 280 chars.

**C2. Roughly how many hours a week does it take?**
<2 · 2–5 · 5–10 · 10–20 · 20+ (midpoints used: 1, 3.5, 7.5, 15, 25)

**C3. (Leader only) How many people spend time on it?** Number, default 1, min 1, max 500. Individual path: fixed at 1.

**C4. What would you do with that time back?** Text, optional, max 280 chars.

### Part D — What would help most (Leader only)

**D1. Say we found a way to win those hours back. What would you want?**
🎓 Show me how to do it myself (`diy`) · 🤝 Build it with us — coach us while we build (`with`) · 🛠️ Have someone build it for us (`for`) · 👀 Just curious for now (`curious`)

**D2. Anything else we should know?** Text, optional, max 500 chars.

Question count: Individual path 9, Leader path 12.

## 5. Scoring and segmentation

All logic lives in pure functions in `src/quiz/scoring.ts`, driven by `src/quiz/config.ts`, shared by the browser and the Netlify Function.

**AI Level** = round((B1+B2+B3+B4+B5) / 20 × 100).

| Band | Range | Gauge colour | One-line description (draft) |
|---|---|---|---|
| Parked 🔴 | 0–20 | red | AI hasn't entered the workflow yet — which means the biggest gains are still on the table. |
| First Gear 🟠 | 21–40 | orange | You're using AI, but it's still a side tool, not a teammate. |
| Cruising 🟡 | 41–60 | amber | Real daily habits. The next jump is giving AI context and repeatable setups. |
| Accelerating 🟢 | 61–80 | green | You've built real habits. The next jump is connecting AI to your systems so work runs without you. |
| Full Speed 🤩 | 81–100 | bright green | You build with AI. What's next is making it reliable, measured, and running across the team. |

**Skill bars:** each of B1–B5 shown as 0–100 (value × 25) with a one-line "next level" tip per skill per score.

**Win-back:**
- team-hours/week = C2 midpoint × C3
- hours/year = team-hours/week × 48 × 0.60 (automation share, shown as an assumption)
- $/year = hours/year × hourly rate. Rate defaults to **$40/hr**; results-page slider ($20–$200, step $5) recalculates live. The CRM and email use the default $40 and say so.

**Segment:**
- **Discovery** = Leader path **and** D1 ∈ {`with`, `for`} **and** team-hours/week ≥ 5
- **Nurture-Leader** = Leader path, not Discovery
- **Course** = Individual path

## 6. Page experience

Built in the existing site style (`src/styles/global.css` tokens, `BaseLayout`, header/footer). Quiz styles live in `src/styles/quiz.css`.

1. **Intro** — eyebrow `AI LEVEL QUIZ · 3 MINUTES`; H1 "What's your AI level, and what's it costing you?"; subhead "Answer a few quick questions. Get your score from 0–100, see where you're strong, and find out how many hours a year you could win back." Three takeaway cards: ① Your AI Level (0–100) ② Your 5-skill breakdown ③ Your win-back + 2 ideas for your task (highlighted). Dimmed gauge visual. CTA **Start the quiz**; quiet link "Rather just talk? Grab a time →".
2. **Questions** — as §4. Progress = thin bar + mini gauge that creeps up with progress (not score).
3. **Teaser + gate** — gauge needle sweeps 0 → score (eased overshoot; static under `prefers-reduced-motion`), band name + description. Blurred skill bars and win-back figure behind a card: "Unlock your full results (we'll email you a copy)". Fields: first name, email; organization (Leader path); "Best number to reach you (optional)" (Discovery only). Hidden honeypot. Button **Show my results →**.
4. **Full results** — gauge + band; 5 skill bars with tips; win-back card with rate slider and the assumption written out; "📬 Your 2 tailored ideas are on their way to your inbox." CTA by segment:
   - Discovery: primary **Grab a time to map your win-back →** (calendar); secondary course opt-in button.
   - Nurture-Leader: both CTAs equal weight.
   - Course: primary **Notify me when the free AI agents course launches** (→ "✓ You're on the list"); secondary "Running a team? Grab a time."
5. **`/quiz/subscribed`** — landing page for the email opt-in link: confirms "You're on the list ✓".

Results render from local state immediately; the gate submit is fire-and-forget with a short wait for the opt-in token (see §7). If submit fails, results still show; the opt-in button falls back to a retry.

**Gauge:** inline SVG semicircle with red → amber → green gradient, needle, Space Grotesk numeral; `role="img"` with text alternative "AI Level 63 of 100, Accelerating". Email uses pre-rendered PNGs `public/quiz/gauge/{0..100}.png` generated by `scripts/generate_gauge_pngs.py` (same visual).

**Accessibility:** keyboard-only completion, visible focus, `aria-live` announcement of question changes, ≥ 44px targets, 375px mobile layout.

**Site integration:** add "AI Level Quiz" to header nav and a secondary CTA on the homepage hero.

## 7. System architecture

```
Browser /quiz  (Astro static page + src/quiz/*.ts)
  │ POST /api/quiz  {submission payload}
  ▼
Netlify Function  netlify/functions/quiz.ts
  - validate schema; honeypot empty; elapsed ≥ 20 s
  - rate limit 5 / IP / hour (Netlify Blobs counter)
  - RE-SCORE with src/quiz/scoring.ts (client score/segment ignored)
  - sign opt-in token: HMAC-SHA256(submissionId + email, OPTIN_SIGNING_KEY)
  - POST to n8n webhook with header X-Span-Quiz-Secret
  - on n8n failure: store payload in Blobs store "quiz-outbox"
  - respond { ok, optinToken }
  ▼
n8n "Span · Quiz Intake" (responds 200 immediately)
  0. Config node: ALERT_SEGMENTS, KAMI_EMAIL, SENDER, CALENDAR_URL, TEST_MODE handling
  1. If segment ∈ ALERT_SEGMENTS → Gmail alert to Kami        (first, before slow steps)
  2. Twenty: find Person by email → create/update; upsert Company by name/email domain (Leader path)
     set custom fields; create Note with all answers + UTM + submissionId
  3. If Discovery → Twenty Task "Call {name} — {org}" assigned to Kami, due now + 1 h
  4. DeepSeek via OpenRouter (n8n "Josh's OpenRouter API Key" credential) → 2 tailored ideas as JSON; fallback to canned ideas by C1 chip
  5. Gmail → result email to lead (segment template)
  6. If Discovery or Nurture-Leader → Tavily company research → append to the Note
  Steps 2–6 "continue on fail".
n8n "Span · Quiz Course Opt-in"   ← POST from netlify/functions/optin.ts
  - set courseOptIn = true, courseOptInAt = now on Person (by email)
n8n "Span · Quiz Errors" (Error Trigger) → email Josh with workflow, node, submissionId
Netlify scheduled function netlify/functions/quiz-replay.ts (every 10 min)
  - replays "quiz-outbox" entries to n8n; deletes on success
```

**Opt-in flow:** results-page button and the email button both reach `netlify/functions/optin.ts` with `{ submissionId, email, token }` (email link goes to `/quiz/subscribed?s=…&e=…&t=…`, the page POSTs it). The function verifies the HMAC and forwards to the n8n opt-in webhook. The token proves the click came from that lead's results.

**Submission payload (browser → function):**
```json
{
  "submissionId": "uuid",
  "startedAt": "ISO",
  "answers": { "A1": "owner", "A2": "10-49", "B1": 3, "B2": 2, "B3": 3, "B4": 2, "B5": 2,
               "C1": "text", "C1chip": "followups|null", "C2": "5-10", "C3": 3,
               "C4": "text|null", "D1": "for", "D2": "text|null" },
  "contact": { "firstName": "", "email": "", "organization": "|null", "phone": "|null" },
  "attribution": { "utm_source": "", "utm_medium": "", "utm_campaign": "", "referrer": "", "landingPath": "" },
  "website": ""
}
```
`website` is the honeypot. The function forwards answers + contact + attribution plus server-computed `{ path, aiLevel, band, skills, teamHoursPerWeek, hoursPerYear, dollarsPerYear, segment, optinToken, test }`.

**Configuration (Netlify env):** `N8N_QUIZ_WEBHOOK_URL`, `N8N_OPTIN_WEBHOOK_URL`, `N8N_QUIZ_SECRET`, `OPTIN_SIGNING_KEY`. `test` is true when the contact email ends in `+quiztest@…` or the deploy is not production.

**Repo layout (new):**
```
src/quiz/config.ts         questions, bands, skill tips, constants
src/quiz/scoring.ts        pure scoring/segment/win-back functions
src/quiz/engine.ts         client state machine + DOM rendering
src/quiz/gauge.ts          SVG gauge render + animation
src/pages/quiz/index.astro
src/pages/quiz/subscribed.astro
src/styles/quiz.css
netlify/functions/quiz.ts, optin.ts, quiz-replay.ts
scripts/generate_gauge_pngs.py  → public/quiz/gauge/*.png
n8n/span-quiz-intake.json, span-quiz-optin.json, span-quiz-errors.json   (exported for version control)
tests/unit/scoring.test.ts (Vitest), tests/quiz.spec.ts (Playwright)
```

## 8. Twenty CRM

New custom fields on **Person**:

| Field (API name) | Type | Values |
|---|---|---|
| Lead Source (`leadSource`) | Select | Quiz, Website, Referral, Outbound, Other |
| Segment (`segment`) | Select | Discovery, Nurture-Leader, Course |
| AI Level (`aiLevel`) | Number | 0–100 |
| Est. Annual Value (`estAnnualValue`) | Currency (CAD) | win-back $/year at $40/hr |
| Lead Status (`leadStatus`) | Select | New, Contacted, In Conversation, Meeting Booked, Not Interested, Client |
| Course Opt-in (`courseOptIn`) | Boolean | |
| Course Opt-in At (`courseOptInAt`) | Date-time | |

Standard fields used: `name`, `emails`, `phones`, `jobTitle` (A1 label), Company link.

**Repeat submissions:** Person matched by email; score/segment fields overwrite with the latest; `leadStatus` is set to New only on create (never overwrites Kami's progress); each attempt adds a Note. `submissionId` in the Note makes n8n skip a duplicate delivery.

**Note body:** level, band, skills, every question with its answer text, win-back maths, D2, attribution, submissionId, and later the research summary.

**Task (Discovery):** title "Call {firstName} — {org} (≈${value}/yr)", assignee Kamila Buitrago, due submission time + 1 h, linked to the Person.

## 9. Emails

All sent via n8n Gmail node from `hello@spanaisolutions.com` (send-as alias), display name "Josh & Kami at Span".

**Result email (all segments)** — subject `Your AI Level: {score} · {band}, and ≈${value}/yr on the table`.
Body: gauge PNG, band description, 5 skills (compact), win-back with assumptions, **2 tailored ideas** for their C1 task (title, what it does, tools, rough hours saved), then:
- Discovery: single CTA "Grab a time to map your win-back" (calendar). No mention of a call from Kami.
- Nurture-Leader: calendar CTA + "Notify me when the free AI agents course launches" button.
- Course: course opt-in button + small "Running a team? Grab a time" link.
Footer: why they got this email (they requested their results), Span's mailing address (required by CASL; Josh to supply), privacy link. No marketing follow-ups are sent without opt-in.

**Kami alert** — to `kamila@spanaisolutions.com`; subject prefix by segment: `🔥 Discovery`, `🌤 Nurture-Leader`, `🎓 Course`, then `: {name}, {org} — ≈${value}/yr, AI Level {score}`. Body: tap-to-call `tel:` link, email, role, team size, C1/C4/D1/D2 verbatim, level, Twenty record link. `ALERT_SEGMENTS` in the Config node controls which segments alert.

**Ideas generation** — OpenRouter chat completions via the existing n8n "Josh's OpenRouter API Key" credential, model `deepseek/deepseek-v4.1-flash` (switched from Anthropic on 2026-10-27 at Josh's request), JSON output: `[{title, whatItDoes, tools[], hoursSavedPerWeek}]` × 2, grounded in C1, C2, C3, C4, path and B-scores. Prompt forbids promises/guarantees and price talk. Timeout 30 s → canned ideas keyed by C1 chip (or a generic pair).

## 10. Reliability, security, privacy

- Results never depend on the backend.
- n8n unreachable → Blobs outbox → replay every 10 min. Error Trigger workflow emails Josh.
- Kami alert runs before slow/fragile steps; later steps continue on failure.
- Webhooks: secret path + `X-Span-Quiz-Secret` header; Twenty API key lives only in n8n.
- Bot defences: honeypot, ≥ 20 s elapsed, 5/IP/hour.
- Opt-in links carry an HMAC token; forged opt-ins are rejected.
- **Email deliverability:** add SPF (`v=spf1 include:_spf.google.com ~all`), Google DKIM, and DMARC (`p=none` with reporting, tightened later) on Cloudflare DNS before launch.
- **Privacy:** replace the `/privacy` stub with a real notice covering what the quiz collects, why, storage in our CRM, and how to request deletion (PIPEDA). Course/marketing emails only after explicit opt-in click (CASL); opt-in timestamp stored.

## 11. Testing

- **Unit (Vitest, new dev dependency):** table-driven persona tests on `scoring.ts` — power user (all 4s → 100, Full Speed); beginner ED, 3 people × 5–10 h, D1 `for` → Discovery; owner, `curious` → Nurture-Leader; student → Course; leader with < 5 team-hours → Nurture-Leader; band boundaries 20/21, 40/41, 60/61, 80/81; win-back maths; branch rule.
- **Function tests:** validation, honeypot, elapsed-time rejection, server re-score overrides tampered client segment, HMAC sign/verify, outbox on n8n failure (mocked fetch).
- **Playwright e2e:** both paths through to results with `/api/*` mocked; gate shows org/phone only when expected; segment CTAs; keyboard-only run; 375px screenshot; reduced-motion gauge.
- **Live n8n check (test mode):** one submission per segment against real Twenty + Gmail with alerts routed to Josh; verify fields, Note, Task, emails; then delete test records.
- Existing gates still pass: `npm run check`, `npm run build`, `npm run test:e2e`.

## 12. Rollout

1. Cloudflare DNS: SPF and DMARC records (via API). Josh generates the DKIM key in Google Workspace Admin, then the TXT record is added. Josh creates the `hello@` alias and adds it as a Gmail send-as address.
2. Twenty: add custom fields (§8).
3. n8n: Gmail OAuth credential for the Span Workspace account; Twenty header-auth credential for crm.spanaisolutions.com; build the three workflows inactive; export JSON to `n8n/`.
4. Site: build the quiz on a feature branch; review on a Netlify deploy preview.
5. Live test (§11), then activate workflows, set Netlify env vars, merge to `main`.
6. Add nav link + homepage CTA; update `/privacy`.

## 13. Follow-ups (to file as beads issues)

- Funnel analytics for per-question drop-off
- Shareable score card image
- Show AI ideas on the results page
- Course-launch email sequence for opted-in contacts
- Create Twenty Opportunities from Discovery leads (pipeline steps 2–7)
- Narrow `ALERT_SEGMENTS` once volume grows
