# AutoLog — your vehicle's logbook

**English** · [Español](README.es.md)

[![Live demo](https://img.shields.io/badge/live%20demo-try%20it-2f5fd0)](https://davidniin.github.io/autolog/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Buy me a coffee](https://img.shields.io/badge/buy%20me%20a%20coffee-☕-ffdd00)](https://buymeacoffee.com/davidniin)

Log fill-ups, expenses and reminders for your car or motorbike, and see what it really consumes and costs.
AutoLog is a mobile web app you install on your phone (PWA) and **host yourself**: your data lives on your server,
not on someone else's.

<p align="center">
  <img src="docs/screenshots/light-summary.png" width="220" alt="Summary: vehicle card, reminders">
  <img src="docs/screenshots/light-scan.png" width="220" alt="Scanning a workshop invoice fills in the form">
  <img src="docs/screenshots/light-costs.png" width="220" alt="Costs per month and per km, 12-month chart">
  <img src="docs/screenshots/dark-summary.png" width="220" alt="Dark mode">
</p>

## Features

- **Fill-ups** with real consumption (full-to-full method), €/L and cost per trip.
- **Expenses** by category (service, repairs, MOT/ITV, insurance, tax, parking, tolls…) with photo/PDF attachments.
- **Reminders** by date and/or mileage (oil change, ITV, insurance…), with optional **push notifications**.
- **Costs**: per month, per km, including the purchase price, 12-month chart and breakdown by category.
- **Scan invoices and fuel receipts** (photo or PDF, Spanish or English): the amount, date, mileage, litres and concept
  are filled in.
  OCR runs **on the phone** ([runonweb](https://runonweb.ai/models/ocr), PP-OCRv6): the photo never leaves the device.
- **Works offline**: changes are saved on the phone and synced when the connection is back.
- **Validation** of every field (impossible mileage, unrealistic €/L, future dates…).
- **Your units**: km or miles, litres or gallons, L/100 km, km/L or mpg, and any currency.
- **Your data, portable**: backup with photos (ZIP) and restore, CSV export/import (Excel, Google Sheets).
- **Several phones**: if two phones edit the same thing, you choose which version to keep — nothing is lost silently.
- **Accessible**: checked with axe-core (WCAG 2.1 AA), keyboard and screen-reader friendly.
- **English and Spanish** (follows the phone's language; switch it in ⚙ Settings), light/dark mode, installable on
  Android and iPhone, several vehicles.

## Try it

**[Live demo](https://davidniin.github.io/autolog/)** — the real app with made-up data, right in your browser. Nothing is
saved and nothing is sent anywhere.

Locally: run it (see [Development](#development)) and open `http://localhost:5173/?demo=1`.

## Install your own

AutoLog is **self-hosted**: everyone runs their own copy. There is no central service and nobody else sees your data.

| Where | Guide |
|---|---|
| Your own server / NAS / Raspberry Pi / VPS (Docker) | [docs/en/self-hosting.md](docs/en/self-hosting.md) |
| Any cloud provider (container + PostgreSQL) | [docs/en/cloud.md](docs/en/cloud.md) |

Quick start with Docker:

```sh
git clone https://github.com/davidniin/autolog.git && cd autolog
cp .env.example .env          # set AUTOLOG_TOKEN (openssl rand -hex 24) and POSTGRES_PASSWORD
docker compose up -d --build  # app on 127.0.0.1:8791 + its own PostgreSQL
```

Then put HTTPS in front of it (Tailscale, Caddy, Cloudflare Tunnel…) — required to install it on the phone.

## Privacy and security

- Your data stays in **your** PostgreSQL and **your** disk. The app has no analytics and no tracking.
- The only external requests are the one-time download of the OCR model (Hugging Face) and engine (jsdelivr), and
  push notifications (sent through Google/Apple/Mozilla push services, as for any web app).
- Access needs a password (`AUTOLOG_TOKEN`, min. 16 characters); the server won't start without one. Repeated wrong
  attempts are blocked, and security headers (CSP…) are set.
- Found a vulnerability? Please report it privately: see [SECURITY.md](SECURITY.md).

## How it works

Consumption, reminders, costs, push, attachments, scanner, validation, API and backups:
[docs/en/how-it-works.md](docs/en/how-it-works.md).

```
Phone (PWA) ──HTTPS──▶ autolog (Node + Hono, port 8791) ──▶ PostgreSQL
                         └── /data/files (attachments)
```

- `web/` — Vue 3 + Vite PWA. `server/` — Node 22+ and Hono: `/v1` API plus the built web app, in one container.

## Development

```sh
cd server && npm install && npm run dev   # :8791 — needs PostgreSQL (DATABASE_URL in server/.env)
cd web && npm install && npm run dev      # :5173, proxies /v1 to :8791
npm test                                  # in web/ and in server/
cd web && npm run build:site              # landing page + live demo → site/dist/
```

For the server in development you can set `ALLOW_NO_AUTH=1` in `server/.env`.

## Contributing

Ideas, bug reports and pull requests are welcome, in English or Spanish. Read [CONTRIBUTING.md](CONTRIBUTING.md)
and the [Code of Conduct](CODE_OF_CONDUCT.md).

## Roadmap

1. More languages, and receipt-scanner rules for more countries — help wanted.
2. Electric and hybrid vehicles (kWh).
3. Tyres and parts tracking.
4. A PDF service history to show when selling the vehicle.
5. A prebuilt Docker image for every release (`ghcr.io`).

## Support

AutoLog is free and always will be. If it's useful to you, you can
**[buy me a coffee ☕](https://buymeacoffee.com/davidniin)** — thank you!

## License

[MIT](LICENSE)
