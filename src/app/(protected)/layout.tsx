import { getAuthUser } from '@/lib/auth'
import LogoutButton from './LogoutButton'

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  await getAuthUser()

  return (
    <>
      <header className="flex items-center justify-between gap-4 border-b p-4">
        <span className="font-semibold">C1Pay</span>
        <LogoutButton />
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4">{children}</main>
    </>
  )
}
