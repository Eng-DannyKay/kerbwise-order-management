import { ApiError } from '../services/api-error'

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'The order desk is not authorised. Check the API token.'
    if (error.status === 429) return 'Too many requests. Wait a moment and try again.'
    if (error.status !== null && error.status >= 500) return 'The orders service is having problems. Try again shortly.'
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong. Try again.'
}
