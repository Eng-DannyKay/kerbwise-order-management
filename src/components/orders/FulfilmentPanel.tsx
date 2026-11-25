import { useEffect, useId, useRef } from 'react'
import { useFulfilment } from '../../hooks/useFulfilment'
import type { OrderDetail } from '../../types/order.types'
import { formatCurrency } from '../../utils/formatters'
import type { FulfilmentResult } from '../../utils/fulfilment-errors'
import { displayCustomerName } from '../../utils/order-labels'
import { canFulfilOrder } from '../../utils/order-rules'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'

interface FulfilmentPanelProps {
  order: OrderDetail
  /** Replaces the shown order with the server's copy. */
  onOrderChange: (order: OrderDetail) => void
  /** Reloads the order, used when the server reports it has gone. */
  onReload: () => void
  /** Refreshes the orders list after the server reports a change. */
  onOrdersChanged: () => void
  /** Shows the confirmed fulfilment as a toast. */
  onFulfilled: (result: FulfilmentResult) => void
}

const RESULT_STYLES: Record<FulfilmentResult['tone'], string> = {
  success: 'bg-brand-50 text-brand-700',
  info: 'border border-line bg-surface-subtle text-ink',
  danger: 'border border-danger-700/30 bg-danger-50 text-danger-700',
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
export function FulfilmentPanel({ order, onOrderChange, onReload, onOrdersChanged, onFulfilled }: FulfilmentPanelProps) {
  const { state, start, confirm, checkAgain, cancel } = useFulfilment(order, {
    onOrderChange,
    onOrdersChanged,
    onOrderGone: onReload,
    onFulfilled,
  })
  const resultRef = useRef<HTMLDivElement>(null)
  const fulfilledRef = useRef<HTMLParagraphElement>(null)
  const reasonId = useId()
  const result = state.kind === 'result' ? state.result : null

  useEffect(() => {
    if (result) resultRef.current?.focus()
  }, [result])

  useEffect(() => {
    if (state.kind === 'fulfilled') fulfilledRef.current?.focus()
  }, [state.kind])

  const isBusy = state.kind === 'refreshing' || state.kind === 'checking'

  return (
    <div className="flex flex-col gap-3">
      {state.kind === 'checking' && (
        <p role="status" className="rounded-lg border border-line bg-surface-subtle px-3.5 py-3">
          Checking the latest status of order #{order.number}…
        </p>
      )}

      {result && (
        <div
          ref={resultRef}
          tabIndex={-1}
          role={result.tone === 'danger' ? 'alert' : 'status'}
          className={`rounded-lg px-3.5 py-3 leading-relaxed focus:outline-none ${RESULT_STYLES[result.tone]}`}
        >
          <p className="font-semibold">{result.title}</p>
          {result.detail && <p className="mt-0.5 text-ink">{result.detail}</p>}
          {result.canCheckAgain && (
            <Button size="sm" className="mt-2" onClick={() => void checkAgain()}>
              Check again
            </Button>
          )}
        </div>
      )}

      {order.status === 'paid' && (
        <Button
          variant="primary"
          className="w-full"
          aria-disabled={isBusy}
          onClick={() => {
            if (!isBusy) void start()
          }}
        >
          {state.kind === 'refreshing' ? 'Checking latest status…' : 'Mark as fulfilled'}
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
          <Button aria-disabled="true" aria-describedby={reasonId} className="w-full" onClick={() => void start()}>
            <LockIcon />
            Mark as fulfilled
          </Button>
          <p id={reasonId} className="text-warning-800">
            Payment required before this order can be fulfilled.
          </p>
        </>
      )}

      {!result && order.status === 'fulfilled' && (
        <p ref={fulfilledRef} tabIndex={-1} className="font-semibold focus:outline-none">
          This order has been fulfilled.
        </p>
      )}
      {!result && order.status === 'cancelled' && <p className="text-muted">Cancelled orders can’t be fulfilled.</p>}
      {!result && order.status === 'on_hold' && <p className="text-muted">This order is on hold, so it can’t be fulfilled.</p>}
      {!result && order.status === 'part_refunded' && (
        <p className="text-muted">This order has been partly refunded, so it can’t be fulfilled from the desk.</p>
      )}

      <ConfirmDialog
        isOpen={(state.kind === 'confirming' || state.kind === 'submitting') && canFulfilOrder(order)}
        title={`Mark order #${order.number} as fulfilled?`}
        description={
          <>
            {displayCustomerName(order.customerName)} · {formatCurrency(order.total)}. Payment has been received. This
            tells the team the order has been packed and handed over.
          </>
        }
        confirmLabel="Confirm fulfilment"
        pendingLabel="Fulfilling…"
        isPending={state.kind === 'submitting'}
        onConfirm={() => void confirm()}
        onCancel={cancel}
      />
    </div>
  )
}
