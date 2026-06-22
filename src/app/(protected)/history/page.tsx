import { getAuthUser } from '@/lib/auth'
import { getTransactionHistory } from '@/lib/transactions'
import { TransactionRow } from './TransactionRow'

// Server Component (no 'use client'): it calls the service directly rather than
// fetching its own API route — a Server Component already runs on the server, so
// fetch('/api/transactions') would be a needless server→server hop. History is a
// static read (no SSE / no aria-live).
export default async function HistoryPage() {
  const { userId } = await getAuthUser()
  const items = await getTransactionHistory(userId)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      {/* NOT id="balance-heading" — that id is the home balance heading e2e selects. */}
      <h1 className="text-2xl font-semibold">Transaction history</h1>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No transactions yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <TransactionRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
