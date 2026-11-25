import {
  ORDER_CHANNELS,
  ORDER_STATUSES,
  type DeliveryAddress,
  type OrderChannel,
  type OrderDetail,
  type OrderLine,
  type OrderStatus,
  type OrderSummary,
  type OrdersPage,
} from '../types/order.types'

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isInteger(value: unknown): value is number {
  return Number.isInteger(value)
}

function isOneOf<T extends string>(allowed: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return isOneOf(ORDER_STATUSES, value)
}

function isOrderChannel(value: unknown): value is OrderChannel {
  return isOneOf(ORDER_CHANNELS, value)
}

export function isOrderSummary(value: unknown): value is OrderSummary {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isInteger(value.number) &&
    isString(value.customerName) &&
    isString(value.phone) &&
    isOrderStatus(value.status) &&
    isFiniteNumber(value.total) &&
    isInteger(value.itemCount) &&
    isString(value.createdAt) &&
    isOrderChannel(value.channel) &&
    isInteger(value.version)
  )
}

function isOrderLine(value: unknown): value is OrderLine {
  return isRecord(value) && isString(value.name) && isInteger(value.qty) && isFiniteNumber(value.lineTotal)
}

function isDeliveryAddress(value: unknown): value is DeliveryAddress {
  return isRecord(value) && isString(value.line1) && isString(value.area)
}

export function isOrderDetail(value: unknown): value is OrderDetail {
  return (
    isRecord(value) &&
    isOrderSummary(value) &&
    Array.isArray(value.lines) &&
    value.lines.every(isOrderLine) &&
    (value.address === null || isDeliveryAddress(value.address)) &&
    isString(value.notes)
  )
}

export function isOrdersPage(value: unknown): value is OrdersPage {
  return (
    isRecord(value) &&
    Array.isArray(value.orders) &&
    value.orders.every(isOrderSummary) &&
    isInteger(value.page) &&
    isInteger(value.pageSize) &&
    isInteger(value.total)
  )
}

export function readErrorCode(body: unknown): string | null {
  return isRecord(body) && isString(body.code) ? body.code : null
}

/** The latest order sent with a 409 `stale` response, if it is valid. */
export function readConflictOrder(body: unknown): OrderDetail | null {
  return isRecord(body) && isOrderDetail(body.current) ? body.current : null
}

/** The status an order was in when a 409 `invalid_transition` was returned. */
export function readTransitionFrom(body: unknown): OrderStatus | null {
  return isRecord(body) && isOrderStatus(body.from) ? body.from : null
}
