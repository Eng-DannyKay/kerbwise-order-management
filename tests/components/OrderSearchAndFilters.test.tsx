import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrdersPage } from '../../src/pages/OrdersPage'
import { getAllOrders, getOrders } from '../../src/services/orders-api'
import type { OrdersQuery } from '../../src/types/order.types'
import { buildOrder, buildPage } from '../fixtures/orders'

jest.mock('../../src/services/orders-api')

const getOrdersMock = jest.mocked(getOrders)
const getAllOrdersMock = jest.mocked(getAllOrders)

function lastQuery(): OrdersQuery {
  const call = getOrdersMock.mock.lastCall
  if (!call) throw new Error('getOrders was not called')
  return call[0] ?? {}
}

beforeEach(() => {
  getOrdersMock.mockImplementation((query = {}) =>
    Promise.resolve(
      buildPage([buildOrder({ id: `ord_${query.page ?? 1}`, number: 3000 + (query.page ?? 1) })], {
        page: query.page ?? 1,
        total: 148,
      }),
    ),
  )
})

afterEach(() => {
  jest.resetAllMocks()
})

async function renderOnPageTwo() {
  const user = userEvent.setup()
  render(<OrdersPage />)
  await user.click(await screen.findByRole('button', { name: 'Next page' }))
  await waitFor(() => expect(lastQuery().page).toBe(2))
  return user
}

describe('Order search, filters and sorting', () => {
  it('searches immediately on Enter, as a barcode scanner does, and returns to page 1', async () => {
    const user = await renderOnPageTwo()

    await user.type(screen.getByLabelText('Search orders'), '2201{Enter}')

    await waitFor(() => expect(lastQuery()).toMatchObject({ q: '2201', page: 1 }))
  })

  it('searches by customer name after typing stops', async () => {
    const user = userEvent.setup()
    render(<OrdersPage />)
    await screen.findByRole('table')

    await user.type(screen.getByLabelText('Search orders'), '  Ben Wright ')

    await waitFor(() => expect(lastQuery()).toMatchObject({ q: 'Ben Wright', page: 1 }))
    expect(getOrdersMock.mock.calls.filter(([query]) => query?.q !== undefined)).toHaveLength(1)
  })

  it('filters by status, keeps the search, and returns to page 1', async () => {
    const user = await renderOnPageTwo()
    await user.type(screen.getByLabelText('Search orders'), 'ben{Enter}')

    const statusGroup = screen.getByRole('group', { name: 'Filter by status' })
    await user.click(within(statusGroup).getByRole('button', { name: 'Paid' }))

    await waitFor(() => expect(lastQuery()).toMatchObject({ q: 'ben', status: 'paid', page: 1 }))
    expect(within(statusGroup).getByRole('button', { name: 'Paid' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText('148 paid orders match “ben”')).toBeInTheDocument()
  })

  it('sorts by date on the server and returns to page 1', async () => {
    const user = await renderOnPageTwo()

    await user.click(screen.getByRole('button', { name: /^Sort:/ }))
    await user.click(screen.getByRole('menuitemradio', { name: 'Date created · Oldest first' }))

    await waitFor(() => expect(lastQuery()).toMatchObject({ sort: 'createdAt', dir: 'asc', page: 1 }))
  })

  it.each([
    ['Total · High to low', ['#3001', '#3003', '#3002']],
    ['Total · Low to high', ['#3002', '#3003', '#3001']],
  ])('sorts by %s across every loaded order, not just one page', async (label, expected) => {
    const user = userEvent.setup()
    getAllOrdersMock.mockResolvedValue({
      orders: [
        buildOrder({ id: 'ord_3002', number: 3002, total: 36.99 }),
        buildOrder({ id: 'ord_3001', number: 3001, total: 1401.99 }),
        buildOrder({ id: 'ord_3003', number: 3003, total: 78.5 }),
      ],
      rejected: [],
      changedWhileLoading: false,
    })
    render(<OrdersPage />)
    await screen.findByRole('table')
    await user.type(screen.getByLabelText('Search orders'), 'ben{Enter}')

    await user.click(screen.getByRole('button', { name: /^Sort:/ }))
    await user.click(screen.getByRole('menuitemradio', { name: label }))

    await waitFor(() => expect(getAllOrdersMock).toHaveBeenCalledWith({ q: 'ben', status: undefined }, expect.anything()))
    const table = screen.getByRole('table')
    await waitFor(() => expect(within(table).getAllByRole('rowheader').map((cell) => cell.textContent)).toEqual(expected))
  })

  it('offers a way back when nothing matches', async () => {
    const user = userEvent.setup()
    getOrdersMock.mockImplementation((query = {}) =>
      Promise.resolve(query.q ? buildPage([]) : buildPage([buildOrder()], { total: 148 })),
    )
    render(<OrdersPage />)
    await screen.findByRole('table')

    await user.type(screen.getByLabelText('Search orders'), 'zzz{Enter}')

    expect(await screen.findByText('No orders match “zzz”')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear search and filters' }))

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByLabelText('Search orders')).toHaveValue('')
    expect(lastQuery().q).toBeUndefined()
  })

  it('clears the search straight away with the clear button', async () => {
    const user = userEvent.setup()
    render(<OrdersPage />)
    const input = await screen.findByLabelText('Search orders')
    await user.type(input, 'ben{Enter}')
    await waitFor(() => expect(lastQuery().q).toBe('ben'))

    await user.click(screen.getByRole('button', { name: 'Clear search' }))

    await waitFor(() => expect(lastQuery().q).toBeUndefined())
    expect(input).toHaveFocus()
  })
})

describe('Pages of 50', () => {
  const allOrders = Array.from({ length: 148 }, (_, index) =>
    buildOrder({
      id: `ord_${4000 - index}`,
      number: 4000 - index,
      status: index % 2 === 0 ? 'paid' : 'new',
      total: index + 1,
    }),
  )

  function serve(query: OrdersQuery = {}) {
    const page = query.page ?? 1
    const pageSize = Math.min(query.pageSize ?? 20, 50)
    const matching = allOrders.filter((order) => !query.status || order.status === query.status)
    return Promise.resolve(
      buildPage(matching.slice((page - 1) * pageSize, page * pageSize), { page, pageSize, total: matching.length }),
    )
  }

  function shownNumbers(): number[] {
    return within(screen.getByRole('table'))
      .getAllByRole('rowheader')
      .map((cell) => Number(cell.textContent?.slice(1)))
  }

  it('lists all 148 orders as 1–50, 51–100 and 101–148', async () => {
    const user = userEvent.setup()
    getOrdersMock.mockImplementation(serve)
    render(<OrdersPage />)

    expect(await screen.findByText('Showing 1–50 of 148 orders')).toBeInTheDocument()
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument()
    expect(shownNumbers()).toHaveLength(50)
    expect(shownNumbers()[0]).toBe(4000)
    expect(getOrdersMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 50 }), expect.anything())

    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Showing 51–100 of 148 orders')).toBeInTheDocument()
    expect(shownNumbers()).toHaveLength(50)
    expect(shownNumbers()[0]).toBe(3950)

    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Showing 101–148 of 148 orders')).toBeInTheDocument()
    expect(shownNumbers()).toHaveLength(48)
    expect(shownNumbers().at(-1)).toBe(3853)
    expect(screen.getByRole('button', { name: 'Next page' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('never requests more than 50 orders at a time', async () => {
    const user = userEvent.setup()
    getOrdersMock.mockImplementation(serve)
    render(<OrdersPage />)
    await screen.findByText('Showing 1–50 of 148 orders')
    await user.click(screen.getByRole('button', { name: 'Page 3' }))
    await screen.findByText('Showing 101–148 of 148 orders')

    for (const [query] of getOrdersMock.mock.calls) expect(query?.pageSize).toBe(50)
  })

  it('pages a status filter in 50s and returns to page 1 when the filter changes', async () => {
    const user = userEvent.setup()
    getOrdersMock.mockImplementation(serve)
    render(<OrdersPage />)
    await screen.findByText('Showing 1–50 of 148 orders')
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await screen.findByText('Showing 51–100 of 148 orders')

    await user.click(within(screen.getByRole('group', { name: 'Filter by status' })).getByRole('button', { name: 'Paid' }))

    expect(await screen.findByText('Showing 1–50 of 74 orders')).toBeInTheDocument()
    expect(getOrdersMock).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'paid', page: 1, pageSize: 50 }), expect.anything())
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Showing 51–74 of 74 orders')).toBeInTheDocument()
    expect(shownNumbers()).toHaveLength(24)
  })

  it('sorts every order by total and pages the result in 50s', async () => {
    const user = userEvent.setup()
    getOrdersMock.mockImplementation(serve)
    getAllOrdersMock.mockResolvedValue({ orders: allOrders, rejected: [], changedWhileLoading: false })
    render(<OrdersPage />)
    await screen.findByText('Showing 1–50 of 148 orders')

    await user.click(screen.getByRole('button', { name: /^Sort:/ }))
    await user.click(screen.getByRole('menuitemradio', { name: 'Total · High to low' }))

    expect(await screen.findByText('Showing 1–50 of 148 orders')).toBeInTheDocument()
    await waitFor(() => expect(shownNumbers()[0]).toBe(3853))
    expect(shownNumbers()).toHaveLength(50)

    await user.click(screen.getByRole('button', { name: 'Page 3' }))
    expect(await screen.findByText('Showing 101–148 of 148 orders')).toBeInTheDocument()
    expect(shownNumbers()).toHaveLength(48)
    expect(shownNumbers().at(-1)).toBe(4000)
    expect(getAllOrdersMock).toHaveBeenCalledTimes(1)
  })
})
