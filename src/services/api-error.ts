export class ApiError extends Error {
  /** `null` when no response was received. */
  readonly status: number | null
  /** Error `code` from the response body, e.g. `stale`. */
  readonly code: string | null
  readonly body: unknown
  /** Seconds the server asked clients to wait, from a `Retry-After` header. */
  readonly retryAfterSeconds: number | null

  constructor(
    message: string,
    status: number | null,
    code: string | null = null,
    body: unknown = null,
    retryAfterSeconds: number | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.body = body
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export class FulfilmentNotAllowedError extends Error {
  constructor(orderNumber: number) {
    super(`Order ${orderNumber} has not been paid, so it cannot be fulfilled.`)
    this.name = 'FulfilmentNotAllowedError'
  }
}
