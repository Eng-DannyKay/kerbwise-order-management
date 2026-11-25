# Kerbwise Order Desk

A browser-based order desk for **Fern & Thistle**, the Kerbwise pilot shop in Hackney, London. Shop owners and packing staff can:

- see incoming orders, 20 per page, from the website, WhatsApp and the till
- search by customer name or order number (a barcode scanner that types the number and presses Enter opens the order directly)
- filter by status (New, Paid, Fulfilled, Cancelled) and sort by date created or total
- open an order to see its items, quantities, line totals, delivery address and note
- mark a **paid** order as fulfilled

**An unpaid order can never be fulfilled.** The button is locked in the UI, and the API service refuses to send the request.

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
cp .env.example .env            # PowerShell: Copy-Item .env.example .env
```

Then edit `.env`:

| Variable | Value |
| --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:4000` (the mock API) |
| `VITE_API_TOKEN` | The bearer key given in the Orders API notes (`desk-api-notes.md`) |

`.env` is git-ignored. Both values are bundled into the browser code, as with any `VITE_` variable, so only use a key that is meant to be visible to desk users.

## Start the API

In its own terminal, from the project root:

```bash
node orders-server.js
```

It listens on `http://localhost:4000` and keeps its data in memory; restart it to reset the orders.

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
  app/            App shell (header, main)
  pages/          Screens: own the state and compose components (OrdersPage)
  components/
    orders/       Filters, sort menu, table, details panel, fulfilment
    ui/           Button, Pagination, Drawer, ConfirmDialog, StateMessage
  config/         Reads and validates the environment variables
  hooks/          useOrders, useOrderDetail, useOrderQuery
  services/       Orders API client, response validation, ApiError
  types/          Order types that mirror the API contract
  utils/          Formatters, status and channel labels, business rules, error messages
tests/            Jest + React Testing Library tests, fixtures and mocks
```

## Key decisions

- **The server does all filtering, sorting and paging.** Every request asks for at most 50 orders (the API's limit; the desk uses 20). Totals and page counts come from the response's `total`, never from the number of orders loaded.
- **Money is shown, not calculated.** `order.total` is the only order total; `lineTotal` already includes the quantity and is shown as sent.
- **Dates use the server's `createdAt`** and are always shown in London time, whatever the device's clock or time zone.
- **Fulfilment is never optimistic.** The status changes only after the API confirms it. Each request sends the order's `version`; a 409 conflict shows the latest order the server returned, so two staff members can't silently overwrite each other.
- **Responses are validated** against the contract before use, so unexpected data fails clearly instead of showing wrong values.
- **Out-of-date requests are cancelled** with `AbortController`, and search waits 300 ms after typing (or runs immediately on Enter), so results always match the current query without flooding the API.
- **Customer phone numbers are never displayed.** The API returns them, but packers must not see them.
- **Accessibility:** semantic table and landmarks, labelled controls, visible focus rings, status shown by icon and text (not colour alone), keyboard-only operation including the sort menu and dialogs, and layouts checked at 390 px wide with text at 200%.

## Known limitations

- There are no user roles, so phone numbers are hidden for everyone rather than shown to the owner and customer care.
- The orders list does not update by itself when new orders arrive; changing page, filters or search fetches fresh data.
- The Inter font is loaded from Google Fonts.
