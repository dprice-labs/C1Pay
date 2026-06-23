---
baseline_commit: c0c01ba
---

# Story 6.4: Automated WCAG AA Audit Gate

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer maintaining the codebase,
I want automated accessibility checks on every page,
so that WCAG AA compliance is continuously verified and regressions are caught.

## Acceptance Criteria

1. **Given** the Playwright e2e suite, **Then** axe-core is integrated (via `@axe-core/playwright`) and run against every page/route of the application — `/login`, `/register`, `/` (home), `/send`, `/request`, `/history` (FR31)
2. **Given** the axe-core audit, **When** run on any page, **Then** it reports zero automated WCAG 2.1 AA violations — scanned against the `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` rule tags (NFR13, FR31)
3. **Given** the accessibility audit, **Then** it executes as part of the existing e2e quality gate (`npm run test:e2e`) so a new violation fails the test run — no separate command or CI wiring required, since the suite already runs as one gate
4. **Given** an audit failure, **When** reported, **Then** the test failure output identifies the offending rule ID, the impact level, the specific element(s), and the page route — not just a generic "violations found"

## Tasks / Subtasks

- [x] Task 1: Add the axe integration dependency (AC: #1)
  - [x] Add `@axe-core/playwright` `^4.11.3` to `devDependencies` in `package.json` (confirmed latest on npm at story creation time; it bundles `axe-core` itself — do not add `axe-core` separately)
  - [x] Run `npm install` and confirm `package-lock.json` updates cleanly with no peer-dependency conflicts against `@playwright/test@^1.60.0`

- [x] Task 2: Build the reusable audit helper (AC: #2, #4)
  - [x] Create `tests/e2e/accessibility.spec.ts`
  - [x] Import `AxeBuilder` from `@axe-core/playwright` (default export)
  - [x] Write an `auditPage(page, route)` helper that runs `new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()` and asserts `results.violations` is empty
  - [x] Format failure output so each violation reports `id`, `impact`, `help`/`helpUrl`, and the CSS target of every affected node, prefixed with the route under test (see Dev Notes for exact snippet) — pass this formatted string as the `expect(...).toEqual([])` failure message so AC #4 holds even though Playwright's default array-diff would otherwise just dump raw violation objects

- [x] Task 3: Audit unauthenticated routes (AC: #1, #2)
  - [x] `test('login page has zero violations')`: `page.goto('/login')`, then `auditPage(page, '/login')`
  - [x] `test('register page has zero violations')`: `page.goto('/register')`, then `auditPage(page, '/register')`

- [x] Task 4: Audit authenticated routes (AC: #1, #2)
  - [x] Copy the `register`/`login` helper functions verbatim from `tests/e2e/history.spec.ts` (do not import across spec files — every existing e2e spec duplicates this helper locally; follow that convention, don't introduce a shared `tests/e2e/utils.ts` for this story)
  - [x] Register + log in a fresh `e2e_a11y_<unique-suffix>` user (use the same `Date.now()_random` suffix pattern as `history.spec.ts` — a `Date.now()`-only suffix collides under `fullyParallel`)
  - [x] Audit `/` (home, post-login landing page) via `auditPage`
  - [x] Navigate to `/send` and audit it (step 1 of the send funnel only — do not drive into steps 2/3, which are component states, not routes, and are out of scope per AC #1's "page/route" wording)
  - [x] Navigate to `/request` and audit it (step 1 only, same reasoning)
  - [x] Navigate to `/history` and audit it

- [x] Task 5: Run the gate for real and fix any surfaced violations (AC: #2, #3)
  - [x] Run `npm run test:e2e` locally end-to-end (it already starts `npm run dev` via the existing `webServer` config in `playwright.config.ts` — no config changes needed)
  - [x] If any route reports violations, fix the underlying page/component (not the test) — see Dev Notes for what's already in place vs. likely gaps
  - [x] Re-run until all accessibility tests pass with zero violations on every route
  - [x] Run the full existing e2e suite (not just the new file) to confirm no regression from any fix made in this story

## Dev Notes

### Why this story can be done before Story 6.1 — and what that means for scope

Per `team-parallelization-plan.md` / `wave-1-assignments.md`, this story (6.4) is being built before 6.1 (Semantic Structure, ARIA & Contrast Baseline) by design — it stands up the gate first. **That means AC #2's "zero violations" is not guaranteed yet by other work; fixing whatever the gate finds is part of finishing this story, not a follow-up.** Do not land this story with the new test file present but failing, and do not weaken the assertion to "pass with known violations" — either fix the page/component or the audit isn't done. Keep fixes minimal and targeted to what axe actually flags; do not attempt to preemptively implement all of Story 6.1's broader scope (landmark audit, full ARIA pass, contrast token review) here — that story still needs to run for anything axe's ruleset doesn't catch (e.g., logical reading order, non-DOM colour-only meaning).

### What's already in place — do not re-implement

| Area | State | Relevant to this story |
|---|---|---|
| `src/app/layout.tsx` | EXISTS | `<html lang="en">` already set — satisfies the `html-has-lang` axe rule globally |
| `src/app/(protected)/layout.tsx` | EXISTS | Already has `<header>` and `<main>` landmarks wrapping all protected pages |
| `src/components/ui/button.tsx`, `input.tsx` | EXIST | Both already define a consistent `focus-visible:ring-3 focus-visible:ring-ring/50` focus style — the "one defined focus indicator" requirement from Story 6.1's scope is largely already satisfied by these shared primitives, which is good news for this story's pass rate |
| `src/app/(protected)/send/UserSearchInput.tsx:140` | EXISTS | Uses `focus-visible:outline-none` paired with `focus-visible:ring-2` — this is the standard Tailwind "replace the default outline with a custom ring" pattern, not a bare `outline: none`; axe doesn't flag this, leave as-is |
| `@playwright/test` `^1.60.0` | EXISTS | Already a devDependency; `@axe-core/playwright` `^4.11.3` works against this version with no known peer conflicts (verified via `npm view` at story creation time) |
| `playwright.config.ts` | EXISTS — no change | `testDir: './tests/e2e'` already picks up any new spec file automatically; `webServer` already boots `npm run dev` — nothing to wire up |

### Likely gaps the audit may surface (not guaranteed — verify by running, don't assume)

- The home page's pending-request inbox row (`src/app/(protected)/page.tsx`) renders an icon-only status with `aria-hidden="true"` on the icon — check that any accompanying text fully conveys state, since this is exactly the kind of icon-without-text-alternative pattern axe's `aria-*`/colour-contrast rules will catch.
- Form fields built directly with `<Input>`/`<Label>` (not `FieldGroup`/`Field`) on `/send`, `/request` may be missing explicit `htmlFor`/`id` pairing or error-message association (`aria-describedby`) — axe's `label` rule will catch unassociated labels.
- None of this is confirmed; Task 5 requires actually running the suite rather than guessing from static reading.

### `tests/e2e/accessibility.spec.ts` — Reference Implementation

```typescript
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const PASSWORD = 'password123'
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function register(page: Page, username: string) {
  await page.goto('/register')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Confirm password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL('/login')
}

async function login(page: Page, username: string) {
  await page.goto('/login')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/')
}

function uniqueSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 1e6)}`
}

function formatViolations(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'], route: string) {
  return violations
    .map((violation) => {
      const targets = violation.nodes.map((node) => node.target.join(' ')).join(', ')
      return `[${route}] ${violation.id} (${violation.impact}): ${violation.help}\n  ${violation.helpUrl}\n  Elements: ${targets}`
    })
    .join('\n\n')
}

async function auditPage(page: Page, route: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  expect(results.violations, formatViolations(results.violations, route)).toEqual([])
}

test('login page has zero violations', async ({ page }) => {
  await page.goto('/login')
  await auditPage(page, '/login')
})

test('register page has zero violations', async ({ page }) => {
  await page.goto('/register')
  await auditPage(page, '/register')
})

test('authenticated pages have zero violations', async ({ page }) => {
  const username = `e2e_a11y_${uniqueSuffix()}`
  await register(page, username)
  await login(page, username)

  await auditPage(page, '/')

  await page.goto('/send')
  await auditPage(page, '/send')

  await page.goto('/request')
  await auditPage(page, '/request')

  await page.goto('/history')
  await auditPage(page, '/history')
})
```

**Why one `test()` per route for unauthenticated pages but one combined `test()` for all authenticated routes:** registering + logging in a fresh user is the expensive setup step; the existing `history.spec.ts`/`send-money.spec.ts` pattern of doing all assertions for one user within a single test (rather than re-registering per page) is followed here to avoid the e2e suite slowing down with `N` redundant registrations for routes that don't otherwise depend on each other.

**Why `withTags` instead of the default ruleset:** axe-core's default run includes `best-practice` rules that are not part of WCAG 2.1 AA — using `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa` keeps the gate scoped exactly to what NFR13 requires (WCAG 2.1 AA), so the dev agent isn't blocked by stylistic best-practice warnings that aren't actually required by this NFR.

**Why the violations array is the `expect` message, not a separate `console.log`:** Playwright prints the second argument to `expect()` as the failure message directly in the test report — this is what makes AC #4 ("output identifies the offending rule, element, and page") true without needing a custom reporter or extra logging plumbing.

### Project Structure Notes

New files:
- `tests/e2e/accessibility.spec.ts`

Modified files:
- `package.json` — new `@axe-core/playwright` devDependency
- `package-lock.json`
- Possibly one or more files under `src/app/` or `src/components/` — only if Task 5's run surfaces real violations; cannot be predicted ahead of running the suite, so this story's File List is not fully knowable until Task 5 completes

No database, schema, route handler, or store changes are anticipated by this story.

### Testing Requirements

- This story's entire deliverable IS a test file — there's no separate "test the test" requirement beyond running it for real (Task 5) and confirming the rest of the e2e suite still passes (no regression from any incidental fix).
- Do not add a unit or integration test for `auditPage`/`formatViolations` — they're test-infrastructure helpers exercised directly every time the e2e suite runs; wrapping them in their own test would test Playwright/axe-core's own behavior, not application code.

### Cross-Story Context

- **Story 6.1** (Semantic Structure, ARIA & Contrast Baseline) is the next story in this epic per the wave plan and covers the broader manual accessibility pass (landmarks across all pages, `aria-live` for SSE updates, colour-alone checks on status badges, contrast token review). This story's job is narrower: stand up the automated gate and make it pass *today's* pages. Don't duplicate 6.1's planned manual audit work here, but do fix whatever axe's automated ruleset actually flags now (see "Why this story can be done before 6.1" above).
- **Stories 6.2/6.3** (keyboard navigation, responsive layout) are unaffected by this story — axe-core's automated rules do not cover keyboard operability or responsive layout correctness; those remain fully owned by 6.2/6.3's own e2e tests.
- This story does not depend on Epic 4's remaining stories (4.2–4.5, inbox/pending-request UI) — those routes don't exist yet, so they are correctly excluded from the route list above. When 4.2+ ship, their pages should be added to this spec's route list as a small follow-up (flag this to whoever picks up 4.2, since it won't automatically appear in this gate).

### References

- Epics: Story 6.4 ACs and Epic 6 goal [Source: `_bmad-output/planning-artifacts/epics.md#Story 6.4: Automated WCAG AA Audit Gate`]
- PRD: NFR13 (zero automated WCAG 2.1 AA violations), FR31 (WCAG AA — semantic HTML, ARIA, keyboard, contrast) [Source: `_bmad-output/planning-artifacts/prd.md`]
- Architecture: Playwright e2e test pyramid location (`tests/e2e/`) and config (`playwright.config.ts`) [Source: `_bmad-output/planning-artifacts/architecture.md#Project Structure`]
- Existing pattern: `register`/`login` per-spec helper convention and unique-suffix collision fix [Source: `tests/e2e/history.spec.ts`]
- Existing pattern: shared focus-ring style already defined on `Button`/`Input` primitives [Source: `src/components/ui/button.tsx`, `src/components/ui/input.tsx`]
- Existing pattern: root `<html lang="en">` and protected `<header>`/`<main>` landmarks already present [Source: `src/app/layout.tsx`, `src/app/(protected)/layout.tsx`]
- Team plan: this story's intentional sequencing ahead of 6.1 [Source: `_bmad-output/implementation-artifacts/wave-1-assignments.md`]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (dev-story workflow; implementation started on claude-sonnet-4-6, completed on claude-opus-4-8)

### Debug Log References

- `npm run test:e2e -- tests/e2e/accessibility.spec.ts` — first run surfaced a real violation: `aria-valid-attr-value (critical)` on `#user-search` (`/send`), because `aria-controls="user-search-listbox"` pointed at a `<ul>` that was only rendered when results existed (dangling reference when the list was empty).
- Second run surfaced two `serious` violations on `/history` (`document-title`, `html-has-lang`) — these were a Next.js error page (`#__next_error__`), not an accessibility regression: the `transactions` table did not exist in the local DB, throwing a 500. Resolved by running `npm run db:migrate` (a local environment setup gap, not a code/page defect). No application code changed for this.

### Completion Notes List

- **AC #1 (axe integration, all routes):** `@axe-core/playwright@^4.11.3` added; `tests/e2e/accessibility.spec.ts` audits `/login`, `/register`, `/` (home), `/send`, `/request`, `/history`.
- **AC #2 (zero WCAG 2.1 AA violations):** All routes pass with zero violations against the `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa` tag set.
- **AC #3 (runs as part of the existing e2e gate):** New spec lives under `tests/e2e/`, picked up automatically by `playwright.config.ts`; `npm run test:e2e` runs it as part of the single quality gate — no separate command or CI wiring added.
- **AC #4 (actionable failure output):** `formatViolations()` is passed as the `expect(...).toEqual([])` message, so a failure reports rule `id`, `impact`, `help`/`helpUrl`, affected CSS targets, and the route prefix. Verified live: the first real failure printed `[/send] aria-valid-attr-value (critical): ... Elements: #user-search`.
- **One real accessibility fix made (Task 5):** `src/app/(protected)/send/UserSearchInput.tsx` — the listbox `<ul id="user-search-listbox">` is now always rendered (hidden via class when empty) so the input's `aria-controls` always resolves to a real element. Scope kept minimal and targeted to exactly what axe flagged, per Dev Notes guidance; broader Story 6.1 work not pulled in.
- **No regressions:** Full e2e suite (12 tests) passes. Lint/type-check clean for both touched files (pre-existing lint errors elsewhere in `_bmad/`, `src/db`, `src/lib/sse-emitter.ts` are unrelated to this story and were left untouched).

### File List

- `package.json` — added `@axe-core/playwright@^4.11.3` devDependency
- `package-lock.json` — lockfile update for the new dependency
- `tests/e2e/accessibility.spec.ts` — new: axe-core WCAG 2.1 AA audit gate across all six routes
- `src/app/(protected)/send/UserSearchInput.tsx` — fixed dangling `aria-controls` reference by always rendering the listbox element

## Change Log

| Date       | Version | Description                                                                                                   | Author |
|------------|---------|---------------------------------------------------------------------------------------------------------------|--------|
| 2026-06-23 | 1.0     | Implemented automated WCAG AA audit gate (axe-core across 6 routes); fixed `aria-controls` dangling reference on `/send`. Story → review. | Amelia (Dev) |
