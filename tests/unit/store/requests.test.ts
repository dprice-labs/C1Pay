import { describe, it, expect, beforeEach } from 'vitest'
import { useRequestStore } from '@/store/requests'

describe('useRequestStore', () => {
  beforeEach(() => {
    useRequestStore.setState({ pendingCount: 0 })
  })

  it('setPendingCount updates pendingCount', () => {
    useRequestStore.getState().setPendingCount(3)
    expect(useRequestStore.getState().pendingCount).toBe(3)
  })

  it('setPendingCount correctly clears to zero', () => {
    useRequestStore.getState().setPendingCount(5)
    useRequestStore.getState().setPendingCount(0)
    expect(useRequestStore.getState().pendingCount).toBe(0)
  })
})
