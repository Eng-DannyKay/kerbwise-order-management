import { useOrderDetail } from '../../hooks/useOrderDetail'
import type { OrderSummary } from '../../types/order.types'
import { Button, focusRing } from '../ui/Button'
import { Drawer } from '../ui/Drawer'
import { StateMessage } from '../ui/StateMessage'
import { FulfilmentPanel } from './FulfilmentPanel'
import { OrderDetails } from './OrderDetails'
import { OrderStatus } from './OrderStatus'

interface OrderDetailsDrawerProps {
  /** The row that was opened, shown in the header while the full order loads. */
  summary: OrderSummary | null
  onClose: () => void
  /** Called after the server reports a change to the order, so the list can refresh. */
  onOrdersChanged: () => void
}

interface OrderPanelContentProps {
  summary: OrderSummary
  onClose: () => void
  onOrdersChanged: () => void
}

/** Mounted only while the panel is open, so every opening fetches the order afresh. */
function OrderPanelContent({ summary, onClose, onOrdersChanged }: OrderPanelContentProps) {
  const { order, error, isLoading, reload, replaceOrder } = useOrderDetail(summary.id)
  const status = order?.status ?? summary.status

  return (
    <>
      <div className="flex shrink-0 items-center gap-3 border-b border-line-soft px-5 py-4">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <h2 id="order-details-heading" className="text-xl font-bold tracking-tight">
            Order #{summary.number}
          </h2>
          <OrderStatus status={status} />
        </div>
        <button
          type="button"
          aria-label="Close order details"
          onClick={onClose}
          className={`flex size-11 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-white hover:bg-canvas sm:size-10 ${focusRing}`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5" aria-busy={isLoading}>
        {error ? (
          <StateMessage
            tone="danger"
            title="Unable to load this order"
            description={error}
            action={
              <Button variant="primary" onClick={reload}>
                Try again
              </Button>
            }
          />
        ) : order ? (
          <OrderDetails order={order} />
        ) : (
          <p role="status" className="py-10 text-center text-muted">
            Loading order details…
          </p>
        )}
      </div>

      {order && !error && (
        <div className="shrink-0 border-t border-line-soft bg-white p-4 sm:px-5">
          <FulfilmentPanel order={order} onOrderChange={replaceOrder} onReload={reload} onOrdersChanged={onOrdersChanged} />
        </div>
      )}
    </>
  )
}

export function OrderDetailsDrawer({ summary, onClose, onOrdersChanged }: OrderDetailsDrawerProps) {
  return (
    <Drawer isOpen={summary !== null} onClose={onClose} labelledBy="order-details-heading">
      {summary && (
        <OrderPanelContent key={summary.id} summary={summary} onClose={onClose} onOrdersChanged={onOrdersChanged} />
      )}
    </Drawer>
  )
}
