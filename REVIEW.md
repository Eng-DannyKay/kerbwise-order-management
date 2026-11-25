# Review: "Add the order panel with a packing note and the packing slip"

**Author:** Kwesi · **Files:** `app/orders/OrderPanel.tsx`, `app/orders/panel.css`, `app/orders/OrderPanel.test.tsx`
**Evidence used:** the PR (`docs/orders-pr.md`), the packing-room browser log (`docs/browser-log.txt`, build 15), the API notes and the brief. Line numbers refer to `OrderPanel.tsx` as shown in the PR, counting `'use client'` as line 1.

**Recommendation: Request changes.** All five problems below block merging.

Thanks, Kwesi. The panel is aimed at exactly what the packing room asked for: scan, check the order, print, and close without the mouse. Reusing `getOrder`, adding a "Print slip" button and handling a missing address with optional chaining were all good calls. The browser log from the shop, though, shows real problems in use, and two more are visible in the code. They are listed in order of importance. Most are small changes.

"Confirmed" means the browser log shows it happening. "Risk" means it follows from the code but is not shown in the log.

---

## 1. Totals are wrong on the panel and on every printed slip

**Confirmed · Blocks merge**

**What happens.** Line 24 calculates the total as `lineTotal × qty` for each line, and line 36 shows each line's price the same way. The API's `lineTotal` is already the price for the whole line; `desk-api-notes.md` says it is "already multiplied by `qty`". So any line with a quantity above one is counted twice. The panel also calculates its own total instead of using `order.total`, which the API already provides.

**Evidence.** The log shows four orders, each with a correct API total and a wrong panel total:

| Order | API total (log) | Panel total (log) |
| --- | --- | --- |
| #2265 | £160.90 | £241.35 |
| #2270 | £185.90 | £309.84 |
| #2273 | £88.00 | £132.00 |
| #2274 | £149.50 | £249.16 |

Recalculating `lineTotal × qty` from these orders' real lines gives exactly the four wrong totals.

**Impact.** The slip goes in the customer's bag, so customers receive slips overstating what they paid (#2274 by two-thirds). That means confused customers, refund queries and lost trust. What customers were actually charged is not affected; the panel only displays a figure.

**Recommendation.** Show `l.lineTotal` exactly as the API sends it, and show `order.total` for the order total. Don't recalculate money in the browser. Add a test with a quantity-2 line that checks the displayed total equals `order.total`.

## 2. Every scan prints more copies than the last

**Confirmed · Blocks merge**

**What happens.** Lines 12–15 add a `keydown` listener to the whole window each time the panel opens, and nothing ever removes it. After four orders there are four listeners, so one key press runs everything four times.

**Evidence.** The print count goes up by one with each order opened: `window.print() x1` (#2265), `x2` (#2270), `x3` (#2273), `x4` (#2274). Escape then closed the panel four times: `key: Escape -> panel closed x4`.

**Impact.** Wasted slips at best. At worst, duplicate slips lead to duplicate packing, and the problem gets worse as the day goes on.

**Recommendation.** Use a named handler and return a cleanup function from the effect, for example `return () => window.removeEventListener('keydown', handleKey)`. Include `onClose` in the effect's dependencies, or read it through a ref. A test that opens and closes the panel twice and checks `onClose` is called once would catch this.

## 3. The scanner's Enter prints a slip before the new order has loaded

**Confirmed · Blocks merge**

**What happens.** Line 13 prints whenever Enter is pressed anywhere in the window. The barcode scanner ends every scan with Enter, so scanning the next order prints straight away. Enter pressed in the note box would also print.

**Evidence.** `open panel ord_2270` and `key: Enter -> window.print() x1` are both logged at 13:05:52, but `GET /orders/ord_2270` only returns at 13:05:53. The same pattern repeats for #2273 and #2274.

**Impact.** A slip is printed before the right order is on screen. It may show "Loading…", or the previous order: `order` is not reset when `id` changes, and there is no error handling or request cancellation on line 11. A wrong slip can end up in a customer's bag.

**Recommendation.** Don't use a bare Enter on the whole window. Print only from the "Print slip" button, or a dedicated shortcut that only works once the order for the current `id` has loaded and never while typing in a text field. While you are here, clear the order when `id` changes, cancel the previous request, and show an error with a retry if loading fails.

## 4. Customer data is exposed: phone numbers shown to packers, and notes rendered as HTML

**Risk (from the code) · Blocks merge**

**What happens.**
- **Phone numbers (line 44):** the panel and the printed slip show `order.phone`. The brief says phone numbers are personal data that only the owner and customer care may see, "not every packer".
- **Notes as HTML (line 46):** the slip renders `order.notes` with `dangerouslySetInnerHTML`. Notes come from customers through the website and WhatsApp, so a crafted note could run script inside the desk. The desk holds an API key that, per the brief, "the whole platform uses".

**Evidence.** Both are visible in the code. The log removes names, phone numbers and note text, so it neither shows nor rules out either problem. There is no sign that the HTML risk has been exploited; it is a risk found by reading the code.

**Impact.** A privacy breach the business has to be able to justify, phone numbers on paper slips, and a route to reading or changing orders through a malicious note.

**Recommendation.** Remove the phone number from the panel and the slip. If couriers need it, let's agree with Kerbwise who may see it. Render notes as plain text (`<p>{order.notes}</p>`, with `white-space: pre-line` if line breaks matter).

## 5. Notes are only saved on the device they were typed on

**Confirmed · Blocks merge**

**What happens.** Lines 8 and 18–21 save notes in `localStorage`, which belongs to one browser on one device. The PR says notes let "packers leave a message for each other", but other devices never see them. The note is also read only when the panel first loads, so if `id` changes without a remount, the previous order's note stays on screen.

**Evidence.** `note typed on ord_2265 (38 characters), saved` on the packing-room laptop, then `(on a packer's phone) open panel ord_2265: note box empty`.

**Impact.** Staff believe a message has been passed on ("fragile", "collect later") when it hasn't. That is riskier than having no note box at all.

**Recommendation.** The API has no endpoint for saving notes, so sharing them needs a backend change. Until then, please remove the note box, or label it clearly as "only saved on this device" and update the PR description. Let's raise the endpoint with Kerbwise.

---

## Before re-review

- **Fix 1–5 above, with tests.** The current snapshot test doesn't mock `getOrder`, so it only captures "Loading…" and can't catch any of these. Tests for the total, a single `onClose` call, and notes shown as text would cover the most important ones.
- **Next round, not blocking:**
  - **Close control:** make it a `<button>` with a label.
  - **Panel:** give it dialog semantics and a labelled note field.
  - **Width:** replace the fixed 420px with a width that fits a 390px phone.
  - **Printing:** add a print stylesheet so only the slip prints.
  - **Types:** use the order types instead of `any`.
  - **Till orders:** handle orders with no address on the slip.
- **Questions:**
  - Should slips be printable for orders that aren't paid?
  - Was this tested with the USB scanner?

Happy to pair on any of this. The fixes for 1, 2 and 4 are only a few lines each.
