import { getAuthUser } from '@/lib/auth'
import { searchUsers } from '@/lib/users'
import { errorResponse, AppError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'

const log = createLogger('users-search')

export async function GET(request: Request) {
  let userId: number
  try {
    ;({ userId } = await getAuthUser())
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
    log.error(`unexpected error in getAuthUser (GET /api/users/search): ${err instanceof Error ? err.message : String(err)}`)
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
  }

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()

  if (q.length < 1) {
    return Response.json([])
  }

  try {
    const results = await searchUsers(q, userId)
    log.info(`search q="${q}" userId=${userId} → ${results.length} results`)
    return Response.json(results)
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
    log.error(
      `unexpected error in GET /api/users/search: ${err instanceof Error ? err.message : String(err)}`,
    )
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
  }
}
