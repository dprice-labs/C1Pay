'use client'

import { useState } from 'react'
import { Send, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { AmountDisplay } from '@/components/ui/AmountDisplay'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/format'
import type { OutgoingRequestItem } from '@/lib/requests'
import { RequestLifecycleIndicator } from './RequestLifecycleIndicator'

export function OutgoingRequestCard({ item }: { item: OutgoingRequestItem }) {
  const router = useRouter()
  const [isCancelling, setIsCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCancel() {
    setError(null)
    setIsCancelling(true)

    try {
      const res = await fetch(`/api/requests/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong. Please try again.')
        setIsCancelling(false)
        return
      }

      // Leave isCancelling true (button stays disabled) — router.refresh() is about to
      // remove this card from the list once the server data re-fetches. Resetting it here
      // would re-enable the button for the brief window before that happens, letting a
      // fast double-click fire a second PATCH against an already-CANCELLED request.
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
      setIsCancelling(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 text-card-foreground">
      <div className="flex items-center justify-between gap-4">
        {/* min-w-0 on the identity column + its inner stack so `truncate` actually clips a long
            recipient username (flex children default to min-width:auto and won't shrink otherwise). */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Send aria-hidden="true" className="size-4" />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium">{item.recipientUsername}</span>
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

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={isCancelling}
          aria-busy={isCancelling}
          onClick={handleCancel}
        >
          <X data-icon="inline-start" />
          {isCancelling ? 'Cancelling…' : 'Cancel'}
        </Button>
      </div>
    </div>
  )
}
