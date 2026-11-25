import type { OrderChannel, OrderStatus } from '../types/order.types'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'New',
  paid: 'Paid',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
  on_hold: 'On hold',
  part_refunded: 'Part refunded',
}

export const ORDER_CHANNEL_LABELS: Record<OrderChannel, string> = {
  web: 'Website',
  whatsapp: 'WhatsApp',
  pos: 'Till',
}

/** E.g. "3 paid orders", "1 order on hold". */
export function describeOrderCount(count: number, status: OrderStatus | 'all'): string {
  const noun = count === 1 ? 'order' : 'orders'
  if (status === 'all') return `${count} ${noun}`
  if (status === 'on_hold') return `${count} ${noun} on hold`
  const adjective = status === 'part_refunded' ? 'part-refunded' : ORDER_STATUS_LABELS[status].toLowerCase()
  return `${count} ${adjective} ${noun}`
}

/** Till orders have no customer name. Extra spaces are removed for display; letter case is left as sent. */
export function displayCustomerName(name: string | null): string {
  if (name === null) return 'Till customer'
  const tidy = name.trim().replace(/\s+/g, ' ')
  return tidy === '' ? 'No name given' : tidy
}
