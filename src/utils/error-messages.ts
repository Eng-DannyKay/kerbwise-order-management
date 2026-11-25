import { ApiError } from '../services/api-error'

/** A plain-language sentence for staff. Never includes status codes or technical terms. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403)
      return 'The desk isn’t allowed to read orders. Ask whoever set it up to check its access key.'
    if (error.status === 429) return 'The orders service is busy right now.'
    if (error.status !== null && error.status >= 500) return 'The orders service has a problem at the moment.'
    if (error.status !== null && error.code === null) return 'The orders service couldn’t handle that request.'
    return error.message
  }
  return 'Something went wrong.'
}
