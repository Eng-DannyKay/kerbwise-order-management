import { focusRing } from './Button'

interface ToastProps {
  title: string
  detail?: string
  onDismiss: () => void
}

/** Success message at the top of the screen, or the bottom on phones so the panel's close button stays clear. Never takes focus. */
export function Toast({ title, detail, onDismiss }: ToastProps) {
  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 sm:top-4 sm:bottom-auto z-50 flex w-[27.5rem] max-w-[calc(100%-2rem)] -translate-x-1/2 items-start gap-3 rounded-card border border-line-strong bg-white py-3.5 pr-3.5 pl-4 text-sm text-ink shadow-[0_12px_32px_rgb(16_24_40/0.22)]"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="mt-px flex-none text-brand-600"
      >
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 12l2 2 4-4" />
      </svg>
      <div className="min-w-0 flex-1 leading-relaxed">
        <p className="font-semibold">{title}</p>
        {detail && <p className="mt-0.5 text-muted">{detail}</p>}
      </div>
      <button
        type="button"
        aria-label="Dismiss message"
        onClick={onDismiss}
        className={`-my-1.5 flex size-11 flex-none items-center justify-center rounded-md hover:bg-canvas sm:size-8 sm:my-0 ${focusRing}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
