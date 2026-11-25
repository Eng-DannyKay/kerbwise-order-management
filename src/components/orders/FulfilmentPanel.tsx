import { useEffect, useId, useRef, useState } from 'react'
import { updateOrderStatus } from '../../services/orders-api'
import type { OrderDetail } from '../../types/order.types'
import { formatCurrency } from '../../utils/formatters'
import { describeFulfilmentFailure } from '../../utils/fulfilment-errors'
import { displayCustomerName } from '../../utils/order-labels'
import { canFulfilOrder } from '../../utils/order-rules'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'

type PanelState =
  | { kind: 'idle' }
  | { kind: 'confirming' }
  | { kind: 'submitting' }
  | { kind: 'succeeded' }
  | { kind: 'failed'; message: string }
  | { kind: 'blocked' }

interface FulfilmentPanelProps {
  order: OrderDetail
  /** Replaces the shown order with the server's copy. */
  onOrderChange: (order: OrderDetail) => void
  /** Fetches the order again when its real state is unknown. */
  onReload: () => void
  /** Refreshes the orders list after the server reports a change. */
  onOrdersChanged: () => void
}

function LockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

/**
 * The status shown only ever changes after the API confirms it. Unpaid orders are
 * blocked here and again in `updateOrderStatus`.
 */
export function FulfilmentPanel({ order, onOrderChange, onReload, onOrdersChanged }: FulfilmentPanelProps) {
  const [state, setState] = useState<PanelState>({ kind: 'idle' })
  const successRef = useRef<HTMLParagraphElement>(null)
  const isSubmittingRef = useRef(false)
  const reasonId = useId()

  useEffect(() => {
    if (state.kind === 'succeeded') successRef.current?.focus()
  }, [state.kind])

  async function fulfil() {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    setState({ kind: 'submitting' })
    try {
      const updated = await updateOrderStatus(order, 'fulfilled')
      onOrderChange(updated)
      onOrdersChanged()
      setState({ kind: 'succeeded' })
    } catch (error: unknown) {
      const failure = describeFulfilmentFailure(error, order.number)
      if (failure.latestOrder) onOrderChange(failure.latestOrder)
      if (failure.shouldReload) onReload()
      onOrdersChanged()
      setState({ kind: 'failed', message: failure.message })
    } finally {
      isSubmittingRef.current = false
    }
  }

  const failureAlert = state.kind === 'failed' && (
    <div role="alert" className="rounded-lg border border-danger-700/30 bg-danger-50 px-3.5 py-3 leading-relaxed text-danger-700">
      <p className="font-semibold">Order not fulfilled</p>
      <p className="mt-0.5 text-ink">{state.message}</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      {failureAlert}

      {order.status === 'paid' && (
        <Button variant="primary" className="w-full" onClick={() => setState({ kind: 'confirming' })}>
          Mark as fulfilled
        </Button>
      )}

      {order.status === 'new' && (
        <>
          {state.kind === 'blocked' && (
            <div role="alert" className="rounded-lg border border-warning-800/30 bg-warning-50 px-3.5 py-3 leading-relaxed text-warning-800">
              <p className="font-bold">Payment hasn’t been received</p>
              <p className="mt-0.5">Order #{order.number} can’t be fulfilled until payment is confirmed. Don’t pack it yet.</p>
            </div>
          )}
          <Button
            aria-disabled="true"
            aria-describedby={reasonId}
            className="w-full"
            onClick={() => setState({ kind: 'blocked' })}
          >
            <LockIcon />
            Mark as fulfilled
          </Button>
          <p id={reasonId} className="text-warning-800">
            Payment required before this order can be fulfilled.
          </p>
        </>
      )}

      {order.status === 'fulfilled' &&
        (state.kind === 'succeeded' ? (
          <p
            ref={successRef}
            tabIndex={-1}
            role="status"
            className="flex items-center gap-2 rounded-lg bg-brand-50 px-3.5 py-3 font-semibold text-brand-700 focus:outline-none"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Order #{order.number} fulfilled.
          </p>
        ) : (
          <p className="font-semibold">This order has been fulfilled.</p>
        ))}

      {order.status === 'cancelled' && <p className="text-muted">Cancelled orders can’t be fulfilled.</p>}

      {order.status === 'on_hold' && <p className="text-muted">This order is on hold, so it can’t be fulfilled.</p>}

      {order.status === 'part_refunded' && (
        <p className="text-muted">This order has been partly refunded, so it can’t be fulfilled from the desk.</p>
      )}

      <ConfirmDialog
        isOpen={(state.kind === 'confirming' || state.kind === 'submitting') && canFulfilOrder(order)}
        title={`Mark order #${order.number} as fulfilled?`}
        description={
          <>
            {displayCustomerName(order.customerName)} · {formatCurrency(order.total)}. Payment has been received. This tells the team the
            order has been packed and handed over.
          </>
        }
        confirmLabel="Confirm fulfilment"
        pendingLabel="Fulfilling…"
        isPending={state.kind === 'submitting'}
        onConfirm={() => void fulfil()}
        onCancel={() => setState({ kind: 'idle' })}
      />
    </div>
  )
}
