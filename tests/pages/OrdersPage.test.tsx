import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrdersPage } from '../../src/pages/OrdersPage'
import { ApiError } from '../../src/services/api-error'
import { getOrders } from '../../src/services/orders-api'
import { buildOrder, buildPage } from '../fixtures/orders'

jest.mock('../../src/services/orders-api')

const getOrdersMock = jest.mocked(getOrders)

const DEFAULT_QUERY = { sort: 'createdAt', dir: 'desc', page: 1, pageSize: 20 }

afterEach(() => {
  jest.resetAllMocks()
})

describe('OrdersPage', () => {
  it('shows each order with its number, customer, date, status and total', async () => {
    getOrdersMock.mockResolvedValue(
      buildPage([
        buildOrder(),
        buildOrder({ id: 'ord_2202', number: 2202, customerName: 'Ada Shaw', status: 'new', total: 1234.5 }),
      ]),
    )

    render(<OrdersPage />)

    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(within(rows[1]!).getByRole('rowheader')).toHaveTextContent('#2201')
    expect(rows[1]).toHaveTextContent('Ben Wright')
    expect(rows[1]).toHaveTextContent('24 Nov, 11:56')
    expect(rows[1]).toHaveTextContent('Website')
    expect(rows[1]).toHaveTextContent('Paid')
    expect(rows[1]).toHaveTextContent('£176.99')
    expect(rows[2]).toHaveTextContent('Ada Shaw')
    expect(rows[2]).toHaveTextContent('New')
    expect(rows[2]).toHaveTextContent('£1,234.50')
  })

  it('never shows customer phone numbers', async () => {
    getOrdersMock.mockResolvedValue(buildPage([buildOrder()]))

    render(<OrdersPage />)

    await screen.findByRole('table')
    expect(screen.queryByText(/\+447467220101/)).not.toBeInTheDocument()
  })

  it('requests at most 20 orders per page and moves between pages', async () => {
    const user = userEvent.setup()
    getOrdersMock.mockImplementation((query = {}) =>
      Promise.resolve(
        buildPage([buildOrder({ id: `ord_${query.page ?? 1}`, number: 3000 + (query.page ?? 1) })], {
          page: query.page ?? 1,
          total: 45,
        }),
      ),
    )

    render(<OrdersPage />)

    expect(await screen.findByText(/Page 1 of 3/)).toBeInTheDocument()
    expect(getOrdersMock).toHaveBeenLastCalledWith({ ...DEFAULT_QUERY, page: 1 }, expect.anything())
    expect(screen.getByRole('button', { name: 'Previous page' })).toHaveAttribute('aria-disabled', 'true')

    await user.click(screen.getByRole('button', { name: 'Next page' }))

    expect(await screen.findByText(/Page 2 of 3/)).toBeInTheDocument()
    expect(await within(screen.getByRole('table')).findByText('#3002')).toBeInTheDocument()
    expect(getOrdersMock).toHaveBeenLastCalledWith({ ...DEFAULT_QUERY, page: 2 }, expect.anything())
    expect(screen.getByText('Showing 21–40 of 45 orders')).toBeInTheDocument()
  })

  it('moves back to the last page when the requested page no longer exists', async () => {
    const user = userEvent.setup()
    let total = 45
    getOrdersMock.mockImplementation((query = {}) => {
      const page = query.page ?? 1
      if (page === 3) total = 30
      return Promise.resolve(buildPage([buildOrder({ id: `ord_${page}`, number: 3000 + page })], { page, total }))
    })

    render(<OrdersPage />)
    await user.click(await screen.findByRole('button', { name: 'Next page' }))
    expect(await screen.findByText(/Page 2 of 3/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next page' }))

    await waitFor(() => expect(getOrdersMock).toHaveBeenLastCalledWith({ ...DEFAULT_QUERY, page: 2 }, expect.anything()))
    expect(await within(screen.getByRole('table')).findByText('#3002')).toBeInTheDocument()
    expect(screen.getByText('Showing 21–30 of 30 orders')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('shows a loading state before the first page arrives', async () => {
    getOrdersMock.mockResolvedValue(buildPage([buildOrder()]))

    render(<OrdersPage />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading orders…')
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('shows an empty state when there are no orders', async () => {
    getOrdersMock.mockResolvedValue(buildPage([]))

    render(<OrdersPage />)

    expect(await screen.findByText('No orders yet')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
  })

  it('shows an error and loads again when asked', async () => {
    const user = userEvent.setup()
    getOrdersMock
      .mockRejectedValueOnce(new ApiError('Request failed with status 429.', 429, null))
      .mockResolvedValueOnce(buildPage([buildOrder()]))

    render(<OrdersPage />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Unable to load orders')
    expect(alert).toHaveTextContent('The orders service is busy right now.')

    await user.click(within(alert).getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
