# C1Pay

## Accessibility (always-on)

Accessibility is a first-class requirement in this project — both functionally (WCAG 2.1 AA) and as a demonstrated teaching artifact studied in the code. Build it in from the start; never retrofit it.

When writing or changing any UI, always:

- Use semantic HTML (`header`, `nav`, `main`, `button`, lists, headings in order) — not generic `div`/`span` for structural or interactive elements.
- Make everything keyboard-operable: reachable in a logical tab order, with a visible focus indicator. Never `outline: none` without an equivalent replacement. Manage focus across multi-step flows and dialogs (no traps).
- Add appropriate ARIA roles/labels, and use `aria-live` for real-time (SSE-driven) balance and inbox updates so changes are announced.
- Never convey meaning by colour alone — pair colour with a text label or icon (e.g. request status badges).
- Provide text alternatives for all non-text content.
- Meet WCAG AA contrast: 4.5:1 normal text, 3:1 large text and UI components.
- Ensure layouts are responsive (Tailwind breakpoints) and usable at mobile, tablet, and desktop with no loss of functionality.

Treat new axe-core / automated WCAG AA violations as build failures, not warnings.
