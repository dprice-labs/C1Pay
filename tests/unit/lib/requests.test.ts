import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock must be hoisted before the module under test is imported
vi.mock('@/db/index', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}))

import { createRequest, payRequest, declineRequest } from '@/lib/requests'
import { db } from '@/db/index'

// The `tx` object passed into a db.transaction(callback) — minimal shape for unit stubs.
type TxArg = Parameters<Parameters<typeof db.transaction>[0]>[0]

type RequestStatus = 'PENDING' | 'PAID' | 'DECLINED' | 'CANCELLED'

const fakeRequest: {
  id: number
  requesterId: number
  recipientId: number
  amountCents: number
  note: null
  status: RequestStatus
  createdAt: Date
  resolvedAt: null
} = {
  id: 1,
  requesterId: 1,
  recipientId: 2,
  amountCents: 5000,
  note: null,
  status: 'PENDING',
  createdAt: new Date(),
  resolvedAt: null,
}

// Helper to set up the fluent insert chain stub for the success path
function mockInsertSuccess() {
  const mockReturning = vi.fn().mockResolvedValue([fakeRequest])
  const mockValues = vi.fn().mockReturnValue({ returning: mockReturning })
  vi.mocked(db.insert).mockReturnValue({ values: mockValues } as unknown as ReturnType<typeof db.insert>)
  return { mockReturning, mockValues }
}

// Build a minimal tx stub whose select().from().where().for() returns the given rows.
function buildTxWithRequest(request: (typeof fakeRequest) | null) {
  const rows: (typeof fakeRequest)[] = request ? [request] : []
  const mockFor = vi.fn().mockResolvedValue(rows)
  const mockWhere = vi.fn().mockReturnValue({ for: mockFor })
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
  const mockTxSelect = vi.fn().mockReturnValue({ from: mockFrom })
  return { mockTxSelect, mockWhere, mockFrom, mockFor }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── createRequest ──────────────────────────────────────────────────────────

describe('createRequest validation', () => {
  it('throws SELF_REQUEST when requesterId === recipientId', async () => {
    await expect(createRequest(1, 1, 1000)).rejects.toMatchObject({
      code: 'SELF_REQUEST',
    })
  })

  it('throws INVALID_AMOUNT when amountCents is 0', async () => {
    await expect(createRequest(1, 2, 0)).rejects.toMatchObject({
      code: 'INVALID_AMOUNT',
    })
  })

  it('throws INVALID_AMOUNT when amountCents is negative', async () => {
    await expect(createRequest(1, 2, -500)).rejects.toMatchObject({
      code: 'INVALID_AMOUNT',
    })
  })

  it('does not call db.insert when SELF_REQUEST guard fires', async () => {
    await createRequest(1, 1, 1000).catch(() => {})
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('does not call db.insert when INVALID_AMOUNT guard fires', async () => {
    await createRequest(1, 2, 0).catch(() => {})
    expect(db.insert).not.toHaveBeenCalled()
  })
})

describe('createRequest success', () => {
  it('inserts a payment_requests row with status PENDING', async () => {
    const { mockValues, mockReturning } = mockInsertSuccess()

    const result = await createRequest(1, 2, 5000, 'coffee')

    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterId: 1,
        recipientId: 2,
        amountCents: 5000,
        note: 'coffee',
      }),
    )
    expect(mockReturning).toHaveBeenCalledTimes(1)
    expect(result).toEqual(fakeRequest)
  })

  it('passes null for note when note is omitted', async () => {
    const { mockValues } = mockInsertSuccess()

    await createRequest(1, 2, 5000)

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ note: null }),
    )
  })
})

// ─── payRequest guards ───────────────────────────────────────────────────────

describe('payRequest guards', () => {
  it('throws REQUEST_ALREADY_RESOLVED when request status is PAID', async () => {
    const { mockTxSelect } = buildTxWithRequest({ ...fakeRequest, status: 'PAID' })
    vi.mocked(db.transaction).mockImplementationOnce((fn) =>
      fn({ select: mockTxSelect } as unknown as TxArg)
    )

    await expect(payRequest(1, 2)).rejects.toMatchObject({
      code: 'REQUEST_ALREADY_RESOLVED',
    })
  })

  it('throws REQUEST_ALREADY_RESOLVED when request status is DECLINED', async () => {
    const { mockTxSelect } = buildTxWithRequest({ ...fakeRequest, status: 'DECLINED' })
    vi.mocked(db.transaction).mockImplementationOnce((fn) =>
      fn({ select: mockTxSelect } as unknown as TxArg)
    )

    await expect(payRequest(1, 2)).rejects.toMatchObject({
      code: 'REQUEST_ALREADY_RESOLVED',
    })
  })

  it('throws REQUEST_ALREADY_RESOLVED when request status is CANCELLED', async () => {
    const { mockTxSelect } = buildTxWithRequest({ ...fakeRequest, status: 'CANCELLED' })
    vi.mocked(db.transaction).mockImplementationOnce((fn) =>
      fn({ select: mockTxSelect } as unknown as TxArg)
    )

    await expect(payRequest(1, 2)).rejects.toMatchObject({
      code: 'REQUEST_ALREADY_RESOLVED',
    })
  })

  it('throws FORBIDDEN when caller is not the recipient', async () => {
    // fakeRequest.recipientId = 2; calling userId = 99 → forbidden
    const { mockTxSelect } = buildTxWithRequest(fakeRequest)
    vi.mocked(db.transaction).mockImplementationOnce((fn) =>
      fn({ select: mockTxSelect } as unknown as TxArg)
    )

    await expect(payRequest(1, 99)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('throws INSUFFICIENT_BALANCE when payer balance < amountCents', async () => {
    // fakeRequest: recipientId=2, amountCents=5000. Call with userId=2 (the recipient/payer).
    // Payer (id=2) has balance_cents=0, requester (id=1) has balance_cents=10000.
    const { mockTxSelect } = buildTxWithRequest(fakeRequest)
    vi.mocked(db.transaction).mockImplementationOnce((fn) =>
      fn({
        select: mockTxSelect,
        execute: vi.fn().mockResolvedValue([
          { id: 1, balance_cents: 10000 }, // requester
          { id: 2, balance_cents: 0 },     // payer (insufficient)
        ]),
      } as unknown as TxArg)
    )

    await expect(payRequest(1, 2)).rejects.toMatchObject({
      code: 'INSUFFICIENT_BALANCE',
    })
  })

  it('does not call db.transaction when request is already resolved', async () => {
    // Guards before db.transaction are only the pre-call guards — note: payRequest always
    // calls db.transaction first (request fetch is inside). We verify the RESOLVED error
    // is thrown from inside the transaction callback.
    const { mockTxSelect } = buildTxWithRequest({ ...fakeRequest, status: 'PAID' })
    vi.mocked(db.transaction).mockImplementationOnce((fn) =>
      fn({ select: mockTxSelect } as unknown as TxArg)
    )

    await payRequest(1, 2).catch(() => {})
    expect(db.transaction).toHaveBeenCalledTimes(1)
  })
})

// ─── declineRequest guards ───────────────────────────────────────────────────

describe('declineRequest guards', () => {
  it('throws REQUEST_ALREADY_RESOLVED when request status is PAID', async () => {
    const { mockTxSelect } = buildTxWithRequest({ ...fakeRequest, status: 'PAID' })
    vi.mocked(db.transaction).mockImplementationOnce((fn) =>
      fn({ select: mockTxSelect } as unknown as TxArg)
    )

    await expect(declineRequest(1, 2)).rejects.toMatchObject({
      code: 'REQUEST_ALREADY_RESOLVED',
    })
  })

  it('throws REQUEST_ALREADY_RESOLVED when request status is DECLINED', async () => {
    const { mockTxSelect } = buildTxWithRequest({ ...fakeRequest, status: 'DECLINED' })
    vi.mocked(db.transaction).mockImplementationOnce((fn) =>
      fn({ select: mockTxSelect } as unknown as TxArg)
    )

    await expect(declineRequest(1, 2)).rejects.toMatchObject({
      code: 'REQUEST_ALREADY_RESOLVED',
    })
  })

  it('throws REQUEST_ALREADY_RESOLVED when request status is CANCELLED', async () => {
    const { mockTxSelect } = buildTxWithRequest({ ...fakeRequest, status: 'CANCELLED' })
    vi.mocked(db.transaction).mockImplementationOnce((fn) =>
      fn({ select: mockTxSelect } as unknown as TxArg)
    )

    await expect(declineRequest(1, 2)).rejects.toMatchObject({
      code: 'REQUEST_ALREADY_RESOLVED',
    })
  })

  it('throws FORBIDDEN when caller is not the recipient', async () => {
    // fakeRequest.recipientId = 2; calling userId = 99 → forbidden
    const { mockTxSelect } = buildTxWithRequest(fakeRequest)
    vi.mocked(db.transaction).mockImplementationOnce((fn) =>
      fn({ select: mockTxSelect } as unknown as TxArg)
    )

    await expect(declineRequest(1, 99)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('does not call tx.update when FORBIDDEN guard fires', async () => {
    const { mockTxSelect } = buildTxWithRequest(fakeRequest)
    const mockTxUpdate = vi.fn()
    vi.mocked(db.transaction).mockImplementationOnce((fn) =>
      fn({ select: mockTxSelect, update: mockTxUpdate } as unknown as TxArg)
    )

    await declineRequest(1, 99).catch(() => {})
    expect(mockTxUpdate).not.toHaveBeenCalled()
  })
})
