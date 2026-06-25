import Link from 'next/link'
import { getAuthUser } from '@/lib/auth'
import { getUserById } from '@/lib/users'
import { getInboxRequests } from '@/lib/requests'
import LogoutButton from './LogoutButton'
import Providers from './Providers'
import { NavLinks } from './NavLinks'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await getAuthUser()
  const [user, inboxItems] = await Promise.all([getUserById(userId), getInboxRequests(userId)])
  const initialPendingCount = inboxItems.length

  return (
    <Providers initialBalance={user.balanceCents} initialPendingCount={initialPendingCount}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-sm focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:outline-2 focus:outline-ring"
      >
        Skip to content
      </a>
      <header className="flex items-center justify-between gap-4 border-b p-4">
        <Link href="/" className="font-semibold hover:text-foreground/80">C1Pay</Link>
        <NavLinks />
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground" aria-label={`Signed in as ${user.username}`}>
            @{user.username}
          </span>
          <LogoutButton />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col gap-4 p-4">{children}</main>
    </Providers>
  )
}
