import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrdersPage, TOAST_DURATION_MS } from '../../src/pages/OrdersPage'
import { ApiError } from '../../src/services/api-error'
import { getOrder, getOrders, updateOrderStatus } from '../../src/services/orders-api'
import type { OrderDetail, OrderStatus } from '../../src/types/order.types'
import { buildOrder, buildPage } from '../fixtures/orders'

jest.mock('../../src/services/orders-api')

const getOrdersMock = jest.mocked(getOrders)
const getOrderMock = jest.mocked(getOrder)
const updateOrderStatusMock = jest.mocked(updateOrderStatus)

function buildDetail(status: OrderStatus, overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    ...buildOrder({ id: 'ord_2265', number: 2265, customerName: 'Jess Hughes', status, total: 160.9, version: 3 }),
    lines: [{ name: 'Peony bouquet', qty: 1, lineTotal: 160.9 }],
    address: { line1: '1 Mare Street', area: 'Hackney, London' },
    notes: '',
    ...overrides,
  }
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  let reject: (reason: unknown) => void = () => {}
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function openOrder(status: OrderStatus) {
  getOrdersMock.mockResolvedValue(buildPage([buildOrder({ id: 'ord_2265', number: 2265, status })]))
  getOrderMock.mockResolvedValue(buildDetail(status))
  const user = userEvent.setup()
  render(<OrdersPage />)
  const table = await screen.findByRole('table')
  await user.click(within(table).getByRole('button', { name: 'View order #2265' }))
  const drawer = screen.getByRole('dialog', { name: 'Order #2265' })
  await within(drawer).findByRole('table', { name: 'Items in order #2265' })
  return { user, drawer }
}

async function confirmFulfilment(user: ReturnType<typeof userEvent.setup>, drawer: HTMLElement) {
  await user.click(within(drawer).getByRole('button', { name: 'Mark as fulfilled' }))
  const confirm = await screen.findByRole('alertdialog', { name: 'Mark order #2265 as fulfilled?' })
  await user.click(within(confirm).getByRole('button', { name: 'Confirm fulfilment' }))
  return confirm
}

function statusIn(drawer: HTMLElement): string {
  return within(drawer).getByRole('heading', { name: 'Order #2265' }).parentElement?.textContent ?? ''
}

afterEach(() => {
  jest.resetAllMocks()
})

describe('Fulfilment', () => {
  it('never lets an unpaid order be fulfilled', async () => {
    const { user, drawer } = await openOrder('new')

    const button = within(drawer).getByRole('button', { name: 'Mark as fulfilled' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAccessibleDescription('Payment required before this order can be fulfilled.')

    await user.click(button)

    expect(within(drawer).getByRole('alert')).toHaveTextContent('Payment hasn’t been received')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(updateOrderStatusMock).not.toHaveBeenCalled()
  })

  it.each([
    ['fulfilled', 'This order has been fulfilled.'],
    ['cancelled', 'Cancelled orders can’t be fulfilled.'],
  ] as const)('offers no fulfil action for a %s order', async (status, message) => {
    const { drawer } = await openOrder(status)

    expect(within(drawer).queryByRole('button', { name: 'Mark as fulfilled' })).not.toBeInTheDocument()
    expect(within(drawer).getByText(message)).toBeInTheDocument()
  })

  it('asks for confirmation and does nothing when cancelled', async () => {
    const { user, drawer } = await openOrder('paid')

    await user.click(within(drawer).getByRole('button', { name: 'Mark as fulfilled' }))
    const confirm = screen.getByRole('alertdialog', { name: 'Mark order #2265 as fulfilled?' })
    expect(confirm).toHaveTextContent('Jess Hughes · £160.90')
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus()

    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Order #2265' })).toBeInTheDocument()
    expect(updateOrderStatusMock).not.toHaveBeenCalled()
  })

  it('sends the order version and shows Fulfilled only after the API confirms it', async () => {
    const request = deferred<OrderDetail>()
    updateOrderStatusMock.mockReturnValue(request.promise)
    const { user, drawer } = await openOrder('paid')

    const confirm = await confirmFulfilment(user, drawer)

    expect(updateOrderStatusMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'ord_2265', version: 3 }), 'fulfilled')
    expect(within(confirm).getByRole('button', { name: 'Fulfilling…' })).toHaveAttribute('aria-disabled', 'true')
    expect(statusIn(drawer)).toContain('Paid')
    expect(statusIn(drawer)).not.toContain('Fulfilled')

    const callsBefore = getOrdersMock.mock.calls.length
    request.resolve(buildDetail('fulfilled', { version: 4 }))

    expect(await within(drawer).findByRole('status')).toHaveTextContent('Order #2265 fulfilled.')
    expect(statusIn(drawer)).toContain('Fulfilled')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await waitFor(() => expect(getOrdersMock.mock.calls.length).toBeGreaterThan(callsBefore))
  })

  it('sends only one request when Confirm is clicked twice', async () => {
    updateOrderStatusMock.mockReturnValue(deferred<OrderDetail>().promise)
    const { user, drawer } = await openOrder('paid')

    const confirm = await confirmFulfilment(user, drawer)
    await user.click(within(confirm).getByRole('button', { name: 'Fulfilling…' }))

    expect(updateOrderStatusMock).toHaveBeenCalledTimes(1)
  })

  it('shows the latest order when someone else fulfilled it first (409 stale)', async () => {
    updateOrderStatusMock.mockRejectedValue(
      new ApiError('Request failed with status 409.', 409, 'stale', { code: 'stale', current: buildDetail('fulfilled', { version: 4 }) }),
    )
    const { user, drawer } = await openOrder('paid')

    await confirmFulfilment(user, drawer)

    expect(await within(drawer).findByText('Order #2265 was already fulfilled by someone else')).toBeInTheDocument()
    expect(statusIn(drawer)).toContain('Fulfilled')
    expect(within(drawer).queryByRole('button', { name: 'Mark as fulfilled' })).not.toBeInTheDocument()
  })

  it('retries a stale paid order with the newer version', async () => {
    updateOrderStatusMock
      .mockRejectedValueOnce(
        new ApiError('Request failed with status 409.', 409, 'stale', { code: 'stale', current: buildDetail('paid', { version: 5 }) }),
      )
      .mockResolvedValueOnce(buildDetail('fulfilled', { version: 6 }))
    const { user, drawer } = await openOrder('paid')

    await confirmFulfilment(user, drawer)
    expect(await within(drawer).findByText('Someone else changed Order #2265 while you had it open')).toBeInTheDocument()

    getOrderMock.mockResolvedValue(buildDetail('paid', { version: 5 }))
    await confirmFulfilment(user, drawer)

    expect(updateOrderStatusMock).toHaveBeenLastCalledWith(expect.objectContaining({ version: 5 }), 'fulfilled')
    expect(await within(drawer).findByText('Order #2265 fulfilled.')).toBeInTheDocument()
  })

  it('checks the latest status before opening the confirmation', async () => {
    const { user, drawer } = await openOrder('paid')
    getOrderMock.mockResolvedValue(buildDetail('paid', { version: 7 }))
    updateOrderStatusMock.mockResolvedValue(buildDetail('fulfilled', { version: 8 }))
    const detailCalls = getOrderMock.mock.calls.length

    await confirmFulfilment(user, drawer)

    expect(getOrderMock.mock.calls.length).toBe(detailCalls + 1)
    expect(updateOrderStatusMock).toHaveBeenCalledWith(expect.objectContaining({ version: 7 }), 'fulfilled')
  })

  it('does not open the confirmation when the order changed since it was opened', async () => {
    const { user, drawer } = await openOrder('paid')
    getOrderMock.mockResolvedValue(buildDetail('cancelled', { version: 4 }))
    const listCalls = getOrdersMock.mock.calls.length

    await user.click(within(drawer).getByRole('button', { name: 'Mark as fulfilled' }))

    expect(await within(drawer).findByText('Order #2265 can’t be fulfilled')).toBeInTheDocument()
    expect(within(drawer).getByText('It is now cancelled.')).toBeInTheDocument()
    expect(statusIn(drawer)).toContain('Cancelled')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(updateOrderStatusMock).not.toHaveBeenCalled()
    await waitFor(() => expect(getOrdersMock.mock.calls.length).toBeGreaterThan(listCalls))
  })

  it('does not open the confirmation when the latest status cannot be checked', async () => {
    const { user, drawer } = await openOrder('paid')
    getOrderMock.mockRejectedValue(new ApiError('The orders service took too long to respond.', null, 'timeout'))

    await user.click(within(drawer).getByRole('button', { name: 'Mark as fulfilled' }))

    expect(await within(drawer).findByRole('alert')).toHaveTextContent('Couldn’t check the latest status of order #2265')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(updateOrderStatusMock).not.toHaveBeenCalled()
  })

  it.each([
    ['network failure', new ApiError('Could not reach the orders service.', null, 'network')],
    ['timeout', new ApiError('The orders service took too long to respond.', null, 'timeout')],
    ['HTML 502', new ApiError('Request failed with status 502.', 502, null)],
    ['unreadable reply', new ApiError('The orders service sent a response the desk could not read.', 200, 'invalid_json')],
  ])('reports success, not failure, when a %s hid a fulfilment the server applied', async (_label, error) => {
    updateOrderStatusMock.mockRejectedValue(error)
    const { user, drawer } = await openOrder('paid')
    await user.click(within(drawer).getByRole('button', { name: 'Mark as fulfilled' }))
    const confirm = await screen.findByRole('alertdialog')
    getOrderMock.mockResolvedValue(buildDetail('fulfilled', { version: 4 }))

    await user.click(within(confirm).getByRole('button', { name: 'Confirm fulfilment' }))

    expect(await within(drawer).findByText('Order #2265 is fulfilled')).toBeInTheDocument()
    expect(statusIn(drawer)).toContain('Fulfilled')
    expect(within(drawer).queryByText(/not fulfilled/)).not.toBeInTheDocument()
  })

  it('says nothing changed when the order is still paid after an unknown outcome', async () => {
    updateOrderStatusMock.mockRejectedValue(new ApiError('Could not reach the orders service.', null, 'network'))
    const { user, drawer } = await openOrder('paid')

    await confirmFulfilment(user, drawer)

    const alert = await within(drawer).findByRole('alert')
    expect(alert).toHaveTextContent('Order #2265 was not fulfilled')
    expect(alert).toHaveTextContent('Nothing changed, so you can try again.')
    expect(statusIn(drawer)).toContain('Paid')
    expect(updateOrderStatusMock).toHaveBeenCalledTimes(1)
  })

  it('offers to check again when an unknown outcome cannot be confirmed', async () => {
    updateOrderStatusMock.mockRejectedValue(new ApiError('The orders service took too long to respond.', null, 'timeout'))
    const { user, drawer } = await openOrder('paid')
    await user.click(within(drawer).getByRole('button', { name: 'Mark as fulfilled' }))
    const confirm = await screen.findByRole('alertdialog')
    getOrderMock.mockRejectedValue(new ApiError('Could not reach the orders service.', null, 'network'))

    await user.click(within(confirm).getByRole('button', { name: 'Confirm fulfilment' }))

    const alert = await within(drawer).findByRole('alert')
    expect(alert).toHaveTextContent('We couldn’t confirm whether Order #2265 was fulfilled')
    expect(statusIn(drawer)).toContain('Paid')

    getOrderMock.mockResolvedValue(buildDetail('fulfilled', { version: 4 }))
    await user.click(within(alert).getByRole('button', { name: 'Check again' }))

    expect(await within(drawer).findByText('Order #2265 is fulfilled')).toBeInTheDocument()
    expect(statusIn(drawer)).toContain('Fulfilled')
    expect(updateOrderStatusMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['422', new ApiError('Request failed with status 422.', 422, 'invalid_status'), 'paid', 'The orders service refused the change.', 'Paid'],
    [
      '409 invalid transition',
      new ApiError('Request failed with status 409.', 409, 'invalid_transition', { code: 'invalid_transition', from: 'on_hold' }),
      'on_hold',
      'It is now on hold.',
      'On hold',
    ],
  ] as const)('describes a %s using the confirmed status', async (_label, error, latestStatus, detail, badge) => {
    updateOrderStatusMock.mockRejectedValue(error)
    const { user, drawer } = await openOrder('paid')
    await user.click(within(drawer).getByRole('button', { name: 'Mark as fulfilled' }))
    const confirm = await screen.findByRole('alertdialog')
    getOrderMock.mockResolvedValue(buildDetail(latestStatus))

    await user.click(within(confirm).getByRole('button', { name: 'Confirm fulfilment' }))

    expect(await within(drawer).findByText(detail, { exact: false })).toBeInTheDocument()
    expect(statusIn(drawer)).toContain(badge)
  })

  it('does not fetch or change anything after a 429', async () => {
    updateOrderStatusMock.mockRejectedValue(new ApiError('Request failed with status 429.', 429, 'slow_down'))
    const { user, drawer } = await openOrder('paid')

    await confirmFulfilment(user, drawer)
    const detailCalls = getOrderMock.mock.calls.length

    expect(await within(drawer).findByRole('alert')).toHaveTextContent('The orders service is busy right now. Nothing changed.')
    expect(getOrderMock.mock.calls.length).toBe(detailCalls)
    expect(within(drawer).getByRole('button', { name: 'Mark as fulfilled' })).toBeInTheDocument()
    expect(updateOrderStatusMock).toHaveBeenCalledTimes(1)
  })

  it('removes the actions and refreshes the list when the order no longer exists', async () => {
    updateOrderStatusMock.mockRejectedValue(new ApiError('Request failed with status 404.', 404, 'not_found'))
    const { user, drawer } = await openOrder('paid')
    const listCalls = getOrdersMock.mock.calls.length
    await user.click(within(drawer).getByRole('button', { name: 'Mark as fulfilled' }))
    const confirm = await screen.findByRole('alertdialog')
    getOrderMock.mockRejectedValue(new ApiError('Request failed with status 404.', 404, 'not_found'))

    await user.click(within(confirm).getByRole('button', { name: 'Confirm fulfilment' }))

    await waitFor(() => expect(within(drawer).queryByRole('button', { name: 'Mark as fulfilled' })).not.toBeInTheDocument())
    expect(within(drawer).getByText('Order #2265 no longer exists')).toBeInTheDocument()
    expect(within(drawer).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    await waitFor(() => expect(getOrdersMock.mock.calls.length).toBeGreaterThan(listCalls))
  })

  it('fetches the order again when it is reopened, instead of showing the old copy', async () => {
    const { user, drawer } = await openOrder('paid')
    await user.click(within(drawer).getByRole('button', { name: 'Close order details' }))
    const refetch = deferred<OrderDetail>()
    getOrderMock.mockReturnValueOnce(refetch.promise)

    await user.click(within(screen.getByRole('table')).getByRole('button', { name: 'View order #2265' }))

    const reopened = screen.getByRole('dialog', { name: 'Order #2265' })
    expect(within(reopened).getByRole('status')).toHaveTextContent('Loading order details…')
    expect(within(reopened).queryByRole('button', { name: 'Mark as fulfilled' })).not.toBeInTheDocument()

    refetch.resolve(buildDetail('fulfilled', { version: 4 }))

    expect(await within(reopened).findByText('This order has been fulfilled.')).toBeInTheDocument()
    expect(statusIn(reopened)).toContain('Fulfilled')
  })

  it('cannot start another fulfilment while the result is still being checked', async () => {
    const check = deferred<OrderDetail>()
    updateOrderStatusMock.mockRejectedValue(new ApiError('Request failed with status 502.', 502, null))
    const { user, drawer } = await openOrder('paid')
    await user.click(within(drawer).getByRole('button', { name: 'Mark as fulfilled' }))
    const confirm = await screen.findByRole('alertdialog')
    getOrderMock.mockReturnValueOnce(check.promise)
    await user.click(within(confirm).getByRole('button', { name: 'Confirm fulfilment' }))

    expect(await within(drawer).findByText('Checking the latest status of order #2265…')).toBeInTheDocument()
    await user.click(within(drawer).getByRole('button', { name: 'Mark as fulfilled' }))
    expect(screen.queryByRole('alertdialog', { name: /Mark order/ })).not.toBeInTheDocument()

    await act(async () => check.resolve(buildDetail('fulfilled', { version: 4 })))

    expect(await within(drawer).findByText('Order #2265 is fulfilled')).toBeInTheDocument()
    expect(updateOrderStatusMock).toHaveBeenCalledTimes(1)
  })

  it('can open the confirmation again after the browser closes it on its own', async () => {
    const { user, drawer } = await openOrder('paid')
    await user.click(within(drawer).getByRole('button', { name: 'Mark as fulfilled' }))
    const confirm = (await screen.findByRole('alertdialog')) as HTMLDialogElement

    act(() => confirm.close())

    expect(screen.queryByRole('alertdialog', { name: /Mark order/ })).not.toBeInTheDocument()
    await user.click(within(drawer).getByRole('button', { name: 'Mark as fulfilled' }))
    expect(await screen.findByRole('alertdialog', { name: 'Mark order #2265 as fulfilled?' })).toBeInTheDocument()
    expect(updateOrderStatusMock).not.toHaveBeenCalled()
  })

  it('ignores a late close event from an earlier close when the panel and confirmation are reopened', async () => {
    const { user, drawer } = await openOrder('paid')
    await user.click(within(drawer).getByRole('button', { name: 'Close order details' }))
    await user.click(within(screen.getByRole('table')).getByRole('button', { name: 'View order #2265' }))
    const reopened = screen.getByRole('dialog', { name: 'Order #2265' }) as HTMLDialogElement

    act(() => {
      reopened.dispatchEvent(new Event('close'))
    })

    expect(screen.getByRole('dialog', { name: 'Order #2265' })).toBeInTheDocument()
    await within(reopened).findByRole('table', { name: 'Items in order #2265' })

    await user.click(within(reopened).getByRole('button', { name: 'Mark as fulfilled' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    await user.click(within(reopened).getByRole('button', { name: 'Mark as fulfilled' }))
    const confirm = (await screen.findByRole('alertdialog')) as HTMLDialogElement

    act(() => {
      confirm.dispatchEvent(new Event('close'))
    })

    expect(screen.getByRole('alertdialog', { name: 'Mark order #2265 as fulfilled?' })).toBeInTheDocument()
  })

  it('keeps the confirmation open while the request is pending, even if the browser closes it', async () => {
    updateOrderStatusMock.mockReturnValue(deferred<OrderDetail>().promise)
    const { user, drawer } = await openOrder('paid')

    const confirm = (await confirmFulfilment(user, drawer)) as HTMLDialogElement
    act(() => confirm.close())

    expect(confirm.open).toBe(true)
    expect(within(confirm).getByRole('button', { name: 'Fulfilling…' })).toBeInTheDocument()
    expect(updateOrderStatusMock).toHaveBeenCalledTimes(1)
  })
})

describe('Fulfilment toast', () => {
  it('shows a toast after the API confirms, and moves focus to the fulfilled message', async () => {
    updateOrderStatusMock.mockResolvedValue(buildDetail('fulfilled', { version: 4 }))
    const { user, drawer } = await openOrder('paid')

    await confirmFulfilment(user, drawer)

    expect(await within(drawer).findByRole('status')).toHaveTextContent('Order #2265 fulfilled.')
    expect(within(drawer).getByText('This order has been fulfilled.')).toHaveFocus()
  })

  it('keeps the toast on the page after the panel closes, until it is dismissed', async () => {
    updateOrderStatusMock.mockResolvedValue(buildDetail('fulfilled', { version: 4 }))
    const { user, drawer } = await openOrder('paid')
    await confirmFulfilment(user, drawer)
    await within(drawer).findByText('Order #2265 fulfilled.')

    await user.click(within(drawer).getByRole('button', { name: 'Close order details' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Order #2265 fulfilled.')
    await user.click(screen.getByRole('button', { name: 'Dismiss message' }))
    expect(screen.queryByText('Order #2265 fulfilled.')).not.toBeInTheDocument()
  })

  it('hides the toast on its own after a few seconds', async () => {
    const request = deferred<OrderDetail>()
    updateOrderStatusMock.mockReturnValue(request.promise)
    const { user, drawer } = await openOrder('paid')
    await confirmFulfilment(user, drawer)

    jest.useFakeTimers()
    try {
      await act(async () => request.resolve(buildDetail('fulfilled', { version: 4 })))
      expect(within(drawer).getByText('Order #2265 fulfilled.')).toBeInTheDocument()

      act(() => jest.advanceTimersByTime(TOAST_DURATION_MS - 1))
      expect(within(drawer).getByText('Order #2265 fulfilled.')).toBeInTheDocument()
      act(() => jest.advanceTimersByTime(1))
      expect(screen.queryByText('Order #2265 fulfilled.')).not.toBeInTheDocument()
    } finally {
      jest.useRealTimers()
    }
  })

  it('shows failures in the panel, not as a toast', async () => {
    updateOrderStatusMock.mockRejectedValue(new ApiError('Request failed with status 429.', 429, null))
    const { user, drawer } = await openOrder('paid')

    await confirmFulfilment(user, drawer)

    expect(await within(drawer).findByText('Order #2265 was not fulfilled')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dismiss message' })).not.toBeInTheDocument()
  })
})
