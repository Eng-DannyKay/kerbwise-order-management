import { Button } from '../ui/Button'

interface ListChangedNoticeProps {
  onRefresh: () => void
}

/** Pages are loaded one at a time, so orders arriving in between can shift them. */
export function ListChangedNotice({ onRefresh }: ListChangedNoticeProps) {
  return (
    <div
      role="status"
      className="mx-4 mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-surface-subtle px-3.5 py-3"
    >
      <p className="min-w-0 flex-1">
        <span className="font-semibold">The order list has changed since you opened it.</span> Some orders may now
        appear twice or be missed between pages.
      </p>
      <Button size="sm" onClick={onRefresh}>
        Refresh list
      </Button>
    </div>
  )
}
