import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from './Button'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  pendingLabel: string
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Modal `alertdialog`. Focus starts on Cancel, the safe choice; it cannot be dismissed while pending. */
export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  pendingLabel,
  isPending,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) {
      dialog.showModal()
      cancelRef.current?.focus()
    }
    if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault()
        if (!isPending) onCancel()
      }}
      onClose={(event) => {
        if (event.target !== event.currentTarget || event.currentTarget.open || !isOpen) return
        // A repeated Escape can close the dialog natively even after `cancel` was prevented.
        if (isPending) {
          event.currentTarget.showModal()
        } else {
          onCancel()
        }
      }}
      className="m-auto w-[27.5rem] max-w-[calc(100%-2rem)] rounded-xl bg-white p-6 text-sm text-ink shadow-[0_24px_60px_rgb(16_24_40/0.35)] backdrop:bg-ink/50"
    >
      {isOpen && (
        <>
          <h2 id={titleId} className="text-lg font-bold tracking-tight">
            {title}
          </h2>
          <div id={descriptionId} className="mt-2 leading-relaxed text-muted">
            {description}
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2.5">
            <Button ref={cancelRef} aria-disabled={isPending} onClick={() => !isPending && onCancel()}>
              Cancel
            </Button>
            <Button variant="primary" aria-disabled={isPending} onClick={() => !isPending && onConfirm()}>
              {isPending ? pendingLabel : confirmLabel}
            </Button>
          </div>
        </>
      )}
    </dialog>
  )
}
