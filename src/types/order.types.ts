export const ORDER_STATUSES = ['new', 'paid', 'fulfilled', 'cancelled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_CHANNELS = ['web', 'whatsapp', 'pos'] as const
export type OrderChannel = (typeof ORDER_CHANNELS)[number]

export type OrderSortField = 'createdAt' | 'total' | 'customer' | 'status'
export type SortDirection = 'asc' | 'desc'

export type UpdatableOrderStatus = 'fulfilled' | 'cancelled'

export interface OrderSummary {
  id: string
  number: number
  customerName: string
  /** Restricted to owners and customer care. */
  phone: string
  status: OrderStatus
  /** Authoritative total in GBP */
  total: number
  itemCount: number
  createdAt: string
  channel: OrderChannel
  /** Required when updating the order. */
  version: number
}

export interface OrderLine {
  name: string
  qty: number
  /** Already includes `qty`. */
  lineTotal: number
}

export interface DeliveryAddress {
  line1: string
  area: string
}

export interface OrderDetail extends OrderSummary {
  lines: OrderLine[]
  /** `null` for till orders. */
  address: DeliveryAddress | null
  notes: string
}

export interface OrdersQuery {
  q?: string
  status?: OrderStatus
  sort?: OrderSortField
  dir?: SortDirection
  page?: number
  pageSize?: number
}

export interface OrdersPage {
  orders: OrderSummary[]
  page: number
  pageSize: number
  /** Matching orders across all pages. */
  total: number
}
