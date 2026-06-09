'use client'

import { useRef } from 'react'
import { useBalanceStore } from '@/store/balance'
import { useRequestStore } from '@/store/requests'
// Story 2.3: import { useSSE } from '@/hooks/use-sse' and call useSSE() here
// This hook opens an EventSource to /api/sse and dispatches BALANCE_UPDATED /
// REQUEST_RECEIVED / REQUEST_RESOLVED events to the Zustand stores above.

interface ProvidersProps {
  children: React.ReactNode
  initialBalance: number
  initialPendingCount: number
}

export default function Providers({ children, initialBalance, initialPendingCount }: ProvidersProps) {
  const seeded = useRef<true | null>(null)
  if (seeded.current === null) {
    useBalanceStore.getState().setBalance(initialBalance)
    useRequestStore.getState().setPendingCount(initialPendingCount)
    seeded.current = true
  }

  return <>{children}</>
}
