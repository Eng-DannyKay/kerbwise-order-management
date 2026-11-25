import type { ComponentProps } from 'react'

export const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600'

const VARIANTS = {
  primary: 'border-brand-600 bg-brand-600 text-white hover:border-brand-700 hover:bg-brand-700',
  secondary: 'border-line-strong bg-white text-ink hover:bg-canvas',
}

const DISABLED =
  'aria-disabled:cursor-not-allowed aria-disabled:border-line-strong aria-disabled:bg-settled-50 aria-disabled:text-muted aria-disabled:hover:border-line-strong aria-disabled:hover:bg-settled-50'

const SIZES = {
  md: 'min-h-11 px-4 sm:min-h-10',
  sm: 'min-h-11 px-3.5 sm:min-h-9',
}

interface ButtonProps extends ComponentProps<'button'> {
  variant?: keyof typeof VARIANTS
  size?: keyof typeof SIZES
}

/** At least 44px tall on touch screens; 40px from the `sm` breakpoint, as in the prototype. */
export function Button({ variant = 'secondary', size = 'md', type = 'button', className = '', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border text-sm font-semibold ${DISABLED} ${focusRing} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  )
}
