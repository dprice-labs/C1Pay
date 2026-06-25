import { MailOpen } from 'lucide-react'
import { AmountDisplay } from '@/components/ui/AmountDisplay'
import { Badge } from '@/components/ui/badge'
import type { InboxRequestItem } from '@/lib/requests'

const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

export function RequestCard({ item }: { item: InboxRequestItem }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 text-card-foreground">
      <div className="flex items-center justify-between gap-4">
        {/* min-w-0 on the identity column + its inner stack so `truncate` actually clips a long
            requester username (flex children default to min-width:auto and won't shrink otherwise). */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <MailOpen aria-hidden="true" className="size-4" />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium">{item.requesterUsername}</span>
            <span className="truncate text-xs text-muted-foreground">
              Payment request{item.note ? ` · ${item.note}` : ''}
            </span>
          </div>
        </div>
        {/* shrink-0: the amount stays fully legible — never the clipped element. */}
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <AmountDisplay cents={item.amountCents} className="font-medium" />
          <time dateTime={item.createdAt.toISOString()} className="text-xs text-muted-foreground">
            {dateFmt.format(item.createdAt)}
          </time>
        </div>
      </div>

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
    </div>
  )
}
