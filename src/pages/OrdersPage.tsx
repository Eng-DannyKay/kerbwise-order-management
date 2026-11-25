import { useEffect, useRef, useState } from 'react'
import { useOrderQuery, type StatusFilter } from '../hooks/useOrderQuery'
import { useOrders } from '../hooks/useOrders'
import { useScanner } from '../hooks/useScanner'
import type { OrderSummary } from '../types/order.types'
import type { FulfilmentResult } from '../utils/fulfilment-errors'
import { describeOrderCount } from '../utils/order-labels'
import { findOrderToOpen } from '../utils/scan-match'
import { Button, focusRing } from '../components/ui/Button'
import { Pagination } from '../components/ui/Pagination'
import { StateMessage } from '../components/ui/StateMessage'
import { Toast } from '../components/ui/Toast'
import { OrderDetailsDrawer } from '../components/orders/OrderDetailsDrawer'
import { OrderFilters } from '../components/orders/OrderFilters'
import { OrdersTable, OrdersTableSkeleton } from '../components/orders/OrdersTable'
import { ListChangedNotice } from '../components/orders/ListChangedNotice'
import { RejectedOrdersNotice } from '../components/orders/RejectedOrdersNotice'

export const ORDERS_PAGE_SIZE = 20

export const TOAST_DURATION_MS = 8000

function describeResults(total: number, search: string, status: StatusFilter): string {
  const orders = describeOrderCount(total, status)
  if (!search) return orders
  return `${orders} ${total === 1 ? 'matches' : 'match'} “${search}”`
}

function describeNoResults(search: string, status: StatusFilter): string {
  if (search) return `No orders match “${search}”`
  return status === 'all' ? 'No orders yet' : describeOrderCount(0, status).replace(/^0/, 'No')
}

export function OrdersPage() {
  const orderQuery = useOrderQuery(ORDERS_PAGE_SIZE)
  const { page, setPage, search, status, isFiltered, clearFilters } = orderQuery
  const sectionRef = useRef<HTMLElement>(null)
  const { data, error, isLoading, listChanged, reload } = useOrders(orderQuery.query)

  const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null)
  const [openSingleMatch, setOpenSingleMatch] = useState(false)
  const [toast, setToast] = useState<FulfilmentResult | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast])

  const lastPage = data ? Math.max(1, Math.ceil(data.total / ORDERS_PAGE_SIZE)) : null
  if (lastPage !== null && page > lastPage) {
    setPage(lastPage)
  }

  if (openSingleMatch && !isLoading) {
    setOpenSingleMatch(false)
    const match = !error && data ? findOrderToOpen(search, data) : undefined
    if (match) setSelectedOrder(match)
  }

  function submitSearch() {
    orderQuery.submitSearch()
    setOpenSingleMatch(orderQuery.searchText.trim() !== '')
  }

  useScanner((term) => {
    setSelectedOrder(null)
    orderQuery.searchFor(term)
    setOpenSingleMatch(true)
  })

  function refreshList() {
    setPage(1)
    reload()
  }

  function changePage(nextPage: number) {
    setPage(nextPage)
    const section = sectionRef.current
    if (section && section.getBoundingClientRect().top < 0) {
      section.scrollIntoView({ block: 'start' })
    }
  }

  const summary = data && !error && !isLoading ? describeResults(data.total, search, status) : null
  const toastNode = toast && <Toast title={toast.title} detail={toast.detail} onDismiss={() => setToast(null)} />

  return (
    <section ref={sectionRef} aria-labelledby="orders-heading" className="flex scroll-mt-4 flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 id="orders-heading" className="text-2xl font-bold tracking-tight">
          Orders
        </h1>
        <p className="text-muted">
          {!isFiltered && summary ? `${summary} · ` : ''}Website, WhatsApp and till
        </p>
      </div>

      <div className="rounded-card border border-line bg-white shadow-card">
        <OrderFilters
          searchText={orderQuery.searchText}
          onSearchTextChange={orderQuery.setSearchText}
          onSearchSubmit={submitSearch}
          onSearchClear={orderQuery.clearSearch}
          status={status}
          onStatusChange={orderQuery.setStatus}
          sort={orderQuery.sort}
          onSortChange={orderQuery.setSort}
        />

        {isFiltered && (
          <div className="flex flex-wrap items-center gap-x-2 px-4 pb-3 text-muted">
            <p aria-live="polite">{summary}</p>
            <button
              type="button"
              onClick={clearFilters}
              className={`min-h-11 rounded-sm font-semibold text-brand-700 underline underline-offset-2 sm:min-h-0 ${focusRing}`}
            >
              Clear all
            </button>
          </div>
        )}

        {data && !error && listChanged && <ListChangedNotice onRefresh={refreshList} />}
        {data && !error && <RejectedOrdersNotice rejected={data.rejected} />}

        <div aria-busy={isLoading} className="border-t border-line-soft">
          {error ? (
            <StateMessage
              tone="danger"
              title="Unable to load orders"
              description={error}
              action={
                <Button variant="primary" onClick={reload}>
                  Try again
                </Button>
              }
            />
          ) : !data || isLoading ? (
            <OrdersTableSkeleton />
          ) : data.orders.length === 0 && data.rejected.length > 0 ? null : data.orders.length === 0 ? (
            <StateMessage
              title={describeNoResults(search, status)}
              description={
                isFiltered
                  ? 'Check the order number or try the customer’s name.'
                  : 'New orders from the website, WhatsApp and the till appear here.'
              }
              action={isFiltered ? <Button onClick={clearFilters}>Clear search and filters</Button> : undefined}
            />
          ) : (
            <OrdersTable orders={data.orders} onViewOrder={setSelectedOrder} />
          )}
        </div>

        {data && !error && data.total > 0 && (
          <Pagination page={page} pageSize={ORDERS_PAGE_SIZE} total={data.total} onPageChange={changePage} />
        )}
      </div>

      <OrderDetailsDrawer
        summary={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onOrdersChanged={reload}
        onFulfilled={setToast}
        toast={selectedOrder && toastNode}
      />
      {!selectedOrder && toastNode}
    </section>
  )
}
