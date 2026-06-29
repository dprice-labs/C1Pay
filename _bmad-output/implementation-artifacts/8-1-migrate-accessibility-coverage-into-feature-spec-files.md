---
baseline_commit: 3ce1993
---

# Story 8.1: Migrate Accessibility Coverage into Feature Spec Files

Status: backlog

## Story

As a developer reading the test suite,
I want every feature spec to own its axe, keyboard, and responsive coverage,
so that accessibility tests are co-located with the features they verify and the suite's organisation is self-explanatory.

## Context

The three dimension-based spec files (`accessibility.spec.ts`, `keyboard.spec.ts`, `responsive.spec.ts`) were created in Epic 6 as a post-hoc sweep. They remain after Story 6.5 with all coverage intact, but the structural problem persists: accessibility verification is a separate concern handled "elsewhere" — the wrong mental model. This story migrates every test into the feature spec that owns the routes and states under test, then deletes the three source files.

This is a pure reorganisation. No tests are removed. No new application code is changed.

## Acceptance Criteria

1. **Given** `accessibility.spec.ts`, `keyboard.spec.ts`, and `responsive.spec.ts`, **When** this story is complete, **Then** all three files are deleted — every test has been re-homed in a feature spec and the total test count is unchanged.

2. **Given** the migration mapping:
   - Login/register axe scans → `auth.spec.ts`
   - `/send` axe scans, keyboard send flow, and mobile overflow → `send-money.spec.ts`
   - All inbox tests (axe scan empty state, axe scan populated state, NSF alert explicit-reason, badge text / lifecycle-indicator assertions, keyboard pay / decline / cancel flows, focus-after-resolve, mobile inbox overflow) → `inbox.spec.ts`
   - `aria-live` structural assertion and two-client `REQUEST_RECEIVED` live-update test → `realtime.spec.ts`
   - `/history` axe scan → `history.spec.ts`
   - `/request` axe scan and keyboard request flow → `request.spec.ts`

   **Then** every migrated test lands in the spec that owns those routes and states.

3. **Given** `inbox.spec.ts` and `request.spec.ts` do not yet exist in `tests/e2e/`, **Then** they are created as part of this story following the established per-file conventions (see Dev Notes).

4. **Given** the full suite (`npm run test:e2e:docker`), **When** run with the three source files still present after all tests have been copied to their targets, **Then** the suite is green (no duplicate test failures, no missing coverage).

5. **Given** the three source files are deleted (Task 6), **When** `npm run test:e2e:docker` is run again, **Then** the suite is green and the total test count equals the pre-migration baseline recorded in Task 0.

## Tasks / Subtasks

- [ ] **Task 0: Baseline and inventory**
  - [ ] Run `npm run test:e2e:docker` and record the total passing test count as the migration baseline.
  - [ ] Read `accessibility.spec.ts`, `keyboard.spec.ts`, and `responsive.spec.ts` in full. For each test, note its name, which routes/states it covers, and which feature spec it belongs to per AC#2.

- [ ] **Task 1: Migrate to `auth.spec.ts`**
  - [ ] Copy the `auditPage` / `formatViolations` / `WCAG_TAGS` helpers into `auth.spec.ts` (they are not in the file yet; copy verbatim — no shared module).
  - [ ] Move: login page axe scan.
  - [ ] Move: register page axe scan.
  - [ ] Verify `auth.spec.ts` is self-contained: its own `register`/`login`/`uniqueSuffix()` helpers are already present; no new shared imports needed.
  - [ ] Run `npm run test:e2e:docker -- auth.spec.ts` (or equivalent filter) to confirm these tests pass in isolation.

- [ ] **Task 2: Migrate to `send-money.spec.ts`**
  - [ ] Copy `auditPage` / `formatViolations` / `WCAG_TAGS` helpers into `send-money.spec.ts`.
  - [ ] Move: `/send` axe scan from `accessibility.spec.ts`.
  - [ ] Move: keyboard send flow from `keyboard.spec.ts` (full flow from home → search → amount → confirm via keyboard only, no pointer events).
  - [ ] Move: `/send` mobile overflow test from `responsive.spec.ts` (the `expectNoHorizontalScroll` check at 375×667).

- [ ] **Task 3: Create `inbox.spec.ts` and migrate all inbox coverage**
  - [ ] Create `tests/e2e/inbox.spec.ts` with its own `register`/`login`/`uniqueSuffix()` helpers and `PASSWORD = 'password123'`.
  - [ ] Copy `auditPage` / `formatViolations` / `WCAG_TAGS` and `expectNoHorizontalScroll` helpers.
  - [ ] Move: axe scan of `/inbox` (empty state) from `accessibility.spec.ts`.
  - [ ] Move: axe scan of `/inbox` (populated — at least one incoming `PENDING` request + one outgoing `PENDING` request) from `accessibility.spec.ts`.
  - [ ] Move: NSF insufficient-balance explicit-reason assertion from `accessibility.spec.ts`.
  - [ ] Move: status badge text (`PENDING`/`PAID`/`DECLINED`/`CANCELLED`) and lifecycle-indicator assertions from `accessibility.spec.ts`.
  - [ ] Move: keyboard pay, decline, and cancel flows + focus-after-resolve assertions from `keyboard.spec.ts`.
  - [ ] Move: mobile inbox overflow test (incoming + outgoing rows with long username) from `responsive.spec.ts`.

- [ ] **Task 4: Migrate to `realtime.spec.ts`**
  - [ ] Move: `aria-live` structural assertions (balance region `aria-live="polite"`, pending-count announcer) from `accessibility.spec.ts` into `realtime.spec.ts` — these belong next to the SSE tests that prove the live updates fire.
  - [ ] Move: two-client `REQUEST_RECEIVED` `aria-live` live-update test from `accessibility.spec.ts` into `realtime.spec.ts`.

- [ ] **Task 5: Migrate to `history.spec.ts`**
  - [ ] Copy `auditPage` / `formatViolations` / `WCAG_TAGS` into `history.spec.ts`.
  - [ ] Move: `/history` axe scan from `accessibility.spec.ts`.

- [ ] **Task 6: Create `request.spec.ts` and migrate request coverage**
  - [ ] Create `tests/e2e/request.spec.ts` with its own helpers and `PASSWORD = 'password123'`.
  - [ ] Copy `auditPage` / `formatViolations` / `WCAG_TAGS`.
  - [ ] Move: `/request` axe scan from `accessibility.spec.ts`.
  - [ ] Move: keyboard request flow from `keyboard.spec.ts`.

- [ ] **Task 7: Verify with source files still present**
  - [ ] Run `npm run test:e2e:docker` with all six original + new/extended target specs present (before deleting the three sources).
  - [ ] Confirm the suite is green. The test count will be higher than baseline because tests exist in both source and target — that is expected at this stage.

- [ ] **Task 8: Delete source files and verify final count**
  - [ ] Delete `tests/e2e/accessibility.spec.ts`.
  - [ ] Delete `tests/e2e/keyboard.spec.ts`.
  - [ ] Delete `tests/e2e/responsive.spec.ts`.
  - [ ] Run `npm run test:e2e:docker`. Confirm the suite is green and the total test count matches the Task 0 baseline exactly.

## Dev Notes

### Conventions to carry forward verbatim

Every test convention established across Epic 6 must be preserved in the migrated tests. Do not introduce new patterns.

**Axe helper block** (copy into each file that runs axe scans):
```typescript
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

function formatViolations(violations, route) { /* copy verbatim */ }

async function auditPage(page, route, ready) {
  await expect(ready).toBeVisible()
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  expect(results.violations, formatViolations(results.violations, route)).toEqual([])
}
```

**Self-contained helpers** — every file carries its own:
```typescript
const PASSWORD = 'password123'
function uniqueSuffix() { return `${Date.now()}_${Math.floor(Math.random() * 1e6)}` }
async function register(page, username) { /* ... */ }
async function login(page, username) { /* ... */ }
```

No `tests/e2e/utils.ts` shared module — this was explicitly ruled out in Story 6.4. Copy the helper block into each file.

**Two-client SSE pattern** (`realtime.spec.ts` already uses this; the migrated test must preserve it):
- Set up `page.waitForResponse(r => new URL(r.url()).pathname === '/api/sse')` **before** the login navigation that opens the stream. The in-memory emitter has no replay — an event emitted before the client registers is dropped and flakes the test.

**Responsive overflow check** (`expectNoHorizontalScroll`):
```typescript
async function expectNoHorizontalScroll(page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
}
```
Contract viewports: mobile 375×667, tablet 768×1024, desktop 1280×800 (`test.use({ viewport })` inside the spec — no new Playwright project).

**Keyboard flow idiom**: no pointer events. Search/select: type the full suffixed username, then `getByRole('option').filter({ hasText: target }).click()` — the option is a bare `<li>`, no nested button.

**Axe scan ready-locator**: always gate the scan on a `ready` locator unique to the target state (not just the route) so an auth-redirect or error-boundary can't produce a false green.

### Naming note

The existing send spec is `send-money.spec.ts` — not `send.spec.ts`. Migrate into the existing file; do not rename it.

### Files that do NOT yet exist

`inbox.spec.ts` and `request.spec.ts` must be created. Check `tests/e2e/` before starting to confirm.

### Home page overflow

`responsive.spec.ts` may include an overflow check for `/` (home). If so, it belongs in `send-money.spec.ts` (home is the entry point to the send flow) or can stay in a home-specific block within any appropriate file. Check the actual test during Task 0 and document the decision.

## Testing Requirements

No new tests — this is a reorganisation. The gate is `npm run test:e2e:docker` green with equal test count before (Task 0) and after (Task 8) the deletion of the three source files.

## References

- Source files: `tests/e2e/accessibility.spec.ts`, `tests/e2e/keyboard.spec.ts`, `tests/e2e/responsive.spec.ts`
- Convention source: `_bmad-output/implementation-artifacts/6-5-post-epic-4-accessibility-responsive-verification-sweep.md` Dev Notes (§ "The exact test conventions to reuse")
- Epic 8 goal: `_bmad-output/planning-artifacts/epics.md` § Epic 8
