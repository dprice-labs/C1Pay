import { describe, it, expect, beforeEach } from 'vitest'
import { useBalanceStore } from '@/store/balance'

describe('useBalanceStore', () => {
  beforeEach(() => {
    useBalanceStore.setState({ balanceCents: 0 })
  })

  it('setBalance updates balanceCents', () => {
    useBalanceStore.getState().setBalance(5000)
    expect(useBalanceStore.getState().balanceCents).toBe(5000)
  })

  it('setBalance correctly stores zero', () => {
    useBalanceStore.getState().setBalance(9999)
    useBalanceStore.getState().setBalance(0)
    expect(useBalanceStore.getState().balanceCents).toBe(0)
  })
})
