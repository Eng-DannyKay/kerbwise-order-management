import type { OrderStatus as OrderStatusValue } from '../../types/order.types'
import { ORDER_STATUS_LABELS } from '../../utils/order-labels'

const STATUS_STYLES: Record<OrderStatusValue, { className: string; iconPath: string }> = {
  new: {
    className: 'bg-warning-50 text-warning-800',
    iconPath: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  },
  paid: {
    className: 'bg-brand-50 text-brand-700',
    iconPath: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 12l2 2 4-4',
  },
  fulfilled: {
    className: 'bg-settled-50 text-settled-800',
    iconPath: 'M20 6L9 17l-5-5',
  },
  cancelled: {
    className: 'bg-settled-50 text-settled-800',
    iconPath: 'M18 6L6 18M6 6l12 12',
  },
}

interface OrderStatusProps {
  status: OrderStatusValue
}

/** Icon and label, so status never depends on colour alone. */
export function OrderStatus({ status }: OrderStatusProps) {
  const { className, iconPath } = STATUS_STYLES[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full py-[3px] pr-2.5 pl-2 text-[0.8125rem] font-semibold whitespace-nowrap ${className}`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={iconPath} />
      </svg>
      {ORDER_STATUS_LABELS[status]}
    </span>
  )
}
