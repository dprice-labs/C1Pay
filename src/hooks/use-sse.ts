'use client'

import { useEffect } from 'react'
import { useBalanceStore } from '@/store/balance'
import { useRequestStore } from '@/store/requests'

export function useSSE(): void {
  useEffect(() => {
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
      useRequestStore.setState(s => ({ pendingCount: s.pendingCount + 1 }))
    })

    source.addEventListener('REQUEST_RESOLVED', () => {
      useRequestStore.setState(s => ({ pendingCount: Math.max(0, s.pendingCount - 1) }))
    })

    // Close after 3 consecutive errors to prevent hammering the server on permanent
    // failures (e.g. expired session returning 401). Resets on successful open.
    let errorStreak = 0
    source.onerror = () => { if (++errorStreak >= 3) source.close() }
    source.addEventListener('open', () => { errorStreak = 0 })

    return () => source.close()
  }, [])
}
