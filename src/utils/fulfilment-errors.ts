import { ApiError, FulfilmentNotAllowedError } from '../services/api-error'
import { readConflictOrder } from '../services/order-parsers'
import type { OrderDetail } from '../types/order.types'
import { getErrorMessage } from './error-messages'
import { ORDER_STATUS_LABELS } from './order-labels'

/**
 * What a failed fulfilment request tells us.
 * - `refused`: the server answered and did not change the order (409, 422, other 4xx).
 * - `conflict`: someone else changed it first; `latestOrder` is the server's copy when it sent one.
 * - `gone`: the order no longer exists.
 * - `rate_limited`: rejected before processing; nothing changed.
 * - `unknown_outcome`: no readable answer (network, timeout, 5xx, unreadable reply), so it may have been applied.
 */
export type FulfilmentFailure =
  | { kind: 'not_allowed'; message: string }
  | { kind: 'refused' | 'gone' | 'rate_limited' | 'unknown_outcome'; cause: string }
  | { kind: 'conflict'; latestOrder: OrderDetail | null }

export function classifyFulfilmentFailure(error: unknown): FulfilmentFailure {
  if (error instanceof FulfilmentNotAllowedError) return { kind: 'not_allowed', message: error.message }
  const cause = getErrorMessage(error)
  if (!(error instanceof ApiError) || error.status === null || error.status >= 500) return { kind: 'unknown_outcome', cause }
  if (error.code === 'invalid_json') return { kind: 'unknown_outcome', cause }
  if (error.status === 409 && error.code === 'stale') return { kind: 'conflict', latestOrder: readConflictOrder(error.body) }
  if (error.status === 404) return { kind: 'gone', cause }
  if (error.status === 429) return { kind: 'rate_limited', cause }
  return { kind: 'refused', cause: 'The orders service refused the change.' }
}

export interface FulfilmentResult {
  tone: 'success' | 'info' | 'danger'
  title: string
  detail?: string
  /** Offer to check the order again because its status could not be confirmed. */
  canCheckAgain?: boolean
}

function statusName(order: OrderDetail): string {
  return ORDER_STATUS_LABELS[order.status].toLowerCase()
}

/**
 * Describes a failed fulfilment using the order's confirmed status, so the message never contradicts what the
 * server reports. `latest` is the order fetched after the failure, or `null` if that check also failed.
 */
export function describeFulfilmentFailure(
  failure: Exclude<FulfilmentFailure, { kind: 'not_allowed' }>,
  orderNumber: number,
  latest: OrderDetail | null,
): FulfilmentResult {
  const name = `Order #${orderNumber}`

  if (failure.kind === 'gone') {
    return { tone: 'danger', title: `${name} no longer exists`, detail: 'It may have been removed. Nothing was changed.' }
  }
  if (failure.kind === 'rate_limited') {
    return {
      tone: 'danger',
      title: `${name} was not fulfilled`,
      detail: 'The orders service is busy right now. Nothing changed. Wait a moment, then try again.',
    }
  }

  if (latest === null) {
    if (failure.kind === 'unknown_outcome') {
      return {
        tone: 'danger',
        title: `We couldn’t confirm whether ${name} was fulfilled`,
        detail: 'Check its status before packing it or trying again.',
        canCheckAgain: true,
      }
    }
    const reason = failure.kind === 'conflict' ? 'Someone else changed it while you had it open.' : failure.cause
    return { tone: 'danger', title: `${name} was not fulfilled`, detail: `${reason} Its latest status couldn’t be loaded.` }
  }

  if (latest.status === 'fulfilled') {
    if (failure.kind === 'unknown_outcome') {
      return {
        tone: 'success',
        title: `${name} is fulfilled`,
        detail: 'The server was slow to confirm, so the desk checked: the order is now fulfilled.',
      }
    }
    return { tone: 'info', title: `${name} was already fulfilled by someone else` }
  }

  if (latest.status !== 'paid') {
    const who = failure.kind === 'conflict' ? 'Someone else changed it: it' : 'It'
    return { tone: 'info', title: `${name} can’t be fulfilled`, detail: `${who} is now ${statusName(latest)}.` }
  }

  if (failure.kind === 'conflict') {
    return {
      tone: 'info',
      title: `Someone else changed ${name} while you had it open`,
      detail: 'Its latest details are shown. Check them, then try again.',
    }
  }
  return { tone: 'danger', title: `${name} was not fulfilled`, detail: `${failure.cause} Nothing changed, so you can try again.` }
}
