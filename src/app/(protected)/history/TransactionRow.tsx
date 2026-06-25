import { ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { AmountDisplay } from '@/components/ui/AmountDisplay'
import type { TransactionHistoryItem } from '@/lib/transactions'

const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

// Presentational, no interactivity → a Server Component is fine (no 'use client').
export function TransactionRow({ item }: { item: TransactionHistoryItem }) {
  const sent = item.direction === 'sent'
  const Icon = sent ? ArrowUpRight : ArrowDownLeft
  // The visible text label carries the meaning — direction is never colour alone (NFR15 / UX-DR3).
  const label = sent ? 'Sent' : 'Received'

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-card p-3 text-card-foreground">
      {/* min-w-0 lets the identity column shrink below its content so `truncate` can ellipsise
          a long username instead of overflowing the row (flex children default to min-width:auto). */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon aria-hidden="true" className="size-4" />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium">{item.counterpartyUsername}</span>
          <span className="truncate text-xs text-muted-foreground">
            {label} transaction
            {item.note ? ` · ${item.note}` : ''}
          </span>
        </div>
      </div>
      {/* shrink-0: the amount must never be the thing that gets clipped — money stays fully legible. */}
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <AmountDisplay cents={item.amountCents} className="font-medium" />
        <time dateTime={item.createdAt.toISOString()} className="text-xs text-muted-foreground">
          {dateFmt.format(item.createdAt)}
        </time>
      </div>
    </div>
  )
}
