import { useEffect, useRef, type ReactNode } from 'react'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  labelledBy: string
  children: ReactNode
}

/**
 * Side panel built on a modal `<dialog>`: the page behind is inert, Escape closes it,
 * and the browser returns focus to the control that opened it.
 */
export function Drawer({ isOpen, onClose, labelledBy, children }: DrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) dialog.showModal()
    if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      onClose={(event) => {
        // `close` is dispatched asynchronously; if the drawer was reopened meanwhile, the event is stale.
        if (event.target === event.currentTarget && !event.currentTarget.open) onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-[480px] bg-white p-0 text-sm text-ink shadow-[-12px_0_32px_rgb(16_24_40/0.18)] backdrop:bg-ink/35"
    >
      {isOpen && <div className="flex h-full flex-col">{children}</div>}
    </dialog>
  )
}
