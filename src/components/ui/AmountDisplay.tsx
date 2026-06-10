import { cn } from "@/lib/utils"

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

export function formatCents(cents: number): string {
  return usdFormatter.format(cents / 100)
}

function AmountDisplay({
  cents,
  className,
  ...props
}: React.ComponentProps<"span"> & { cents: number }) {
  return (
    <span className={cn("tabular-nums", className)} {...props}>
      {formatCents(cents)}
    </span>
  )
}

export { AmountDisplay }
