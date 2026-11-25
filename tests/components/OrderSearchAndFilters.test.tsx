import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrdersPage } from '../../src/pages/OrdersPage'
import { getOrders } from '../../src/services/orders-api'
import type { OrdersQuery } from '../../src/types/order.types'
import { buildOrder, buildPage } from '../fixtures/orders'

jest.mock('../../src/services/orders-api')

const getOrdersMock = jest.mocked(getOrders)

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
        total: 45,
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
    expect(await screen.findByText('45 paid orders match “ben”')).toBeInTheDocument()
  })

  it.each([
    ['Date created · Oldest first', 'createdAt', 'asc'],
    ['Total · High to low', 'total', 'desc'],
    ['Total · Low to high', 'total', 'asc'],
  ])('sorts by %s and returns to page 1', async (label, sort, dir) => {
    const user = await renderOnPageTwo()

    await user.click(screen.getByRole('button', { name: /^Sort:/ }))
    await user.click(screen.getByRole('menuitemradio', { name: label }))

    await waitFor(() => expect(lastQuery()).toMatchObject({ sort, dir, page: 1 }))
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
