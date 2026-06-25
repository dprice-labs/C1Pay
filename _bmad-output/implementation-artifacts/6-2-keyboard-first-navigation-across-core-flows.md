---
baseline_commit: 488e898
---

# Story 6.2: Keyboard-First Navigation Across Core Flows

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a keyboard-only user,
I want to complete every core flow without a mouse,
So that the application is fully operable by keyboard as a first-class, demonstrated practice.

## Acceptance Criteria

1. **Given** each core flow — register, log in, send, request, log out — **When** operated using only the keyboard, **Then** it can be completed end to end with no mouse interaction (FR32)
   - *Note: pay, decline, cancel flows target stories 4.3/4.4/4.5 (backlog) — those features don't exist in the UI yet; extend `keyboard.spec.ts` when they ship*
2. **Given** any interactive element, **Then** it is reachable via the keyboard and shows a visible focus indicator when focused (NFR14, UX-DR8)
3. **Given** the tab order on every page, **Then** it follows a logical, predictable sequence matching the visual reading order (UX-DR8)
4. **Given** the 3-step send funnel and the request flow, **When** navigated by keyboard, **Then** focus is managed sensibly across step transitions — focus moves to the new step's first control; no focus traps (FR32)
5. **Given** the skip-to-content link, **When** activated via keyboard, **Then** focus moves programmatically to `#main-content` (requires `tabIndex={-1}` on `<main>`)
6. **Given** an e2e test driving each core flow by keyboard only, **When** run, **Then** it verifies each flow completes without pointer events (FR32, NFR14)

## Tasks / Subtasks

- [x] Task 1: Fix broken locator in `send-money.spec.ts` (pre-condition) (AC: regression guard)
  - [x] `tests/e2e/send-money.spec.ts:42-47`: The `6.1` review removed the nested `<button>` inside `<li role="option">` and moved `onClick` to the `<li>` directly. The existing test chains `.getByRole('option').filter({hasText: recipientName}).getByRole('button')` which now finds nothing. Fix: remove the `.getByRole('button')` chain and click the option `<li>` directly
  - [x] New line 43-47: `await page.getByRole('option').filter({ hasText: recipientName }).click()`
  - [x] Check all other occurrences of `.getByRole('option')...getByRole('button')` in `send-money.spec.ts` (the insufficient balance test also uses this pattern) — apply same fix
  - [x] Verify `npm run test:e2e -- tests/e2e/send-money.spec.ts` passes before proceeding

- [x] Task 2: Add `tabIndex={-1}` to skip-link target (AC: #5)
  - [x] `src/app/(protected)/layout.tsx:27`: Change `<main id="main-content" className="...">` to add `tabIndex={-1}`
  - [x] `tabIndex={-1}` makes the element programmatically focusable (allows `href="#main-content"` to move focus) without adding it to the natural tab order — standard skip-link pattern
  - [x] Without this, the skip link scrolls to `#main-content` but `document.activeElement` stays on the link; screen readers and keyboard users do not land in `main`

- [x] Task 3: Add focus management to the send funnel (AC: #4)
  - [x] `src/app/(protected)/send/page.tsx`: Add `useEffect` + `useRef` to move focus on step transitions. Add these imports: `useEffect`, `useRef` (add to the existing `useState` import line)
  - [x] Declare refs at the top of `SendPage` (step3BackRef is `HTMLDivElement` since Button uses Base UI and doesn't forward refs — wrapped in a div)
  - [x] Add the effect after the existing state declarations
  - [x] Wire up refs in the JSX: step 1 section, step 2 Input, step 3 Back button wrapped in div
  - [x] `isInitialMount` guard prevents auto-focusing the search field on the initial page load — focus management only fires on transitions

- [x] Task 4: Mirror focus management in the request funnel (AC: #4)
  - [x] `src/app/(protected)/request/page.tsx`: Apply the IDENTICAL pattern from Task 3 (same refs, same effect, same JSX wiring)
  - [x] Step 1 `<section>`: add `ref={step1SectionRef}`
  - [x] Amount `<Input>`: add `ref={step2AmountRef}`
  - [x] Back `<Button>` wrapped in div: add `ref={step3BackRef}` on the div

- [x] Task 5: Create keyboard-only e2e test suite (AC: #1, #2, #3, #6)
  - [x] Create `tests/e2e/keyboard.spec.ts`
  - [x] Copy the `register` + `login` + `uniqueSuffix()` helpers per spec-file convention
  - [x] All 6 tests implemented: skip link, register, login, send money, request money, logout
  - [x] No `.click()` for primary flow — `focus()` + `keyboard.*` only
  - [x] Focus assertions after step transitions validate Tasks 3/4
  - [x] Skip link test uses `page.goto('/')` + wait for h1 (hydration guard) + `page.keyboard.press('Tab')`
  - [x] TODO comment marks extension point for pay/decline/cancel (stories 4.3/4.4)

- [x] Task 6: Full suite verification (AC: #1–6)
  - [x] `npm run test:e2e:docker` — 19/19 passed, exit code 0, zero regressions
  - [x] Bonus: fixed broken `.getByRole('button')` locators in `history.spec.ts` and `realtime.spec.ts` (same 6.1 breakage); fixed global-teardown FK constraint; added `workers: 3` CI cap to eliminate flakiness

## Dev Notes

### What's already in place — DO NOT re-implement

| Area | File | State |
|---|---|---|
| Skip-to-content link | `src/app/(protected)/layout.tsx:16-21` | EXISTS — `<a href="#main-content">` renders sr-only, visible on focus |
| `id="main-content"` on `<main>` | `src/app/(protected)/layout.tsx:27` | EXISTS — **missing `tabIndex={-1}`** (Task 2) |
| Nav link focus rings | `src/app/(protected)/NavLinks.tsx:25` | EXISTS — `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring` |
| Button focus rings | `src/components/ui/button.tsx` | EXISTS — `focus-visible:ring-3 focus-visible:ring-ring/50` |
| Input focus rings | `src/components/ui/input.tsx` | EXISTS — `focus-visible:ring-3 focus-visible:ring-ring/50` |
| Combobox keyboard nav (ArrowDown/Up/Enter/Escape) | `src/app/(protected)/send/UserSearchInput.tsx:82-100` | EXISTS — fully implemented |
| `role="combobox"` + `aria-expanded` | `UserSearchInput.tsx:128-132` | EXISTS — fixed in 6.1 |
| Form submit on Enter | Login, Register, Send step 2, Request step 2 | EXISTS — standard form behaviour; all use `<form onSubmit={...}>` with type="submit" button |
| Logout button | `src/app/(protected)/LogoutButton.tsx` | EXISTS — `<Button onClick={handleClick}>` — activates on Enter when focused |
| Nav links | `src/app/(protected)/NavLinks.tsx` | EXISTS — standard `<Link>` elements, activates on Enter when focused |
| `aria-current="page"` on active nav link | `NavLinks.tsx:24` | EXISTS |

### Pre-condition regression: `send-money.spec.ts` option locator is broken

Story 6.1's review patch removed the `<button>` nested inside `<li role="option">` and moved `onClick` to the `<li>` directly (`UserSearchInput.tsx:157-168`). The existing `send-money.spec.ts` test still chains `.getByRole('button')` after getting the option — that locator now returns nothing and `.toBeVisible()` would time out.

**Fix (Task 1) — before and after:**
```ts
// BEFORE (broken since 6.1 review)
const resultButton = page
  .getByRole('option')
  .filter({ hasText: recipientName })
  .getByRole('button')
await expect(resultButton).toBeVisible()
await resultButton.click()

// AFTER (click the option <li> directly)
await page.getByRole('option').filter({ hasText: recipientName }).click()
```

Apply to both tests in `send-money.spec.ts` (the main flow test and the insufficient balance test).

### Task 2 — `tabIndex={-1}` on `<main>`: why it's needed

The skip link (`<a href="#main-content">`) jumps the browser viewport to the element with `id="main-content"`. However, without `tabIndex={-1}`, the element is not programmatically focusable — `document.activeElement` stays on the `<a>` link. Screen reader users hear the skip link activate but then have to Tab forward from the link, not from main content.

`tabIndex={-1}` makes the element focusable via script/anchor but does NOT add it to the sequential Tab order (no extra Tab stop for sighted keyboard users).

```tsx
// src/app/(protected)/layout.tsx — change only this attribute
<main id="main-content" tabIndex={-1} className="flex flex-1 flex-col gap-4 p-4">
```

### Task 3/4 — focus management: implementation details

**Refs to add to `send/page.tsx` and `request/page.tsx`:**

```tsx
// Add useEffect, useRef to the existing import from 'react'
import { useState, useEffect, useRef } from 'react'

// Inside the component function, after state declarations:
const isInitialMount = useRef(true)
const step1SectionRef = useRef<HTMLElement>(null)
const step2AmountRef = useRef<HTMLInputElement>(null)
const step3BackRef = useRef<HTMLButtonElement>(null)

useEffect(() => {
  if (isInitialMount.current) {
    isInitialMount.current = false
    return
  }
  if (step === 1) {
    step1SectionRef.current?.querySelector<HTMLInputElement>('input')?.focus()
  } else if (step === 2) {
    step2AmountRef.current?.focus()
  } else if (step === 3) {
    step3BackRef.current?.focus()
  }
}, [step])
```

**JSX wiring in send/page.tsx:**

```tsx
// Step 1 section (currently line 126)
{step === 1 && (
  <section ref={step1SectionRef} aria-labelledby="step1-heading" className="flex flex-col gap-4">
    ...
  </section>
)}

// Amount Input in step 2 (currently line 160)
<Input
  ref={step2AmountRef}
  id="amount-input"
  ...
/>

// Back button in step 3 (currently line 232)
<Button ref={step3BackRef} variant="outline" onClick={handleBackFromStep3} disabled={submitting}>
  <ArrowLeft data-icon="inline-start" />
  Back
</Button>
```

`Button` from `@/components/ui/button.tsx` — check that it uses `React.forwardRef`. If it does not, wrap the Back button in step 3 with a `<div ref={step3BackRef}` and call `step3BackRef.current?.querySelector('button')?.focus()` instead. (Check `src/components/ui/button.tsx` before writing — if it already uses `forwardRef`, the direct `ref={step3BackRef}` on `<Button>` works fine.)

**Note on `Input` ref:** `src/components/ui/input.tsx` uses `React.forwardRef` (standard shadcn pattern) so `ref={step2AmountRef}` on `<Input>` works directly.

### Task 5 — keyboard.spec.ts patterns

**Keyboard-only idiom in Playwright:**
- `locator.focus()` — establishes keyboard entry point (NOT a pointer event; permitted in keyboard-only tests as a starting position)
- `page.keyboard.type(text)` — types into currently focused element
- `page.keyboard.press('Tab')` — advances focus to next focusable element
- `page.keyboard.press('Shift+Tab')` — reverse Tab
- `page.keyboard.press('Enter')` — activates focused button / submits focused form input
- `page.keyboard.press('ArrowDown')` / `'ArrowUp'` — navigates combobox options
- `expect(locator).toBeFocused()` — asserts `document.activeElement === locator.element`

**Skip link test:**
```ts
test('skip link — keyboard only', async ({ page }) => {
  const username = `e2e_kb_skip_${uniqueSuffix()}`
  await register(page, username)
  await login(page, username)

  // Tab once from body — skip link is the first focusable element
  await page.locator('body').press('Tab')
  const skipLink = page.getByRole('link', { name: 'Skip to content' })
  await expect(skipLink).toBeFocused()
  await page.keyboard.press('Enter')
  // tabIndex={-1} on <main> allows focus to land here
  await expect(page.locator('#main-content')).toBeFocused()
})
```

**Register keyboard test:**
```ts
test('register — keyboard only', async ({ page }) => {
  const username = `e2e_kb_reg_${uniqueSuffix()}`
  await page.goto('/register')
  await page.getByLabel('Username').focus()
  await page.keyboard.type(username)
  await page.keyboard.press('Tab')
  await page.keyboard.type(PASSWORD)
  await page.keyboard.press('Tab')
  await page.keyboard.type(PASSWORD)
  await page.keyboard.press('Enter')  // Enter on confirm-password submits the form
  await expect(page).toHaveURL('/login')
})
```

**Login keyboard test:**
```ts
test('login — keyboard only', async ({ page }) => {
  const username = `e2e_kb_login_${uniqueSuffix()}`
  await register(page, username)
  await page.goto('/login')
  await page.getByLabel('Username').focus()
  await page.keyboard.type(username)
  await page.keyboard.press('Tab')
  await page.keyboard.type(PASSWORD)
  await page.keyboard.press('Enter')  // Enter on password field submits the form
  await expect(page).toHaveURL('/')
})
```

**Send money keyboard test (the most important one):**
```ts
test('send money — keyboard only', async ({ page }) => {
  const suffix = uniqueSuffix()
  const sender = `e2e_kb_s_${suffix}`
  const target = `e2e_kb_t_${suffix}`

  // Register a searchable target, then the sender
  await register(page, target)
  await register(page, sender)
  await login(page, sender)

  await page.goto('/send')
  await expect(page.getByRole('heading', { name: 'Send money', level: 1 })).toBeVisible()

  // Step 1: search + select via keyboard
  await page.getByRole('combobox', { name: 'Search for a recipient by username' }).focus()
  await page.keyboard.type(`e2e_kb_t_${suffix.substring(0, 8)}`)  // type prefix that matches target
  await expect(page.getByRole('option').first()).toBeVisible()
  await page.keyboard.press('ArrowDown')  // highlight first option
  await page.keyboard.press('Enter')  // select — triggers onSelect → step 2

  // Focus management should place focus on amount input
  await expect(page.getByLabel('Amount (USD)')).toBeFocused()

  // Step 2: enter amount via keyboard
  await page.keyboard.type('10')
  await page.keyboard.press('Enter')  // Enter in input submits the form → step 3

  // Focus management should place focus on Back button
  await expect(page.getByRole('button', { name: 'Back' }).last()).toBeFocused()

  // Step 3: tab to Confirm and activate
  await page.keyboard.press('Tab')  // Back → Confirm & Send
  await page.keyboard.press('Enter')  // confirm

  await expect(page).toHaveURL('/')
})
```

**Note on the sender prefix search:** Use `suffix.substring(0, 8)` or similar to type a prefix that matches `target` but is less likely to match `sender`. Alternatively, use the full target username — just ensure it doesn't exceed the debounce before waiting for results.

**Request money keyboard test:**
```ts
test('request money — keyboard only', async ({ page }) => {
  // Mirror of send money test — same structure, different route and confirm label
  const suffix = uniqueSuffix()
  const requester = `e2e_kb_rq_${suffix}`
  const target = `e2e_kb_rt_${suffix}`

  await register(page, target)
  await register(page, requester)
  await login(page, requester)

  await page.goto('/request')
  await expect(page.getByRole('heading', { name: 'Request money', level: 1 })).toBeVisible()

  await page.getByRole('combobox', { name: 'Search for a recipient by username' }).focus()
  await page.keyboard.type(`e2e_kb_rt_`)
  await expect(page.getByRole('option').first()).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')

  await expect(page.getByLabel('Amount (USD)')).toBeFocused()
  await page.keyboard.type('5')
  await page.keyboard.press('Enter')

  await expect(page.getByRole('button', { name: 'Back' }).last()).toBeFocused()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')  // 'Confirm & Request'

  await expect(page).toHaveURL('/')
})
```

**Logout keyboard test:**
```ts
test('logout — keyboard only', async ({ page }) => {
  const username = `e2e_kb_out_${uniqueSuffix()}`
  await register(page, username)
  await login(page, username)

  // Focus the logout button (no click used)
  await page.getByRole('button', { name: 'Sign out' }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL('/login')
})
```

### Scope boundary: pay / decline / cancel

Stories 4.3 (Pay), 4.4 (Cancel), 4.5 (Real-time updates) are `backlog`. The `RequestCard` in `src/app/(protected)/inbox/RequestCard.tsx` currently shows a static `PENDING` badge with no actionable buttons. Do NOT attempt to keyboard-test flows that don't exist in the UI. Add a comment in `keyboard.spec.ts` marking the extension point:

```ts
// TODO(4.3/4.4): Add keyboard tests for Pay, Decline, Cancel once those stories ship.
//   Flows live on /inbox; buttons will be inside RequestCard components.
```

### Inline-send note: combobox keyboard note for the dev agent

The combobox keyboard interaction in `UserSearchInput` already works:
- Arrow keys navigate options while focus stays on the input (correct ARIA combobox pattern)
- The option `<li role="option">` elements intentionally do NOT have `tabindex` — do not add it
- `Enter` on the input with an active option fires `onSelect(results[activeIndex])`, which calls the parent's `handleSelectRecipient` and advances `step` → 2

### Focus management: why `isInitialMount` matters

On initial render, `step === 1`. Without the guard, `useEffect` fires and calls `.focus()` on the search input, stealing focus from wherever the user navigated from (e.g., pressing Send on the home page moves to `/send` — the router handles that, and we don't want to double-manage focus). The `isInitialMount` ref suppresses the first effect run, limiting focus management to user-initiated step transitions only.

### Source files to create/modify

| File | Action | Purpose |
|---|---|---|
| `tests/e2e/send-money.spec.ts` | Modify | Fix broken option locator (Task 1) |
| `src/app/(protected)/layout.tsx` | Modify | Add `tabIndex={-1}` to `<main>` (Task 2) |
| `src/app/(protected)/send/page.tsx` | Modify | Add focus management via useRef/useEffect (Task 3) |
| `src/app/(protected)/request/page.tsx` | Modify | Mirror focus management from send/page (Task 4) |
| `tests/e2e/keyboard.spec.ts` | Create | Keyboard-only e2e test suite (Task 5) |

### Testing requirements

- **No unit or integration tests** — changes are behavioural (focus management) and structural (tabIndex); e2e is the verification layer
- **Run Task 1 first** — `send-money.spec.ts` regression must be cleared before running the full suite
- **Incremental**: run `npm run test:e2e -- tests/e2e/keyboard.spec.ts` after Task 5 before running the full suite
- **Final gate**: `npm run test:e2e` then `npm run test:e2e:docker` — zero regressions across all specs

### Cross-story context

- **Story 6.1**: Established all focus rings, skip link, nav landmark, ARIA structure — this story builds directly on that foundation. Read `6-1-semantic-structure-aria-and-contrast-baseline.md` Dev Notes → "What's already in place" before starting.
- **Story 6.3**: Responsive layout — no interaction with keyboard navigation. Independent.
- **Story 6.4**: axe gate already passes. Do NOT remove or weaken `accessibility.spec.ts` assertions. If Task 2's `tabIndex={-1}` introduces any new axe finding, fix the component (not the test).
- **Stories 4.3/4.4/4.5**: Keyboard tests for pay/decline/cancel are out of scope here. When 4.3 ships, extend `keyboard.spec.ts`.

### References

- Epics: Story 6.2 ACs, FR32, NFR14, UX-DR8 [Source: `_bmad-output/planning-artifacts/epics.md:759–779`]
- Epics: Epic 6 goal [Source: `_bmad-output/planning-artifacts/epics.md:727–729`]
- Story 6.1 — what's already in place [Source: `_bmad-output/implementation-artifacts/6-1-semantic-structure-aria-and-contrast-baseline.md:82–101`]
- Story 6.1 review finding: `<button>` inside option removed [Source: `6-1-semantic-structure-aria-and-contrast-baseline.md:75`]
- Story 6.4: don't share helpers via utils.ts [Source: `6-4-automated-wcag-aa-audit-gate.md:Task 4`]
- Skip link implementation [Source: `src/app/(protected)/layout.tsx:16-21`]
- `<main>` target (missing tabIndex) [Source: `src/app/(protected)/layout.tsx:27`]
- UserSearchInput keyboard nav [Source: `src/app/(protected)/send/UserSearchInput.tsx:82-100`]
- Send funnel (no focus management yet) [Source: `src/app/(protected)/send/page.tsx:34-244`]
- Request funnel (no focus management yet) [Source: `src/app/(protected)/request/page.tsx:33-234`]
- Existing accessibility e2e helpers (register/login/uniqueSuffix) [Source: `tests/e2e/accessibility.spec.ts:7-27`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (bmad-create-story workflow)

### Debug Log References

### Completion Notes List

- Button component uses Base UI `ButtonPrimitive` without `React.forwardRef` in the wrapper — step3BackRef is `HTMLDivElement` wrapping the Button, with `querySelector('button')?.focus()`.
- `page.locator('body').press('Tab')` does not trigger real Tab navigation in Playwright headless; replaced with `page.keyboard.press('Tab')` after `page.goto('/')` and hydration guard.
- Broken `.getByRole('option')...getByRole('button')` locators existed in `history.spec.ts` and `realtime.spec.ts` in addition to `send-money.spec.ts` — all fixed.
- `global-teardown.ts` failed with FK constraint when deleting e2e users who had payment_requests — fixed by deleting child records (payment_requests, transactions) first.
- Added `workers: process.env.CI ? 3 : undefined` to playwright.config.ts to reduce parallel load on single dev server in Docker CI.

### File List

- tests/e2e/send-money.spec.ts
- tests/e2e/history.spec.ts
- tests/e2e/realtime.spec.ts
- tests/e2e/global-teardown.ts
- tests/e2e/keyboard.spec.ts (new)
- src/app/(protected)/layout.tsx
- src/app/(protected)/send/page.tsx
- src/app/(protected)/request/page.tsx
- playwright.config.ts

## Change Log

- 2026-06-25: Implemented story 6.2 — keyboard-first navigation: tabIndex on main, focus management in send/request funnels, keyboard.spec.ts e2e suite; fixed broken option locators in history/realtime/send-money specs; fixed teardown FK constraint; added CI worker cap
