export const ORDER_STATUSES = ['new', 'paid', 'fulfilled', 'cancelled', 'on_hold', 'part_refunded'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_CHANNELS = ['web', 'whatsapp', 'pos'] as const
export type OrderChannel = (typeof ORDER_CHANNELS)[number]

export type OrderSortField = 'createdAt' | 'total' | 'customer' | 'status'
export type SortDirection = 'asc' | 'desc'

export type UpdatableOrderStatus = 'fulfilled' | 'cancelled'

export interface OrderSummary {
  id: string
  number: number
  /** `null` for till orders. */
  customerName: string | null
  /** Restricted to owners and customer care. `null` for till orders. */
  phone: string | null
  status: OrderStatus
  /** Authoritative total in GBP */
  total: number
  itemCount: number
  /** ISO 8601, normalised at the API boundary. */
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

/** A record from the API that could not be read. Shown to staff, never dropped silently. */
export interface RejectedOrder {
  id: string | null
  number: number | null
  reason: string
}

export interface OrdersPage {
  orders: OrderSummary[]
  /** Records on this page that failed validation. */
  rejected: RejectedOrder[]
  page: number
  pageSize: number
  /** Matching orders across all pages. */
  total: number
}
