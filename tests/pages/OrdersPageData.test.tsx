import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getOrder, getOrders, updateOrderStatus } from '../../src/services/orders-api'
import { OrdersPage } from '../../src/pages/OrdersPage'
import type { OrderDetail, OrderStatus } from '../../src/types/order.types'
import { buildOrder, buildPage } from '../fixtures/orders'

jest.mock('../../src/services/orders-api')

const getOrdersMock = jest.mocked(getOrders)
const getOrderMock = jest.mocked(getOrder)

afterEach(() => {
  jest.resetAllMocks()
})

function detailFor(status: OrderStatus, overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    ...buildOrder({ id: 'ord_2337', number: 2337, status }),
    lines: [{ name: 'Gift hamper', qty: 1, lineTotal: 176.99 }],
    address: null,
    notes: '',
    ...overrides,
  }
}

describe('Orders page with real-world data', () => {
  it('shows readable orders and lists each unreadable one with its reason', async () => {
    getOrdersMock.mockResolvedValue(
      buildPage([buildOrder()], {
        total: 3,
        rejected: [
          { id: 'ord_2337', number: 2337, reason: 'unknown status "teleported"' },
          { id: null, number: null, reason: 'not an order record' },
        ],
      }),
    )

    render(<OrdersPage />)

    const notice = await screen.findByRole('region', { name: '2 orders on this page couldn’t be shown' })
    expect(notice).toHaveTextContent('Order #2337: unknown status "teleported"')
    expect(notice).toHaveTextContent('An order without a number: not an order record')
    expect(within(screen.getByRole('table')).getByText('#2201')).toBeInTheDocument()
  })

  it('does not claim there are no orders when every order on the page was unreadable', async () => {
    getOrdersMock.mockResolvedValue(
      buildPage([], { total: 1, rejected: [{ id: 'ord_2337', number: 2337, reason: 'unreadable total "£1,401.99"' }] }),
    )

    render(<OrdersPage />)

    expect(await screen.findByRole('region', { name: '1 order on this page couldn’t be shown' })).toBeInTheDocument()
    expect(screen.queryByText('No orders yet')).not.toBeInTheDocument()
  })

  it('shows till orders without a name as "Till customer"', async () => {
    const user = userEvent.setup()
    getOrdersMock.mockResolvedValue(buildPage([buildOrder({ id: 'ord_2345', number: 2345, customerName: null, phone: null, channel: 'pos' })]))
    getOrderMock.mockResolvedValue(detailFor('paid', { id: 'ord_2345', number: 2345, customerName: null, phone: null, channel: 'pos' }))

    render(<OrdersPage />)

    const row = within(await screen.findByRole('table')).getByRole('row', { name: /2345/ })
    expect(row).toHaveTextContent('Till customer')

    await user.click(within(row).getByRole('button', { name: 'View order #2345' }))
    const panel = screen.getByRole('dialog', { name: 'Order #2345' })
    expect(await within(panel).findByText('Till customer')).toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'Mark as fulfilled' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Till customer · £176.99')
  })

  it.each([
    ['on_hold', 'On hold', 'This order is on hold, so it can’t be fulfilled.'],
    ['part_refunded', 'Part refunded', 'This order has been partly refunded, so it can’t be fulfilled from the desk.'],
  ] as const)('shows %s orders with their own label and never offers fulfilment', async (status, label, message) => {
    const user = userEvent.setup()
    getOrdersMock.mockResolvedValue(buildPage([buildOrder({ id: 'ord_2337', number: 2337, status })]))
    getOrderMock.mockResolvedValue(detailFor(status))

    render(<OrdersPage />)

    const row = within(await screen.findByRole('table')).getByRole('row', { name: /2337/ })
    expect(row).toHaveTextContent(label)
    await user.click(within(row).getByRole('button', { name: 'View order #2337' }))
    const panel = screen.getByRole('dialog', { name: 'Order #2337' })

    expect(await within(panel).findByText(message)).toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: 'Mark as fulfilled' })).not.toBeInTheDocument()
    expect(jest.mocked(updateOrderStatus)).not.toHaveBeenCalled()
  })

  it('offers filters for the on-hold and part-refunded statuses', async () => {
    const user = userEvent.setup()
    getOrdersMock.mockResolvedValue(buildPage([buildOrder()]))

    render(<OrdersPage />)
    await screen.findByRole('table')
    await user.click(within(screen.getByRole('group', { name: 'Filter by status' })).getByRole('button', { name: 'On hold' }))

    expect(getOrdersMock).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'on_hold', page: 1 }), expect.anything())
  })
})

describe('search focus on page load', () => {
  const originalMatchMedia = window.matchMedia

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  function pointer(precise: boolean) {
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: precise && query.includes('pointer: fine'),
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }))
  }

  it('focuses the search box for the scanner on a mouse or trackpad device', async () => {
    pointer(true)
    getOrdersMock.mockResolvedValue(buildPage([buildOrder()]))

    render(<OrdersPage />)

    expect(screen.getByLabelText('Search orders')).toHaveFocus()
  })

  it('does not focus it on a touch screen, where it would open the keyboard over the list', async () => {
    pointer(false)
    getOrdersMock.mockResolvedValue(buildPage([buildOrder()]))

    render(<OrdersPage />)
    await screen.findByRole('table')

    expect(screen.getByLabelText('Search orders')).not.toHaveFocus()
  })
})
