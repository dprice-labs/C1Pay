import { getAuthUser } from '@/lib/auth'
import { getInboxRequests } from '@/lib/requests'
import { RequestCard } from './RequestCard'

export default async function InboxPage() {
  const { userId } = await getAuthUser()
  const items = await getInboxRequests(userId)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <h1 className="text-2xl font-semibold">Inbox</h1>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending requests.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <RequestCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
