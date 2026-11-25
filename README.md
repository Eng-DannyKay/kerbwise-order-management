# Kerbwise Order Desk

A browser-based order desk for **Fern & Thistle**, the Kerbwise pilot shop in Hackney, London. Shop owners and packing staff can:

- see incoming orders, 20 per page, from the website, WhatsApp and the till
- search by customer name or order number; a barcode scanner that types the number and presses Enter opens the order directly, even while another order is open
- filter by status (New, Paid, Fulfilled, Cancelled, On hold, Part refunded) and sort by date created or total
- open an order to see its items, quantities, line totals, delivery address and note
- mark a **paid** order as fulfilled

**An unpaid order can never be fulfilled.** The button is locked in the UI, and the API service refuses to send the request. Only paid orders can be fulfilled; on-hold and part-refunded orders cannot.

Testing against the realistic ("real") API mode, the problems found and the decisions taken are recorded in [DECISIONS.md](DECISIONS.md).

## Technology

| Area | Choice |
| --- | --- |
| UI | React 19, TypeScript (strict, no `any`) |
| Build and dev server | Vite |
| Styling | Tailwind CSS v4, with design tokens taken from the Kerbwise prototype |
| Tests | Jest (jsdom), React Testing Library, `@swc/jest` transformer |
| Linting | oxlint |

The app talks to the supplied mock Orders API; it has no router and no state-management library.

## Prerequisites

- **Node.js 20.19+ or 22.12+** (required by Vite; the mock API needs Node 18+)
- npm (comes with Node)

## Installation

```bash
npm install
```

Then create a file called `.env` in the project folder with these two lines:

```
VITE_API_BASE_URL=http://localhost:4000
VITE_API_TOKEN=<the bearer key given in the Orders API notes>
```

`.env` is git-ignored, so the key is never committed. If either value is missing, the app shows a setup message naming it instead of starting. Both values are bundled into the browser code, as with any `VITE_` variable, so only use a key that is meant to be visible to desk users.

## Start the API

In its own terminal, from the project root:

```bash
node orders-server.js          # calm mode: data as described in the API notes
node orders-server.js --real   # real mode: the live platform on a busy day
```

Both listen on `http://localhost:4000` and keep their data in memory; restart to reset the orders. In real mode new orders keep arriving, and `POST /dev/new-order` adds one immediately.

## Start the frontend

```bash
npm run dev
```

Open the URL Vite prints (normally `http://localhost:5173`). The API must be running first.

## Run the tests

```bash
npm test
```

Other checks:

| Command | What it does |
| --- | --- |
| `npm run typecheck` | Type-checks the app, tests and config (`tsc -b`) |
| `npm run lint` | Lints with oxlint |
| `npm run build` | Type-checks, then builds to `dist/` |
| `npm run preview` | Serves the production build |

## Project structure

```
src/
  app/            App shell and the setup message shown when settings are missing
  pages/          Screens: own the state and compose components (OrdersPage)
  components/
    orders/       Filters, sort menu, table, details panel, fulfilment, notices
    ui/           Button, Pagination, Drawer, ConfirmDialog, StateMessage
  config/         Reads and checks the environment variables
  hooks/          useOrders, useOrderDetail, useOrderQuery, useFulfilment, useScanner
  services/       Orders API client, response parsing and validation, ApiError
  types/          Order types that mirror the API contract
  utils/          Formatters, labels, business rules, sorting, scan matching, error messages
tests/            Jest + React Testing Library tests, fixtures and mocks
```

## Key decisions

Full reasoning and trade-offs are in [DECISIONS.md](DECISIONS.md).

- **API data is normalised and validated at one boundary.** Only formats seen from the real API are accepted (for example `"£122.25"` totals and Unix-second dates); each order is checked separately and unreadable records are listed on screen, never hidden.
- **Money is shown, not calculated.** `order.total` is the only order total; `lineTotal` already includes the quantity and is shown as sent.
- **Dates use the server's `createdAt`** and are always shown in London time, whatever the device's clock or time zone.
- **Fulfilment is never optimistic and never retried automatically.** The order is fetched again before the confirmation opens; each request sends the order's `version`; after a failure with no clear answer, the order is fetched again and the result is described from its confirmed status.
- **Every request times out after 15 seconds**, and rate-limited reads (429) are retried once after `Retry-After`.
- **Sorting by total is done locally** across every page, because the API sorts totals as text. Pages are loaded one after another, so a notice appears when the list changes while browsing.
- **Customer phone numbers are never displayed.** The API returns them, but packers must not see them.
- **Accessibility:** semantic table and landmarks, labelled controls, visible focus rings, status shown by icon and text (not colour alone), keyboard-only operation including the sort menu and dialogs, and layouts checked at 390 px wide with text at 200%.

## Known limitations

See [DECISIONS.md](DECISIONS.md#4-known-limitations). In short: no user roles, no automatic refresh when new orders arrive, page-number paging can shift as orders arrive, and the Inter font is loaded from Google Fonts.
