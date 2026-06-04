<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:ui-component-rules -->
# UI components: shadcn/ui — Base UI variant

This project uses **shadcn/ui with Base UI primitives** (`@base-ui/react`), style `base-nova`. Radix UI is NOT used.

## Non-negotiable rules

1. **Use shadcn before custom markup.** `npx shadcn@latest search` → `npx shadcn@latest add <component>`.
2. **No `@radix-ui/*` imports ever.** The primitive library is `@base-ui/react`. APIs differ significantly.
3. **Component API: `render` not `asChild`.** Base UI uses `render` prop for custom triggers and polymorphism.
4. **UI imports:** `@/components/ui/<component>`. Utils: `@/lib/utils` (`cn()`).
5. **Icons:** `lucide-react`. Put `data-icon="inline-start"` or `data-icon="inline-end"` on icons in `Button`. No manual `size-4` on icons inside components.
6. **Forms:** `FieldGroup` + `Field` for layout. `data-invalid` on `Field`, `aria-invalid` on the control.
7. **Spacing:** `flex gap-*` only. No `space-x-*` / `space-y-*`.
8. **Colors:** Semantic tokens only (`bg-primary`, `text-muted-foreground`). No raw Tailwind colors (`bg-blue-500`).
9. **Dark mode:** Never write manual `dark:` color overrides. Semantic tokens handle it.
10. **Before writing a component:** Run `npx shadcn@latest docs <component>` and fetch the returned doc URL.

## Key component aliases

| Need | Component |
|---|---|
| Form layout | `FieldGroup` + `Field` + `FieldLabel` + `FieldDescription` |
| Text input | `Input` |
| Button | `Button` (variant: `default`, `outline`, `ghost`, `destructive`, `link`) |
| Toggle choices (2–7) | `ToggleGroup` + `ToggleGroupItem` |
| Error/info callout | `Alert` |
| Loading placeholder | `Skeleton` |
| Status label | `Badge` |
| Modal | `Dialog` (requires `DialogTitle`) |
| Toast notification | `sonner` → `toast()` |
<!-- END:ui-component-rules -->
