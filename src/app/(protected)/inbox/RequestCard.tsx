'use client'

import { useRef, useState } from 'react'
import { Check, X, MailOpen } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { AmountDisplay, formatCents } from '@/components/ui/AmountDisplay'
import { Button } from '@/components/ui/button'
import { useBalanceStore } from '@/store/balance'
import { formatDateTime } from '@/lib/format'
import type { InboxRequestItem } from '@/lib/requests'
import { RequestLifecycleIndicator } from './RequestLifecycleIndicator'

export function RequestCard({ item }: { item: InboxRequestItem }) {
  const router = useRouter()
  const balanceCents = useBalanceStore((state) => state.balanceCents)
  const [isPaying, setIsPaying] = useState(false)
  const [isDeclining, setIsDeclining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const canPay = balanceCents >= item.amountCents
  const isActing = isPaying || isDeclining

  async function handleAction(action: 'pay' | 'decline') {
    setError(null)
    if (action === 'pay') setIsPaying(true)
    else setIsDeclining(true)

    try {
      const res = await fetch(`/api/requests/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg =
          data.code === 'INSUFFICIENT_BALANCE'
            ? `Insufficient balance — you have ${formatCents(balanceCents)}, this request is for ${formatCents(item.amountCents)}`
            : (data.error ?? 'Something went wrong. Please try again.')
        setError(msg)
        return
      }

      // Move focus to the section heading BEFORE router.refresh() unmounts this card.
      // Without this, the focused button is removed from the DOM and focus falls to <body>
      // — a WCAG 2.4.3 Focus Order violation (story 6.5, AC#2).
      const section = containerRef.current?.closest('section')
      const heading = section?.querySelector<HTMLElement>('h1, h2')
      if (heading) {
        heading.setAttribute('tabindex', '-1')
        heading.focus()
        heading.addEventListener('blur', () => heading.removeAttribute('tabindex'), { once: true })
      }

      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsPaying(false)
      setIsDeclining(false)
    }
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-3 rounded-lg border bg-card p-3 text-card-foreground">
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
            {formatDateTime(item.createdAt)}
          </time>
        </div>
      </div>

      <RequestLifecycleIndicator />

      {/* Balance gate message — explicit reason, never just a disabled state (UX-DR7) */}
      {!canPay && (
        <p className="text-xs text-destructive" role="alert">
          Insufficient balance — you have {formatCents(balanceCents)}, this request is for{' '}
          {formatCents(item.amountCents)}
        </p>
      )}

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!canPay || isActing}
          aria-disabled={!canPay || isActing}
          aria-busy={isPaying}
          onClick={() => handleAction('pay')}
        >
          <Check data-icon="inline-start" />
          {isPaying ? 'Paying…' : 'Pay'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isActing}
          aria-busy={isDeclining}
          onClick={() => handleAction('decline')}
        >
          <X data-icon="inline-start" />
          {isDeclining ? 'Declining…' : 'Decline'}
        </Button>
      </div>
    </div>
  )
}
