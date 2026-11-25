import { env } from '../config/env'
import type {
  OrderDetail,
  OrderSummary,
  OrdersPage,
  OrdersQuery,
  RejectedOrder,
  UpdatableOrderStatus,
} from '../types/order.types'
import { canFulfilOrder } from '../utils/order-rules'
import { ApiError, FulfilmentNotAllowedError } from './api-error'
import { parseOrderDetail, parseOrdersPage, readErrorCode } from './order-parsers'

export const MAX_PAGE_SIZE = 50

/** Longest wait for any request, including reading its body, before giving up. */
export const REQUEST_TIMEOUT_MS = 15_000

interface RequestOptions {
  signal?: AbortSignal
}

interface RequestSettings {
  method?: 'GET' | 'PATCH'
  body?: string
  signal?: AbortSignal
}

const NETWORK_MESSAGE = 'Could not reach the orders service. Check the internet connection.'
const TIMEOUT_MESSAGE = 'The orders service took too long to answer.'

/**
 * Turns a failure to send a request or read its response into an `ApiError`. A cancellation by the caller is
 * passed through unchanged, so callers can ignore it.
 */
function transportError(error: unknown, timedOut: boolean, callerSignal: AbortSignal | undefined): unknown {
  if (!timedOut && callerSignal?.aborted) return error
  return timedOut ? new ApiError(TIMEOUT_MESSAGE, null, 'timeout') : new ApiError(NETWORK_MESSAGE, null, 'network')
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  if (text === '') return { ok: true, value: null }
  try {
    const value: unknown = JSON.parse(text)
    return { ok: true, value }
  } catch {
    return { ok: false }
  }
}

async function request(path: string, { method = 'GET', body, signal }: RequestSettings = {}): Promise<unknown> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  const forwardAbort = () => controller.abort()
  if (signal?.aborted) controller.abort()
  else signal?.addEventListener('abort', forwardAbort, { once: true })

  try {
    let response: Response
    let text: string
    try {
      response = await fetch(`${env.apiBaseUrl}${path}`, {
        method,
        body,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${env.apiToken}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
      })
      text = await response.text()
    } catch (error: unknown) {
      throw transportError(error, timedOut, signal)
    }

    const parsed = parseJson(text)
    if (!response.ok) {
      const errorBody = parsed.ok ? parsed.value : null
      throw new ApiError(
        `Request failed with status ${response.status}.`,
        response.status,
        readErrorCode(errorBody),
        errorBody,
        parseRetryAfter(response.headers.get('Retry-After')),
      )
    }
    if (!parsed.ok) {
      throw new ApiError('The orders service sent a reply the desk couldn’t read.', response.status, 'invalid_json')
    }
    return parsed.value
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value.trim())) return null
  return Number(value.trim())
}

/** Waits used when the server answers 429 without a usable `Retry-After`. */
const DEFAULT_RETRY_AFTER_SECONDS = 2
/** Longer requested waits are reported to staff instead of retried silently. */
export const MAX_RETRY_AFTER_SECONDS = 10
/** Spreads retries so desks limited at the same moment do not all retry at once. */
const RETRY_JITTER_MS = 500

function wait(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('The operation was aborted.', 'AbortError'))
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(timer)
      reject(new DOMException('The operation was aborted.', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** A read request that is retried once after the server's `Retry-After` when rate-limited. Never used for changes. */
async function read(path: string, signal: AbortSignal | undefined): Promise<unknown> {
  try {
    return await request(path, { signal })
  } catch (error: unknown) {
    if (!(error instanceof ApiError) || error.status !== 429) throw error
    const seconds = error.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS
    if (seconds > MAX_RETRY_AFTER_SECONDS) throw error
    await wait(seconds * 1000 + Math.random() * RETRY_JITTER_MS, signal)
    return request(path, { signal })
  }
}

function invalidResponse(reason: string): ApiError {
  return new ApiError('The orders service sent order details the desk couldn’t read.', null, 'invalid_response', { reason })
}

function clampPageSize(pageSize: number): number {
  return Math.min(Math.max(Math.trunc(pageSize), 1), MAX_PAGE_SIZE)
}

function buildOrdersSearch(query: OrdersQuery): string {
  const params = new URLSearchParams()
  const search = query.q?.trim()

  if (search) params.set('q', search)
  if (query.status) params.set('status', query.status)
  if (query.sort) params.set('sort', query.sort)
  if (query.dir) params.set('dir', query.dir)
  if (query.page !== undefined) params.set('page', String(Math.max(Math.trunc(query.page), 1)))
  if (query.pageSize !== undefined) params.set('pageSize', String(clampPageSize(query.pageSize)))

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

/** `pageSize` is capped at {@link MAX_PAGE_SIZE}. */
export async function getOrders(query: OrdersQuery = {}, options: RequestOptions = {}): Promise<OrdersPage> {
  const body = await read(`/orders${buildOrdersSearch(query)}`, options.signal)
  const page = parseOrdersPage(body)
  if (!page.ok) throw invalidResponse(page.reason)
  return page.value
}

export async function getOrder(id: string, options: RequestOptions = {}): Promise<OrderDetail> {
  const body = await read(`/orders/${encodeURIComponent(id)}`, options.signal)
  const order = parseOrderDetail(body)
  if (!order.ok) throw invalidResponse(order.reason)
  return order.value
}

/**
 * Sends the order's `version`; the API returns 409 if the order changed since.
 *
 * @throws {FulfilmentNotAllowedError} when fulfilling an unpaid order. No request is sent.
 * @throws {ApiError} when the request fails or is rejected.
 */
export async function updateOrderStatus(
  order: Pick<OrderSummary, 'id' | 'number' | 'status' | 'version'>,
  status: UpdatableOrderStatus,
): Promise<OrderDetail> {
  if (status === 'fulfilled' && !canFulfilOrder(order)) {
    throw new FulfilmentNotAllowedError(order.number)
  }

  const body = await request(`/orders/${encodeURIComponent(order.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, version: order.version }),
  })
  const updated = parseOrderDetail(body)
  if (!updated.ok) throw invalidResponse(updated.reason)
  return updated.value
}

/** Above this many pages, sorting the whole collection is refused rather than flooding the API. */
export const MAX_COLLECTION_PAGES = 20

export interface OrderCollection {
  orders: OrderSummary[]
  rejected: RejectedOrder[]
  /** The matching total changed between pages, so orders may be missing or out of date. */
  changedWhileLoading: boolean
}

/**
 * Loads every page of a query one after another and removes duplicates by order id. The pages are fetched at
 * different moments, so this is not a consistent snapshot: `changedWhileLoading` reports when the total moved.
 */
export async function getAllOrders(
  query: Pick<OrdersQuery, 'q' | 'status'>,
  options: RequestOptions = {},
): Promise<OrderCollection> {
  const pageQuery = (page: number): OrdersQuery => ({ ...query, sort: 'createdAt', dir: 'desc', page, pageSize: MAX_PAGE_SIZE })
  const first = await getOrders(pageQuery(1), options)
  const pageCount = Math.ceil(first.total / MAX_PAGE_SIZE)
  if (pageCount > MAX_COLLECTION_PAGES) {
    throw new ApiError('There are too many orders to sort by total. Search or filter first, then sort.', null, 'too_many')
  }

  const orders = new Map<string, OrderSummary>()
  const rejected = new Map<string, RejectedOrder>()
  let changedWhileLoading = false
  const collect = (page: OrdersPage) => {
    for (const order of page.orders) orders.set(order.id, order)
    page.rejected.forEach((record, index) => rejected.set(record.id ?? `page${page.page}-${index}`, record))
    if (page.total !== first.total) changedWhileLoading = true
  }

  collect(first)
  for (let page = 2; page <= pageCount; page++) {
    collect(await getOrders(pageQuery(page), options))
  }
  return { orders: [...orders.values()], rejected: [...rejected.values()], changedWhileLoading }
}
