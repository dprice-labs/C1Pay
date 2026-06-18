import { describe, it, expect, afterEach, afterAll } from 'vitest'
import { db } from '@/db/index'
import { users } from '@/db/schema/users'
import { transactions } from '@/db/schema/transactions'
import { eq, or } from 'drizzle-orm'
import { createUser } from '@/lib/users'
import { sendMoney } from '@/lib/transactions'
import { register, deregister } from '@/lib/sse-emitter'

const SENDER_USERNAME = '__tx_test_sender__'
const RECIPIENT_USERNAME = '__tx_test_recipient__'

afterAll(async () => {
  await globalThis._pgClient?.end()
  globalThis._pgClient = undefined
})

afterEach(async () => {
  const testUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.username, SENDER_USERNAME), eq(users.username, RECIPIENT_USERNAME)))

  for (const u of testUsers) {
    await db
      .delete(transactions)
      .where(or(eq(transactions.senderId, u.id), eq(transactions.recipientId, u.id)))
  }

  await db
    .delete(users)
    .where(or(eq(users.username, SENDER_USERNAME), eq(users.username, RECIPIENT_USERNAME)))
})

describe('sendMoney integration', () => {
  it('transfers funds atomically and inserts one transactions row', async () => {
    const sender = await createUser(SENDER_USERNAME, 'pass')
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass')

    const tx = await sendMoney(sender.id, recipient.id, 25000, 'for lunch')

    expect(tx.senderId).toBe(sender.id)
    expect(tx.recipientId).toBe(recipient.id)
    expect(tx.amountCents).toBe(25000)
    expect(tx.note).toBe('for lunch')

    const [senderRow] = await db.select().from(users).where(eq(users.id, sender.id))
    const [recipientRow] = await db.select().from(users).where(eq(users.id, recipient.id))

    expect(senderRow!.balanceCents).toBe(75000)   // 100000 - 25000
    expect(recipientRow!.balanceCents).toBe(125000) // 100000 + 25000
  })

  it('works without an optional note', async () => {
    const sender = await createUser(SENDER_USERNAME, 'pass')
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass')

    const tx = await sendMoney(sender.id, recipient.id, 1000)

    expect(tx.note).toBeNull()
  })

  it('throws INSUFFICIENT_BALANCE and leaves balances unchanged', async () => {
    const sender = await createUser(SENDER_USERNAME, 'pass')
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass')

    await expect(sendMoney(sender.id, recipient.id, 200000)).rejects.toMatchObject({
      code: 'INSUFFICIENT_BALANCE',
    })

    const [senderRow] = await db.select().from(users).where(eq(users.id, sender.id))
    const [recipientRow] = await db.select().from(users).where(eq(users.id, recipient.id))

    expect(senderRow!.balanceCents).toBe(100000)
    expect(recipientRow!.balanceCents).toBe(100000)

    const txRows = await db
      .select()
      .from(transactions)
      .where(or(eq(transactions.senderId, sender.id), eq(transactions.recipientId, recipient.id)))
    expect(txRows).toHaveLength(0)
  })

  it('emits BALANCE_UPDATED with the recipient new balance after commit', async () => {
    const sender = await createUser(SENDER_USERNAME, 'pass')
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass')

    // Register a real writer for the recipient so emit() delivers to a live stream.
    const stream = new TransformStream<Uint8Array, Uint8Array>()
    const writer = stream.writable.getWriter()
    const reader = stream.readable.getReader()
    register(recipient.id, writer)

    try {
      // Start reading BEFORE the emit fires. A TransformStream begins with backpressure
      // on, so emit()'s awaited write only resolves once the readable side is being
      // pulled — exactly as the live SSE response is consumed in production. Reading
      // sequentially after the write would deadlock.
      const framePromise = reader.read()

      // The emit happens only after COMMIT (AC #2); receiving a frame proves it fired.
      await sendMoney(sender.id, recipient.id, 25000)

      const { value } = await framePromise
      const frame = new TextDecoder().decode(value)

      expect(frame).toContain('event: BALANCE_UPDATED')
      expect(frame).toContain('"balance":125000') // 100000 + 25000
    } finally {
      deregister(recipient.id, writer)
      await reader.cancel().catch(() => {})
    }
  })

  it('serialises concurrent sends — balance never goes negative', async () => {
    const sender = await createUser(SENDER_USERNAME, 'pass')
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass')

    // Sender has $1000; two concurrent $600 sends — only one must succeed
    const results = await Promise.allSettled([
      sendMoney(sender.id, recipient.id, 60000),
      sendMoney(sender.id, recipient.id, 60000),
    ])

    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    expect(succeeded).toBe(1)
    expect(failed).toBe(1)

    const [senderRow] = await db.select().from(users).where(eq(users.id, sender.id))
    expect(senderRow!.balanceCents).toBeGreaterThanOrEqual(0)
    expect(senderRow!.balanceCents).toBe(40000) // 100000 - 60000
  })
})
