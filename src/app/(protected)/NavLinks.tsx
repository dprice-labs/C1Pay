'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Home' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/history', label: 'History' },
]

export function NavLinks() {
  const pathname = usePathname()

  return (
    <nav aria-label="Site navigation">
      <ul className="flex items-center gap-4 text-sm">
        {links.map(({ href, label }) => {
          const isCurrent = pathname === href
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isCurrent ? 'page' : undefined}
                className={`rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
