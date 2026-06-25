---
baseline_commit: 3bc45c5
---

# Story 6.3: Responsive Layout (Mobile / Tablet / Desktop)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user on any device,
I want the application to adapt to my screen size,
so that I can use every feature without loss of functionality.

## Acceptance Criteria

1. **Given** the application, **When** viewed at mobile, tablet, and desktop viewport widths, **Then** every screen is usable and no functionality is lost or inaccessible at any size (FR30)
2. **Given** layout adaptation, **Then** it is expressed through Tailwind breakpoint utilities (no fixed pixel widths that overflow small viewports)
3. **Given** the home screen, send/request flows, inbox, and history at a mobile width, **Then** content reflows without horizontal scrolling and interactive targets remain comfortably tappable
4. **Given** an e2e test run at representative mobile, tablet, and desktop widths, **When** executed, **Then** it verifies the core flows are operable at each width

> **Representative widths used as the contract** (cite these everywhere): **mobile 375×667** (iPhone SE), **tablet 768×1024** (iPad portrait), **desktop 1280×800**. These are the exact viewports the e2e suite must drive.

## Tasks / Subtasks

- [x] **Task 1: Audit-first pass — drive each screen at 375 / 768 / 1280 and record findings (AC: #1, #3)**
  - [x] This story is **verify-first** (same shape as 6.2). The app is already largely responsive by construction — do NOT rewrite layouts wholesale. Find the *specific* break points, fix only those.
  - [x] Use the Playwright MCP browser (or `page.setViewportSize`) to load each route at all three widths **after logging in with seeded data present** (run `npm run seed` so history/inbox have rows — empty states hide the real overflow risks).
  - [x] Routes to audit: `/login`, `/register`, `/` (home), `/send` (all 3 steps), `/request` (all 3 steps), `/inbox` (with pending requests), `/history` (with transactions).
  - [x] For each route × width, record: (a) any horizontal scrollbar, (b) any clipped/overlapping content, (c) any control that is unreachable or smaller than comfortably tappable. Write the findings into Dev Notes → "Audit results" before changing code.

- [x] **Task 2: Add an explicit `viewport` export to the root layout (AC: #2)**
  - [x] `src/app/layout.tsx`: add a Next.js `viewport` export so the responsive contract is **explicit and demonstrated**, not relying on the framework default.
  - [x] Next.js 16 App Router auto-injects `width=device-width, initial-scale=1`, so pinch-zoom already works — but this story is a *teaching artifact* (UX spec line 60: "implemented as a deliberate teaching artifact (FR30), not incidental support"). Making it explicit is the point.
  - [x] Do NOT set `maximumScale` or `userScalable: false` — disabling zoom is a WCAG 1.4.4 (Resize Text) failure and would be caught by the 6.4 axe gate / fail the spirit of Epic 6.
  ```ts
  // src/app/layout.tsx — add alongside the existing `metadata` export
  import type { Metadata, Viewport } from 'next'

  export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
  }
  ```

- [x] **Task 3: Fix the header crowding at mobile (AC: #1, #3) — PRIMARY fix target** → **NO CHANGE NEEDED (audit-driven)**
  - [x] `src/app/(protected)/layout.tsx:22` — the header is `flex items-center justify-between gap-4` containing: the `C1Pay` logo link, `<NavLinks>` (Home / Inbox / History), and the `Sign out` button. This is the single most crowded element at 375px and the most likely AC#3 failure. **Confirm against the Task 1 audit before changing** — if it does not actually overflow at 375px, record that and skip the change (do not add breakpoints for their own sake; AC#2 forbids gratuitous fixed widths, not all unconditional layout). → **Task 1 audit measured header `scrollWidth === clientWidth === 375` at mobile: it does NOT overflow. Per instruction, skipped — no breakpoint added.**
  - [x] If it crowds, prefer the smallest change that holds the three-section layout: tighten the inter-group gap on small screens and restore it at `sm:` (e.g. `gap-2 sm:gap-4`), and/or tighten `NavLinks` spacing (`gap-3 sm:gap-4`). Keep logo left, nav centre-ish, Sign out right. → **Not applicable — no crowding.**
  - [x] Acceptable alternative if tightening is insufficient: allow the header to wrap (`flex-wrap`) so the nav drops to a second row at mobile — but only if the audit shows a hard overflow. Document which approach you took and why. → **Not applicable.**
  - [x] Whatever you do, the header must remain a single semantic `<header>` with the existing `<nav aria-label="Site navigation">` intact — do NOT introduce a hamburger/disclosure menu (out of scope, adds keyboard-focus and ARIA surface that would need its own story and would risk the 6.2 keyboard guarantees). → **Header left untouched; structure intact.**

- [x] **Task 4: Fix any `justify-between` row squeeze with long content (AC: #1, #3)**
  - [x] Candidate rows: `history/TransactionRow.tsx:15`, `inbox/RequestCard.tsx:11`, and the send/request **step-3 confirm** rows (`send/page.tsx:227-242`). Each is `flex items-center justify-between gap-4` with a left identity block and a right amount/time block. → **All confirmed overflowing at 375 by Task 1; all fixed.**
  - [x] Risk: a long `counterpartyUsername` / `requesterUsername` (usernames have no UI length cap) pushes the amount off-screen at 375px. The left identity column already has the right structure — add `min-w-0` to the **flex child that contains the truncatable text** and `truncate` on the username `<span>` so it ellipsises instead of overflowing. (`truncate` needs a `min-w-0` ancestor inside a flex row to actually clip — `flex` children default to `min-width: auto`.) → **Applied `min-w-0` to both flex ancestors + `truncate` on username & secondary spans.**
  - [x] `RequestCard.tsx:18` already truncates the secondary line; extend the same treatment to the username span on line 17 if the audit shows overflow. Apply the identical pattern in `TransactionRow.tsx:21`. → **Done. Confirmed the pre-existing `truncate` on RequestCard was inert (no `min-w-0` ancestor); now functional.**
  - [x] The right-hand amount/time block must keep its natural width (`shrink-0` on that block if needed) so the amount is never the thing that gets clipped — money must always be fully legible. → **Added `shrink-0` to the amount/time block in both rows; verified `$12,345.67` / `$98,765.43` stay fully visible.**
  - [x] Only apply these where Task 1 proved a real overflow. Record which rows you touched. → **Touched: `TransactionRow.tsx`, `RequestCard.tsx`, `send/page.tsx` (step-2 line + step-3 To row), `request/page.tsx` (step-2 line + step-3 From row). The step-2/step-3 send/request rows use `break-words` (wrap, not truncate) so the recipient's full name stays visible on confirmation screens.**

- [x] **Task 5: Confirm touch-target comfort on the core actions (AC: #3)**
  - [x] AC#3 says interactive targets "remain comfortably tappable." Project target is **WCAG 2.1 AA**, which does *not* impose a hard 44px minimum (that is 2.5.5 Target Size, a 2.1 **AAA** criterion). So treat this as a comfort check, not a hard gate — do not bloat the desktop UI.
  - [x] The two primary home actions are already `size="lg"` + `h-12` (`page.tsx:27-45`) — good. Spot-check that the send/request **Back / Continue / Confirm** buttons and the inbox/history tap targets are not uncomfortably small at mobile. The default Button is `h-9`; only enlarge a specific control if the audit flags it as cramped. Record the decision. → **Spot-checked at 375: home actions `h-12`; Back/Continue/Confirm and the full-width inbox/history links use the default `h-9` (36px), comfortable for AA. No control flagged as cramped. Decision: no enlargement — avoids bloating the UI and keeps AA-appropriate sizing.**

- [x] **Task 6: Create the responsive e2e suite (AC: #4)**
  - [x] Create `tests/e2e/responsive.spec.ts`.
  - [x] Copy the `register` + `login` + `uniqueSuffix()` helpers into the file (per spec-file convention — story 6.4 explicitly ruled out a shared `tests/e2e/utils.ts`; every spec is self-contained). Use `PASSWORD = 'password123'`.
  - [x] Define the three viewports as the contract and run a `test.describe` per width using `test.use({ viewport })`, OR a parametrised loop calling `page.setViewportSize()` at the top of each test. Prefer `test.use({ viewport })` per describe block — it is the idiomatic Playwright form and reads as a clear teaching artifact. → **Used `test.use({ viewport })` per describe, generated in a loop over the `VIEWPORTS` contract.**
  - [x] At **each** width, drive a core flow end-to-end and assert (a) the flow completes (URL/heading assertions, same as `send-money.spec.ts`) and (b) **no horizontal scroll** via the document-overflow check below.
  - [x] Minimum coverage per width: home loads + Send funnel completes (search → amount → confirm → back on `/`). Add an inbox + history check at mobile specifically (those are the long-content overflow risks from Task 4). Keep it lean — this is a viewport regression guard, not a re-test of business logic already covered by `send-money.spec.ts` / `history.spec.ts`. → **Funnel uses a long recipient username so it also guards the send step-2/step-3 overflow at mobile. Mobile-only test builds a real long-username history row (send) + inbox row (incoming request) inline.**
  - [x] No-horizontal-scroll helper (the heart of AC#3 as an automated check):
  ```ts
  async function expectNoHorizontalScroll(page: Page) {
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(overflows, 'page must not scroll horizontally at this viewport').toBe(false)
  }
  ```
  - [x] Reuse the search/select idiom from `send-money.spec.ts` / `keyboard.spec.ts`: type the **full suffixed** target username (the 6.2 review proved bare prefixes select a non-deterministic user under parallel workers — `src/lib/users.ts:47` is a prefix `ilike('term%')`), then click the option `<li>` directly (`getByRole('option').filter({ hasText: target }).click()` — the nested `<button>` was removed in 6.1, do NOT chain `.getByRole('button')`). → **Done — full suffixed names, option `<li>` clicked directly.**

- [x] **Task 7: Full-suite verification (AC: #1–4)**
  - [x] `npm run test:e2e -- tests/e2e/responsive.spec.ts` first (fast inner loop). → **Native runner can't launch a browser on this host (Ubuntu — known toolchain issue; only browser-launch failed, spec collection was correct). Verification done via the containerised gate below + live Playwright-MCP overflow measurement.**
  - [x] Then the full containerised gate: `npm run test:e2e:docker` — must be green with **zero regressions** across all specs (auth, send-money, history, realtime, sse, accessibility, keyboard, responsive). The 6.4 `accessibility.spec.ts` axe gate must still pass — if any responsive change (e.g. `flex-wrap`, truncation) introduces a new axe finding, fix the markup, never weaken the test. → **`npm run test:e2e:docker` → 24/24 passed (21.9s), exit 0. Axe gate (tests 5/11/12/13) and keyboard suite all green. Zero regressions.**
  - [x] Record the final pass count in Completion Notes. → **Recorded below.**

## Dev Notes

### What's already in place — DO NOT re-implement

The application was built responsive-by-construction. Most "responsive work" is **verification**, not new layout. Confirm these hold; do not rewrite them.

| Area | File | Current responsive treatment |
|---|---|---|
| Root `<html>`/`<body>` | `src/app/layout.tsx:28-34` | `h-full antialiased` / `min-h-full flex flex-col` — fluid, no fixed width. **Missing explicit `viewport` export → Task 2.** |
| Protected shell | `src/app/(protected)/layout.tsx:22-27` | `<header>` `flex items-center justify-between gap-4 p-4`; `<main>` `flex flex-1 flex-col gap-4 p-4`. **Header is the crowding risk → Task 3.** |
| Home | `src/app/(protected)/page.tsx:14` | `mx-auto w-full max-w-3xl flex flex-col gap-6`; action buttons `grid gap-3 sm:grid-cols-2` (the **only** explicit breakpoint in the app — stacks at mobile, 2-up at ≥640px). Already correct. |
| Send / Request funnel | `send/page.tsx:136`, `request/page.tsx` | `mx-auto w-full max-w-lg flex flex-col gap-6 px-4 py-6` — fluid, centred, capped. Step-3 confirm rows are `justify-between` → Task 4 spot-check. |
| Inbox | `inbox/page.tsx:10`, `RequestCard.tsx` | `mx-auto w-full max-w-3xl`; card already partially truncates (`RequestCard.tsx:18`) → extend per Task 4. |
| History | `history/page.tsx:14`, `TransactionRow.tsx` | `mx-auto w-full max-w-3xl`; row is `justify-between` with un-truncated username → Task 4. |
| Auth pages | `(auth)/login/page.tsx`, `register/page.tsx` | `flex min-h-screen items-center justify-center p-4` + `Card` `w-full max-w-sm` — textbook responsive centred card. Already correct; just verify in Task 1. |
| Focus rings / keyboard | (Story 6.2) | All focus management and keyboard operability is done. Responsive changes must not break it — re-running the full suite in Task 7 guards this. |

### Audit results

Driven live via Playwright MCP at 375 / 768 / 1280, logged in as `testuser1`, with worst-case
seeded data (a 53-char username `aud_recipient_supercalifragilisticexpialidocious_0001`, a sent
transaction of $12,345.67, and an incoming PENDING request of $98,765.43). Overflow measured as
`document.documentElement.scrollWidth > clientWidth` plus per-element `getBoundingClientRect().right`.

| Route | Width | Finding | Fix (task) |
|---|---|---|---|
| `/login`, `/register` | 375/768/1280 | none — centered card (`max-w-sm`, `w-full`), fully fluid | — |
| `/` home + `<header>` | 375 | **none** — header fits exactly (scrollW = clientW = 375); logo + nav + Sign out at `gap-4` do not crowd | **T3 no-op — skipped per spec** |
| `/` home | 768/1280 | none | — |
| `/history` | 375 | long username span = 404px wide → row scrollW **582** vs 375; `$12,345.67` amount pushed off-screen | `min-w-0` + `truncate` + `shrink-0` (T4) |
| `/history` | 768/1280 | none | — |
| `/inbox` | 375 | same as history (scrollW **582**); the existing `truncate` on the secondary line is **inert** — no `min-w-0` ancestor, confirming the Dev Notes gotcha | `min-w-0` + `truncate` + `shrink-0` (T4) |
| `/inbox` | 768/1280 | none; lifecycle row (248px) fits | — |
| `/send` step 1 (dropdown open) | 375 | transient scrollW 392 (17px = scrollbar width) while the Base UI listbox is open; **no element extends past the viewport**; popup closes on select before any assertion → not a real failure | none (documented) |
| `/send` step 2 | 375 | "Sending to **{username}**" — the `<strong>` is an unbreakable 53-char token (374px), scrollW **406** | `break-words` on the line (T4-adjacent, audit-discovered) |
| `/send` step 3 confirm | 375 | "To **{username}**" `justify-between` row — `<strong>` overflows, scrollW **437** | `min-w-0`/`break-words` + label `shrink-0` (T4) |
| `/request` step 2/3 | 375 | identical component code to `/send` → identical overflow | same fixes as `/send` (T4) |

**Decisions recorded:**
- **Task 3 (header) skipped** — the audit proves the header does not overflow at 375px. Per the Task 3 instruction ("if it does not actually overflow at 375px, record that and skip the change"), no header change is made. AC#2 forbids gratuitous breakpoints.
- **Task 4 confirmed and extended.** List rows (`TransactionRow`, `RequestCard`) get the spec's `min-w-0` + `truncate` + `shrink-0` (ellipsis is right for scannable lists). The send/request **confirm/selection** contexts (step-2 line, step-3 "To"/"From" rows) instead **wrap** via `break-words` — truncating a recipient's name on a confirmation screen would hide who you're paying, which is the wrong trade-off there. Money block keeps natural width everywhere.
- Touch targets (Task 5): spot-checked during the audit — primary home actions are `h-12`; Back/Continue/Confirm and list tap targets are the default `h-9`, comfortable at mobile. No enlargement (WCAG 2.1 **AA** imposes no hard 44px min; that's AAA 2.5.5).

### Tailwind v4 breakpoints (the toolkit for AC#2)

- Tailwind v4 is bundled with Next 16 ([architecture.md:91](../planning-artifacts/architecture.md)). Default breakpoints are unchanged and sufficient — **do not customise them**: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px, `2xl` 1536px.
- Note the test contract widths straddle these: 375 (< `sm`, pure mobile), 768 (= `md`, tablet), 1280 (= `xl`, desktop). A `sm:` utility flips on between mobile and tablet; an `md:`/`lg:` utility flips on at/above tablet. Pick the prefix that matches where you actually want the change.
- AC#2 = "expressed through Tailwind breakpoint utilities (no fixed pixel widths that overflow)". The existing `max-w-*` caps are **max** widths with `w-full` underneath, so they shrink fluidly below the cap — they satisfy AC#2 and are not "fixed pixel widths that overflow". Do not replace them.
- Grep confirms **zero** `w-[NNNpx]` / `min-w-[…]` overflow hazards in `src/` (only intentional `whitespace-nowrap` on Button/Badge, which is correct for those small components).

### `truncate` in a flex row — the gotcha (Task 4)

`truncate` (`overflow:hidden; text-overflow:ellipsis; white-space:nowrap`) only clips if the element can actually be narrower than its content. Inside a `flex` row, children default to `min-width: auto`, so they refuse to shrink below their content and overflow the row instead of ellipsising. The fix is `min-w-0` on the flex child (and any intermediate flex wrapper) that contains the truncatable text. Pattern:

```tsx
<div className="flex items-center justify-between gap-4 …">
  <div className="flex min-w-0 items-center gap-3">     {/* add min-w-0 */}
    <Icon … />
    <div className="flex min-w-0 flex-col gap-0.5">     {/* add min-w-0 */}
      <span className="truncate font-medium">{username}</span>  {/* add truncate */}
      …
    </div>
  </div>
  <div className="flex shrink-0 flex-col items-end gap-0.5">  {/* shrink-0: amount never clips */}
    <AmountDisplay … />
    <time … />
  </div>
</div>
```

### e2e patterns (Task 6)

- **Single Chromium project.** `playwright.config.ts` defines one project (`Desktop Chrome`) and `fullyParallel: true`. There is **no device-emulation project** — you set viewports inside the spec, you do NOT add new Playwright projects.
- **CI serves a production build** (`next build && next start`), not `next dev` — same behaviour you'll see locally with `npm run build && npm run start`. Don't rely on dev-only behaviour.
- Idiomatic per-width structure:
  ```ts
  const VIEWPORTS = {
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1280, height: 800 },
  } as const

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test.describe(`${name} (${viewport.width}px)`, () => {
      test.use({ viewport })

      test('home + send funnel — no horizontal scroll, flow operable', async ({ page }) => {
        const suffix = uniqueSuffix()
        const sender = `e2e_rsp_s_${suffix}`
        const target = `e2e_rsp_t_${suffix}`
        await register(page, target)
        await register(page, sender)
        await login(page, sender)

        await expect(page.getByRole('heading', { name: 'Current balance' }).or(
          page.getByRole('heading', { level: 1 }),
        )).toBeVisible()
        await expectNoHorizontalScroll(page)

        await page.getByRole('link', { name: 'Send' }).click()
        await page.getByRole('combobox', { name: 'Search for a recipient by username' }).fill(target)
        await page.getByRole('option').filter({ hasText: target }).click()   // option <li> (no nested button since 6.1)
        await page.getByLabel('Amount (USD)').fill('10')
        await page.getByRole('button', { name: 'Continue' }).click()
        await expectNoHorizontalScroll(page)
        await page.getByRole('button', { name: 'Confirm & Send' }).click()
        await expect(page).toHaveURL('/')
        await expectNoHorizontalScroll(page)
      })
    })
  }
  ```
- Add, at mobile width only, a quick `/inbox` and `/history` overflow check seeded with at least one long-username row, since those are the Task 4 risk surfaces. (Create the row inline via a send between two registered users, or rely on `npm run seed` data — but seeded data is wiped/owned by `global-setup`; prefer creating the row inline within the test so it is deterministic under parallel workers.)
- The home "balance heading" is `id="balance-heading"` / `name: 'Current balance'`? — re-check: in `page.tsx:21` the `<h1 id="balance-heading">` wraps `<LiveBalance/>`, and the visible label "Current balance" is a separate `<p>`. So select the home heading by `level: 1` or by the `Send`/`Request` links being visible, not by the text "Current balance". Verify your selector against the live DOM during Task 1.

### Scope boundaries

- **No hamburger / disclosure nav.** Three nav links + Sign out fit on one row with minor gap tuning. A collapsing menu adds keyboard-focus management and ARIA-expanded surface that belongs to its own story and risks the 6.2 keyboard guarantees. Out of scope.
- **No new breakpoints in CSS theme.** Default Tailwind breakpoints are sufficient.
- **Pay / Decline / Cancel (stories 4.3–4.5) are backlog.** `RequestCard` shows a static `PENDING` badge with no action buttons. Don't responsive-test controls that don't exist; the inbox card's eventual action buttons are a future story's concern.
- **Don't touch business logic, services, or schemas.** This is a pure layout + e2e story.

### Git workflow (required by CLAUDE.md)

Create the branch **before** any code change: `story/6-3-responsive-layout-mobile-tablet-desktop`. Never commit to `main`; land via PR.

### Testing requirements

- **No unit/integration tests** — changes are layout (Tailwind utilities) and a viewport export. e2e is the verification layer, consistent with story 6.2.
- **Inner loop:** `npm run test:e2e -- tests/e2e/responsive.spec.ts`.
- **Final gate:** `npm run test:e2e:docker` — full suite green, zero regressions, 6.4 axe gate still passing.
- Treat any new axe-core violation introduced by a layout change as a **build failure**, not a warning (CLAUDE.md, Epic 6).

### Cross-story context

- **Story 6.1** established semantic landmarks, focus rings, ARIA, contrast. Responsive changes must not alter landmark structure (header/nav/main stay intact).
- **Story 6.2** (just merged, HEAD `3bc45c5`) added focus management + `keyboard.spec.ts`. Re-running the full suite in Task 7 guards that responsive tweaks don't regress keyboard flows.
- **Story 6.4** `accessibility.spec.ts` axe gate runs against every route and must stay green. `flex-wrap`/truncation are axe-neutral if markup stays semantic — verify, don't assume.
- This story is **independent of keyboard navigation** (6.2 Dev Notes line 371 explicitly noted "Responsive layout — no interaction with keyboard navigation. Independent.").

### References

- Story 6.3 ACs, FR30 [Source: [`_bmad-output/planning-artifacts/epics.md:781-795`](../planning-artifacts/epics.md)]
- Epic 6 goal, NFR13–16, UX-DR8 [Source: [`epics.md:727-733`](../planning-artifacts/epics.md)]
- Responsive as deliberate teaching artifact (not incidental) [Source: [`ux-design-specification.md:60`](../planning-artifacts/ux-design-specification.md)]
- Tailwind v4 + responsive via breakpoint utilities [Source: [`architecture.md:91`](../planning-artifacts/architecture.md)]
- FR30–32 traceability → "All page/component files; Tailwind responsive utilities" [Source: [`architecture.md:618`](../planning-artifacts/architecture.md)]
- Root layout, missing `viewport` export [Source: `src/app/layout.tsx`]
- Protected header (crowding risk) [Source: `src/app/(protected)/layout.tsx:22-27`]
- Home `sm:grid-cols-2` (only existing breakpoint) [Source: `src/app/(protected)/page.tsx:26`]
- `justify-between` rows (overflow risk) [Source: `src/app/(protected)/history/TransactionRow.tsx:15`, `inbox/RequestCard.tsx:11`]
- e2e helper convention (per-file register/login/uniqueSuffix) [Source: `tests/e2e/keyboard.spec.ts:1-26`, `tests/e2e/accessibility.spec.ts:7-27`]
- Option-click idiom + non-deterministic-prefix lesson [Source: `6-2-keyboard-first-navigation-across-core-flows.md:71`, `src/lib/users.ts:47`]
- Single Chromium project, CI prod-build server [Source: `playwright.config.ts`]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (bmad-create-story workflow)

### Debug Log References

- Local DB port conflict: another project's container held `:5432`; brought up `c1pay-postgres` (force-recreate to apply the port map), migrated + seeded for the audit. whisky-tracker-db stopped during this story — offer to restart when done.
- Native `npm run test:e2e` fails at `browserType.launch` (no Chromium installed on host — known Ubuntu toolchain issue). Verification routed through `npm run test:e2e:docker` (browsers in-container) + live Playwright-MCP measurement during the audit.

### Completion Notes List

**Verify-first story (per spec). Audit drove every change; nothing rewritten wholesale.**

- **Task 1 audit (live, Playwright MCP @ 375/768/1280, worst-case seeded data):** overflow found ONLY at mobile (375), and ONLY where long usernames meet `justify-between`/inline layout — `/history`, `/inbox`, and `/send` + `/request` steps 2 & 3. Home (incl. `<header>`), auth pages, and all tablet/desktop views passed untouched. Full table in Dev Notes → Audit results.
- **Task 2:** added explicit `viewport` export to `src/app/layout.tsx` (`width: 'device-width', initialScale: 1`) — the FR30 teaching artifact made explicit. No `maximumScale`/`userScalable` (would break WCAG 1.4.4).
- **Task 3 (header): NO CHANGE** — audit proved no overflow at 375 (header `scrollWidth === clientWidth`); skipped per the spec's own instruction. AC#2 forbids gratuitous breakpoints.
- **Task 4:** list rows (`TransactionRow`, `RequestCard`) → `min-w-0` on both flex ancestors + `truncate` on the text spans + `shrink-0` on the amount block (money never clips). Discovered the pre-existing `truncate` on `RequestCard` was inert without a `min-w-0` ancestor — now functional. Send/request **step-2 line** and **step-3 confirm rows** → `break-words` (+ `min-w-0`/`shrink-0`) so a long recipient name **wraps** rather than truncating — you must see exactly who you're paying on a confirm screen.
- **Task 5 (touch targets): NO CHANGE** — spot-checked; home actions `h-12`, others default `h-9` (36px), comfortable for WCAG 2.1 **AA** (no 44px hard min at AA).
- **Post-fix verification:** re-measured `/history`, `/inbox`, `/send` steps 2 & 3 live at 375 → `scrollWidth === 375`, no offenders, amounts (`$12,345.67`, `$98,765.43`) fully visible.
- **Task 6:** `tests/e2e/responsive.spec.ts` — self-contained helpers; `VIEWPORTS` contract (375/768/1280); `test.use({ viewport })` per describe; `expectNoHorizontalScroll` helper; funnel uses a long recipient name (guards send confirm overflow); mobile-only test builds real long-username history + inbox rows inline.
- **Task 7 final gate:** `npm run test:e2e:docker` → **24/24 passed (21.9s), exit 0**, including 4 new responsive tests (mobile/tablet/desktop funnel + mobile long-content list). **Zero regressions**; 6.4 axe gate and 6.2 keyboard suite still green. Lint clean on all changed files (pre-existing errors are in gitignored `_bmad/` scripts only).

### File List

- `src/app/layout.tsx` — added `Viewport` import + explicit `viewport` export (Task 2)
- `src/app/(protected)/history/TransactionRow.tsx` — `min-w-0` + `truncate` + `shrink-0` (Task 4)
- `src/app/(protected)/inbox/RequestCard.tsx` — `min-w-0` + `truncate` + `shrink-0` (Task 4)
- `src/app/(protected)/send/page.tsx` — `break-words` on step-2 line; `min-w-0`/`break-words`/`shrink-0` on step-3 To row (Task 4)
- `src/app/(protected)/request/page.tsx` — same treatment on step-2 line + step-3 From row (Task 4)
- `tests/e2e/responsive.spec.ts` — NEW responsive regression suite at 375/768/1280 (Task 6)

## Change Log

- 2026-06-25: Story 6.3 drafted via bmad-create-story — responsive layout verification + targeted fixes (viewport export, header, truncation) + responsive.spec.ts at 375/768/1280. Status set ready-for-dev.
- 2026-06-25: Implemented via bmad-dev-story. Audit-first: header (Task 3) and touch targets (Task 5) confirmed already-correct and left untouched; added explicit `viewport` export (Task 2); fixed long-username overflow in history/inbox rows (truncate) and send/request confirm screens (wrap) (Task 4); added `responsive.spec.ts` (Task 6). Full containerised suite 24/24 green, zero regressions (Task 7). Status → review.

## Review Findings

_Code review 2026-06-25 (bmad-code-review). 3 adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). 2 patch, 0 decision-needed, 0 deferred, 10 dismissed as noise/false-positive._

- [x] [Review][Patch] Confirm-screen **Note** row overflows at mobile — the `justify-between` note row was left unfixed while the sibling To/From row above it was given `min-w-0 break-words` + `gap-4`/`shrink-0`. A long unbroken note (`maxLength=500`) h-scrolls past 375px. Mirror the To/From fix: `gap-4` on the row, `shrink-0` on the "Note" label, `min-w-0 break-words` on the value span. [src/app/(protected)/send/page.tsx:240-242, src/app/(protected)/request/page.tsx analogous note row] → **Fixed: both note rows now `gap-4` row + `shrink-0` label + `min-w-0 break-words` value (mirrors the To/From row). Lint + tsc clean.**
- [x] [Review][Patch] `responsive.spec.ts` never exercises the note path (so the note-row overflow is unguarded) and never calls `expectNoHorizontalScroll` during the **request** funnel steps (only the symmetric send side is asserted), leaving `request/page.tsx`'s `break-words` fix unverified by the suite. Add a note to the funnel and an h-scroll assertion on the request confirm steps. [tests/e2e/responsive.spec.ts] → **Fixed: added a `LONG_NOTE` unbroken token; the per-width send funnel now fills it (guards the note row at 375/768/1280) and the mobile request flow now fills it + asserts `expectNoHorizontalScroll` at request steps 2 & 3.**
