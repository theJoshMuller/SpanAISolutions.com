# Span website rebuild — private review and launch gates

Source: Kamila's `Span AI Solutions — Website Rebuild Instructions.docx` (Sep 29, 2026). This branch is **not approved for public deployment**. The current production site remains unchanged.

## Review scope

- Six main routes and two legal placeholders, preserving the existing Span logo and dark/green palette.
- Source-quoted copy is in the page files for review only, not an assertion that claims or testimonial permissions are verified.
- Contact form is intentionally **non-submitting** in preview. No message is sent, no opt-in is recorded, and no synthetic success screen is shown.
- The draft uses `<meta name="robots" content="noindex, nofollow">` by default. Only set `PUBLIC_SPAN_LAUNCH_READY=true` after completing every launch gate, and verify a production-equivalent build.
- Footer copyright omits the unresolved legal entity rather than inventing wording. Headshot slots remain placeholders.

## Required before public launch

- Obtain final approval of the exact public page copy, metadata, testimonial quotations, attributions, links, and social card from the website owners. Verify claims against sources, especially press/article attribution, the translated press quote, experience and expert-network claims, Waha naming, and the AI voice-agent features/disclosure promise.
- Get Yeshua, Josh Parkman, and Vincent's permission to publish the quotations and any headshots; obtain founder headshots. Confirm each testimonial subject's LinkedIn profile URL before adding a link. If permissions are refused, replace/remove those blocks with approved copy before publication. The El Espectador backup URL is documented in the source DOCX and should only replace the article link if that link moves.
- Confirm the legal entity line with the accountant.
- Supply approved answers to the custom AI data-safety/timeframe and voice agent calendar/compliance FAQs; do not invent answers.
- Obtain Termly Privacy Policy and Terms; the coming-soon pages are not substitutes for legal terms for form intake, SMS outreach, or client voice-agent launches.
- Implement real form delivery to `sales@spanaisolutions.com` with server-side validation, secret-verified Cloudflare Turnstile, honeypot, every conditional field, and consent handled separately from inquiry. Obtain site/secret keys via a secure channel, never commit secrets. Do not enable submitting until real messages for each service are received/read back, and verify no SMS enrolment.
- Confirm the phone number and `tel:+16393823319` destination; source instructions include a deliberately masked `tel:+163****3319` while displaying the full number.
- Confirm Netlify account/site destination before deployment; verify the exact production URL, assets, mobile menu, SEO/OG tags, forms, and rollback commit after publication.

## Local review

`npm install` if needed, then `npm run check`, `npm run build`, `npm run test:e2e`, and `npm run dev`. Review locally at the URL printed by Astro. The E2E suite builds the site and serves a production-equivalent local preview on an isolated strict port at `http://127.0.0.1:4329` to avoid testing another project already on 4321 and to exclude Astro's dev-toolbar markup. Do not push this branch to a public remote or merge to `main` before approval and gates.
