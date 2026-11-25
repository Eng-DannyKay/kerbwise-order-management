import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrdersPage } from '../../src/pages/OrdersPage'
import { getAllOrders, getOrder, getOrders, updateOrderStatus } from '../../src/services/orders-api'
import type { OrderDetail, OrdersQuery } from '../../src/types/order.types'
import { buildOrder, buildPage } from '../fixtures/orders'

jest.mock('../../src/services/orders-api')

const getOrdersMock = jest.mocked(getOrders)
const getOrderMock = jest.mocked(getOrder)

function detail(number: number): OrderDetail {
  return {
    ...buildOrder({ id: `ord_${number}`, number }),
    lines: [{ name: 'Gift hamper', qty: 1, lineTotal: 176.99 }],
    address: null,
    notes: '',
  }
}

const order2201 = buildOrder({ id: 'ord_2201', number: 2201 })
const order2345 = buildOrder({ id: 'ord_2345', number: 2345, customerName: null, phone: null, channel: 'pos' })
const order2237 = buildOrder({ id: 'ord_2237', number: 2237, customerName: 'Ben Wright', phone: '07406-234-537' })

beforeEach(() => {
  getOrdersMock.mockImplementation((query: OrdersQuery = {}) => {
    if (query.q === '2345') return Promise.resolve(buildPage([order2345, order2237]))
    if (query.q === '2237') return Promise.resolve(buildPage([order2237]))
    return Promise.resolve(buildPage([order2201, order2237], { total: 45 }))
  })
  getOrderMock.mockImplementation((id: string) => Promise.resolve(detail(Number(id.replace('ord_', '')))))
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('Scanning order numbers', () => {
  it('opens the exactly matching order even when a phone number also matched', async () => {
    const user = userEvent.setup()
    render(<OrdersPage />)
    await screen.findByRole('table')

    await user.type(screen.getByLabelText('Search orders'), '2345{Enter}')

    expect(await screen.findByRole('dialog', { name: 'Order #2345' })).toBeInTheDocument()
  })

  it('switches to the scanned order while another order is open', async () => {
    const user = userEvent.setup()
    render(<OrdersPage />)
    await user.click(within(await screen.findByRole('table')).getByRole('button', { name: 'View order #2201' }))
    const first = screen.getByRole('dialog', { name: 'Order #2201' })
    await within(first).findByRole('table', { name: 'Items in order #2201' })
    within(first).getByRole('button', { name: 'Close order details' }).focus()

    await user.keyboard('2345{Enter}')

    expect(await screen.findByRole('dialog', { name: 'Order #2345' })).toBeInTheDocument()
    expect(screen.getByLabelText('Search orders')).toHaveValue('2345')
  })

  it('stops the scanner’s Enter from pressing the button that has focus', async () => {
    const user = userEvent.setup()
    render(<OrdersPage />)
    const next = await screen.findByRole('button', { name: 'Next page' })
    next.focus()

    await user.keyboard('2237{Enter}')

    expect(await screen.findByRole('dialog', { name: 'Order #2237' })).toBeInTheDocument()
    expect(getOrdersMock).not.toHaveBeenCalledWith(expect.objectContaining({ page: 2 }), expect.anything())
  })

  it('never confirms a fulfilment from a scan', async () => {
    const user = userEvent.setup()
    render(<OrdersPage />)
    await user.click(within(await screen.findByRole('table')).getByRole('button', { name: 'View order #2201' }))
    const panel = screen.getByRole('dialog', { name: 'Order #2201' })
    await user.click(await within(panel).findByRole('button', { name: 'Mark as fulfilled' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Mark order #2201 as fulfilled?' })
    within(confirm).getByRole('button', { name: 'Confirm fulfilment' }).focus()

    await user.keyboard('2345{Enter}')

    expect(jest.mocked(updateOrderStatus)).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog', { name: 'Mark order #2201 as fulfilled?' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Order #2345' })).not.toBeInTheDocument()
  })

  it('still lets keyboard users press a focused button with Enter', async () => {
    const user = userEvent.setup()
    render(<OrdersPage />)
    const next = await screen.findByRole('button', { name: 'Next page' })
    next.focus()

    await user.keyboard('{Enter}')

    await waitFor(() => expect(getOrdersMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.anything()))
  })

  it('does not open anything when Enter is pressed in an empty search', async () => {
    const user = userEvent.setup()
    getOrdersMock.mockResolvedValue(buildPage([order2201]))
    render(<OrdersPage />)
    await screen.findByRole('table')

    await user.click(screen.getByLabelText('Search orders'))
    await user.keyboard('{Enter}')

    await waitFor(() => expect(getOrdersMock.mock.calls.length).toBeGreaterThan(0))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(getOrderMock).not.toHaveBeenCalled()
  })
})

describe('List changes while browsing', () => {
  it('says the list has changed when the total moves between pages, and refreshes from page 1', async () => {
    const user = userEvent.setup()
    getOrdersMock.mockImplementation((query: OrdersQuery = {}) =>
      Promise.resolve(buildPage([buildOrder({ id: `ord_${query.page}`, number: 3000 + (query.page ?? 1) })], { page: query.page ?? 1, total: query.page === 2 ? 46 : 45 })),
    )
    render(<OrdersPage />)
    await screen.findByRole('table')
    expect(screen.queryByText('The order list has changed since you opened it.')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next page' }))

    const notice = (await screen.findByText('The order list has changed since you opened it.')).closest('[role=status]')
    expect(notice).toHaveTextContent('Some orders may now appear twice or be missed between pages.')

    await user.click(screen.getByRole('button', { name: 'Refresh list' }))

    await waitFor(() => expect(getOrdersMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }), expect.anything()))
    await waitFor(() => expect(screen.queryByText('The order list has changed since you opened it.')).not.toBeInTheDocument())
  })

  it('warns when the list changed while every page was being loaded for sorting by total', async () => {
    const user = userEvent.setup()
    jest.mocked(getAllOrders).mockResolvedValue({ orders: [order2201], rejected: [], changedWhileLoading: true })
    render(<OrdersPage />)
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: /^Sort:/ }))
    await user.click(screen.getByRole('menuitemradio', { name: 'Total · High to low' }))

    expect(await screen.findByText('The order list has changed since you opened it.')).toBeInTheDocument()
  })
})
