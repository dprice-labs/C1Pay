import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock must be hoisted before the module under test is imported
vi.mock('@/db/index', () => ({
  db: {
    transaction: vi.fn(),
  },
}))

import { sendMoney } from '@/lib/transactions'
import { db } from '@/db/index'

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
    vi.mocked(db.transaction).mockImplementationOnce((fn) =>
      fn({
        execute: vi.fn().mockResolvedValue([
          { id: 1, balance_cents: 500 },
          { id: 2, balance_cents: 100000 },
        ]),
      } as unknown as Parameters<typeof db.transaction>[0])
    )
    await expect(sendMoney(1, 2, 1000)).rejects.toMatchObject({
      code: 'INSUFFICIENT_BALANCE',
    })
  })
})
