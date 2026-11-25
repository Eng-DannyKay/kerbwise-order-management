import { useEffect, useRef, useState } from 'react'
import { getOrder, updateOrderStatus } from '../services/orders-api'
import type { OrderDetail } from '../types/order.types'
import { getErrorMessage } from '../utils/error-messages'
import {
  classifyFulfilmentFailure,
  describeFulfilmentFailure,
  type FulfilmentFailure,
  type FulfilmentResult,
} from '../utils/fulfilment-errors'
import { ORDER_STATUS_LABELS } from '../utils/order-labels'
import { canFulfilOrder } from '../utils/order-rules'

export type FulfilmentState =
  | { kind: 'idle' }
  | { kind: 'refreshing' }
  | { kind: 'confirming' }
  | { kind: 'submitting' }
  | { kind: 'checking' }
  | { kind: 'blocked' }
  | { kind: 'fulfilled' }
  | { kind: 'result'; result: FulfilmentResult }

interface FulfilmentCallbacks {
  /** Shows the server's copy of the order. */
  onOrderChange: (order: OrderDetail) => void
  /** Refreshes the orders list after the server reports a change. */
  onOrdersChanged: () => void
  /** The order has gone; the panel should load it again to show that. */
  onOrderGone: () => void
  /** The server confirmed the order is fulfilled. */
  onFulfilled: (result: FulfilmentResult) => void
}

/**
 * Runs fulfilment for one order. The order is fetched again before the confirmation opens and after any failure,
 * so what staff see always matches the server. The PATCH itself is never retried automatically.
 */
export function useFulfilment(order: OrderDetail, callbacks: FulfilmentCallbacks) {
  const [state, setState] = useState<FulfilmentState>({ kind: 'idle' })
  const busyRef = useRef(false)
  const mountedRef = useRef(true)
  const callbacksRef = useRef(callbacks)

  useEffect(() => {
    callbacksRef.current = callbacks
  })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const update = (next: FulfilmentState) => {
    if (mountedRef.current) setState(next)
  }

  const finish = (result: FulfilmentResult) => {
    if (result.tone !== 'success') {
      update({ kind: 'result', result })
      return
    }
    callbacksRef.current.onFulfilled(result)
    update({ kind: 'fulfilled' })
  }

  async function fetchLatest(): Promise<OrderDetail | null> {
    try {
      const latest = await getOrder(order.id)
      callbacksRef.current.onOrderChange(latest)
      return latest
    } catch {
      return null
    }
  }

  async function run(task: () => Promise<void>) {
    if (busyRef.current) return
    busyRef.current = true
    try {
      await task()
    } finally {
      busyRef.current = false
    }
  }

  const start = () =>
    run(async () => {
      if (!canFulfilOrder(order)) {
        update({ kind: 'blocked' })
        return
      }
      update({ kind: 'refreshing' })
      let latest: OrderDetail
      try {
        latest = await getOrder(order.id)
      } catch (error: unknown) {
        update({
          kind: 'result',
          result: {
            tone: 'danger',
            title: `Couldn’t check the latest status of order #${order.number}`,
            detail: `${getErrorMessage(error)} Nothing was changed.`,
          },
        })
        return
      }
      callbacksRef.current.onOrderChange(latest)
      if (canFulfilOrder(latest)) {
        update({ kind: 'confirming' })
        return
      }
      if (latest.status !== order.status) callbacksRef.current.onOrdersChanged()
      update({
        kind: 'result',
        result: {
          tone: 'info',
          title: `Order #${order.number} can’t be fulfilled`,
          detail: `It is now ${ORDER_STATUS_LABELS[latest.status].toLowerCase()}.`,
        },
      })
    })

  const confirm = () =>
    run(async () => {
      update({ kind: 'submitting' })
      let failure: Exclude<FulfilmentFailure, { kind: 'not_allowed' }>
      try {
        const updated = await updateOrderStatus(order, 'fulfilled')
        callbacksRef.current.onOrderChange(updated)
        callbacksRef.current.onOrdersChanged()
        finish({ tone: 'success', title: `Order #${order.number} fulfilled.` })
        return
      } catch (error: unknown) {
        const classified = classifyFulfilmentFailure(error)
        if (classified.kind === 'not_allowed') {
          update({ kind: 'blocked' })
          return
        }
        failure = classified
      }

      if (failure.kind === 'gone') {
        callbacksRef.current.onOrdersChanged()
        callbacksRef.current.onOrderGone()
        update({ kind: 'result', result: describeFulfilmentFailure(failure, order.number, null) })
        return
      }
      if (failure.kind === 'rate_limited') {
        update({ kind: 'result', result: describeFulfilmentFailure(failure, order.number, order) })
        return
      }

      update({ kind: 'checking' })
      let latest = failure.kind === 'conflict' ? failure.latestOrder : null
      if (latest) callbacksRef.current.onOrderChange(latest)
      else latest = await fetchLatest()
      callbacksRef.current.onOrdersChanged()
      finish(describeFulfilmentFailure(failure, order.number, latest))
    })

  const checkAgain = () =>
    run(async () => {
      update({ kind: 'checking' })
      const latest = await fetchLatest()
      if (latest) callbacksRef.current.onOrdersChanged()
      const failure = { kind: 'unknown_outcome', cause: '' } as const
      finish(describeFulfilmentFailure(failure, order.number, latest))
    })

  const cancel = () => update({ kind: 'idle' })

  return { state, start, confirm, checkAgain, cancel }
}
