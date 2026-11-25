# Decisions: Order Desk against the real-mode API

This records how the Order Desk was tested against the supplied API's realistic mode, what went wrong, what was changed and why, and what is still open. It only describes tests that were actually run.

## 1. Testing environment

**API mode.** `node orders-server.js 4100 --real`: the supplied mock in real mode (the "live platform on a busy day"), unmodified. New orders arrive about once a minute; `POST /dev/new-order` (documented) was used to add one on demand. Calm mode (`node orders-server.js`) was used only where noted.

**How the app was tested**

- **Direct API survey.** Scripts fetched every order and every order's details straight from the API (148 orders at the start; 185 to 187 by the end) and recorded each field's type and format, response codes and timings.
- **Packer workflows in a browser.** The app ran in Vite's dev server pointed at real mode and was driven in a Chromium-based browser at desktop width and with a 375 px phone emulation (touch, coarse pointer), with real keystrokes for searching and scanning.
- **Failure scenarios.** Network failures cannot be produced reliably against the real mock, so a small test-only fault-injection proxy (not part of the repository) was put in front of a calm-mode instance. It could refuse connections, hang, cut a response halfway, apply a change and then drop the reply, or return 404, 429, 500, an HTML 502, broken JSON or an unexpected shape.
- **Two members of staff.** Two browser tabs opened the same order; one fulfilled it, then the other tried.
- **Automated tests.** 197 Jest and React Testing Library tests, plus TypeScript checking, oxlint and a production build, all passing at the end.

**Assumptions and what was not tested**

- A barcode scanner was simulated with real key presses (`2 2 3 7 Enter`). No physical scanner was used. USB and Bluetooth scanners in keyboard mode send key presses; scanners that insert text without key events were not tested.
- Phones were emulated. No physical Android device, its on-screen keyboard or its browser version was tested. Large text was simulated by doubling the root font size.
- The packing-room TV view was not built or tested.
- `docs/browser-log.txt` (from the shop's previous build) was read for hints: wrong panel totals, repeated printing on scanner Enter, notes lost between devices, a laptop running Chrome 119 with its own clock.

## 2. Findings

Severity: **Critical** blocks the desk; **High** risks wrong actions or wrong information; **Medium** causes friction or confusion; **Low** is minor.

| # | Problem | Steps to reproduce | Expected | Actual | Severity |
| --- | --- | --- | --- | --- | --- |
| F1 | The list endpoint sends values outside the API notes, and one bad order failed the whole page | Run `--real`, open the dashboard, any filter or search | Orders listed | "Unable to load orders… unexpected format" on every view. Of 148 listed orders: `createdAt` was Unix **seconds** on 85, `total` a string like `"£122.25"` on 42, `status` in capitals (`PAID`, `ON_HOLD`) on 21. The same orders' details were clean | Critical |
| F2 | Till orders have `customerName: null` and `phone: null` | Open a till order, e.g. #2345 | Details shown | "Unexpected format"; a raw PATCH showed fulfilment **succeeds** on the server but the app would have reported failure | High |
| F3 | Statuses not in the notes: `on_hold` (8) and `part_refunded` (3) | Any page containing #2337 | Shown with a clear status | Page failed; no filter for them. The server refuses to fulfil `on_hold` (409 `invalid_transition`) | High |
| F4 | The server sorts `total` as text | `GET /orders?sort=total&dir=desc` | Highest first | 78.5, 77.5, 76.5…, so £1,401.99 came after £78.50; ascending was effectively unsorted. Date sort was correct | Medium |
| F5 | Page-number paging shifts as orders arrive | Load page 1, `POST /dev/new-order`, load page 2 | Each order once | #2342 appeared on both pages | Medium |
| F6 | Rate limiting | Six requests at once (six desks share one key) | All succeed | 14 of 18 got 429 `{"code":"slow_down"}` with `Retry-After: 2`; five at once succeeded; immediate retries kept failing | Medium |
| F7 | Intermittent HTML error pages | Repeated list requests | JSON | One in 103 requests returned an HTML "502 Bad Gateway" | Medium |
| F8 | Slow responses | Any request | — | 0.3 to 2.2 seconds | Low |
| F9 | Search also matches phone numbers (undocumented) | Search or scan `2345` | #2345 | Also returned #2237, whose phone `07406-234-537` contains those digits, so the single-match scanner shortcut did not open anything | Medium |
| F10 | Names stored with extra spaces | Search "ben bennett" | Finds `"  ben  bennett "` (#2266) | No results (server-side search); the name displayed in lower case with odd spacing | Low |
| F11 | No time limit on requests | Proxy hangs the list, details or fulfil request | An error with a way out | Loading forever; a hanging fulfil left "Fulfilling…" on a confirmation that cannot be dismissed, freezing the app until a page reload | High |
| F12 | A fulfilment that succeeded was reported as failed | Proxy applies the PATCH, then drops or garbles the reply | "Fulfilled" | Badge reloaded to Fulfilled, but the message said "Order not fulfilled \| Failed to fetch" | High |
| F13 | Raw browser errors | Connection cut while reading a response | Plain message | "Failed to fetch" | Medium |
| F14 | An open order is not refreshed | Staff B keeps #2340 open while Staff A fulfils it | B sees the change before acting | B saw "Paid" until pressing fulfil; only the server's 409 caught it (correctly, with no overwrite) | Medium |
| F15 | 404 left actions that cannot work | 404 during fulfil, or opening a removed order | Actions removed | "Mark as fulfilled" and "Try again" still offered; order stayed in the list | Medium |
| F16 | A scan while a panel is open was lost | With #2255 open, scan `2339` | #2339 opens | Digits went nowhere and Enter pressed the focused Close button | Medium |
| F17 | Search box focused on load on phones | Load on a touch device | Keyboard stays closed | Search focused on load (emulated); on a real phone this opens the keyboard over the list | Medium |
| F18 | Enter in an empty search opened an order | A filter with one result, Enter in an empty search box | Nothing opens | The only order opened | Low |
| F19 | Setup failures were silent | Leave `VITE_API_TOKEN` blank | A visible explanation | Blank page; reason only in the console. The README also referred to a `.env.example` that is no longer in the repository | Low |
| F20 | Found while fixing F15: a removed order showed "Paid" | 404 on a fulfil | No status shown | The header fell back to the list's last-known status | Medium |

What held up under real-mode and failure testing:

- **Unpaid orders were never fulfilled.** The app sent no request, and the server also refuses (409 `invalid_transition`).
- **Money was consistent.** Line totals added up to `total` for every order checked.
- **Concurrent updates were safe.** Version-based 409 conflicts were handled without overwriting anyone's change.
- **Basic errors were handled.** 500, HTML 502 and 429 showed friendly messages.
- **Escape and keyboard focus** behaved correctly.

## 3. Decisions and fixes

| Finding | Decision | Reason | Implementation | Trade-offs |
| --- | --- | --- | --- | --- |
| F1 | Normalise only verified formats at one API boundary; validate each order separately and list unreadable ones on screen | Business rules need trustworthy data; one bad record should not hide 19 good ones, and must not disappear silently | `src/services/order-parsers.ts`: money from numbers or exactly `£123.45` (pounds and pence parsed as integers); dates from ISO with time zone or integer Unix seconds; statuses matched case-insensitively. A `rejected` list per page with reasons, shown by `RejectedOrdersNotice` (commit `6b3e08f`, `06b5e0e`) | Unseen formats (e.g. `£1,401.99`, millisecond dates) are rejected rather than guessed, so a new API format shows up as a visible rejected record |
| F2 | Allow null names and phones; display "Till customer" | Till sales have no customer | Nullable types; `displayCustomerName` | — |
| F3 | Support `on_hold` and `part_refunded` as distinct statuses that cannot be fulfilled | No business rule allows it; unknown statuses are never mapped to known ones | Labels, badges, filters, panel text; `canFulfilOrder` remains paid-only | If Kerbwise decides either can be fulfilled, only `canFulfilOrder` needs to change |
| F4 | When sorting by total, load every page one after another (50 at a time), remove duplicates by order id and sort locally | The server's total sort is wrong | `getAllOrders` and `sortByTotal`; paging is then local (commit `2cadc82`) | One request per 50 orders (4 for 185); capped at 20 pages (1,000 orders), above which staff are asked to search or filter first; not a consistent snapshot |
| F5 | Show a notice when the total changes while paging or while pages load, with a refresh | Page-number paging cannot be made consistent on the client | `listChanged` in `useOrders`, `ListChangedNotice` | Reduces the risk; does not remove it |
| F6 | Retry safe reads once after `Retry-After` (plus up to 0.5 s jitter); never retry a fulfilment | Six desks share one key; retrying all at once would trigger another 429 | `read()` in `orders-api.ts`; waits over 10 s are reported instead (commit `ca5a410`) | Loading can take a few seconds longer when the service is busy |
| F7, F13 | Treat failures while reading a response as network errors; keep the HTTP status of non-JSON error pages | Staff should never see browser jargon | `request()` in `orders-api.ts` (commit `2105fe3`) | — |
| F11 | A 15-second time limit on every request, including reading the body | Nothing should load forever or freeze the app | Combined with caller cancellation by hand rather than `AbortSignal.any`, which older Android browsers lack | A very slow but successful response after 15 s is treated as a timeout; for fulfilment the order is then checked (F12) |
| F12 | When a fulfilment has no readable answer (network, timeout, 5xx, unreadable reply), fetch the order and describe its confirmed status; if that check fails, say so and offer "Check again" | Messages must never contradict the server | `useFulfilment` and `describeFulfilmentFailure` (commit `cd43d00`) | One extra read after a failure; 5xx is treated as "unknown" because a gateway error can follow a change that was applied |
| F14 | Fetch the order again before opening the confirmation | Catch another member of staff's change before staff confirm | `useFulfilment.start` | One extra request per fulfilment |
| F15, F20 | On 404, say the order no longer exists, remove actions, refresh the list; hide the status badge when details fail to load | Stale information must not look current | `useOrderDetail` `isGone`, `OrderDetailsDrawer` (commit `93ae902`) | — |
| F9, F16, F18 | Open the order whose number matches a scan exactly; capture digits typed outside text fields followed by Enter as a scan, including with a panel open; stop that Enter pressing the focused button; ignore scans while a confirmation is open; only open automatically after a non-empty search | Scanners type and press Enter; a scan must never confirm anything | `findOrderToOpen`, `useScanner` (commit `7be7a97`) | Needs key events (see limitations); digits typed on a focused button followed by Enter are treated as a scan |
| F17 | Focus the search box on load only on devices with a precise, hovering pointer | Keep the scanner station fast without opening keyboards on phones | `hasPrecisePointer()` in `OrderFilters` (commit `9b330c9`) | Touch-screen scanner stations would need a tap first |
| F10 | Tidy names for display (trim and collapse spaces), keep letter case | Readability without altering data | `displayCustomerName` (commit `c3242af`) | Search still runs on the server, so odd spacing can still stop a match |
| F19 | Show a setup message naming missing settings; document the `.env` lines in the README | Silent blank pages waste time | `ConfigError`, `findMissingSettings` (commits `bb29e3d`, `dc0c31a`) | — |
| — | Plain language throughout | Staff should not see status codes or jargon | `getErrorMessage`, natural counts ("8 orders on hold") | — |

## 4. Known limitations

- **No user roles.** Phone numbers are hidden for everyone, including the owner and customer care, who are allowed to see them. They are still present in API responses, so anyone opening the browser's developer tools can read them. Fixing this needs per-role API keys or an API that omits phones for packers.
- **No automatic refresh.** New orders (about one a minute in real mode) appear only after an action that reloads the list. Deferred by decision; see section 6.
- **Page-number paging can shift.** The notice warns staff, but duplicates or skips across pages remain possible. A real fix needs cursor or snapshot paging from the API.
- **Sorting by total is local.** It costs one request per 50 orders, is capped at 1,000 orders, and is not a consistent snapshot.
- **Server-side search quirks remain.** It matches phone numbers (F9) and is sensitive to stored spacing (F10). The client cannot change what the server matches.
- **Scanner input outside the search box needs key events.** Text inserted without key presses is not recognised as a scan while focus is outside the search box.
- **Not tested on real devices.** No physical phone, older Android browser or scanner was used. The app uses Tailwind CSS v4, which needs Chrome 111 or later; the packing laptop's Chrome 119 is fine, older phones may not be.
- **The API key is in the browser bundle**, as with any `VITE_` variable. The notes say this key is used across the platform; a narrower key was promised.
- **The Inter font loads from Google Fonts.**
- **Notes are read-only.** `docs/browser-log.txt` suggests staff typed notes in the old build that were lost; the API offers no way to save notes.

## 5. Backend dependencies

Changes that only the API can make, and that would remove workarounds above:

1. **One consistent representation** in the list and details: numeric totals, ISO 8601 dates, lower-case statuses.
2. **Documented statuses and transitions**, including `on_hold` and `part_refunded`, and who may move an order between them.
3. **A correct numeric sort by total**, so the desk can go back to server paging for every sort.
4. **Cursor or snapshot paging**, so pages do not shift as orders arrive.
5. **A way to learn about new or changed orders** (a change feed, or ETags or `If-None-Match` for cheap polling) that fits the rate limit.
6. **Per-user or per-role keys**, so phone numbers can be withheld from packers at the source, and rate limits apply per desk rather than per shop.
7. **Documented search behaviour**: whether phone numbers should be searchable, and normalised names.
8. **Idempotent updates.** The CORS preflight allows `Idempotency-Key` and `If-Match` headers, but neither is documented, so the desk does not use them. If supported, they would make a fulfilment whose reply was lost safe to retry automatically.

## 6. Deferred features

| Feature | Why deferred |
| --- | --- |
| Automatic polling for new orders | Decided out of scope for this step; six desks share one rate-limited key, so a polling interval needs agreeing (see questions) |
| Packing-room TV view | Out of scope for this step |
| Showing phone numbers to owners and customer care | Needs roles and identity, which the desk does not have |
| Editing notes | No API endpoint |
| Payment reminders, Excel export, dark mode | Not requested for this step (the reminder appears in the prototype only) |

## 7. Questions for Kerbwise

1. Can a **part-refunded** order be packed and fulfilled? Who decides?
2. What does **on hold** mean for packers, and who releases an order from hold?
3. Is `PAID` always the same as `paid`, and why does the list send different formats from the details? Which should the desk trust if they ever disagree?
4. Is **"Till customer"** the right wording for till orders without a name?
5. Should searching by **phone number** be possible for packers, given phones are personal data?
6. Who may see customers' phone numbers in the desk, and how will the desk know who is using it?
7. How many orders can a shop have in one view? Sorting by total is capped at 1,000.
8. Is automatic refresh wanted, and how often, given the shared rate limit?
9. Should staff be able to add or edit order notes from the desk?
10. Will each desk get its own, narrower API key?
