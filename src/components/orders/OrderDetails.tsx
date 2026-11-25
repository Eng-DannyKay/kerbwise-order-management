import type { OrderDetail } from '../../types/order.types'
import { formatCurrency, formatDateTime } from '../../utils/formatters'
import { ORDER_CHANNEL_LABELS } from '../../utils/order-labels'

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
          <dd className="mt-0.5 font-semibold break-words">{order.customerName}</dd>
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
