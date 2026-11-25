import { findOrderToOpen } from '../../src/utils/scan-match'
import { sortByTotal } from '../../src/utils/order-sort'
import { buildOrder, buildPage } from '../fixtures/orders'

describe('sortByTotal', () => {
  const orders = [
    buildOrder({ id: 'a', number: 1, total: 78.5, createdAt: '2026-11-25T10:00:00.000Z' }),
    buildOrder({ id: 'b', number: 2, total: 1401.99, createdAt: '2026-11-25T09:00:00.000Z' }),
    buildOrder({ id: 'c', number: 3, total: 78.5, createdAt: '2026-11-25T11:00:00.000Z' }),
    buildOrder({ id: 'd', number: 4, total: 9, createdAt: '2026-11-25T08:00:00.000Z' }),
  ]

  it('sorts numerically, so £1,401.99 is above £78.50, with newer orders first on ties', () => {
    expect(sortByTotal(orders, 'desc').map((o) => o.number)).toEqual([2, 3, 1, 4])
    expect(sortByTotal(orders, 'asc').map((o) => o.number)).toEqual([4, 3, 1, 2])
  })

  it('does not change the original list', () => {
    sortByTotal(orders, 'desc')
    expect(orders.map((o) => o.number)).toEqual([1, 2, 3, 4])
  })
})

describe('findOrderToOpen', () => {
  const exact = buildOrder({ id: 'ord_2345', number: 2345, customerName: null })
  const phoneMatch = buildOrder({ id: 'ord_2237', number: 2237, phone: '07406-234-537' })

  it('opens the order whose number matches, even if a phone number also matched', () => {
    expect(findOrderToOpen('2345', buildPage([exact, phoneMatch]))).toBe(exact)
    expect(findOrderToOpen('#2345', buildPage([phoneMatch, exact]))).toBe(exact)
  })

  it('opens the only result of a name search', () => {
    expect(findOrderToOpen('ben', buildPage([phoneMatch]))).toBe(phoneMatch)
  })

  it('opens nothing when a number matches no order exactly and there are several results', () => {
    expect(findOrderToOpen('234', buildPage([exact, phoneMatch]))).toBeUndefined()
  })
})
