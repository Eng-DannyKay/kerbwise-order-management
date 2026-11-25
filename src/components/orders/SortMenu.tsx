import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { SORT_OPTIONS, type SortOptionValue } from '../../hooks/useOrderQuery'
import { focusRing } from '../ui/Button'

interface SortMenuProps {
  value: SortOptionValue
  onChange: (value: SortOptionValue) => void
}

/** Menu button with radio items: arrows, Home and End move, Enter or Space picks, Escape closes. */
export function SortMenu({ value, onChange }: SortMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const menuId = useId()

  const selectedIndex = Math.max(
    0,
    SORT_OPTIONS.findIndex((option) => option.value === value),
  )
  const selected = SORT_OPTIONS[selectedIndex] ?? SORT_OPTIONS[0]

  useEffect(() => {
    if (!isOpen) return
    itemRefs.current[selectedIndex]?.focus()

    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [isOpen, selectedIndex])

  function close() {
    setIsOpen(false)
    buttonRef.current?.focus()
  }

  function choose(option: SortOptionValue) {
    onChange(option)
    close()
  }

  function focusItem(index: number) {
    const count = SORT_OPTIONS.length
    itemRefs.current[(index + count) % count]?.focus()
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = itemRefs.current.findIndex((item) => item === document.activeElement)
    const keyActions: Record<string, () => void> = {
      ArrowDown: () => focusItem(current + 1),
      ArrowUp: () => focusItem(current - 1),
      Home: () => focusItem(0),
      End: () => focusItem(SORT_OPTIONS.length - 1),
      Escape: close,
      Tab: () => setIsOpen(false),
    }
    const action = keyActions[event.key]
    if (!action) return
    if (event.key !== 'Tab') event.preventDefault()
    action()
  }

  return (
    <div ref={containerRef} className="relative w-full sm:w-auto">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setIsOpen(true)
          }
        }}
        className={`inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-line-strong bg-white px-4 py-2 text-left text-sm font-semibold hover:bg-canvas sm:min-h-10 sm:w-auto sm:py-0 sm:whitespace-nowrap ${focusRing}`}
      >
        <span>
          <span className="text-muted">Sort:</span> {selected.shortLabel}
        </span>
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
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label="Sort orders"
          onKeyDown={handleMenuKeyDown}
          className="absolute top-[calc(100%+6px)] right-0 left-0 z-30 rounded-card border border-line bg-white p-1.5 shadow-[0_10px_30px_rgb(16_24_40/0.16)] sm:left-auto sm:w-[17rem]"
        >
          {SORT_OPTIONS.map((option, index) => {
            const isSelected = option.value === value
            return (
              <button
                key={option.value}
                ref={(element) => {
                  itemRefs.current[index] = element
                }}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                tabIndex={-1}
                onClick={() => choose(option.value)}
                className={`flex min-h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm sm:min-h-10 ${focusRing} ${
                  isSelected ? 'bg-brand-100 font-semibold' : 'font-medium hover:bg-canvas focus-visible:bg-canvas'
                }`}
              >
                <span className="flex w-4 shrink-0 justify-center text-brand-700" aria-hidden="true">
                  {isSelected && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </span>
                {option.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
