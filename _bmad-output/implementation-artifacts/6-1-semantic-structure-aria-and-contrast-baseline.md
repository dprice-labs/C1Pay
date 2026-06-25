---
baseline_commit: d86a9f17a106e9fc690b431c9298a1a3abb05c15
---

# Story 6.1: Semantic Structure, ARIA & Contrast Baseline

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user relying on assistive technology,
I want the application built on semantic HTML with correct ARIA and accessible colour,
so that the structure and meaning of every screen are conveyed regardless of how I perceive it.

## Acceptance Criteria

1. **Given** any page, **When** rendered, **Then** it uses semantic HTML landmarks (`header`, `nav`, `main`, appropriate headings in order) rather than generic `div`/`span` for structural elements (FR31)
2. **Given** interactive and dynamic elements (forms, buttons, the inbox badge, status badges, live balance), **Then** they carry appropriate ARIA roles and labels — including an `aria-live` region for the SSE-driven balance and inbox updates so changes are announced (FR31)
3. **Given** any non-text content (icons, direction indicators, status colour), **Then** it has an appropriate text alternative; meaning is never conveyed by colour alone (NFR15)
4. **Given** the colour palette, **When** any text or UI component is rendered, **Then** contrast meets WCAG AA minimums — 4.5:1 for normal text, 3:1 for large text and UI components (NFR16)
5. **Given** a reusable visible-focus indicator style, **Then** it is defined once and applied consistently to all focusable elements (no `outline: none` without a replacement) (NFR14)
6. **Given** the request status badges from Epic 4, **Then** they convey state with a text label plus colour — confirming the "never colour alone" rule holds across the request state machine (UX-DR3 cross-check)

## Tasks / Subtasks

- [x] Task 1: Fix missing page-level `<h1>` heading on login and register pages (AC: #1)
  - [x] `src/app/(auth)/login/page.tsx`: `CardTitle` renders as a `<div>` — replace it with an `<h1>` carrying the same `font-heading text-base font-medium leading-snug` styling so screen reader users can jump to the page title
  - [x] `src/app/(auth)/register/page.tsx`: Same fix — replace `<CardTitle>Create account</CardTitle>` with an `<h1>` heading

- [x] Task 2: Add `<nav>` landmark to the protected layout header (AC: #1)
  - [x] `src/app/(protected)/layout.tsx`: Add a `<nav aria-label="Main">` element inside the `<header>` containing links to the main app sections (`/`, `/inbox`, `/history`)
  - [x] Keep the "C1Pay" branding `<span>` and `<LogoutButton>` in place; the nav sits between them
  - [x] Style nav links consistently: `text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm` — matching the existing History link pattern on the home page

- [x] Task 3: Complete combobox ARIA pattern on `UserSearchInput` (AC: #2) — deferred from Story 6.4 review
  - [x] `src/app/(protected)/send/UserSearchInput.tsx`: Add `role="combobox"` to the `<Input>` element
  - [x] Add `aria-haspopup="listbox"` to the Input
  - [x] Derive `isExpanded = trimmedQuery.length > 0 && results.length > 0` (reuse the existing `trimmedQuery` const at line 96)
  - [x] Add `aria-expanded={isExpanded}` to the Input — `true` when the listbox is showing results, `false` otherwise
  - [x] Preserve all existing attributes: `aria-autocomplete="list"`, `aria-controls`, `aria-activedescendant`

- [x] Task 4: Add `aria-live` announcement region for pending inbox count updates (AC: #2)
  - [x] `src/app/(protected)/page.tsx`: Add a visually-hidden `aria-live="polite" aria-atomic="true"` `<span>` that mirrors the pending count text — announces SSE-driven inbox changes to screen readers
  - [x] Add `aria-hidden="true"` to the visible `<Badge>` so screen readers hear the sr-only live region instead of double-announcing
  - [x] Live region text: `{pendingCount > 0 ? \`${pendingCount} pending request${pendingCount !== 1 ? 's' : ''}\` : ''}`

- [x] Task 5: Add `/inbox` to the axe-core audit suite (AC: #1, #2)
  - [x] `tests/e2e/accessibility.spec.ts`: Add `/inbox` audit inside the existing authenticated test block, after the home page audit
  - [x] Navigate to `/inbox` and assert the `<h1>Inbox</h1>` heading is visible before calling `auditPage(page, '/inbox')` — use `page.getByRole('heading', { name: 'Inbox' })` as the ready locator
  - [x] Run `npm run test:e2e -- tests/e2e/accessibility.spec.ts` and verify `/inbox` passes with zero violations

- [x] Task 6: Contrast token audit and sign-off (AC: #4, #5)
  - [x] Read the key CSS custom property pairs in `src/app/globals.css` (lines 50–72 light mode, lines 75–98 dark mode)
  - [x] Verify muted-foreground / background (oklch(0.556) on oklch(1.0)) meets 4.5:1 for normal text — computed 4.73:1 ✓
  - [x] Verify `--ring` (oklch(0.708)) focus indicator achieves 3:1 against adjacent background colours — computed 2.59:1 ✗ FAIL → darkened to oklch(0.66) → 3.11:1 ✓
  - [x] Verify `--destructive` on `--background` achieves 4.5:1 for error text — computed 4.76:1 ✓
  - [x] Updated `--ring` and `--sidebar-ring` in `:root` from oklch(0.708) to oklch(0.66); dark mode `--ring` (oklch(0.556)) already passes at 3.60:1 and is unchanged
  - [x] Run `npm run test:e2e -- tests/e2e/accessibility.spec.ts` after token change: all 12 tests pass ✓

- [x] Task 7: Final full-suite verification (AC: #1–6)
  - [x] Run `npm run test:e2e:docker` — 12/12 tests passed, zero violations on all routes including /inbox
  - [x] No regressions in auth, send-money, history, sse, or realtime specs

### Review Findings

- [x] [Review][Patch] aria-current missing on active nav links — extracted `NavLinks` client component with `usePathname()`; `aria-current="page"` on active link; `aria-label="Site navigation"` [`src/app/(protected)/NavLinks.tsx`]
- [x] [Review][Patch] No skip-navigation link — added `<a href="#main-content">` skip link + `id="main-content"` on `<main>` [`src/app/(protected)/layout.tsx`]
- [x] [Review][Patch] `aria-live` region was inside `<Link href="/inbox">` — moved outside the Link [`src/app/(protected)/page.tsx`]
- [x] [Review][Patch] Count→0 emits empty string — now emits `'No pending requests'` on zero [`src/app/(protected)/page.tsx`]
- [x] [Review][Patch] Nav link `rounded-sm` class order — `NavLinks` component uses correct order (last) [`src/app/(protected)/NavLinks.tsx`]
- [x] [Review][Defer→Fixed] h1 gets `data-slot="card-title"` to preserve slot identifier [`src/app/(auth)/login/page.tsx:9`, `register/page.tsx:9`]
- [x] [Review][Defer→Fixed] C1Pay brand converted to `<Link href="/">` [`src/app/(protected)/layout.tsx`]
- [x] [Review][Defer→Fixed] `<button>` inside `<li role="option">` removed; `onClick` moved to `<li>` directly [`src/app/(protected)/send/UserSearchInput.tsx`]
- [x] [Review][Defer→Fixed] `tabIndex={0}` on option button removed (button gone) [`src/app/(protected)/send/UserSearchInput.tsx`]
- [x] [Review][Defer→Fixed] Escape key handled — collapses listbox, clears `activeIndex`, preserves query [`src/app/(protected)/send/UserSearchInput.tsx`]
- [x] [Review][Defer→Fixed] `aria-label="Main"` renamed to `aria-label="Site navigation"` to avoid landmark ambiguity [`src/app/(protected)/NavLinks.tsx`]

## Dev Notes

### What's already in place — DO NOT re-implement

| Area | File | State |
|---|---|---|
| `<html lang="en">` | `src/app/layout.tsx:26` | EXISTS — `html-has-lang` satisfied globally |
| `<header>` (banner) + `<main>` in protected layout | `src/app/(protected)/layout.tsx:14,18` | EXISTS |
| `<main>` on login/register pages | `src/app/(auth)/login/page.tsx:6`, `register/page.tsx:6` | EXISTS |
| `LiveBalance` aria-live | `src/app/(protected)/LiveBalance.tsx:32–33` | EXISTS — `aria-live="polite" aria-atomic="true"` on balance span |
| All icons aria-hidden | All pages | EXISTS |
| Inbox badge aria-label | `src/app/(protected)/page.tsx:67` | EXISTS — `aria-label="${pendingCount} pending incoming requests"` |
| Button/Input focus ring | `src/components/ui/button.tsx`, `input.tsx` | EXISTS — `focus-visible:ring-3 focus-visible:ring-ring/50` |
| Form label associations (htmlFor/id) | All auth + send/request forms | EXISTS |
| Error announcements (`role="alert"`, `aria-live="assertive"`) | Login/Register forms | EXISTS |
| `aria-describedby` on invalid inputs | Send, Request, Login, Register | EXISTS |
| Step indicator `aria-live="polite"` | Send/Request pages | EXISTS — `<p aria-live="polite">Step {step} of 3</p>` |
| Combobox keyboard navigation (ArrowDown/Up/Enter) | `UserSearchInput.tsx:80–93` | EXISTS |
| Listbox always rendered (aria-controls not dangling) | `UserSearchInput.tsx:137–155` | FIXED in 6.4 — `className={results.length > 0 ? 'flex...' : 'hidden'}` |
| TransactionRow text label for direction | `TransactionRow.tsx:11–12` | EXISTS — "Sent"/"Received" text, icon aria-hidden |
| RequestCard PENDING badge + lifecycle indicator | `RequestCard.tsx:33–47` | EXISTS — text label plus `aria-label` on lifecycle div |

### Task 1 — heading fix: why `CardTitle` is the problem

`CardTitle` in this project renders as a `<div>` (see `src/components/ui/card.tsx:36–46`):
```tsx
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-title" className={cn("font-heading text-base font-medium leading-snug", className)} {...props} />
}
```

A `<div>` has no implicit ARIA role — screen reader users cannot jump to the page title via the heading shortcut. The axe audit doesn't catch this (axe only verifies heading order when headings exist, not that a page has any heading at all).

**Fix — change only the two auth use sites, not the CardTitle component itself:**

```tsx
// src/app/(auth)/login/page.tsx
<CardHeader>
  <h1 className="font-heading text-base font-medium leading-snug">Sign in</h1>
</CardHeader>
```

```tsx
// src/app/(auth)/register/page.tsx
<CardHeader>
  <h1 className="font-heading text-base font-medium leading-snug">Create account</h1>
</CardHeader>
```

Remove the `<CardTitle>` import from both files if it's no longer used after this change.

### Task 2 — nav landmark: target layout structure

Current `src/app/(protected)/layout.tsx`:
```tsx
<header className="flex items-center justify-between gap-4 border-b p-4">
  <span className="font-semibold">C1Pay</span>
  <LogoutButton />
</header>
<main className="flex flex-1 flex-col gap-4 p-4">{children}</main>
```

Target — add `<nav>` between branding and logout:
```tsx
import Link from 'next/link'  // add this import

<header className="flex items-center justify-between gap-4 border-b p-4">
  <span className="font-semibold">C1Pay</span>
  <nav aria-label="Main">
    <ul className="flex items-center gap-4 text-sm">
      <li>
        <Link href="/" className="text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm">
          Home
        </Link>
      </li>
      <li>
        <Link href="/inbox" className="text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm">
          Inbox
        </Link>
      </li>
      <li>
        <Link href="/history" className="text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm">
          History
        </Link>
      </li>
    </ul>
  </nav>
  <LogoutButton />
</header>
```

Send and Request are action flows launched from the home page, not persistent navigation destinations — do NOT add them to this nav.

### Task 3 — combobox ARIA: attributes to add

Current `<Input>` in `UserSearchInput.tsx` (lines 109–121) has: `aria-label`, `aria-autocomplete="list"`, `aria-controls`, `aria-activedescendant`.

Missing per ARIA 1.2 combobox pattern:
```tsx
// Derive before the return:
const isExpanded = trimmedQuery.length > 0 && results.length > 0  // trimmedQuery already exists at line 96

// Add to the <Input> element:
role="combobox"
aria-haspopup="listbox"
aria-expanded={isExpanded}
```

`Input` renders as a plain `<input>` with `{...props}` pass-through — no component changes needed. The `role` / `aria-haspopup` / `aria-expanded` props are valid HTML attributes for `<input>` in combobox usage.

### Task 4 — inbox aria-live: implementation pattern

Mirror the `LiveBalance` pattern (`src/app/(protected)/LiveBalance.tsx:31–44`) for the pending count. In `src/app/(protected)/page.tsx`, the inbox badge section (lines 66–70) currently:

```tsx
{pendingCount > 0 ? (
  <Badge aria-label={`${pendingCount} pending incoming requests`}>
    {pendingCount}
  </Badge>
) : null}
```

Replace with:
```tsx
<>
  {/* sr-only live region announces count changes to screen readers */}
  <span aria-live="polite" aria-atomic="true" className="sr-only">
    {pendingCount > 0 ? `${pendingCount} pending request${pendingCount !== 1 ? 's' : ''}` : ''}
  </span>
  {pendingCount > 0 ? (
    <Badge aria-label={`${pendingCount} pending incoming requests`} aria-hidden="true">
      {pendingCount}
    </Badge>
  ) : null}
</>
```

`aria-hidden="true"` on the visible `<Badge>` prevents double-reading (the sr-only live region handles announcements; the badge's `aria-label` is for sighted-only assistive display). The sr-only live region is always rendered (even when count is 0) so it doesn't flash in/out of the DOM — an empty string is the resting state.

### Task 5 — /inbox audit: insertion point

In `tests/e2e/accessibility.spec.ts`, inside the `test('authenticated pages have zero violations', ...)` block, after the existing `/` audit and before the `/send` audit:

```ts
await auditPage(page, '/')

// Add after home audit:
await page.goto('/inbox')
await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible()
await auditPage(page, '/inbox')

await page.goto('/send')
```

The ready locator (`heading 'Inbox'`) ensures the Server Component has rendered before scanning — prevents false-green audits against an error boundary (pattern established in 6.4 review findings).

### Contrast token reference

Key light-mode pairs from `src/app/globals.css:50–72`:

| Token pair | Values | Expected contrast | Threshold |
|---|---|---|---|
| `--foreground` / `--background` | oklch(0.145) / oklch(1.0) | >10:1 | 4.5:1 normal ✓ |
| `--muted-foreground` / `--background` | oklch(0.556) / oklch(1.0) | ~4.7:1 | 4.5:1 normal ✓ (verify — marginal) |
| `--primary-foreground` / `--primary` | oklch(0.985) / oklch(0.205) | >7:1 | 4.5:1 ✓ |
| `--secondary-foreground` / `--secondary` | oklch(0.205) / oklch(0.97) | >4.5:1 | 4.5:1 ✓ |
| `--destructive` / `--background` | oklch(0.577 0.245 27.3°) / oklch(1.0) | axe verified ✓ | 4.5:1 normal |
| `--ring` / `--background` | oklch(0.708) / oklch(1.0) | verify | 3:1 UI component |

Story 6.4's axe audit passed zero violations for text contrast on all six routes — use Task 6 to formally verify the ring and muted-foreground pairs (UI components and the marginal case), not to re-check what axe already cleared.

### Source files to create/modify

| File | Action | Purpose |
|---|---|---|
| `src/app/(auth)/login/page.tsx` | Modify | Replace `<CardTitle>` with `<h1>` |
| `src/app/(auth)/register/page.tsx` | Modify | Replace `<CardTitle>` with `<h1>` |
| `src/app/(protected)/layout.tsx` | Modify | Add `<nav aria-label="Main">` with Home/Inbox/History links |
| `src/app/(protected)/send/UserSearchInput.tsx` | Modify | Add `role="combobox"`, `aria-haspopup="listbox"`, `aria-expanded` |
| `src/app/(protected)/page.tsx` | Modify | Add sr-only `aria-live` span for inbox count; `aria-hidden` on visible badge |
| `tests/e2e/accessibility.spec.ts` | Modify | Add `/inbox` to authenticated route audit |
| `src/app/globals.css` | Modify only if Task 6 finds a failing pair | Fix any non-compliant token value |

### Testing requirements

- **No unit or integration tests** — all changes are structural HTML/ARIA; the axe-core e2e gate (Story 6.4) is the verification layer
- **Incremental verification**: Run `npm run test:e2e -- tests/e2e/accessibility.spec.ts` after each Task group (Tasks 1–2, then 3–4, then 5–6) to catch issues early
- **Final gate**: `npm run test:e2e` — full suite must pass with zero regressions
- **Violation output format** (from 6.4 `formatViolations`): `[/route] rule-id (impact): help text\n  Elements: css-selector` — fix the component, not the test

### Cross-story context

- **Story 6.2** (Keyboard Navigation): Builds directly on the combobox ARIA from Task 3 — `role="combobox"` + `aria-expanded` provide the correct structure for keyboard-operable tests. Complete Task 3 cleanly so 6.2 doesn't need to revisit it.
- **Stories 4.3/4.4/4.5** (Pay/Decline/Cancel): When these ship, add their routes to `accessibility.spec.ts` — flag to whoever picks up 4.3.
- **Story 6.4** deferred items addressed here:
  - "Combobox ARIA incomplete" → Task 3 [Source: 6-4 Review Findings]
  - "Gate audits only the initial/empty DOM — populated listbox never exercised" → partially addressed; 6.2 adds keyboard flow tests that exercise the populated state
  - "/inbox not yet in audit scope" → Task 5

### References

- Epics: Story 6.1 ACs [Source: `_bmad-output/planning-artifacts/epics.md:737–757`]
- Epics: NFR13–NFR16, FR31 [Source: `_bmad-output/planning-artifacts/epics.md:78–81, 163`]
- Story 6.4 deferred review findings (combobox ARIA, /inbox audit) [Source: `_bmad-output/implementation-artifacts/6-4-automated-wcag-aa-audit-gate.md:59–63`]
- CardTitle renders as `<div>` (no heading semantics) [Source: `src/components/ui/card.tsx:36–46`]
- LiveBalance aria-live pattern to mirror [Source: `src/app/(protected)/LiveBalance.tsx:31–44`]
- Existing focus-visible outline pattern for nav links [Source: `src/app/(protected)/page.tsx:52, 74`]
- ARIA 1.2 combobox pattern (role, aria-expanded, aria-haspopup) [https://www.w3.org/WAI/ARIA/apg/patterns/combobox/]
- Colour tokens [Source: `src/app/globals.css:50–98`]
- Protected layout current structure [Source: `src/app/(protected)/layout.tsx`]
- axe audit /inbox ready-locator pattern [Source: `_bmad-output/implementation-artifacts/6-4-automated-wcag-aa-audit-gate.md:58`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (bmad-dev-story workflow)

### Debug Log References

- `npm run test:e2e:docker:clean` required before first run — the cached `e2e_node_modules` volume predated `@axe-core/playwright` (added in story 6.4) and caused `Cannot find module '@axe-core/playwright'` inside the container.
- Contrast audit computed via Node script: `--ring` (oklch(0.708)) → 2.59:1 vs white — fails WCAG AA 3:1 UI component threshold. Fixed to oklch(0.66) → 3.11:1. All other token pairs pass. Dark mode ring is a separate declaration (oklch(0.556) → 3.60:1) and was not changed.

### Completion Notes List

- **AC #1 (semantic landmarks + headings):** `<h1>` added to `/login` and `/register` (previously `CardTitle` rendered as `<div>`). `<nav aria-label="Main">` with Home/Inbox/History links added to the protected layout `<header>`, giving the app a proper `banner + nav + main` landmark structure.
- **AC #2 (ARIA roles + `aria-live`):** Combobox ARIA completed on `UserSearchInput` (`role="combobox"`, `aria-haspopup="listbox"`, `aria-expanded`). SSE-driven inbox count now announced via a sr-only `aria-live="polite" aria-atomic="true"` span (mirrors the `LiveBalance` pattern).
- **AC #3 (no colour alone):** Confirmed pre-existing — all icons `aria-hidden`, text labels on direction (TransactionRow) and status badges (RequestCard).
- **AC #4 (contrast):** Audited all key token pairs. One failure: `--ring` oklch(0.708) → 2.59:1 (below 3:1 for UI components). Fixed to oklch(0.66) → 3.11:1. All other pairs pass.
- **AC #5 (focus indicator):** Focus ring now meets 3:1 after the `--ring` fix. Consistent `focus-visible` styles across Button, Input, and nav links.
- **AC #6 (status badges):** Confirmed pre-existing — `RequestCard` shows `PENDING` as a text badge, never colour alone.
- `/inbox` added to `accessibility.spec.ts` — previously omitted despite the route existing since story 4.2.
- **Full suite: 12/12 passed via `npm run test:e2e:docker`.**

### File List

- `src/app/(auth)/login/page.tsx` — replaced `<CardTitle>` with `<h1>` (removed `CardTitle` import)
- `src/app/(auth)/register/page.tsx` — replaced `<CardTitle>` with `<h1>` (removed `CardTitle` import)
- `src/app/(protected)/layout.tsx` — added `<nav aria-label="Main">` with Home/Inbox/History links; added `Link` import
- `src/app/(protected)/send/UserSearchInput.tsx` — added `role="combobox"`, `aria-haspopup="listbox"`, `aria-expanded` + `isExpanded` derived value
- `src/app/(protected)/page.tsx` — added sr-only `aria-live` span for inbox count; `aria-hidden="true"` on visible Badge
- `tests/e2e/accessibility.spec.ts` — added `/inbox` audit to authenticated test block
- `src/app/globals.css` — changed `--ring` and `--sidebar-ring` from oklch(0.708) to oklch(0.66) in `:root`

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-06-24 | 1.0 | Semantic HTML headings on auth pages, nav landmark in protected layout, combobox ARIA completion, inbox aria-live, /inbox added to axe audit, ring contrast fix (oklch 0.708→0.66). Story → review. | claude-sonnet-4-6 (dev-story) |
