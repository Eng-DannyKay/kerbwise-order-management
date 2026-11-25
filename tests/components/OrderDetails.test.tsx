import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrdersPage } from '../../src/pages/OrdersPage'
import { ApiError } from '../../src/services/api-error'
import { getOrder, getOrders } from '../../src/services/orders-api'
import type { OrderDetail } from '../../src/types/order.types'
import { buildOrder, buildPage } from '../fixtures/orders'

jest.mock('../../src/services/orders-api')

const getOrdersMock = jest.mocked(getOrders)
const getOrderMock = jest.mocked(getOrder)

const detail: OrderDetail = {
  ...buildOrder({ id: 'ord_2201', number: 2201, customerName: 'Ben Wright', status: 'paid', total: 176.99 }),
  lines: [
    { name: 'Peony bouquet', qty: 1, lineTotal: 44.25 },
    { name: 'Olive oil 500ml', qty: 2, lineTotal: 88.5 },
    { name: 'Gift hamper', qty: 1, lineTotal: 44.24 },
  ],
  address: { line1: '53 Mare Street', area: 'Hackney, London' },
  notes: 'Gift wrap please.',
}

beforeEach(() => {
  getOrdersMock.mockResolvedValue(
    buildPage([buildOrder({ id: 'ord_2201', number: 2201 }), buildOrder({ id: 'ord_2202', number: 2202 })]),
  )
  getOrderMock.mockResolvedValue(detail)
})

afterEach(() => {
  jest.resetAllMocks()
})

async function openOrder(number: number) {
  const user = userEvent.setup()
  render(<OrdersPage />)
  const table = await screen.findByRole('table')
  await user.click(within(table).getByRole('button', { name: `View order #${number}` }))
  return { user, dialog: screen.getByRole('dialog', { name: `Order #${number}` }) }
}

describe('Order details', () => {
  it('shows the items, quantities, line totals, total, address and note', async () => {
    const { dialog } = await openOrder(2201)

    const items = await within(dialog).findByRole('table', { name: 'Items in order #2201' })
    const oil = within(items).getByRole('row', { name: /Olive oil 500ml/ })
    expect(oil).toHaveTextContent('Qty 2')
    expect(oil).toHaveTextContent('£88.50')
    expect(oil).not.toHaveTextContent('£177.00')
    expect(within(items).getByRole('row', { name: /Total/ })).toHaveTextContent('£176.99')

    expect(within(dialog).getByText(/53 Mare Street/)).toHaveTextContent('53 Mare StreetHackney, London')
    expect(within(dialog).getByText('Gift wrap please.')).toBeInTheDocument()
    expect(within(dialog).getByText('Ben Wright')).toBeInTheDocument()
    expect(getOrderMock).toHaveBeenCalledWith('ord_2201', expect.anything())
  })

  it('never shows the customer phone number', async () => {
    const { dialog } = await openOrder(2201)

    await within(dialog).findByRole('table', { name: 'Items in order #2201' })
    expect(within(dialog).queryByText(/\+447467220101/)).not.toBeInTheDocument()
    expect(within(dialog).queryByText(/phone/i)).not.toBeInTheDocument()
  })

  it('explains that till orders have no delivery address', async () => {
    getOrderMock.mockResolvedValue({ ...detail, channel: 'pos', address: null, notes: '' })

    const { dialog } = await openOrder(2201)

    expect(await within(dialog).findByText(/Till orders are handed over in the shop/)).toBeInTheDocument()
    expect(within(dialog).getByText('No note for this order.')).toBeInTheDocument()
  })

  it('shows a loading state while the order is fetched', async () => {
    getOrderMock.mockReturnValue(new Promise(() => {}))

    const { dialog } = await openOrder(2201)

    expect(within(dialog).getByRole('status')).toHaveTextContent('Loading order details…')
    expect(within(dialog).getByRole('heading', { name: 'Order #2201' })).toBeInTheDocument()
  })

  it('shows an error with a retry when the order cannot be loaded', async () => {
    getOrderMock
      .mockRejectedValueOnce(new ApiError('Request failed with status 404.', 404, 'not_found'))
      .mockResolvedValueOnce(detail)

    const { user, dialog } = await openOrder(2201)

    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent('This order could not be found.')

    await user.click(within(alert).getByRole('button', { name: 'Try again' }))

    expect(await within(dialog).findByRole('table', { name: 'Items in order #2201' })).toBeInTheDocument()
  })

  it('closes with the close button', async () => {
    const { user, dialog } = await openOrder(2201)

    await user.click(within(dialog).getByRole('button', { name: 'Close order details' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the order straight away when a scanned number matches exactly one order', async () => {
    const user = userEvent.setup()
    getOrdersMock.mockImplementation((query = {}) =>
      Promise.resolve(
        query.q === '2201'
          ? buildPage([buildOrder({ id: 'ord_2201', number: 2201 })])
          : buildPage([buildOrder({ id: 'ord_2201', number: 2201 }), buildOrder({ id: 'ord_2202', number: 2202 })]),
      ),
    )
    render(<OrdersPage />)
    await screen.findByRole('table')

    await user.type(screen.getByLabelText('Search orders'), '2201{Enter}')

    expect(await screen.findByRole('dialog', { name: 'Order #2201' })).toBeInTheDocument()
  })

  it('does not open anything when a search matches several orders', async () => {
    const user = userEvent.setup()
    render(<OrdersPage />)
    await screen.findByRole('table')

    await user.type(screen.getByLabelText('Search orders'), 'ben{Enter}')

    await waitFor(() => expect(getOrdersMock).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'ben' }), expect.anything()))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(getOrderMock).not.toHaveBeenCalled()
  })
})
