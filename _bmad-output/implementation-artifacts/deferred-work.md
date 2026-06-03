# Deferred Work

## Deferred from: code review of story-1.1 (2026-06-01)

- `globals.css` `body` hard-codes `Arial` while `layout.tsx` loads the Geist font and exposes `--font-geist-sans`; Geist is downloaded but never applied at the body level. Resolve when building the real UI (Epic 2 — Home Screen UI).
- `src/app/page.tsx` is create-next-app boilerplate: default marketing content and external links using `target="_blank"` with no "opens in new window" affordance. Replace in Epic 2; accessibility pass in Epic 6.
- No helper to turn an `AppError` into an `errorResponse` — `AppError` ({message, code, status}) and `errorResponse` ({error, code}) are parallel, unconnected shapes that invite drift. Add a bridge (e.g. `errorResponse(err: AppError)`) when route handlers begin using both (Epic 3+).
- Test tooling fragility: `@playwright/test` is pinned to date-stamped alpha `^1.61.0-alpha-2026-06-01` (non-reproducible if the tag rotates); `playwright.config.ts` `webServer` relies on the default 60s timeout for `next dev` cold start. Harden during CI setup.

## Deferred from: code review of 1-2-database-foundation (2026-06-03)

- `balanceCents` is stored as 32-bit `integer` (max ~$21M); if high-value accounts are ever needed, a `bigint` migration would be required. Architectural decision — revisit at scale.
- `src/db/index.ts` imports only `./schema/users`; when a second schema file is added (Stories 3.1, 4.1), update to a barrel import or merged object.
- No `db:seed` or `db:reset` scripts; a developer needs to read Drizzle docs to reset the local schema. Add in a later story.
- `drizzle.config.ts` has no protection against `drizzle-kit push`; consider `strict: true` or a pre-push hook as a guard (defense-in-depth, not blocking).
- `drizzle-kit` is in `devDependencies`; `npm run db:migrate` will fail in environments where dev deps are pruned. If migration-on-start is needed in production, move `drizzle-kit` to `dependencies` or use a custom migration runner.
- `postgres()` constructor error on malformed `DATABASE_URL` propagates as an untyped module-load exception; acceptable for the current project context.
