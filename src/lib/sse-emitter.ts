import { createLogger } from '@/lib/logger'
import type { SSEEvent } from '@/types'

const log = createLogger('sse-emitter')
const encoder = new TextEncoder()

declare global {
  // eslint-disable-next-line no-var
  var __sseWriters: Map<number, WritableStreamDefaultWriter> | undefined
}

const writers: Map<number, WritableStreamDefaultWriter> =
  globalThis.__sseWriters ?? (globalThis.__sseWriters = new Map())

export function register(userId: number, writer: WritableStreamDefaultWriter): void {
  const existing = writers.get(userId)
  if (existing) existing.close().catch(() => {})
  writers.set(userId, writer)
  log.info(`registered userId=${userId} (total=${writers.size})`)
}

// writer param enables identity-checked deletion: only removes the entry if it still
// points to this specific writer, preventing a late abort from evicting a newer connection.
export function deregister(userId: number, writer?: WritableStreamDefaultWriter): void {
  if (writer !== undefined && writers.get(userId) !== writer) return
  writers.delete(userId)
  log.info(`deregistered userId=${userId} (total=${writers.size})`)
}

export async function emit(userId: number, event: SSEEvent): Promise<void> {
  const writer = writers.get(userId)
  if (!writer) return
  try {
    const text = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
    await writer.write(encoder.encode(text))
  } catch {
    log.error(`write failed for userId=${userId} — deregistering`)
    deregister(userId, writer)
  }
}
