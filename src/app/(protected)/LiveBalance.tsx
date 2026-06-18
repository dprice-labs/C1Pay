'use client'

import { useEffect, useRef, useState } from 'react'
import { AmountDisplay } from '@/components/ui/AmountDisplay'
import { useBalanceStore } from '@/store/balance'
import { cn } from '@/lib/utils'

/**
 * Home-route wrapper around the shared, static `AmountDisplay`. Subscribes to the balance
 * store and, when the value changes (e.g. via an SSE BALANCE_UPDATED push), briefly
 * highlights the number so the live update draws the eye (UX-DR6, AC #4).
 *
 * a11y: `aria-live="polite"` + `aria-atomic="true"` announce the new balance to screen
 * readers. The emphasis is gated behind `motion-safe:` so users who request reduced motion
 * see no flashing, and colour is never the only signal — the number itself changes.
 */
export function LiveBalance({ className }: { className?: string }) {
  const balanceCents = useBalanceStore((s) => s.balanceCents)
  const prev = useRef(balanceCents)
  const [highlight, setHighlight] = useState(false)

  useEffect(() => {
    if (balanceCents === prev.current) return
    prev.current = balanceCents
    setHighlight(true)
    const t = setTimeout(() => setHighlight(false), 1000)
    return () => clearTimeout(t)
  }, [balanceCents])

  return (
    <span
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'inline-block transition-colors duration-500 motion-reduce:transition-none',
        highlight && 'motion-safe:animate-pulse text-primary',
        className,
      )}
    >
      <AmountDisplay cents={balanceCents} />
    </span>
  )
}
