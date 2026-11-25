export class ApiError extends Error {
  /** `null` when no response was received. */
  readonly status: number | null
  /** Error `code` from the response body, e.g. `stale`. */
  readonly code: string | null
  readonly body: unknown

  constructor(message: string, status: number | null, code: string | null = null, body: unknown = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.body = body
  }
}

export class FulfilmentNotAllowedError extends Error {
  constructor(orderNumber: number) {
    super(`Order ${orderNumber} has not been paid, so it cannot be fulfilled.`)
    this.name = 'FulfilmentNotAllowedError'
  }
}
