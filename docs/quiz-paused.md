# Quiz paused — course first

Josh requested the quiz be shut down and removed from the main site on 2026-10-28. Build the course before revisiting the quiz as a lead-management funnel. Do not restart automatically.

## Paused surfaces

- Header/mobile navigation and homepage quiz CTA removed.
- Original pages preserved byte-for-byte under `src/pages/_quiz/`; Astro excludes underscore-prefixed directories from published routes.
- `/quiz` and `/quiz/*` temporarily redirect home through the disabled quiz function. Old email/signed-token query strings are not forwarded.
- `/api/quiz` and `/api/optin` return HTTP 410 before parsing, storing or forwarding data.
- `quiz-replay` has no schedule and returns HTTP 410; it cannot read, deliver or delete the retained outbox.
- These three n8n workflows are inactive/unpublished, with their definitions retained:
  - Span · Quiz Intake — `6pTJv7oWh278AgjD`
  - Span · Quiz Course Opt-in — `Ca3NnPWooz2t0Y5u`
  - Span · Quiz Errors — `TZvZ8mpCZcwqLewz`
- Existing CRM contacts, consent records, execution history, credentials and Netlify Blob stores are not deleted. The privacy notice remains available for historical submissions.

## Recovery

- Last active source: `77eb988b7505b6785837e2b2d273524ac40212c7`.
- Last active production deploy: `6ae17a00245663fba70e674e`.
- Private before/after workflow snapshots and verification: `.private/quiz-pause-2026-10-28/` (gitignored; directory 0700, snapshots 0600).
- Quiz configuration, browser engine, scoring, styles, gauge assets, n8n source exports and unit tests remain in the project. Interactive browser tests are parked at `tests/paused/quiz.spec.ts`.
- After explicit restart approval: review the course offer and consent copy, restore the pages/function wrappers/navigation and browser suite from the last active source, test both paths, then re-publish only the three owned workflows. **Inspect the retained outbox before re-enabling replay** so stale leads are not emailed automatically.
