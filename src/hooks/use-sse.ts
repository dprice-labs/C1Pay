'use client'

import { useEffect } from 'react'
import { useBalanceStore } from '@/store/balance'
import { useRequestStore } from '@/store/requests'

export function useSSE(): void {
  useEffect(() => {
    let cancelled = false
    const source = new EventSource('/api/sse')

    source.addEventListener('BALANCE_UPDATED', (e: MessageEvent) => {
      try {
        const { balance } = JSON.parse(e.data) as { balance: number }
        useBalanceStore.getState().setBalance(balance)
      } catch {
        // malformed event data — skip
      }
    })

    source.addEventListener('REQUEST_RECEIVED', () => {
      const { pendingCount } = useRequestStore.getState()
      useRequestStore.getState().setPendingCount(pendingCount + 1)
    })

    source.addEventListener('REQUEST_RESOLVED', () => {
      const { pendingCount } = useRequestStore.getState()
      useRequestStore.getState().setPendingCount(Math.max(0, pendingCount - 1))
    })

    // Intentional deviation from FR29: close after 3 consecutive errors to prevent
    // hammering /api/sse with 401s on expired sessions. Native EventSource would retry
    // forever. Resets on successful open (transient errors don't accumulate).
    let errorStreak = 0
    source.onerror = () => { if (++errorStreak >= 3) source.close() }

    // On every (re)connect, reconcile against the authoritative balance. The in-memory SSE
    // emitter has no replay, so a BALANCE_UPDATED pushed while this stream was momentarily
    // disconnected would otherwise be lost and leave the balance stale until a full reload.
    source.addEventListener('open', () => {
      errorStreak = 0
      fetch('/api/balance')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('balance fetch failed'))))
        .then(({ balanceCents }: { balanceCents: number }) => {
          if (!cancelled) useBalanceStore.getState().setBalance(balanceCents)
        })
        .catch(() => {
          // transient — the next reconnect or a BALANCE_UPDATED event will reconcile
        })
    })

    return () => {
      cancelled = true
      source.close()
    }
  }, [])
}
