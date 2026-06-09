import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/store/auth'

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null })
  })

  it('setUser updates user state', () => {
    useAuthStore.getState().setUser({ id: 1, username: 'alice' })
    expect(useAuthStore.getState().user).toEqual({ id: 1, username: 'alice' })
  })

  it('clearUser resets user to null', () => {
    useAuthStore.getState().setUser({ id: 1, username: 'alice' })
    useAuthStore.getState().clearUser()
    expect(useAuthStore.getState().user).toBeNull()
  })
})
