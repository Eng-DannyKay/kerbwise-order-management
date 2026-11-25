import type { ReactNode } from 'react'

const ICONS = {
  neutral: { path: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3', className: 'stroke-muted' },
  danger: {
    path: 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
    className: 'stroke-danger-700',
  },
}

interface StateMessageProps {
  tone?: keyof typeof ICONS
  title: string
  description?: string
  action?: ReactNode
}

export function StateMessage({ tone = 'neutral', title, description, action }: StateMessageProps) {
  const icon = ICONS[tone]
  return (
    <div
      role={tone === 'danger' ? 'alert' : undefined}
      className="flex flex-col items-center gap-2.5 px-6 py-14 text-center"
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={icon.className}
        aria-hidden="true"
      >
        <path d={icon.path} />
      </svg>
      <p className="text-base font-semibold">{title}</p>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  )
}
