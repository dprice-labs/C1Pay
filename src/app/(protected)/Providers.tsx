'use client'

import { useRef } from 'react'
import { useBalanceStore } from '@/store/balance'
import { useRequestStore } from '@/store/requests'
import { useSSE } from '@/hooks/use-sse'

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

  useSSE()

  return <>{children}</>
}
