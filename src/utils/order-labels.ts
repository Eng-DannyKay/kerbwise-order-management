import type { OrderChannel, OrderStatus } from '../types/order.types'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'New',
  paid: 'Paid',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
}

export const ORDER_CHANNEL_LABELS: Record<OrderChannel, string> = {
  web: 'Website',
  whatsapp: 'WhatsApp',
  pos: 'Till',
}
