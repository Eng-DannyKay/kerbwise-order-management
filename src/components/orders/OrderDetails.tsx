import type { OrderDetail } from '../../types/order.types'
import { formatCurrency, formatDateTime } from '../../utils/formatters'
import { displayCustomerName, ORDER_CHANNEL_LABELS } from '../../utils/order-labels'
import { Skeleton } from '../ui/Skeleton'

interface OrderDetailsProps {
  order: OrderDetail
}

const sectionHeading = 'mb-2 text-sm font-semibold'

/** Deliberately omits `phone`: packers must not see customers' numbers. */
export function OrderDetails({ order }: OrderDetailsProps) {
  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-1 gap-x-5 gap-y-3.5 min-[360px]:grid-cols-2">
        <div>
          <dt className="text-[0.8125rem] text-muted">Customer</dt>
          <dd className="mt-0.5 font-semibold break-words">{displayCustomerName(order.customerName)}</dd>
        </div>
        <div>
          <dt className="text-[0.8125rem] text-muted">Order date</dt>
          <dd className="mt-0.5 font-semibold">
            <time dateTime={order.createdAt}>{formatDateTime(order.createdAt)}</time>
          </dd>
        </div>
        <div>
          <dt className="text-[0.8125rem] text-muted">Channel</dt>
          <dd className="mt-0.5 font-semibold">{ORDER_CHANNEL_LABELS[order.channel]}</dd>
        </div>
        <div>
          <dt className="text-[0.8125rem] text-muted">Order total</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{formatCurrency(order.total)}</dd>
        </div>
      </dl>

      <section aria-labelledby="order-items-heading">
        <h3 id="order-items-heading" className={sectionHeading}>
          Items
        </h3>
        <div className="overflow-hidden rounded-card border border-line">
          <table className="w-full text-left">
            <caption className="sr-only">Items in order #{order.number}</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Item and quantity</th>
                <th scope="col">Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line, index) => (
                <tr key={`${line.name}-${index}`} className="border-t border-line-soft first:border-t-0">
                  <th scope="row" className="px-3 py-3 text-left font-medium wrap-anywhere sm:px-3.5">
                    {line.name}
                    <span className="mt-0.5 block text-[0.8125rem] font-normal text-muted">Qty {line.qty}</span>
                  </th>
                  <td className="px-3 py-3 text-right align-top font-semibold whitespace-nowrap tabular-nums sm:px-3.5">
                    {formatCurrency(line.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-line bg-surface-subtle">
              <tr>
                <th scope="row" className="px-3 py-3 text-left text-base font-bold sm:px-3.5">
                  Total
                </th>
                <td className="px-3 py-3 text-right text-base font-bold whitespace-nowrap tabular-nums sm:px-3.5">{formatCurrency(order.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section aria-labelledby="order-delivery-heading">
        <h3 id="order-delivery-heading" className={sectionHeading}>
          {order.address ? 'Delivery address' : 'Delivery'}
        </h3>
        {order.address ? (
          <address className="leading-relaxed not-italic">
            {order.address.line1}
            <br />
            {order.address.area}
          </address>
        ) : (
          <p className="text-muted">No delivery address. Till orders are handed over in the shop.</p>
        )}
      </section>

      <section aria-labelledby="order-notes-heading">
        <h3 id="order-notes-heading" className={sectionHeading}>
          Order note
        </h3>
        {order.notes ? (
          <p className="rounded-lg border border-line bg-surface-subtle px-3 py-2.5 leading-relaxed break-words whitespace-pre-line">
            {order.notes}
          </p>
        ) : (
          <p className="text-muted">No note for this order.</p>
        )}
      </section>
    </div>
  )
}

/** Same shape as `OrderDetails`: the four facts, the items box and the address. */
export function OrderDetailsSkeleton() {
  return (
    <div role="status">
      <span className="sr-only">Loading order details…</span>
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-x-5 gap-y-3.5 min-[360px]:grid-cols-2">
          {['w-28', 'w-36', 'w-20', 'w-16'].map((width) => (
            <div key={width} className="flex flex-col gap-2 py-0.5">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className={width} />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="w-12" />
          <div className="overflow-hidden rounded-card border border-line">
            {['w-36', 'w-28'].map((width) => (
              <div key={width} className="flex items-center justify-between border-t border-line-soft px-3 py-3.5 first:border-t-0 sm:px-3.5">
                <div className="flex flex-col gap-2">
                  <Skeleton className={width} />
                  <Skeleton className="h-2.5 w-10" />
                </div>
                <Skeleton className="w-14" />
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-line bg-surface-subtle px-3 py-3.5 sm:px-3.5">
              <Skeleton className="h-3.5 w-12" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="w-28" />
          <Skeleton className="w-40" />
          <Skeleton className="w-32" />
        </div>
      </div>
    </div>
  )
}
