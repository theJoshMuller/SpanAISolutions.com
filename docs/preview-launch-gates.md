# Span website rebuild — private review and launch gates

Source: Kamila's `Span AI Solutions — Website Rebuild Instructions.docx` (Sep 29, 2026). This branch is **not approved for public deployment**. The current production site remains unchanged.

## Review scope

- Six main routes and two legal placeholders, preserving the existing Span logo and dark/green palette.
- Kamila approved the supplied public copy and offers and stated that Josh also approves. Testimonial use is confirmed. Final assembled-page approval remains pending after the email-only and photo changes.
- Email-only launch approved: the intake form and updates opt-in are removed. Contact links open an email to `sales@spanaisolutions.com`, preserving the service in the subject where applicable. No website form submission or enrolment occurs.
- The draft uses `<meta name="robots" content="noindex, nofollow">` by default. Only set `PUBLIC_SPAN_LAUNCH_READY=true` after completing every launch gate, and verify a production-equivalent build.
- Footer wording awaits final-version approval. Kamila confirmed corporation identifier `102237577`; the previously verified registration record identifies `102237577 Saskatchewan Inc.`. All three supplied photos are included in the local review: Josh on About and AI Consulting, Kamila's edited portrait and the edited joint photo on About.

## Required before public launch

- Obtain approval of the final assembled public version, including the email-only contact page, photos, metadata, links and social card. Independently verify source-backed claims and link destinations; owner approval is not independent verification.
- Testimonial use is confirmed for the supplied quotations and attributions. Testimonial photos and LinkedIn links remain optional and are omitted unless separately approved and verified. All founder photos are supplied and included. Originals and editing material are gitignored under `assets/source-photos/` (directory 0700, files 0600); only metadata-free WebP derivatives are public assets.
- Kamila confirmed that Span AI Solutions is registered under their corporation identified as `102237577`. The previously verified ISC registration record identifies the full company as `102237577 Saskatchewan Inc.`. Proposed footer for final-version review: “Span AI Solutions is a trade name of 102237577 Saskatchewan Inc.”
- Kamila approved omitting unanswered FAQs for launch. Do not invent data-safety, supported-calendar or compliance answers; generic answered FAQs can remain.
- Kamila deferred the full form and final privacy policy. Privacy/Terms remain the source-requested update notices; they are not final policies. Before adding intake, SMS outreach or launching client voice agents, obtain and review appropriate final policies.
- Full-form follow-up only: implement server-validated delivery, Turnstile, honeypot, conditional fields and separate consent, then verify received messages. No SMS enrolment. This is not a blocker for the approved email-only launch.
- Kamila confirmed phone `16393823319`; contact and footer use `tel:+16393823319`, displayed as `+1 (639) 382-3319`.

## Photo review evidence

- `public/images/josh-muller.webp`: unchanged selected portrait crop, 640×480.
- `public/images/kamila-buitrago.webp`: 640×480, diploma excluded by crop; university branding and graduation background replaced with deep green/charcoal via the approved external API. Side-by-side visual review found no material identity, pose, clothing or jewelry change.
- `public/images/span-founders.webp`: 768×1152; diploma and medal/case removed via the approved external API. The original top 711 rows were restored verbatim before resize/export, preserving both original faces; the lower edit is blended over rows 711–750. Visual review found no seam, residual objects or material hand defects.
- Both delivered WebPs decode successfully and have explicit dimensions, meaningful alt text, lazy loading and responsive sizing. Final rendered desktop/mobile and owner review are still required before production deployment.
- Confirm Netlify account/site destination before deployment; verify the exact production URL, assets, mobile menu, SEO/OG tags, forms, and rollback commit after publication.

## Local review

`npm install` if needed, then `npm run check`, `npm run build`, `npm run test:e2e`, and `npm run dev`. Review locally at the URL printed by Astro. The E2E suite builds the site and serves a production-equivalent local preview on an isolated strict port at `http://127.0.0.1:4329` to avoid testing another project already on 4321 and to exclude Astro's dev-toolbar markup. Josh authorized pushing this review branch to GitHub; do not merge to `main` or deploy publicly before approval and gates.
