export class AppError extends Error {
  code: string
  status: number

  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
  }
}

export function errorResponse(message: string, code: string, status: number): Response {
  // Guard against an out-of-range status: Response.json throws RangeError for
  // anything outside 200-599, which would crash the handler. Fall back to 500.
  const safeStatus =
    Number.isInteger(status) && status >= 200 && status <= 599 ? status : 500
  return Response.json({ error: message, code }, { status: safeStatus })
}
