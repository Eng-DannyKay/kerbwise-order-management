import { useCallback, useEffect, useState } from 'react'
import { getOrders } from '../services/orders-api'
import type { OrdersPage, OrdersQuery } from '../types/order.types'
import { getErrorMessage } from '../utils/error-messages'

interface UseOrdersResult {
  data: OrdersPage | null
  error: string | null
  isLoading: boolean
  reload: () => void
}

interface SettledRequest {
  key: string
  data: OrdersPage | null
  error: string | null
}

/** Keeps the previous page visible while loading. A newer query cancels the older request. */
export function useOrders(query: OrdersQuery): UseOrdersResult {
  const [settled, setSettled] = useState<SettledRequest | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  const { q, status, sort, dir, page, pageSize } = query
  const requestKey = JSON.stringify([q, status, sort, dir, page, pageSize, reloadCount])

  useEffect(() => {
    const controller = new AbortController()

    getOrders({ q, status, sort, dir, page, pageSize }, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setSettled({ key: requestKey, data, error: null })
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        setSettled((previous) => ({ key: requestKey, data: previous?.data ?? null, error: getErrorMessage(caught) }))
      })

    return () => controller.abort()
  }, [requestKey, q, status, sort, dir, page, pageSize])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])
  const isLoading = settled?.key !== requestKey

  return {
    data: settled?.data ?? null,
    error: isLoading ? null : (settled?.error ?? null),
    isLoading,
    reload,
  }
}
