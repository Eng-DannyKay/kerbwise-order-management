import { focusRing } from './Button'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

type PageItem = number | 'gap-start' | 'gap-end'

/** First, last and the pages around the current one, so the bar stays short. */
function getPageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)
  const start = Math.max(2, Math.min(page - 1, totalPages - 4))
  const end = Math.min(totalPages - 1, Math.max(page + 1, 5))
  const middle = Array.from({ length: end - start + 1 }, (_, index) => start + index)
  return [1, ...(start > 2 ? ['gap-start' as const] : []), ...middle, ...(end < totalPages - 1 ? ['gap-end' as const] : []), totalPages]
}

const pageButton = `min-w-11 h-11 rounded-lg border px-2 font-semibold sm:h-9 sm:min-w-9 ${focusRing}`
const arrowButton = `${pageButton} inline-flex items-center justify-center gap-1 border-transparent hover:bg-canvas aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent`

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  )
}

/** Previous and next use `aria-disabled`, not `disabled`, so keyboard focus is not lost at either end. */
export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const firstShown = total === 0 ? 0 : (page - 1) * pageSize + 1
  const lastShown = Math.min(page * pageSize, total)
  const isFirstPage = page <= 1
  const isLastPage = page >= totalPages

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-soft px-4 py-3">
      <p className="text-muted" aria-live="polite">
        Showing {firstShown}–{lastShown} of {total} orders
      </p>
      <nav aria-label="Pagination" className="flex flex-wrap items-center gap-1 sm:ml-auto">
        <button
          type="button"
          aria-label="Previous page"
          aria-disabled={isFirstPage}
          onClick={() => {
            if (!isFirstPage) onPageChange(page - 1)
          }}
          className={arrowButton}
        >
          <Chevron direction="left" />
          <span className="pr-1 sm:hidden" aria-hidden="true">
            Previous
          </span>
        </button>

        <span className="px-2 text-muted sm:hidden">
          Page {page} of {totalPages}
        </span>

        <ul className="hidden items-center gap-1 sm:flex">
          {getPageItems(page, totalPages).map((item) =>
            typeof item === 'number' ? (
              <li key={item}>
                <button
                  type="button"
                  aria-label={`Page ${item}`}
                  aria-current={item === page ? 'page' : undefined}
                  onClick={() => onPageChange(item)}
                  className={`${pageButton} ${
                    item === page ? 'border-brand-50 bg-brand-50 text-brand-700' : 'border-transparent hover:bg-canvas'
                  }`}
                >
                  {item}
                </button>
              </li>
            ) : (
              <li key={item} aria-hidden="true" className="px-1 text-muted">
                …
              </li>
            ),
          )}
        </ul>

        <button
          type="button"
          aria-label="Next page"
          aria-disabled={isLastPage}
          onClick={() => {
            if (!isLastPage) onPageChange(page + 1)
          }}
          className={arrowButton}
        >
          <span className="pl-1 sm:hidden" aria-hidden="true">
            Next
          </span>
          <Chevron direction="right" />
        </button>
      </nav>
    </div>
  )
}
