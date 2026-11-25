/**
 * @jest-environment node
 */
import { ApiError, FulfilmentNotAllowedError } from '../../src/services/api-error'
import { getOrder, getOrders, REQUEST_TIMEOUT_MS, updateOrderStatus } from '../../src/services/orders-api'
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
    expect(page).toEqual({ orders: [summary], rejected: [], page: 2, pageSize: 20, total: 148 })
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

  it('reports an unreadable order without failing the rest of the page', async () => {
    const other = { ...summary, id: 'ord_2202', number: 2202 }
    mockFetch(jsonResponse({ orders: [{ ...summary, status: 'shipped' }, other], page: 1, pageSize: 20, total: 2 }))

    const page = await getOrders()

    expect(page.orders.map((order) => order.number)).toEqual([2202])
    expect(page.rejected).toEqual([{ id: 'ord_2201', number: 2201, reason: 'unknown status "shipped"' }])
  })

  it('rejects a response whose page information is missing', async () => {
    mockFetch(jsonResponse({ orders: [summary] }))

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

  it('accepts the response for a fulfilled till order with no customer name', async () => {
    mockFetch(jsonResponse({ ...detail, customerName: null, phone: null, channel: 'pos', address: null, status: 'fulfilled', version: 2 }))

    await expect(updateOrderStatus(summary, 'fulfilled')).resolves.toMatchObject({ status: 'fulfilled', customerName: null })
  })

  it('surfaces a 409 version conflict with its code', async () => {
    mockFetch(jsonResponse({ code: 'stale', current: { ...detail, version: 2 } }, 409))

    await expect(updateOrderStatus(summary, 'fulfilled')).rejects.toMatchObject({ status: 409, code: 'stale' })
  })
})

describe('request reliability', () => {
  function hangingFetch() {
    return jest.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')))
        }),
    )
  }

  afterEach(() => {
    jest.useRealTimers()
  })

  it('gives up with a timeout error when the service never answers', async () => {
    jest.useFakeTimers()
    hangingFetch()

    const result = getOrders().catch((caught: unknown) => caught)
    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)

    await expect(result).resolves.toMatchObject({ name: 'ApiError', status: null, code: 'timeout' })
  })

  it('also times out a fulfilment request instead of leaving it pending', async () => {
    jest.useFakeTimers()
    hangingFetch()

    const result = updateOrderStatus(summary, 'fulfilled').catch((caught: unknown) => caught)
    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)

    await expect(result).resolves.toMatchObject({ name: 'ApiError', code: 'timeout' })
  })

  it('passes a cancellation by the caller through unchanged', async () => {
    hangingFetch()
    const controller = new AbortController()

    const result = getOrders({}, { signal: controller.signal }).catch((caught: unknown) => caught)
    controller.abort()

    await expect(result).resolves.toMatchObject({ name: 'AbortError' })
  })

  it('treats a connection that drops while reading the body as a network failure', async () => {
    const brokenBody = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"orders": ['))
        controller.error(new TypeError('network error'))
      },
    })
    mockFetch(new Response(brokenBody, { status: 200 }))

    const error: unknown = await getOrders().catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: null, code: 'network', message: expect.stringContaining('Could not reach the orders service') })
  })

  it('keeps the HTTP status of an error page that is not JSON', async () => {
    mockFetch(new Response('<html><h1>Bad Gateway</h1></html>', { status: 502, headers: { 'Content-Type': 'text/html' } }))

    await expect(getOrders()).rejects.toMatchObject({ status: 502, code: null })
  })

  it('flags a successful response whose body cannot be read as JSON', async () => {
    mockFetch(new Response('{"orders": [', { status: 200 }))

    await expect(getOrders()).rejects.toMatchObject({ status: 200, code: 'invalid_json' })
  })
})
