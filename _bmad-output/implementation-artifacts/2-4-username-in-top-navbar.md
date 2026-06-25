---
baseline_commit: 9258804f90772de0646440c8933c3f14d09d174c
---

# Story 2-4: Display Username in Top Navbar

**Status:** review
**GitHub Issue:** #39
**Epic:** 2 — Home Screen & Real-Time Foundation

---

## User Story

As an authenticated user,
I want to see my username displayed in the top navigation bar,
So that I always know which account I'm signed in as.

---

## Acceptance Criteria

- **AC1:** The logged-in user's username is visible in the `<header>` on every protected page (`/`, `/inbox`, `/history`, `/send`).
- **AC2:** Unauthenticated pages (`/login`, `/register`) do not show a username (they use a different layout with no `<header>`).
- **AC3:** The username is prefixed with `@` (e.g. `@vindhya`) to distinguish it from other text in the header.
- **AC4:** On mobile (`< md` breakpoint) the username is still visible — it must not be hidden or overflow its container.
- **AC5:** The username element has sufficient colour contrast (WCAG AA — 4.5:1 for normal text).
- **AC6:** The username is readable by screen readers — it must not be `aria-hidden`.

---

## Technical Requirements

### What to change

**File:** `src/app/(protected)/layout.tsx`

The protected layout **already fetches `user`** via `getUserById(userId)`. The `user.username` value is available but never rendered. The only change needed is to pass it into the JSX header.

**Current header:**
```tsx
<header className="flex items-center justify-between gap-4 border-b p-4">
  <Link href="/" className="font-semibold hover:text-foreground/80">C1Pay</Link>
  <NavLinks />
  <LogoutButton />
</header>
```

**Target header** — add `@username` between `NavLinks` and `LogoutButton`:
```tsx
<header className="flex items-center justify-between gap-4 border-b p-4">
  <Link href="/" className="font-semibold hover:text-foreground/80">C1Pay</Link>
  <NavLinks />
  <div className="flex items-center gap-3">
    <span className="text-sm text-muted-foreground" aria-label={`Signed in as ${user.username}`}>
      @{user.username}
    </span>
    <LogoutButton />
  </div>
</header>
```

No new files. No new components. No new DB queries (user is already fetched).

### Styling constraints

- Use `text-muted-foreground` — semantic token, auto dark mode, meets contrast.
- Use `text-sm` to match the `LogoutButton` size tier.
- Use `flex items-center gap-3` wrapper to keep username and button visually grouped on the right side.
- Never use raw colours (`text-gray-500`, etc.).

### Accessibility

- The `<span>` must **not** have `aria-hidden`.
- Add `aria-label="Signed in as {username}"` so screen readers announce the full phrase, not just `@vindhya`.
- The element is purely informational — no interactive role needed.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/app/(protected)/layout.tsx` | Add `@{user.username}` span in header — no other changes |

**No new files. No schema changes. No new dependencies.**

---

## Dev Notes

- `user` is already in scope in `ProtectedLayout` — `const [user, inboxItems] = await Promise.all([...])`. The username is `user.username` (string, non-null per DB schema).
- `LogoutButton` is already in the header — just wrap it and the new span in a `<div className="flex items-center gap-3">`.
- Do **not** move `NavLinks` or change any nav behaviour. Touch only the right-hand side of the header.
- On mobile the flex layout will compress — the username should remain visible. If space is very tight, the `text-sm text-muted-foreground` treatment is small enough not to overflow on real device widths. Do not add `hidden sm:block` or anything that hides it.
- No Zustand store change — username is server-rendered from the layout, same as all other layout content.

---

## Testing

No unit or integration tests are required for this story — it is a pure server-component render path change with no logic.

**Manual smoke test:**
1. Log in → verify `@<username>` appears in the header on all protected pages.
2. Log out → verify `/login` has no username in the header.
3. Resize to mobile (375 px) — verify username is still visible and header does not overflow.
4. Run axe-core / browser accessibility check on any protected page — no new violations.

---

## Out of Scope

- Clicking the username (profile link) — not requested.
- Avatar / initials icon — not requested.
- Truncation for long usernames — usernames are constrained by registration validation; not a real-world concern for this app.

---

## Dev Agent Record

### Implementation Notes

- Modified `src/app/(protected)/layout.tsx` only — wrapped the existing `<LogoutButton />` in a `<div className="flex items-center gap-3">` and prepended a `<span>` rendering `@{user.username}`.
- `user.username` was already in scope from the existing `getUserById(userId)` call — zero additional DB queries.
- `aria-label="Signed in as {username}"` added so screen readers announce the full phrase rather than the bare `@handle`.
- Semantic token `text-muted-foreground` used — satisfies WCAG AA contrast without raw colour values.

### Completion Notes

All 6 acceptance criteria satisfied:
- AC1 ✅ Username visible in header on every protected page (server-rendered by `ProtectedLayout`)
- AC2 ✅ Unauthenticated pages (`/login`, `/register`) use a separate layout with no header — unchanged
- AC3 ✅ Username prefixed with `@`
- AC4 ✅ No breakpoint hiding — visible on mobile
- AC5 ✅ `text-muted-foreground` semantic token meets WCAG AA contrast
- AC6 ✅ `<span>` is not `aria-hidden`; `aria-label` provides full context for screen readers

No regressions — no logic changed, only a render-only addition to the header.

### File List

| File | Status |
|------|--------|
| `src/app/(protected)/layout.tsx` | Modified |

### Change Log

| Date | Change |
|------|--------|
| 2026-06-25 | Added `@username` span to protected layout header (GH #39) |

---

## Session Metrics

### Development
- Started: 2026-06-25
- Completed: 2026-06-25
- Duration: —
- Tokens (dev): —

### Code Review
- Completed: —
- Duration: —
- Tokens: —
