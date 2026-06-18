import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock must be hoisted before the module under test is imported
vi.mock('@/db/index', () => ({
  db: {
    transaction: vi.fn(),
  },
}))

// Story 3.3: sendMoney emits a BALANCE_UPDATED SSE event after commit. Mock the emitter
// so the unit suite can assert the emit contract without a real writer registry.
vi.mock('@/lib/sse-emitter', () => ({ emit: vi.fn() }))

import { sendMoney } from '@/lib/transactions'
import { db } from '@/db/index'
import { emit } from '@/lib/sse-emitter'

// The `tx` object handed to a db.transaction(callback) — i.e. the first parameter of the
// transaction callback, which is itself db.transaction's first parameter. Casting the
// minimal stub to this (rather than to the callback type) keeps tsc --noEmit clean.
type TxArg = Parameters<Parameters<typeof db.transaction>[0]>[0]

// Minimal tx stub whose FOR UPDATE read returns a sender (id 1, 500c) too poor to cover a
// 1000c send and a solvent recipient (id 2). Shared by the two INSUFFICIENT_BALANCE paths.
const insufficientBalanceTx = () =>
  ({
    execute: vi.fn().mockResolvedValue([
      { id: 1, balance_cents: 500 },
      { id: 2, balance_cents: 100000 },
    ]),
  }) as unknown as TxArg

beforeEach(() => {
  vi.clearAllMocks()
})

describe('sendMoney validation', () => {
  it('throws SELF_TRANSFER when senderId === recipientId', async () => {
    await expect(sendMoney(1, 1, 1000)).rejects.toMatchObject({
      code: 'SELF_TRANSFER',
    })
  })

  it('throws INVALID_AMOUNT when amountCents is 0', async () => {
    await expect(sendMoney(1, 2, 0)).rejects.toMatchObject({
      code: 'INVALID_AMOUNT',
    })
  })

  it('throws INVALID_AMOUNT when amountCents is negative', async () => {
    await expect(sendMoney(1, 2, -100)).rejects.toMatchObject({
      code: 'INVALID_AMOUNT',
    })
  })

  it('does not call db.transaction when SELF_TRANSFER guard fires', async () => {
    await sendMoney(1, 1, 1000).catch(() => {})
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('does not call db.transaction when INVALID_AMOUNT guard fires', async () => {
    await sendMoney(1, 2, 0).catch(() => {})
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('throws INSUFFICIENT_BALANCE when sender balance is less than amountCents', async () => {
    // sender.id=1, balance_cents=500; recipient.id=2; amountCents=1000
    vi.mocked(db.transaction).mockImplementationOnce((fn) => fn(insufficientBalanceTx()))
    await expect(sendMoney(1, 2, 1000)).rejects.toMatchObject({
      code: 'INSUFFICIENT_BALANCE',
    })
  })
})

describe('sendMoney SSE emit contract', () => {
  it('does not emit when the SELF_TRANSFER guard fires', async () => {
    await sendMoney(1, 1, 1000).catch(() => {})
    expect(emit).not.toHaveBeenCalled()
  })

  it('does not emit when the INVALID_AMOUNT guard fires', async () => {
    await sendMoney(1, 2, 0).catch(() => {})
    expect(emit).not.toHaveBeenCalled()
  })

  it('does not emit when INSUFFICIENT_BALANCE throws inside the transaction', async () => {
    vi.mocked(db.transaction).mockImplementationOnce((fn) => fn(insufficientBalanceTx()))
    await sendMoney(1, 2, 1000).catch(() => {})
    expect(emit).not.toHaveBeenCalled()
  })

  it('emits BALANCE_UPDATED exactly once with the recipient new balance after commit', async () => {
    const senderId = 1
    const recipientId = 2
    const amountCents = 25000
    const fakeTransaction = {
      id: 99,
      senderId,
      recipientId,
      amountCents,
      note: null,
      createdAt: new Date(),
    }

    // Chainable no-op for `tx.update(users).set({...}).where(...)` (awaited in the service).
    const updateChain = () => ({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    })

    vi.mocked(db.transaction).mockImplementationOnce((fn) =>
      fn({
        execute: vi.fn().mockResolvedValue([
          { id: senderId, balance_cents: 100000 },
          { id: recipientId, balance_cents: 50000 },
        ]),
        update: vi.fn().mockImplementation(updateChain),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([fakeTransaction]),
          }),
        }),
      } as unknown as TxArg)
    )

    const result = await sendMoney(senderId, recipientId, amountCents)

    expect(result).toEqual(fakeTransaction)
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith(recipientId, {
      type: 'BALANCE_UPDATED',
      data: { balance: 75000 }, // recipient 50000 + amount 25000
    })
  })
})
