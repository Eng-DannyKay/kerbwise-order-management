import type { OrderSummary } from '../types/order.types'

/** Only paid orders can be fulfilled. */
export function canFulfilOrder(order: Pick<OrderSummary, 'status'>): boolean {
  return order.status === 'paid'
}
