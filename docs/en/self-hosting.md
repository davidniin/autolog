# Self-hosting AutoLog (your own server)

**English** · [Español](../es/self-hosting.md)

Any machine that runs Docker works: a home server, a NAS, a Raspberry Pi 4/5 or a VPS from any provider.
For a cloud platform without a shell (PaaS), see [cloud.md](cloud.md).

## What you need

- Docker with the Compose plugin (`docker compose version`).
- About 300 MB of RAM and some disk for attachments.
- **HTTPS** for the phone: installing the app, push notifications and the scanner need a secure connection. Options
  are in step 3.

## 1. Configure

```sh
git clone https://github.com/davidniin/autolog.git
cd autolog
cp .env.example .env
```

Edit `.env`:

| Variable | What to put |
|---|---|
| `AUTOLOG_TOKEN` | The app password. Generate it: `openssl rand -hex 24`. Min. 16 characters |
| `POSTGRES_PASSWORD` | Any long password for the bundled database (`openssl rand -hex 24`) |
| `PUSH_CONTACT` | `mailto:` + an address you own (push services require it; Apple rejects made-up ones) |
| `TZ` | Your time zone, e.g. `Europe/Madrid`, `America/Mexico_City` |

`.env` holds your secrets: it is in `.gitignore` and must never be committed or shared.

## 2. Start

```sh
docker compose up -d --build
curl http://127.0.0.1:8791/v1/health    # {"ok":true,...,"db":true,"auth":true}
```

This starts two containers: `autolog` and its own PostgreSQL (`db`, not reachable from outside). The app listens
**only on 127.0.0.1:8791**: nothing is exposed to your network or the internet until you choose how in step 3.

## 3. HTTPS and access from your phone

Pick one.

### A. Tailscale — private, no open ports (recommended)

Only your devices (with Tailscale installed) can reach the app. Nothing is published to the internet.

```sh
sudo tailscale serve --bg --https=8444 http://127.0.0.1:8791
tailscale serve status        # shows https://<machine>.<tailnet>.ts.net:8444
```

Set `TRUST_PROXY=1` in `.env` and run `docker compose up -d`.

### B. Your own domain with Caddy (public)

Point a DNS record (e.g. `autolog.example.com`) to the server, open ports 80/443 and use this `Caddyfile`
(Caddy gets the certificate automatically):

```
autolog.example.com {
    reverse_proxy 127.0.0.1:8791
}
```

Set `TRUST_PROXY=1` in `.env` and run `docker compose up -d`. Nginx, Traefik or similar work the same way: proxy to
`127.0.0.1:8791` and pass `X-Forwarded-For`.

### C. Cloudflare Tunnel (public, no open ports)

Create a tunnel to `http://127.0.0.1:8791` (`cloudflared tunnel --url http://127.0.0.1:8791` to test, or a named
tunnel for good). Set `TRUST_PROXY=1`. You can add Cloudflare Access in front for an extra login.

> **Public exposure (B and C):** the password is the only thing between the internet and your data. Use a long random
> `AUTOLOG_TOKEN`, keep the app updated, and never set `ALLOW_NO_AUTH`.

## 4. Install it on the phone

Open `https://<your-address>/?token=<AUTOLOG_TOKEN>` once. The password is saved on the phone and removed from the
address bar. Then:

- **Android (Chrome):** tap **⬇ Instalar** in the header, or *Menu → Install app*.
- **iPhone (Safari):** *Share → Add to Home Screen*. Push notifications on iPhone require iOS 16.4+ and the installed
  app.

Do the same on every phone that should use it (they share the same data).

## Updating

```sh
git pull
docker compose up -d --build
```

Database changes are applied automatically on start.

## Backups

Your data is in two places: the database and the attachments volume. Keep the backups **outside the repository
folder** (they contain your personal data).

```sh
mkdir -p ~/autolog-backups
# database
docker compose exec -T db pg_dump -U autolog autolog | gzip > ~/autolog-backups/db-$(date +%F).sql.gz
# attachments (the volume name is <folder>_autolog-data; check it with: docker volume ls)
docker run --rm -v autolog_autolog-data:/d -v ~/autolog-backups:/b alpine tar czf /b/files-$(date +%F).tgz -C /d .
```

Restore:

```sh
gunzip -c ~/autolog-backups/db-2026-01-31.sql.gz | docker compose exec -T db psql -U autolog autolog
docker run --rm -v autolog_autolog-data:/d -v ~/autolog-backups:/b alpine tar xzf /b/files-2026-01-31.tgz -C /d
```

Automate it with `cron` and copy the folder to another machine or a cloud drive.

## Existing PostgreSQL

If you already run PostgreSQL (in Docker or not), use `docker-compose.external-db.yml` instead of the bundled one.

1. Create a user and a database:

   ```sh
   # <postgres> = your PostgreSQL container (docker ps)
   docker exec -it <postgres> psql -U postgres -c "create user autolog with password 'CHANGE_ME';"
   docker exec -it <postgres> psql -U postgres -c "create database autolog owner autolog;"
   ```

2. In `.env`, set `DATABASE_URL` instead of `POSTGRES_PASSWORD`:

   ```
   DATABASE_URL=postgres://autolog:CHANGE_ME@host.docker.internal:5432/autolog
   ```

   `host.docker.internal` is the host machine. If your PostgreSQL is a container on a Docker network, uncomment the
   `networks` block in the file and use the container name instead.

3. Start: `docker compose -f docker-compose.external-db.yml up -d --build`

Tables are created on first start. Back up the database with your usual PostgreSQL backup.

## Without Docker

Node 22+ and PostgreSQL 14+:

```sh
cd web && npm ci && npm run build && cd ..
cd server && npm ci --omit=dev
AUTOLOG_TOKEN=... DATABASE_URL=postgres://... STATIC_DIR=../web/dist FILES_DIR=/var/lib/autolog node src/index.js
```

Run it as a service (systemd, pm2…) and put HTTPS in front as in step 3.

## Troubleshooting

| Problem | Fix |
|---|---|
| Container exits: `AUTOLOG_TOKEN is missing` / `too short` | Set a token of 16+ characters in `.env` |
| `/v1/health` says `"db":false` | Check `DATABASE_URL` / `POSTGRES_PASSWORD`; `docker compose logs db` |
| The phone keeps asking for the password | The token on the phone doesn't match `AUTOLOG_TOKEN`. Open `/?token=...` again |
| `429 too many attempts` | 10 wrong passwords from that IP: wait 15 minutes. Behind a proxy, set `TRUST_PROXY=1` so each device is counted separately |
| No "Install" option / no push | The page isn't on HTTPS (see step 3) |
| Scanner says it needs a connection | The first use downloads the OCR model (~31 MB). Afterwards it works offline |

Logs: `docker compose logs -f autolog`.
