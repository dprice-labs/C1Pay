import { create } from 'zustand'

interface RequestState {
  pendingCount: number
  setPendingCount: (count: number) => void
}

export const useRequestStore = create<RequestState>()((set) => ({
  pendingCount: 0,
  setPendingCount: (count) => set({ pendingCount: count }),
}))
