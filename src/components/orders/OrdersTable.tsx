import type { OrderSummary } from '../../types/order.types'
import { formatCurrency, formatShortDateTime } from '../../utils/formatters'
import { ORDER_CHANNEL_LABELS } from '../../utils/order-labels'
import { Button } from '../ui/Button'
import { OrderStatus } from './OrderStatus'

interface OrdersTableProps {
  orders: OrderSummary[]
  onViewOrder: (order: OrderSummary) => void
}

const headerCellClassName = 'h-10 px-5 text-[0.8125rem] font-semibold'
const cellClassName = 'h-[60px] px-5'

export function OrdersTable({ orders, onViewOrder }: OrdersTableProps) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left">
          <caption className="sr-only">Orders</caption>
          <thead className="bg-surface-subtle text-muted">
            <tr>
              <th scope="col" className={headerCellClassName}>Order</th>
              <th scope="col" className={headerCellClassName}>Customer</th>
              <th scope="col" className={headerCellClassName}>Date</th>
              <th scope="col" className={`${headerCellClassName} hidden lg:table-cell`}>Channel</th>
              <th scope="col" className={`${headerCellClassName} text-right`}>Total</th>
              <th scope="col" className={headerCellClassName}>Status</th>
              <th scope="col" className={headerCellClassName}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-line-soft">
                <th scope="row" className={`${cellClassName} font-semibold`}>#{order.number}</th>
                <td className={cellClassName}>
                  {order.customerName}
                  <span className="block text-[0.8125rem] text-muted lg:hidden">{ORDER_CHANNEL_LABELS[order.channel]}</span>
                </td>
                <td className={`${cellClassName} whitespace-nowrap text-muted`}>
                  <time dateTime={order.createdAt}>{formatShortDateTime(order.createdAt)}</time>
                </td>
                <td className={`${cellClassName} hidden text-muted lg:table-cell`}>{ORDER_CHANNEL_LABELS[order.channel]}</td>
                <td className={`${cellClassName} text-right tabular-nums`}>{formatCurrency(order.total)}</td>
                <td className={cellClassName}>
                  <OrderStatus status={order.status} />
                </td>
                <td className={`${cellClassName} text-right`}>
                  <Button size="sm" aria-label={`View order #${order.number}`} onClick={() => onViewOrder(order)}>
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul aria-label="Orders" className="divide-y divide-line-soft md:hidden">
        {orders.map((order) => (
          <li key={order.id} className="flex flex-col gap-2 px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[1.0625rem] font-bold">#{order.number}</span>
              <OrderStatus status={order.status} />
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="font-semibold break-words">{order.customerName}</span>
              <span className="font-bold tabular-nums">{formatCurrency(order.total)}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <p className="text-muted">
                {ORDER_CHANNEL_LABELS[order.channel]} ·{' '}
                <time dateTime={order.createdAt}>{formatShortDateTime(order.createdAt)}</time>
              </p>
              <Button size="sm" aria-label={`View order #${order.number}`} onClick={() => onViewOrder(order)}>
                View
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

const SKELETON_WIDTHS = ['w-40', 'w-32', 'w-36', 'w-28', 'w-44', 'w-32', 'w-30', 'w-36']
const bar = 'h-3 rounded-md bg-line motion-safe:animate-pulse'

export function OrdersTableSkeleton() {
  return (
    <div role="status">
      <div aria-hidden="true">
        {SKELETON_WIDTHS.map((nameWidth, index) => (
          <div key={index} className="flex h-[60px] items-center gap-4 border-b border-line-soft px-5">
            <span className={`${bar} w-14`} />
            <span className={`${bar} ${nameWidth}`} />
            <span className={`${bar} ml-auto hidden w-24 md:block`} />
            <span className={`${bar} h-5 w-20 rounded-full`} />
          </div>
        ))}
      </div>
      <p className="px-5 py-3.5 text-muted">Loading orders…</p>
    </div>
  )
}
