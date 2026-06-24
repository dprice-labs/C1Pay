import { describe, it, expect, afterEach, afterAll } from 'vitest'
import { db } from '@/db/index'
import { users } from '@/db/schema/users'
import { paymentRequests } from '@/db/schema/requests'
import { eq, or } from 'drizzle-orm'
import { createUser } from '@/lib/users'
import { createRequest, getInboxRequests } from '@/lib/requests'

const REQUESTER_USERNAME = '__req_test_requester__'
const RECIPIENT_USERNAME = '__req_test_recipient__'

afterAll(async () => {
  await globalThis._pgClient?.end()
  globalThis._pgClient = undefined
})

afterEach(async () => {
  // Must delete requests before users due to FK constraints
  const testUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.username, REQUESTER_USERNAME), eq(users.username, RECIPIENT_USERNAME)))

  for (const u of testUsers) {
    await db
      .delete(paymentRequests)
      .where(
        or(eq(paymentRequests.requesterId, u.id), eq(paymentRequests.recipientId, u.id)),
      )
  }

  await db
    .delete(users)
    .where(or(eq(users.username, REQUESTER_USERNAME), eq(users.username, RECIPIENT_USERNAME)))
})

describe('createRequest integration', () => {
  it('inserts a payment_requests row with status PENDING', async () => {
    const requester = await createUser(REQUESTER_USERNAME, 'pass')
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass')

    await createRequest(requester.id, recipient.id, 5000, 'coffee')

    const rows = await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.requesterId, requester.id))

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      requesterId: requester.id,
      recipientId: recipient.id,
      amountCents: 5000,
      note: 'coffee',
      status: 'PENDING',
      resolvedAt: null,
    })
  })

  it('inserts with null note when note is omitted', async () => {
    const requester = await createUser(REQUESTER_USERNAME, 'pass')
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass')

    await createRequest(requester.id, recipient.id, 10000)

    const rows = await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.requesterId, requester.id))

    expect(rows).toHaveLength(1)
    expect(rows[0]!.note).toBeNull()
    expect(rows[0]!.resolvedAt).toBeNull()
  })

  it('throws SELF_REQUEST and inserts no row', async () => {
    const requester = await createUser(REQUESTER_USERNAME, 'pass')

    await expect(createRequest(requester.id, requester.id, 5000)).rejects.toMatchObject({
      code: 'SELF_REQUEST',
    })

    const rows = await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.requesterId, requester.id))

    expect(rows).toHaveLength(0)
  })

  it('throws INVALID_AMOUNT for zero and negative amounts', async () => {
    const requester = await createUser(REQUESTER_USERNAME, 'pass')
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass')

    await expect(createRequest(requester.id, recipient.id, 0)).rejects.toMatchObject({
      code: 'INVALID_AMOUNT',
    })
    await expect(createRequest(requester.id, recipient.id, -100)).rejects.toMatchObject({
      code: 'INVALID_AMOUNT',
    })

    const rows = await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.requesterId, requester.id))

    expect(rows).toHaveLength(0)
  })
})

describe('getInboxRequests integration', () => {
  it('returns PENDING incoming requests with resolved requester username', async () => {
    const requester = await createUser(REQUESTER_USERNAME, 'pass')
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass')

    await createRequest(requester.id, recipient.id, 7500, 'lunch')

    const items = await getInboxRequests(recipient.id)

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      requesterUsername: REQUESTER_USERNAME,
      amountCents: 7500,
      note: 'lunch',
    })
    expect(items[0]!.id).toBeTypeOf('number')
    expect(items[0]!.createdAt).toBeInstanceOf(Date)
  })

  it('excludes outgoing requests (user is requester, not recipient)', async () => {
    const requester = await createUser(REQUESTER_USERNAME, 'pass')
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass')

    await createRequest(requester.id, recipient.id, 5000)

    const items = await getInboxRequests(requester.id)

    expect(items).toHaveLength(0)
  })

  it.each([
    ['PAID'],
    ['DECLINED'],
    ['CANCELLED'],
  ] as const)('excludes %s requests', async (status) => {
    const requester = await createUser(REQUESTER_USERNAME, 'pass')
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass')

    const req = await createRequest(requester.id, recipient.id, 3000)
    await db
      .update(paymentRequests)
      .set({ status })
      .where(eq(paymentRequests.id, req.id))

    const items = await getInboxRequests(recipient.id)

    expect(items).toHaveLength(0)
  })

  it('returns empty array when no pending requests exist', async () => {
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass')

    const items = await getInboxRequests(recipient.id)

    expect(items).toHaveLength(0)
  })
})
