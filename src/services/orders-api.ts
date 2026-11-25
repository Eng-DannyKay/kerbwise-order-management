import { env } from '../config/env'
import type {
  OrderDetail,
  OrderSummary,
  OrdersPage,
  OrdersQuery,
  UpdatableOrderStatus,
} from '../types/order.types'
import { canFulfilOrder } from '../utils/order-rules'
import { ApiError, FulfilmentNotAllowedError } from './api-error'
import { isOrderDetail, isOrdersPage, readErrorCode } from './order-parsers'

export const MAX_PAGE_SIZE = 50

interface RequestOptions {
  signal?: AbortSignal
}

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${env.apiToken}`,
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
    })
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new ApiError('Could not reach the orders service. Check your connection and try again.', null)
  }

  const body = await readJson(response)

  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}.`, response.status, readErrorCode(body), body)
  }

  return body
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (text === '') {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(text)
    return parsed
  } catch {
    throw new ApiError('The orders service returned a response that is not valid JSON.', response.status)
  }
}

function invalidResponse(status: number | null = null): ApiError {
  return new ApiError('The orders service returned data in an unexpected format.', status, 'invalid_response')
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
  const body = await request(`/orders${buildOrdersSearch(query)}`, { signal: options.signal })
  if (!isOrdersPage(body)) {
    throw invalidResponse()
  }
  return body
}

export async function getOrder(id: string, options: RequestOptions = {}): Promise<OrderDetail> {
  const body = await request(`/orders/${encodeURIComponent(id)}`, { signal: options.signal })
  if (!isOrderDetail(body)) {
    throw invalidResponse()
  }
  return body
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
  if (!isOrderDetail(body)) {
    throw invalidResponse()
  }
  return body
}
