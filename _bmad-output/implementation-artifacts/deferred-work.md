# Deferred Work

## Deferred from: code review of story-1.1 (2026-06-01)

- `globals.css` `body` hard-codes `Arial` while `layout.tsx` loads the Geist font and exposes `--font-geist-sans`; Geist is downloaded but never applied at the body level. Resolve when building the real UI (Epic 2 — Home Screen UI).
- `src/app/page.tsx` is create-next-app boilerplate: default marketing content and external links using `target="_blank"` with no "opens in new window" affordance. Replace in Epic 2; accessibility pass in Epic 6.
- No helper to turn an `AppError` into an `errorResponse` — `AppError` ({message, code, status}) and `errorResponse` ({error, code}) are parallel, unconnected shapes that invite drift. Add a bridge (e.g. `errorResponse(err: AppError)`) when route handlers begin using both (Epic 3+).
- Test tooling fragility: `@playwright/test` is pinned to date-stamped alpha `^1.61.0-alpha-2026-06-01` (non-reproducible if the tag rotates); `playwright.config.ts` `webServer` relies on the default 60s timeout for `next dev` cold start. Harden during CI setup.
