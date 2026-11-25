import type { OrderSummary, OrdersPage } from '../../src/types/order.types'

export function buildOrder(overrides: Partial<OrderSummary> = {}): OrderSummary {
  return {
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
    ...overrides,
  }
}

export function buildPage(orders: OrderSummary[], overrides: Partial<OrdersPage> = {}): OrdersPage {
  return { orders, page: 1, pageSize: 20, total: orders.length, ...overrides }
}
