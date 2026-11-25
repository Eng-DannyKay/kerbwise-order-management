import { useEffect, useRef } from 'react'
import type { SortOptionValue, StatusFilter } from '../../hooks/useOrderQuery'
import { ORDER_STATUSES } from '../../types/order.types'
import { ORDER_STATUS_LABELS } from '../../utils/order-labels'
import { focusRing } from '../ui/Button'
import { SortMenu } from './SortMenu'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...ORDER_STATUSES.map((value) => ({ value, label: ORDER_STATUS_LABELS[value] })),
]

const fieldClassName = `h-11 w-full rounded-lg border border-line-strong bg-white text-base sm:h-10 sm:text-sm ${focusRing}`

/** Mouse or trackpad devices, such as the scanner station. On touch screens focusing would open the keyboard. */
function hasPrecisePointer(): boolean {
  return window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches ?? false
}

interface OrderFiltersProps {
  searchText: string
  onSearchTextChange: (text: string) => void
  onSearchSubmit: () => void
  onSearchClear: () => void
  status: StatusFilter
  onStatusChange: (status: StatusFilter) => void
  sort: SortOptionValue
  onSortChange: (sort: SortOptionValue) => void
}

export function OrderFilters({
  searchText,
  onSearchTextChange,
  onSearchSubmit,
  onSearchClear,
  status,
  onStatusChange,
  sort,
  onSortChange,
}: OrderFiltersProps) {
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (hasPrecisePointer()) searchInputRef.current?.focus()
  }, [])

  return (
    <div>
      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-x-1 border-b border-line-soft px-3">
        {STATUS_FILTERS.map((filter) => {
          const isActive = filter.value === status
          return (
            <button
              key={filter.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onStatusChange(filter.value)}
              className={`h-12 border-b-2 px-3 font-semibold whitespace-nowrap ${focusRing} ${
                isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {filter.label}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        <form
          role="search"
          className="relative min-w-0 flex-[1_1_260px] sm:min-w-52"
          onSubmit={(event) => {
            event.preventDefault()
            onSearchSubmit()
          }}
        >
          <label htmlFor="order-search" className="sr-only">
            Search orders
          </label>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 stroke-muted"
            aria-hidden="true"
          >
            <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" />
          </svg>
          <input
            ref={searchInputRef}
            id="order-search"
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Order number or customer"
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
            className={`${fieldClassName} pr-11 pl-10 placeholder:text-muted`}
          />
          {searchText && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                onSearchClear()
                searchInputRef.current?.focus()
              }}
              className={`absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-md hover:bg-canvas sm:size-8 ${focusRing}`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth="2.2"
                strokeLinecap="round"
                className="stroke-muted"
                aria-hidden="true"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </form>

        <SortMenu value={sort} onChange={onSortChange} />
      </div>
    </div>
  )
}
