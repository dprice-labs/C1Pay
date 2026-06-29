'use client'

import { useRequestStore } from '@/store/requests'

/**
 * Persistent aria-live region for the SSE-driven pending request count. Lives in the protected
 * layout so REQUEST_RECEIVED / REQUEST_RESOLVED announcements reach screen readers on every
 * protected route, not only while the home page is mounted (FR31, 6.1 AC, UX-DR11, story 6.5 AC#5).
 */
export function PendingCountAnnouncer() {
  const pendingCount = useRequestStore((state) => state.pendingCount)

  return (
    <span aria-live="polite" aria-atomic="true" className="sr-only">
      {pendingCount > 0
        ? `${pendingCount} pending request${pendingCount !== 1 ? 's' : ''}`
        : 'No pending requests'}
    </span>
  )
}
