# Span website rebuild — private review and launch gates

Source: Kamila's `Span AI Solutions — Website Rebuild Instructions.docx` (Sep 29, 2026). Kamila approved the assembled review and explicitly requested “Publish!” on Sep 30, 2026, conditional on preserving the existing fonts. Production publication is authorized after verification.

## Review scope

- Six main routes and two legal placeholders, preserving the existing Span logo and dark/green palette.
- Kamila approved the supplied public copy and offers and stated that Josh also approves. Testimonial use and the final assembled email-only/photo version are approved.
- Email-only launch approved: the intake form and updates opt-in are removed. Contact links open an email to `sales@spanaisolutions.com`, preserving the service in the subject where applicable. No website form submission or enrolment occurs.
- The draft uses `<meta name="robots" content="noindex, nofollow">` by default. Only set `PUBLIC_SPAN_LAUNCH_READY=true` after completing every launch gate, and verify a production-equivalent build.
- Publish the footer exactly as shown in the approved assembled review: “© 2026 Span AI Solutions.” Do not add new legal statements during deployment. Kamila confirmed corporation identifier `102237577`; the previously verified registration record identifies `102237577 Saskatchewan Inc.`. All three supplied photos are included: Josh on About and AI Consulting, Kamila's edited portrait and the edited joint photo on About.

## Required before public launch

- Final assembled-version approval received. Verify the unchanged typography, production-equivalent build, all routes and asset paths before deployment; re-read the exact live targets afterward.
- Testimonial use is confirmed for the supplied quotations and attributions. Testimonial photos and LinkedIn links remain optional and are omitted unless separately approved and verified. All founder photos are supplied and included. Originals and editing material are gitignored under `assets/source-photos/` (directory 0700, files 0600); only metadata-free WebP derivatives are public assets.
- The proposed extra legal line is not part of the approved rendered footer and is intentionally omitted from this launch. Preserve the verified corporation identifier for a separately reviewed future legal-policy update.
- Kamila approved omitting unanswered FAQs for launch. Do not invent data-safety, supported-calendar or compliance answers; generic answered FAQs can remain.
- Kamila deferred the full form and final privacy policy. Privacy/Terms remain the source-requested update notices; they are not final policies. Before adding intake, SMS outreach or launching client voice agents, obtain and review appropriate final policies.
- Full-form follow-up only: implement server-validated delivery, Turnstile, honeypot, conditional fields and separate consent, then verify received messages. No SMS enrolment. This is not a blocker for the approved email-only launch.
- Kamila confirmed phone `16393823319`; contact and footer use `tel:+16393823319`, displayed as `+1 (639) 382-3319`.

## Photo review evidence

- `public/images/josh-muller.webp`: unchanged selected portrait crop, 640×480.
- `public/images/kamila-buitrago.webp`: 640×480, diploma excluded by crop; university branding and graduation background replaced with deep green/charcoal via the approved external API. Side-by-side visual review found no material identity, pose, clothing or jewelry change.
- `public/images/span-founders.webp`: 768×1152; diploma and medal/case removed via the approved external API. The original top 711 rows were restored verbatim before resize/export, preserving both original faces; the lower edit is blended over rows 711–750. Visual review found no seam, residual objects or material hand defects.
- Both delivered WebPs decode successfully and have explicit dimensions, meaningful alt text, lazy loading and responsive sizing. Desktop/mobile visual QC and 36 browser tests passed; owner photo and assembled-version review is approved.
- Confirm Netlify account/site destination before deployment; verify the exact production URL, assets, mobile menu, SEO/OG tags, forms, and rollback commit after publication.

## Local review

`npm install` if needed, then `npm run check`, `npm run build`, `npm run test:e2e`, and `npm run dev`. Review locally at the URL printed by Astro. The E2E suite serves an isolated non-indexable local preview on strict port `4329`. Production builds use `PUBLIC_SPAN_LAUNCH_READY=true`; `netlify.toml` enables it only in production.

## Publication and rollback

- Verified target: Netlify user `j@umut.ca`, account `mullerhosting`, site `a64be413-1281-44d2-aae8-ab56576d334c`, domain `https://spanaisolutions.com`.
- Previous production commit: `34474a6c120e1aecfce54bb91c68992ed0b97f57`.
- Previous Netlify deploy: `6a480c9e7ade5600090db9e4`. Restore that deployment if launch verification fails.
