import { getAuthUser } from '@/lib/auth'
import { getUserById } from '@/lib/users'
import { getInboxRequests } from '@/lib/requests'
import LogoutButton from './LogoutButton'
import Providers from './Providers'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await getAuthUser()
  const [user, inboxItems] = await Promise.all([getUserById(userId), getInboxRequests(userId)])
  const initialPendingCount = inboxItems.length

  return (
    <Providers initialBalance={user.balanceCents} initialPendingCount={initialPendingCount}>
      <header className="flex items-center justify-between gap-4 border-b p-4">
        <span className="font-semibold">C1Pay</span>
        <LogoutButton />
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4">{children}</main>
    </Providers>
  )
}
