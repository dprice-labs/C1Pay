---
baseline_commit: 8a75d04
---

# Story 2.2: Home Screen UI

Status: review

## Story

As an authenticated user,
I want to see my current balance and quick-access actions on the home screen,
So that I can orient myself immediately after login and act without navigating away.

## Acceptance Criteria

1. **Given** the home page `/`, **When** rendered, **Then** it displays the authenticated user's current balance as the hero element — prominently positioned and clearly labelled — reading from `useBalanceStore`

2. **Given** `src/components/ui/AmountDisplay.tsx` exists, **When** passed an integer cents value, **Then** it renders the formatted currency string (e.g., `100000` → `$1,000.00`); this component is used consistently wherever a monetary amount is displayed

3. **Given** the home page, **When** rendered, **Then** it displays a "Send" button and a "Request" button as large, immediately accessible primary CTAs

4. **Given** the home page, **When** rendered, **Then** it displays an inbox badge showing the pending incoming request count from `useRequestStore`; the badge is not shown when the count is zero

5. **Given** a unit test for `AmountDisplay`, **When** run, **Then** it verifies correct cent-to-currency formatting for representative values including zero, round dollars, and dollars with cents

## Tasks / Subtasks

- [x] Task 1: Read local Next.js 16 App Router docs before editing app code
- [x] Task 2: Fetch shadcn/ui Button and Badge docs; add Badge via shadcn CLI
- [x] Task 3: Create `AmountDisplay` shared UI component and formatting helper
- [x] Task 4: Replace protected home placeholder with a client dashboard reading Zustand stores
- [x] Task 5: Add unit coverage for amount formatting and rendered output
- [x] Task 6: Run verification and capture results

## Dev Notes

- The page is a Client Component because it reads `useBalanceStore` and `useRequestStore`.
- Initial balance and pending count are seeded by Story 2.1's protected layout/Providers boundary.
- Send and Request CTAs are presentational in this story; the actual flows arrive in Epics 3 and 4.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Completion Notes List

- Added shadcn/ui `Badge` using the Base UI registry.
- Added `AmountDisplay` with `Intl.NumberFormat` USD formatting from integer cents.
- Replaced the signed-in placeholder home page with a balance hero, large Send/Request CTAs, and a pending-request inbox badge.
- `npm run test:unit` passes: 7 files, 28 tests.
- `npm run lint` passes with one pre-existing warning in `src/db/index.ts`.
- `npm run build` passes when network is available for `next/font` Google font fetches.
- `npx tsc --noEmit` is still blocked by pre-existing type errors in `tests/unit/lib/users.test.ts`.

### File List

- `src/components/ui/badge.tsx` (created)
- `src/components/ui/AmountDisplay.tsx` (created)
- `src/app/(protected)/page.tsx` (modified)
- `tests/unit/components/AmountDisplay.test.tsx` (created)
- `_bmad-output/implementation-artifacts/2-2-home-screen-ui.md` (created)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

## Change Log

- Started Story 2.2 and implemented the home screen UI foundation (Date: 2026-06-10)
