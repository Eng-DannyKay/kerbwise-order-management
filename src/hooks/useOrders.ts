import { useCallback, useEffect, useState } from 'react'
import { getAllOrders, getOrders } from '../services/orders-api'
import type { OrderSummary, OrdersPage, OrdersQuery, RejectedOrder } from '../types/order.types'
import { getErrorMessage } from '../utils/error-messages'
import { sortByTotal } from '../utils/order-sort'

interface UseOrdersResult {
  data: OrdersPage | null
  error: string | null
  isLoading: boolean
  /** Orders may have been added or changed since the list was first shown with these filters. */
  listChanged: boolean
  reload: () => void
}

interface SortedCollection {
  orders: OrderSummary[]
  rejected: RejectedOrder[]
  changedWhileLoading: boolean
}

interface SettledRequest {
  key: string
  page: OrdersPage | null
  collection: SortedCollection | null
  error: string | null
}

function pageOf(collection: SortedCollection, page: number, pageSize: number): OrdersPage {
  const start = (page - 1) * pageSize
  return {
    orders: collection.orders.slice(start, start + pageSize),
    rejected: collection.rejected,
    page,
    pageSize,
    total: collection.orders.length,
  }
}

/**
 * Loads one server page, or, when sorting by total, every page sorted locally because the API's own total sort is
 * unreliable. Keeps the previous result visible while loading, and a newer query cancels the older request.
 */
export function useOrders(query: OrdersQuery): UseOrdersResult {
  const [settled, setSettled] = useState<SettledRequest | null>(null)
  const [reloadCount, setReloadCount] = useState(0)
  const [baseline, setBaseline] = useState<{ key: string; total: number } | null>(null)

  const { q, status, sort, dir, page = 1, pageSize = 20 } = query
  const sortsWholeCollection = sort === 'total'
  // The whole collection is paged locally, so changing page must not load it again.
  const serverPage = sortsWholeCollection ? null : page
  const requestKey = JSON.stringify(
    sortsWholeCollection ? ['collection', q, status, dir, reloadCount] : ['page', q, status, sort, dir, page, pageSize, reloadCount],
  )

  useEffect(() => {
    const controller = new AbortController()
    const settle = (result: Omit<SettledRequest, 'key'>) => {
      if (!controller.signal.aborted) setSettled({ key: requestKey, ...result })
    }
    const fail = (caught: unknown) => {
      if (controller.signal.aborted) return
      setSettled((previous) => ({
        key: requestKey,
        page: previous?.page ?? null,
        collection: previous?.collection ?? null,
        error: getErrorMessage(caught),
      }))
    }

    if (sortsWholeCollection) {
      getAllOrders({ q, status }, { signal: controller.signal })
        .then((collection) =>
          settle({ page: null, collection: { ...collection, orders: sortByTotal(collection.orders, dir ?? 'desc') }, error: null }),
        )
        .catch(fail)
    } else {
      getOrders({ q, status, sort, dir, page: serverPage ?? 1, pageSize }, { signal: controller.signal })
        .then((result) => settle({ page: result, collection: null, error: null }))
        .catch(fail)
    }

    return () => controller.abort()
  }, [requestKey, sortsWholeCollection, q, status, sort, dir, serverPage, pageSize])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])
  const isLoading = settled?.key !== requestKey
  const data = settled?.collection ? pageOf(settled.collection, page, pageSize) : (settled?.page ?? null)

  const filterKey = JSON.stringify([q, status, sort, dir, reloadCount])
  const settledTotal = !isLoading && settled?.page && !settled.error ? settled.page.total : null
  if (settledTotal !== null && baseline?.key !== filterKey) {
    setBaseline({ key: filterKey, total: settledTotal })
  }
  const totalMoved = settledTotal !== null && baseline?.key === filterKey && settledTotal !== baseline.total
  const collectionMoved = !isLoading && (settled?.collection?.changedWhileLoading ?? false)

  return {
    data,
    error: isLoading ? null : (settled?.error ?? null),
    isLoading,
    listChanged: totalMoved || collectionMoved,
    reload,
  }
}
