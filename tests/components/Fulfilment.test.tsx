import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrdersPage } from '../../src/pages/OrdersPage'
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
  const confirm = screen.getByRole('alertdialog', { name: 'Mark order #2265 as fulfilled?' })
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

    expect(await within(drawer).findByRole('alert')).toHaveTextContent('Order #2265 was already fulfilled by someone else.')
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
    expect(await within(drawer).findByRole('alert')).toHaveTextContent('Someone else changed order #2265')

    await confirmFulfilment(user, drawer)

    expect(updateOrderStatusMock).toHaveBeenLastCalledWith(expect.objectContaining({ version: 5 }), 'fulfilled')
    expect(await within(drawer).findByRole('status')).toHaveTextContent('Order #2265 fulfilled.')
  })

  it.each([
    [
      '422',
      new ApiError('Request failed with status 422.', 422, 'invalid_status'),
      'The server rejected this change, so order #2265 was not fulfilled.',
    ],
    [
      'network failure',
      new ApiError('Could not reach the orders service.', null),
      'We couldn’t confirm whether order #2265 was fulfilled.',
    ],
    ['409 invalid transition', new ApiError('Request failed with status 409.', 409, 'invalid_transition', { code: 'invalid_transition', from: 'new' }), 'Order #2265 can’t be fulfilled because it is new.'],
  ])('keeps the status and reloads the order after a %s', async (_label, error, message) => {
    updateOrderStatusMock.mockRejectedValue(error)
    const { user, drawer } = await openOrder('paid')
    const detailCallsBefore = getOrderMock.mock.calls.length

    await confirmFulfilment(user, drawer)

    expect(await within(drawer).findByRole('alert')).toHaveTextContent(message)
    expect(statusIn(drawer)).toContain('Paid')
    await waitFor(() => expect(getOrderMock.mock.calls.length).toBeGreaterThan(detailCallsBefore))
  })

  it('does not reload or change anything after a 429', async () => {
    updateOrderStatusMock.mockRejectedValue(new ApiError('Request failed with status 429.', 429, null))
    const { user, drawer } = await openOrder('paid')
    const detailCallsBefore = getOrderMock.mock.calls.length

    await confirmFulfilment(user, drawer)

    expect(await within(drawer).findByRole('alert')).toHaveTextContent('Too many requests. Nothing was changed.')
    expect(getOrderMock.mock.calls.length).toBe(detailCallsBefore)
    expect(within(drawer).getByRole('button', { name: 'Mark as fulfilled' })).toBeInTheDocument()
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

  it('keeps a confirmed fulfilment when an older reload arrives afterwards', async () => {
    const staleReload = deferred<OrderDetail>()
    updateOrderStatusMock
      .mockRejectedValueOnce(new ApiError('Request failed with status 422.', 422, 'invalid_status'))
      .mockResolvedValueOnce(buildDetail('fulfilled', { version: 4 }))
    const { user, drawer } = await openOrder('paid')
    getOrderMock.mockReturnValueOnce(staleReload.promise)

    await confirmFulfilment(user, drawer)
    await within(drawer).findByRole('alert')
    await confirmFulfilment(user, drawer)
    expect(await within(drawer).findByRole('status')).toHaveTextContent('Order #2265 fulfilled.')

    await act(async () => staleReload.resolve(buildDetail('paid', { version: 3 })))

    expect(statusIn(drawer)).toContain('Fulfilled')
    expect(within(drawer).queryByRole('button', { name: 'Mark as fulfilled' })).not.toBeInTheDocument()
  })

  it('can open the confirmation again after the browser closes it on its own', async () => {
    const { user, drawer } = await openOrder('paid')
    await user.click(within(drawer).getByRole('button', { name: 'Mark as fulfilled' }))
    const confirm = screen.getByRole('alertdialog') as HTMLDialogElement

    act(() => confirm.close())

    expect(screen.queryByRole('alertdialog', { name: /Mark order/ })).not.toBeInTheDocument()
    await user.click(within(drawer).getByRole('button', { name: 'Mark as fulfilled' }))
    expect(screen.getByRole('alertdialog', { name: 'Mark order #2265 as fulfilled?' })).toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(within(reopened).getByRole('button', { name: 'Mark as fulfilled' }))
    const confirm = screen.getByRole('alertdialog') as HTMLDialogElement

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
