# AutoLog in the cloud (any provider)

**English** · [Español](../es/cloud.md)

AutoLog is a single Docker container plus a PostgreSQL database, so it runs on almost any cloud. This guide lists
what the platform must provide and the settings to use; follow your provider's own docs for the clicks.

If your provider gives you a plain virtual machine (VPS), it's simpler to follow [self-hosting.md](self-hosting.md)
on it. On **Render** there's a one-click button, and on **Coolify** a ready-made template: [one-click.md](one-click.md).

## Checklist: what your platform needs

| Requirement | Why | Look for |
|---|---|---|
| **Run a container** from this repo's `Dockerfile` (or a prebuilt image) | The app | "Deploy from GitHub / Dockerfile", "container service" |
| **PostgreSQL 14+** | The data | Managed PostgreSQL from the same provider or a separate one; or a second container with a volume |
| **Persistent disk mounted at `/data`** | Photos and PDFs (attachments) | "Volume", "persistent disk". ⚠ Without it, attachments are **lost on every deploy or restart** |
| **HTTPS** with your own or a provided domain | Install on the phone, push, scanner | Almost every platform provides it |
| **One always-on instance** | Daily reminder check and login lock-out live in memory | Disable "scale to zero" / "sleep" if you want push reminders on time; don't run more than 1 replica |

Costs vary by plan; small instances (256–512 MB RAM) are enough. Check that the plan you choose includes persistent
volumes: some free tiers don't.

## Settings

**Container**

- Port: the app listens on `$PORT` if the platform sets it, otherwise `8791`.
- Health check: `GET /v1/health` (no password needed).
- Volume: mount it at `/data`.

**Environment variables / secrets**

| Variable | Value |
|---|---|
| `AUTOLOG_TOKEN` | `openssl rand -hex 24` — store it as a **secret**, not as plain config |
| `DATABASE_URL` | Your PostgreSQL URL, e.g. `postgres://user:pass@host:5432/autolog?sslmode=require` |
| `TRUST_PROXY` | `1` (the platform's load balancer is in front of the app) |
| `PUSH_CONTACT` | `mailto:` + an address you own |
| `TZ` | Your time zone, e.g. `Europe/Madrid` (the daily reminder check runs at `PUSH_HOUR`, default 9) |

The Dockerfile already sets `STATIC_DIR` and `FILES_DIR=/data/files`. **Never** set `ALLOW_NO_AUTH` on a public cloud.

## Steps (general)

1. **Fork** this repository (or use the image from `ghcr.io/davidniin/autolog` if the maintainers publish one).
2. **Create the database**: a managed PostgreSQL, or a PostgreSQL container with its own volume. Copy its connection
   URL. Managed databases usually need `?sslmode=require` at the end.
3. **Create the app** from your fork using the `Dockerfile`. Add the variables above, a volume at `/data` and the
   health check.
4. **Deploy** and open `https://<your-app>/v1/health`: it should say `"db":true,"auth":true`.
5. **Install it on the phone**: open `https://<your-app>/?token=<AUTOLOG_TOKEN>` once, then *Install app* (Android) or
   *Share → Add to Home Screen* (iPhone).

## Platform types

- **Container PaaS with volumes** (e.g. Fly.io, Railway, Render with a disk, Koyeb, Northflank…): deploy from the
  Dockerfile, attach a volume at `/data`, add a managed PostgreSQL or a separate one (Neon, Supabase, Aiven…).
- **Serverless containers without disks** (e.g. Google Cloud Run, AWS App Runner, Azure Container Apps without a
  file share): the app runs, but attachments need a mounted file share at `/data`; without it they will be lost.
  These platforms also scale to zero by default — set a minimum of 1 instance for on-time reminders.
- **Kubernetes**: a `Deployment` with 1 replica, a `PersistentVolumeClaim` at `/data`, a `Secret` with the variables,
  and an `Ingress` with TLS.
- **VPS / VM** (any provider): use the Docker Compose setup from [self-hosting.md](self-hosting.md) with Caddy.

Provider features and free tiers change often: check their current documentation. If you write a step-by-step for a
specific provider, a pull request to `docs/` is very welcome.

## Security in a public cloud

- The password is the only barrier: use a long random token and keep it as a secret.
- Keep the app updated (`git pull` in your fork, or enable automatic deploys).
- Enable backups of the database (most managed PostgreSQL services have them) and of the `/data` volume.
- Your data is on the provider's infrastructure: choose a region and provider you trust.

## Backups

- **Database:** the provider's automatic backups, or `pg_dump "$DATABASE_URL" | gzip > autolog-db.sql.gz` from your
  computer.
- **Attachments:** volume snapshots if the platform offers them; otherwise copy `/data/files` with the platform's
  shell or SFTP.
