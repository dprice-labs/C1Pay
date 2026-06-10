import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { AmountDisplay, formatCents } from "@/components/ui/AmountDisplay"

describe("AmountDisplay", () => {
  it.each([
    [0, "$0.00"],
    [100000, "$1,000.00"],
    [12345, "$123.45"],
    [99, "$0.99"],
  ])("formats %i cents as %s", (cents, expected) => {
    expect(formatCents(cents)).toBe(expected)
  })

  it("renders the formatted amount", () => {
    const markup = renderToStaticMarkup(<AmountDisplay cents={2500} />)
    expect(markup).toContain("$25.00")
  })
})
