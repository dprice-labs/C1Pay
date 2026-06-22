'use client'

import { ArrowDownLeft, ArrowUpRight, Inbox, ListOrdered } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useRequestStore } from "@/store/requests"
import { LiveBalance } from "./LiveBalance"

export default function HomePage() {
  const pendingCount = useRequestStore((state) => state.pendingCount)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <section
        aria-labelledby="balance-heading"
        className="flex min-h-48 flex-col justify-between gap-6 rounded-xl border bg-card p-6 text-card-foreground"
      >
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">Current balance</p>
          <h1 id="balance-heading" className="text-5xl font-semibold tracking-normal">
            <LiveBalance />
          </h1>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            size="lg"
            className="h-12 justify-start text-base"
            render={<Link href="/send" />}
            nativeButton={false}
          >
            <ArrowUpRight data-icon="inline-start" />
            Send
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-12 justify-start text-base"
            render={<Link href="/request" />}
            nativeButton={false}
          >
            <ArrowDownLeft data-icon="inline-start" />
            Request
          </Button>
        </div>
      </section>

      <section
        aria-labelledby="inbox-heading"
        className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4 text-card-foreground"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Inbox aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 id="inbox-heading" className="text-base font-medium">
              Inbox
            </h2>
            <p className="text-sm text-muted-foreground">Incoming requests</p>
          </div>
        </div>

        {pendingCount > 0 ? (
          <Badge aria-label={`${pendingCount} pending incoming requests`}>
            {pendingCount}
          </Badge>
        ) : null}
      </section>

      <Link
        href="/history"
        className="inline-flex items-center gap-2 self-start rounded-md text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ListOrdered aria-hidden="true" className="size-4" />
        View transaction history
      </Link>
    </div>
  )
}
