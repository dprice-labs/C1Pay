import { Badge } from '@/components/ui/badge'

/**
 * Status badge + 4-state lifecycle row, shared by RequestCard and OutgoingRequestCard —
 * the canonical, single representation of the request state machine (UX-DR3, UX-DR12).
 */
export function RequestLifecycleIndicator() {
  return (
    <div className="flex items-center gap-2">
      {/* Text label carries meaning — colour is supplementary only (UX-DR3) */}
      <Badge variant="secondary">PENDING</Badge>

      {/* 4-state lifecycle teaching artifact (UX-DR12) */}
      <div
        className="flex items-center gap-1 text-xs text-muted-foreground"
        aria-label="Request lifecycle: PENDING can become PAID, DECLINED, or CANCELLED"
      >
        <span className="font-medium text-foreground">PENDING</span>
        <span aria-hidden="true">→</span>
        <span>PAID</span>
        <span aria-hidden="true">|</span>
        <span>DECLINED</span>
        <span aria-hidden="true">|</span>
        <span>CANCELLED</span>
      </div>
    </div>
  )
}
