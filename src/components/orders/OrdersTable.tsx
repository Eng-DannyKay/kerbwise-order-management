import type { OrderSummary } from '../../types/order.types'
import { formatCurrency, formatShortDateTime } from '../../utils/formatters'
import { displayCustomerName, ORDER_CHANNEL_LABELS } from '../../utils/order-labels'
import { Button } from '../ui/Button'
import { Skeleton } from '../ui/Skeleton'
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
                  {displayCustomerName(order.customerName)}
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
              <span className="font-semibold break-words">{displayCustomerName(order.customerName)}</span>
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

const SKELETON_NAME_WIDTHS = ['w-40', 'w-32', 'w-36', 'w-28', 'w-44', 'w-32', 'w-30', 'w-36']

/** Mirrors the table on wider screens and the cards on phones, so nothing jumps when orders arrive. */
export function OrdersTableSkeleton() {
  return (
    <div role="status">
      <div aria-hidden="true">
        <div className="hidden md:block">
          <div className="flex h-10 items-center bg-surface-subtle px-5">
            <Skeleton className="w-24" />
          </div>
          {SKELETON_NAME_WIDTHS.map((nameWidth, index) => (
            <div key={index} className="flex h-[60px] items-center gap-6 border-t border-line-soft px-5">
              <Skeleton className="w-14 flex-none" />
              <Skeleton className={`${nameWidth} flex-none`} />
              <Skeleton className="w-24 flex-none" />
              <Skeleton className="hidden w-[4.5rem] flex-none lg:block" />
              <Skeleton className="ml-auto w-14 flex-none" />
              <Skeleton className="h-[22px] w-20 flex-none rounded-full" />
              <Skeleton className="h-9 w-[3.75rem] flex-none rounded-lg" />
            </div>
          ))}
        </div>
        <ul className="divide-y divide-line-soft md:hidden">
          {SKELETON_NAME_WIDTHS.slice(0, 5).map((nameWidth, index) => (
            <li key={index} className="flex flex-col gap-3 px-4 py-3.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-[22px] w-20 rounded-full" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className={nameWidth} />
                <Skeleton className="w-16" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="w-36" />
                <Skeleton className="h-11 w-[3.75rem] rounded-lg" />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="border-t border-line-soft px-5 py-3.5 text-muted">Loading orders…</p>
    </div>
  )
}
