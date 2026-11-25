import type { OrderSummary, SortDirection } from '../types/order.types'

/** Sorts by the numeric order total; ties keep the newest order first. Returns a new array. */
export function sortByTotal(orders: OrderSummary[], dir: SortDirection): OrderSummary[] {
  const direction = dir === 'asc' ? 1 : -1
  return [...orders].sort(
    (a, b) => (a.total - b.total) * direction || b.createdAt.localeCompare(a.createdAt) || b.number - a.number,
  )
}
