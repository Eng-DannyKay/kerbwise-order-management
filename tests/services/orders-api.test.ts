/**
 * @jest-environment node
 */
import { ApiError, FulfilmentNotAllowedError } from '../../src/services/api-error'
import { getOrder, getOrders, updateOrderStatus } from '../../src/services/orders-api'
import type { OrderDetail, OrderSummary } from '../../src/types/order.types'

const summary: OrderSummary = {
  id: 'ord_2201',
  number: 2201,
  customerName: 'Ben Wright',
  phone: '+447467220101',
  status: 'paid',
  total: 176.99,
  itemCount: 3,
  createdAt: '2026-11-24T11:56:41.612Z',
  channel: 'web',
  version: 1,
}

const detail: OrderDetail = {
  ...summary,
  lines: [
    { name: 'Peony bouquet', qty: 1, lineTotal: 44.25 },
    { name: 'Olive oil 500ml', qty: 2, lineTotal: 88.5 },
    { name: 'Gift hamper', qty: 1, lineTotal: 44.24 },
  ],
  address: { line1: '53 Mare Street', area: 'Hackney, London' },
  notes: '',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function mockFetch(response: Response) {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValue(response)
}

function requestedUrl(fetchMock: jest.SpyInstance): URL {
  const [input] = fetchMock.mock.calls[0] as [string, RequestInit]
  return new URL(input)
}

function requestedInit(fetchMock: jest.SpyInstance): RequestInit {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  return init
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('getOrders', () => {
  it('sends the query and the bearer token, and returns the page', async () => {
    const fetchMock = mockFetch(jsonResponse({ orders: [summary], page: 2, pageSize: 20, total: 148 }))

    const page = await getOrders({ q: ' Ben ', status: 'paid', sort: 'total', dir: 'asc', page: 2, pageSize: 20 })

    const url = requestedUrl(fetchMock)
    expect(url.origin + url.pathname).toBe('http://localhost:4000/orders')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'Ben',
      status: 'paid',
      sort: 'total',
      dir: 'asc',
      page: '2',
      pageSize: '20',
    })
    expect(requestedInit(fetchMock).headers).toMatchObject({ Authorization: 'Bearer test-token' })
    expect(page).toEqual({ orders: [summary], page: 2, pageSize: 20, total: 148 })
  })

  it('never requests more than 50 orders per page', async () => {
    const fetchMock = mockFetch(jsonResponse({ orders: [], page: 1, pageSize: 50, total: 0 }))

    await getOrders({ pageSize: 500 })

    expect(requestedUrl(fetchMock).searchParams.get('pageSize')).toBe('50')
  })

  it('omits a blank search term', async () => {
    const fetchMock = mockFetch(jsonResponse({ orders: [], page: 1, pageSize: 20, total: 0 }))

    await getOrders({ q: '   ' })

    expect(requestedUrl(fetchMock).searchParams.has('q')).toBe(false)
  })

  it('rejects a response that does not match the contract', async () => {
    mockFetch(jsonResponse({ orders: [{ ...summary, status: 'shipped' }], page: 1, pageSize: 20, total: 1 }))

    await expect(getOrders()).rejects.toMatchObject({ name: 'ApiError', code: 'invalid_response' })
  })

  it('reports a network failure as an ApiError without a status', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(getOrders()).rejects.toMatchObject({ name: 'ApiError', status: null })
  })
})

describe('getOrder', () => {
  it('returns the order with its lines, address and notes', async () => {
    const fetchMock = mockFetch(jsonResponse(detail))

    await expect(getOrder('ord_2201')).resolves.toEqual(detail)
    expect(requestedUrl(fetchMock).pathname).toBe('/orders/ord_2201')
  })

  it('accepts a till order without an address', async () => {
    mockFetch(jsonResponse({ ...detail, channel: 'pos', address: null }))

    await expect(getOrder('ord_2201')).resolves.toMatchObject({ address: null })
  })

  it('exposes the status and error code of a failed request', async () => {
    mockFetch(jsonResponse({ code: 'not_found' }, 404))

    const error: unknown = await getOrder('ord_missing').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, code: 'not_found' })
  })
})

describe('updateOrderStatus', () => {
  it('sends the new status with the order version', async () => {
    const fetchMock = mockFetch(jsonResponse({ ...detail, status: 'fulfilled', version: 2 }))

    const updated = await updateOrderStatus(summary, 'fulfilled')

    const init = requestedInit(fetchMock)
    expect(init.method).toBe('PATCH')
    expect(init.body).toBe(JSON.stringify({ status: 'fulfilled', version: 1 }))
    expect(updated).toMatchObject({ status: 'fulfilled', version: 2 })
  })

  it.each(['new', 'fulfilled', 'cancelled'] as const)('refuses to fulfil an order that is %s without calling the API', async (status) => {
    const fetchMock = jest.spyOn(globalThis, 'fetch')

    await expect(updateOrderStatus({ ...summary, status }, 'fulfilled')).rejects.toBeInstanceOf(FulfilmentNotAllowedError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces a 409 version conflict with its code', async () => {
    mockFetch(jsonResponse({ code: 'stale', current: { ...detail, version: 2 } }, 409))

    await expect(updateOrderStatus(summary, 'fulfilled')).rejects.toMatchObject({ status: 409, code: 'stale' })
  })
})
