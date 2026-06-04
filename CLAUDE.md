# C1Pay

## UI Component Library

This project uses **shadcn/ui with Base UI primitives** (`@base-ui/react`) — not Radix UI. The style is `base-nova`.

Rules for all agents building any UI:

- **Always use shadcn components** before writing custom markup. Run `npx shadcn@latest search` to find what's available, then `npx shadcn@latest add <component>` to install.
- **Never use `@radix-ui/*` packages.** The project uses `@base-ui/react`. Component APIs differ — use `render` prop instead of `asChild`, etc. See [`CLAUDE.md`-level rules in `.claude/skills/shadcn/rules/base-vs-radix.md`](./rules/base-vs-radix.md).
- **Imports:** UI components live at `@/components/ui/<component>`. Utils at `@/lib/utils` (exports `cn()`).
- **Icons:** Use `lucide-react` (configured `iconLibrary`). Use `data-icon` on icons inside `Button`, no manual sizing classes.
- **Styling:** Use semantic Tailwind tokens (`bg-primary`, `text-muted-foreground`). Never raw colors (`bg-blue-500`). Use `cn()` for conditional classes.
- **Forms:** Use `FieldGroup` + `Field` for form layout. Never raw `div` + `Label`. Validation: `data-invalid` on `Field`, `aria-invalid` on the input.
- **Spacing:** Use `flex` + `gap-*`. Never `space-x-*` or `space-y-*`.
- **Equal dimensions:** `size-4`, not `w-4 h-4`.
- **No manual dark mode overrides.** Semantic tokens handle it automatically.

When adding a new component, always run `npx shadcn@latest docs <component>` and fetch the returned URLs before writing any code.

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
