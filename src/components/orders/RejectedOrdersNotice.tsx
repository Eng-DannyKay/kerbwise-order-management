import type { RejectedOrder } from '../../types/order.types'

interface RejectedOrdersNoticeProps {
  rejected: RejectedOrder[]
}

/** Lists records the API sent in a form the desk cannot read, so they are never hidden silently. */
export function RejectedOrdersNotice({ rejected }: RejectedOrdersNoticeProps) {
  if (rejected.length === 0) return null
  const count = rejected.length === 1 ? '1 order' : `${rejected.length} orders`

  return (
    <section
      aria-labelledby="rejected-orders-heading"
      className="mx-4 mb-3 rounded-lg border border-warning-800/30 bg-warning-50 px-3.5 py-3 text-warning-800"
    >
      <h2 id="rejected-orders-heading" className="font-bold">
        {count} on this page couldn’t be shown
      </h2>
      <p className="mt-0.5 text-ink">
        The orders service sent details the desk can’t read. Don’t pack these until they’ve been checked.
      </p>
      <ul className="mt-1.5 list-disc pl-5 text-ink">
        {rejected.map((order, index) => (
          <li key={order.id ?? `unknown-${index}`}>
            {order.number !== null ? `Order #${order.number}` : (order.id ?? 'An order without a number')}: {order.reason}
          </li>
        ))}
      </ul>
    </section>
  )
}
