import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../services/api-error'
import { getOrder } from '../services/orders-api'
import type { OrderDetail } from '../types/order.types'
import { getErrorMessage } from '../utils/error-messages'

interface SettledRequest {
  key: string
  order: OrderDetail | null
  error: string | null
  isGone: boolean
}

/**
 * Loads one order. The last copy stays visible while it reloads, and a copy passed to
 * `replaceOrder` cancels any reload still in flight so an older response cannot overwrite it.
 */
export function useOrderDetail(orderId: string) {
  const [settled, setSettled] = useState<SettledRequest | null>(null)
  const [reloadCount, setReloadCount] = useState(0)
  const inFlightRef = useRef<AbortController | null>(null)
  const requestKey = `${orderId}:${reloadCount}`

  useEffect(() => {
    const controller = new AbortController()
    inFlightRef.current = controller

    getOrder(orderId, { signal: controller.signal })
      .then((order) => {
        if (!controller.signal.aborted) setSettled({ key: requestKey, order, error: null, isGone: false })
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        const isGone = caught instanceof ApiError && caught.status === 404
        const error = isGone ? 'It may have been removed, so nothing can be done with it here.' : getErrorMessage(caught)
        setSettled({ key: requestKey, order: null, error, isGone })
      })

    return () => controller.abort()
  }, [orderId, requestKey])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  const replaceOrder = useCallback(
    (order: OrderDetail) => {
      inFlightRef.current?.abort()
      setSettled({ key: requestKey, order, error: null, isGone: false })
    },
    [requestKey],
  )

  const isCurrent = settled?.key === requestKey

  return {
    order: settled?.order ?? null,
    error: isCurrent ? settled.error : null,
    isGone: isCurrent && settled.isGone,
    isLoading: !isCurrent,
    reload,
    replaceOrder,
  }
}
