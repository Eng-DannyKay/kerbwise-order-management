import { ApiError, FulfilmentNotAllowedError } from '../services/api-error'
import { readConflictOrder, readTransitionFrom } from '../services/order-parsers'
import type { OrderDetail, OrderStatus } from '../types/order.types'
import { getErrorMessage } from './error-messages'
import { ORDER_STATUS_LABELS } from './order-labels'

export interface FulfilmentFailure {
  message: string
  /** The server's latest copy of the order, when the response included one. */
  latestOrder: OrderDetail | null
  /** True when the order must be fetched again because its real state is unknown. */
  shouldReload: boolean
}

function describeStatus(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status].toLowerCase()
}

function conflictMessage(orderNumber: number, latest: OrderDetail): string {
  if (latest.status === 'fulfilled') return `Order #${orderNumber} was already fulfilled by someone else.`
  if (latest.status === 'cancelled') return `Order #${orderNumber} was cancelled by someone else, so it can’t be fulfilled.`
  if (latest.status === 'paid')
    return `Someone else changed order #${orderNumber} while you had it open. Check the details, then try again.`
  return `Order #${orderNumber} is now ${describeStatus(latest.status)}, so it can’t be fulfilled.`
}

/** Turns a failed fulfilment into a message and what the UI must do to show the order's real state. */
export function describeFulfilmentFailure(error: unknown, orderNumber: number): FulfilmentFailure {
  if (error instanceof FulfilmentNotAllowedError) {
    return { message: error.message, latestOrder: null, shouldReload: false }
  }

  if (!(error instanceof ApiError)) {
    return { message: getErrorMessage(error), latestOrder: null, shouldReload: true }
  }

  if (error.status === 409 && error.code === 'stale') {
    const latest = readConflictOrder(error.body)
    if (latest) return { message: conflictMessage(orderNumber, latest), latestOrder: latest, shouldReload: false }
    return {
      message: `Someone else changed order #${orderNumber}. Its latest details have been loaded.`,
      latestOrder: null,
      shouldReload: true,
    }
  }

  if (error.status === 409 && error.code === 'invalid_transition') {
    const from = readTransitionFrom(error.body)
    const state = from ? ` because it is ${describeStatus(from)}` : ''
    return { message: `Order #${orderNumber} can’t be fulfilled${state}.`, latestOrder: null, shouldReload: true }
  }

  if (error.status === 404) {
    return { message: `Order #${orderNumber} no longer exists.`, latestOrder: null, shouldReload: false }
  }

  if (error.status === 422) {
    return {
      message: `The server rejected this change, so order #${orderNumber} was not fulfilled.`,
      latestOrder: null,
      shouldReload: true,
    }
  }

  if (error.status === 429) {
    return {
      message: 'Too many requests. Nothing was changed. Wait a moment and try again.',
      latestOrder: null,
      shouldReload: false,
    }
  }

  if (error.status === null) {
    return {
      message: `We couldn’t confirm whether order #${orderNumber} was fulfilled. Its latest status has been reloaded; check it before trying again.`,
      latestOrder: null,
      shouldReload: true,
    }
  }

  return {
    message: `Order #${orderNumber} could not be fulfilled (${getErrorMessage(error)}). Its latest status has been reloaded.`,
    latestOrder: null,
    shouldReload: true,
  }
}
