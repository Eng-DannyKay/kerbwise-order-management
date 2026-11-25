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

/** Till orders have no customer name. */
export function displayCustomerName(name: string | null): string {
  return name ?? 'Till customer'
}
