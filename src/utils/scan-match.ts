import type { OrdersPage, OrderSummary } from '../types/order.types'

/**
 * The order a search should open on its own: the one whose number equals an order-number search, or else the
 * only result. The API's search also matches phone numbers, so a number can return other orders as well.
 */
export function findOrderToOpen(search: string, page: OrdersPage): OrderSummary | undefined {
  const number = search.trim().replace(/^#/, '')
  if (/^\d+$/.test(number)) {
    const exact = page.orders.filter((order) => String(order.number) === number)
    if (exact.length === 1) return exact[0]
    if (exact.length > 1) return undefined
  }
  return page.total === 1 ? page.orders[0] : undefined
}
