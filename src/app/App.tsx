import { OrdersPage } from '../pages/OrdersPage'

export function App() {
  return (
    <div className="min-h-screen text-sm">
      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="flex min-h-14 flex-wrap items-center gap-x-6 gap-y-1 px-5 py-2">
          <div className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 30 30" aria-hidden="true">
              <rect width="30" height="30" rx="8" className="fill-brand-600" />
              <path
                d="M7 21h6v-4h5v-4h5"
                fill="none"
                stroke="#fff"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[1.0625rem] font-bold tracking-tight">Kerbwise</span>
          </div>
          <p className="text-muted sm:ml-auto">
            <span className="font-semibold text-ink">Fern &amp; Thistle</span> · Hackney, London
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-[1320px] px-4 pt-6 pb-10 sm:px-7">
        <OrdersPage />
      </main>
    </div>
  )
}
