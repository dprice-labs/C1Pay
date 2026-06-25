'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AmountDisplay } from '@/components/ui/AmountDisplay'
import { UserSearchInput } from '../send/UserSearchInput'
import type { CreateRequestInput } from '@/lib/schemas'

type Step = 1 | 2 | 3

interface Recipient {
  id: number
  username: string
}

// Postgres `integer` (int4) max — amount_cents cannot exceed this.
const MAX_AMOUNT_CENTS = 2_147_483_647

function parseDollarsToCents(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  const num = parseFloat(trimmed)
  if (!isFinite(num) || num <= 0) return null
  const cents = Math.round(num * 100)
  if (cents > MAX_AMOUNT_CENTS) return null
  return cents
}

export default function RequestPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [recipient, setRecipient] = useState<Recipient | null>(null)
  const [dollarInput, setDollarInput] = useState('')
  const [amountCents, setAmountCents] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [amountError, setAmountError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isInitialMount = useRef(true)
  const step1SectionRef = useRef<HTMLElement>(null)
  const step2AmountRef = useRef<HTMLInputElement>(null)
  const step3BackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    if (step === 1) {
      step1SectionRef.current?.querySelector<HTMLInputElement>('input')?.focus()
    } else if (step === 2) {
      step2AmountRef.current?.focus()
    } else if (step === 3) {
      step3BackRef.current?.querySelector('button')?.focus()
    }
  }, [step])

  function handleSelectRecipient(user: Recipient) {
    setRecipient(user)
    setStep(2)
  }

  function handleBackFromStep2() {
    setDollarInput('')
    setAmountCents(null)
    setNote('')
    setAmountError(null)
    setStep(1)
  }

  function handleAdvanceToStep3() {
    const cents = parseDollarsToCents(dollarInput)
    if (cents === null) {
      setAmountError('Enter a valid dollar amount (e.g. 25 or 25.50)')
      return
    }
    setAmountCents(cents)
    setAmountError(null)
    setStep(3)
  }

  function handleBackFromStep3() {
    setSubmitError(null)
    setStep(2)
  }

  async function handleConfirm() {
    if (!recipient || !amountCents || submitting) return
    setSubmitting(true)
    setSubmitError(null)

    const body: CreateRequestInput = {
      recipientId: recipient.id,
      amountCents,
      ...(note.trim() ? { note: note.trim() } : {}),
    }

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.status === 201) {
        // No balance update — no funds move until the recipient pays.
        router.push('/')
        return
      }

      const data: { error?: string; code?: string } = await res.json()
      setSubmitError(data.error ?? 'Something went wrong. Please try again.')
    } catch {
      setSubmitError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Request money</h1>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          Step {step} of 3
        </p>
      </header>

      {step === 1 && (
        <section ref={step1SectionRef} aria-labelledby="step1-heading" className="flex flex-col gap-4">
          <h2 id="step1-heading" className="sr-only">
            Step 1: Choose recipient
          </h2>
          <UserSearchInput onSelect={handleSelectRecipient} />
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => router.push('/')}
          >
            <ArrowLeft data-icon="inline-start" />
            Back to home
          </Button>
        </section>
      )}

      {step === 2 && recipient && (
        <section aria-labelledby="step2-heading" className="flex flex-col gap-4">
          <h2 id="step2-heading" className="sr-only">
            Step 2: Enter amount
          </h2>
          <p className="text-sm text-muted-foreground">
            Requesting from <strong>{recipient.username}</strong>
          </p>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              handleAdvanceToStep3()
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount-input">Amount (USD)</Label>
              <Input
                ref={step2AmountRef}
                id="amount-input"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={dollarInput}
                onChange={(e) => {
                  setDollarInput(e.target.value)
                  setAmountError(null)
                }}
                aria-describedby={amountError ? 'amount-error' : undefined}
                aria-invalid={amountError ? true : undefined}
              />
              {amountError && (
                <p id="amount-error" role="alert" className="text-sm text-destructive">
                  {amountError}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="note-input">Note (optional)</Label>
              <Input
                id="note-input"
                type="text"
                maxLength={500}
                placeholder="What's this for?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handleBackFromStep2}>
                <ArrowLeft data-icon="inline-start" />
                Back
              </Button>
              <Button type="submit">Continue</Button>
            </div>
          </form>
        </section>
      )}

      {step === 3 && recipient && amountCents !== null && (
        <section aria-labelledby="step3-heading" className="flex flex-col gap-4">
          <h2 id="step3-heading" className="sr-only">
            Step 3: Confirm request
          </h2>
          <div className="rounded-xl border bg-card p-4 text-card-foreground flex flex-col gap-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">From</span>
              <strong>{recipient.username}</strong>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <strong>
                <AmountDisplay cents={amountCents} />
              </strong>
            </div>
            {note.trim() && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Note</span>
                <span className="text-right max-w-xs">{note.trim()}</span>
              </div>
            )}
          </div>

          {submitError && (
            <p role="alert" className="text-sm text-destructive">
              {submitError}
            </p>
          )}

          <div className="flex gap-3">
            <div ref={step3BackRef}>
              <Button variant="outline" onClick={handleBackFromStep3} disabled={submitting}>
                <ArrowLeft data-icon="inline-start" />
                Back
              </Button>
            </div>
            <Button onClick={handleConfirm} disabled={submitting}>
              {submitting ? 'Requesting…' : 'Confirm & Request'}
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
