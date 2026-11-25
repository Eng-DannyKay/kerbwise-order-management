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
  type RejectedOrder,
} from '../types/order.types'

type UnknownRecord = Record<string, unknown>

export type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: string }

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

function describe(value: unknown): string {
  return value === undefined ? 'missing' : JSON.stringify(value)
}

/** The only string format the API has been seen to send, e.g. `£122.25`. */
const GBP_STRING = /^£(\d+)\.(\d{2})$/

/**
 * Reads a money amount in pounds. Accepts a non-negative number with at most two decimals, or a string in
 * the verified `£123.45` format. Anything else returns `null`; amounts are never guessed.
 */
export function parseMoney(value: unknown): number | null {
  if (isFiniteNumber(value)) {
    const pence = value * 100
    return value >= 0 && Math.abs(pence - Math.round(pence)) < 1e-6 ? value : null
  }
  if (!isString(value)) return null
  const match = GBP_STRING.exec(value)
  if (!match) return null
  const [, pounds = '', pence = ''] = match
  return (Number(pounds) * 100 + Number(pence)) / 100
}

/** Unix seconds between 2001 and 2286; millisecond values are not accepted because they were never observed. */
const MIN_UNIX_SECONDS = 1e9
const MAX_UNIX_SECONDS = 1e10

/** Reads a timestamp as an ISO 8601 string with a time zone, or integer Unix seconds, and returns ISO 8601. */
export function parseTimestamp(value: unknown): string | null {
  if (isInteger(value)) {
    return value >= MIN_UNIX_SECONDS && value < MAX_UNIX_SECONDS ? new Date(value * 1000).toISOString() : null
  }
  if (!isString(value) || !/(Z|[+-]\d{2}:?\d{2})$/.test(value)) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

/** Accepts a known status in any letter case. Unknown statuses are never mapped to known ones. */
export function parseStatus(value: unknown): OrderStatus | null {
  if (!isString(value)) return null
  const lower = value.toLowerCase()
  return (ORDER_STATUSES as readonly string[]).includes(lower) ? (lower as OrderStatus) : null
}

function parseChannel(value: unknown): OrderChannel | null {
  return isString(value) && (ORDER_CHANNELS as readonly string[]).includes(value) ? (value as OrderChannel) : null
}

export function parseOrderSummary(value: unknown): ParseResult<OrderSummary> {
  if (!isRecord(value)) return { ok: false, reason: 'not an order record' }
  if (!isString(value.id) || value.id === '') return { ok: false, reason: 'missing order id' }
  if (!isInteger(value.number)) return { ok: false, reason: `unreadable order number ${describe(value.number)}` }
  if (value.customerName !== null && !isString(value.customerName))
    return { ok: false, reason: `unreadable customer name ${describe(value.customerName)}` }
  if (value.phone !== null && !isString(value.phone)) return { ok: false, reason: 'unreadable phone field' }

  const status = parseStatus(value.status)
  if (!status) return { ok: false, reason: `unknown status ${describe(value.status)}` }
  const total = parseMoney(value.total)
  if (total === null) return { ok: false, reason: `unreadable total ${describe(value.total)}` }
  const createdAt = parseTimestamp(value.createdAt)
  if (!createdAt) return { ok: false, reason: `unreadable order date ${describe(value.createdAt)}` }
  const channel = parseChannel(value.channel)
  if (!channel) return { ok: false, reason: `unknown channel ${describe(value.channel)}` }
  if (!isInteger(value.itemCount)) return { ok: false, reason: `unreadable item count ${describe(value.itemCount)}` }
  if (!isInteger(value.version)) return { ok: false, reason: `unreadable version ${describe(value.version)}` }

  return {
    ok: true,
    value: {
      id: value.id,
      number: value.number,
      customerName: value.customerName,
      phone: value.phone,
      status,
      total,
      itemCount: value.itemCount,
      createdAt,
      channel,
      version: value.version,
    },
  }
}

function parseLine(value: unknown): OrderLine | null {
  if (!isRecord(value) || !isString(value.name) || !isInteger(value.qty) || value.qty <= 0) return null
  const lineTotal = parseMoney(value.lineTotal)
  return lineTotal === null ? null : { name: value.name, qty: value.qty, lineTotal }
}

function parseAddress(value: unknown): DeliveryAddress | null | undefined {
  if (value === null) return null
  return isRecord(value) && isString(value.line1) && isString(value.area) ? { line1: value.line1, area: value.area } : undefined
}

export function parseOrderDetail(value: unknown): ParseResult<OrderDetail> {
  if (!isRecord(value)) return { ok: false, reason: 'not an order record' }
  const summary = parseOrderSummary(value)
  if (!summary.ok) return summary
  if (!Array.isArray(value.lines)) return { ok: false, reason: 'missing order lines' }
  const lines = value.lines.map(parseLine)
  const badLine = lines.findIndex((line) => line === null)
  if (badLine !== -1) return { ok: false, reason: `unreadable order line ${badLine + 1}` }
  const address = parseAddress(value.address)
  if (address === undefined) return { ok: false, reason: 'unreadable delivery address' }
  if (!isString(value.notes)) return { ok: false, reason: 'unreadable notes' }
  return { ok: true, value: { ...summary.value, lines: lines.filter((line) => line !== null), address, notes: value.notes } }
}

function rejectedFrom(value: unknown, reason: string): RejectedOrder {
  const record = isRecord(value) ? value : {}
  return {
    id: isString(record.id) ? record.id : null,
    number: isInteger(record.number) ? record.number : null,
    reason,
  }
}

/** Validates each order separately, so one bad record is reported instead of failing the whole page. */
export function parseOrdersPage(value: unknown): ParseResult<OrdersPage> {
  if (!isRecord(value) || !Array.isArray(value.orders)) return { ok: false, reason: 'missing orders list' }
  if (!isInteger(value.page) || !isInteger(value.pageSize) || !isInteger(value.total))
    return { ok: false, reason: 'missing page information' }

  const orders: OrderSummary[] = []
  const rejected: RejectedOrder[] = []
  for (const record of value.orders) {
    const result = parseOrderSummary(record)
    if (result.ok) orders.push(result.value)
    else rejected.push(rejectedFrom(record, result.reason))
  }
  return { ok: true, value: { orders, rejected, page: value.page, pageSize: value.pageSize, total: value.total } }
}

export function readErrorCode(body: unknown): string | null {
  return isRecord(body) && isString(body.code) ? body.code : null
}

/** The latest order sent with a 409 `stale` response, if it is valid. */
export function readConflictOrder(body: unknown): OrderDetail | null {
  if (!isRecord(body)) return null
  const result = parseOrderDetail(body.current)
  return result.ok ? result.value : null
}

/** The status an order was in when a 409 `invalid_transition` was returned. */
export function readTransitionFrom(body: unknown): OrderStatus | null {
  return isRecord(body) ? parseStatus(body.from) : null
}
