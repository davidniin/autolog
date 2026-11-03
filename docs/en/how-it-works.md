# How AutoLog works

**English** · [Español](../es/how-it-works.md)

## Architecture

```
Phone (PWA) ──HTTPS──▶ autolog (Node + Hono, port 8791) ──▶ PostgreSQL
                         └── /data/files (attachments)
```

- **Web app** (`web/`): Vue 3 + Vite. Vehicle selector at the top and four tabs: **Resumen** (summary: vehicle card,
  reminders, consumption, expenses), **Repostajes** (fill-ups), **Gastos** (expenses, filterable by category) and
  **Costes** (costs).
- **Offline first**: every change is shown at once, stored on the phone (`localStorage`) in a queue and sent in order
  when there is a connection. While there are queued changes the app doesn't reload from the server, so nothing local
  is overwritten. Record ids are generated on the phone, so re-sending a change never duplicates it.
- **Server** (`server/`): Node 22+ and Hono. Serves the `/v1` API and the built web app from one container. Tables
  (`autolog_*`) are created automatically on start.

## Languages

The interface is in English and Spanish. It follows the phone's language the first time and can be changed in
**⚙ Settings** (saved on each phone). Texts live in `web/src/i18n/` (`es.js`, `en.js`, same keys); dates and numbers
use the locale of the chosen language. Push notifications are sent in the language each phone had when it
subscribed (`server/src/messages.js`). API error responses are in English and include a stable `code` that the app
translates.

## Consumption: full-to-full method

Each fill-up says whether the tank was filled. Between two full fills, consumption is the litres added after the first
one (including partial fills in between) divided by the km driven. **Average** joins every stretch; **last stretch**
is the most recent one.

## Reminders

A reminder is due on a date, at a mileage, or both, and fires with whichever comes first. It becomes ⚠️ *Pronto*
(soon) 30 days or 1,000 km before, and ⛔ *Vencido* (overdue) after. It can repeat every X km and/or X months.

**Hecho** (done) asks for date, km and, optionally, an amount. With an amount, an expense is recorded in the reminder's
category. A repeating reminder is rescheduled from that date and mileage; otherwise it is deleted. Templates: oil,
service, ITV (MOT), insurance, road tax, tyres.

## Costs

- **Per month:** all expenses (fuel included) divided by the months since the first entry.
- **Per km:** total divided by the km driven since the first known mileage.
- **With purchase:** if the vehicle has a purchase price, purchase + expenses and cost per month since purchase.
- **Last 12 months chart:** fuel and other expenses stacked; tap a month for its detail.
- **Breakdown by category.**

## Push notifications

In **Resumen → Avisos**, *🔔 Avisarme también con notificaciones en este móvil* asks for permission and subscribes the
phone; a test notification arrives. It can be enabled on several phones.

- **Daily check:** the server checks every reminder once a day from `PUSH_HOUR` (9:00 by default, server time `TZ`).
- **When:** a reminder becomes *soon* or *overdue*, or its due date/km changes. If it stays overdue, once a week.
- **Requirements:** HTTPS. On iPhone (iOS 16.4+) the app must be installed on the home screen.
- **VAPID keys** are generated on first start and stored in `autolog_setting`. If deleted, enable notifications again
  on each phone.
- **Check now:** `curl -X POST -H "Authorization: Bearer $AUTOLOG_TOKEN" https://<your-app>/v1/push/check`
  (it never repeats what was already notified).

## Attachments

Photos and PDFs on **expenses** (invoices), **fill-ups** (fuel receipts) and the **vehicle** (registration, insurance
policy…). Up to 15 MB each. Photos are reduced to 2000 px on the phone before uploading (a 5 MB photo becomes ~300 KB).
Uploading needs a connection. Deleting an expense, fill-up or vehicle deletes its files too.

## Scanning invoices and receipts

In a new expense or fill-up, **📷 Escanear la factura** reads the photo and fills in the form.

- **Expense:** total amount, date, km, category, concept, workshop and invoice number.
- **Fill-up:** litres, amount, date and station; litres are computed from €/L if missing.
- Filled fields are marked **✨ leído** until edited. What you already typed is never overwritten. The photo is attached.
- Warns if the invoice's plate is not the vehicle's, and offers to record a fuel receipt scanned as an expense as a
  fill-up instead.
- **On-device OCR** with [runonweb](https://runonweb.ai/models/ocr) (PP-OCRv6 by PaddleOCR, WebGPU or WASM). The photo
  is never sent anywhere. The first time it downloads the model from Hugging Face (~31 MB) and the onnxruntime engine
  from jsdelivr; both are cached on the phone and it works offline afterwards.
- **Code:** `web/src/ocr.js` (loaded only when used), `web/src/receipt.js` (extracts the data from the text; Spanish
  rules today) and `web/src/ReceiptScan.vue`. Tests with sample invoices: `web/test/receipt.test.js`.
- **Pinned versions:** `runonweb` 0.1.0 and `onnxruntime-web` 1.30.0 (in `overrides`): the WASM loaded from the CDN must
  match the JS version. When upgrading runonweb, check its `ORT_WASM` constant and update the override and the CSP.

## Form validation

Rules per field live in `web/src/forms.js` (required, min/max, decimals, no future dates…) and are applied by
`web/src/validate.js`. Errors appear when leaving a field or on save, and the cursor jumps to the first wrong field.
Fill-ups also check that the mileage fits between the previous and next fill-ups and that €/L is realistic
(0.30–5 €/L). The server does its own basic check (`server/src/db.js`, `clean()`).

## Security

- `AUTOLOG_TOKEN` is required (16+ characters); the server refuses to start without it unless `ALLOW_NO_AUTH=1`.
- Every API route except `/v1/health` needs `Authorization: Bearer <token>`. Attachments (opened by `<img>` or in a new
  tab) use the `autolog_token` cookie, limited to `/v1/files`. Tokens are never accepted in URLs, except the one-time
  `/?token=` link that the web app stores and removes from the address bar.
- 10 failed attempts from one IP within 15 minutes → `429` for 15 minutes. Behind a proxy set `TRUST_PROXY=1`, and
  only then, so the real client IP is used.
- Security headers on every response; a Content-Security-Policy on the web app (see `server/src/security.js`).
- Same-origin only: no CORS unless `CORS_ORIGIN` is set. Internal errors are logged, not returned to the client.

## Demo mode

`/?demo=1` loads made-up data into the current tab (`sessionStorage`), with no server requests and without touching
the real data stored on the phone. Useful to try the app and for screenshots. *Salir* (exit) clears it.

## API

| Method | Path | |
|---|---|---|
| GET | `/v1/health` | Status (no password) |
| GET | `/v1/data` | `{ vehicles, fuel, expenses, reminders, files }`, all at once |
| PUT | `/v1/{vehicles,fuel,expenses,reminders}/:id` | Create or update (idempotent: the id comes from the client) |
| DELETE | `/v1/{vehicles,fuel,expenses,reminders}/:id` | Delete. Deleting a vehicle deletes everything it has |
| POST | `/v1/files` | Upload an attachment (multipart: `file`, `id`, `vehicle_id`, `parent_kind` = vehicles · expenses · fuel, `parent_id`) |
| GET / DELETE | `/v1/files/:id` | Open or delete an attachment |
| GET | `/v1/alerts` | Pending reminders (*soon* / *overdue*) of every vehicle, e.g. for a home dashboard |
| GET | `/v1/push/key` | Public VAPID key |
| POST | `/v1/push/subscribe` · `/unsubscribe` · `/test` · `/check` | Push subscriptions and sending |

## Configuration reference

| Variable | Default | |
|---|---|---|
| `AUTOLOG_TOKEN` | — | App password, required (16+ characters) |
| `DATABASE_URL` | `postgres://autolog:autolog@localhost:5432/autolog` | PostgreSQL connection |
| `PORT` | `8791` | Port inside the container |
| `TRUST_PROXY` | `0` | `1` behind a reverse proxy (real client IP from `X-Forwarded-For`) |
| `CORS_ORIGIN` | empty | Only if the web app is served from another origin |
| `PUSH_CONTACT` | `mailto:autolog@example.com` | Contact for push services: use a real address |
| `PUSH_HOUR` | `9` | Hour of the daily reminder check |
| `TZ` | `Europe/Madrid` | Server time zone |
| `STATIC_DIR` | empty (`web` in Docker) | Built web app to serve |
| `FILES_DIR` | `./data/files` (`/data/files` in Docker) | Attachments folder |
| `ALLOW_NO_AUTH` | `0` | `1` = start without a password. Only on a private network with no internet access |
| `BIND_ADDR` / `HOST_PORT` | `127.0.0.1` / `8791` | Docker Compose only: where the port is published on the host |
