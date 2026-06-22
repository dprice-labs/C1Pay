import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock must be hoisted before the module under test is imported
vi.mock('@/db/index', () => ({
  db: {
    insert: vi.fn(),
  },
}))

import { createRequest } from '@/lib/requests'
import { db } from '@/db/index'

const fakeRequest = {
  id: 1,
  requesterId: 1,
  recipientId: 2,
  amountCents: 5000,
  note: null,
  status: 'PENDING' as const,
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

beforeEach(() => {
  vi.clearAllMocks()
})

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
