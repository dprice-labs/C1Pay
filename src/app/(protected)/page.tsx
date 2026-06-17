'use client'

import { ArrowDownLeft, ArrowUpRight, Inbox } from "lucide-react"
import Link from "next/link"
import { AmountDisplay } from "@/components/ui/AmountDisplay"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useBalanceStore } from "@/store/balance"
import { useRequestStore } from "@/store/requests"

export default function HomePage() {
  const balanceCents = useBalanceStore((state) => state.balanceCents)
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
            <AmountDisplay cents={balanceCents} />
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
          <Button variant="outline" size="lg" className="h-12 justify-start text-base">
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
    </div>
  )
}
