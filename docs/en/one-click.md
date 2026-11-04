# One-click install

**English** · [Español](../es/one-click.md)

Ready-made templates so you don't have to write a `.env` or a `docker-compose.yml` yourself. They all follow the same
security rules:

- **No default passwords.** Every install generates its own owner password and database password.
- **The database is never published:** only the AutoLog container can reach it.
- **Hardened container:** unprivileged user, read-only filesystem except `/data`, no Linux capabilities,
  `no-new-privileges`.
- **Pinned image version** (`ghcr.io/davidniin/autolog:0.5`), never `latest`. To update, change the tag.
- `TRUST_PROXY` only where there really is a proxy in front.

| Platform | Where | Template |
|---|---|---|
| [CasaOS](#casaos) | Home server / NAS | [`deploy/casaos/docker-compose.yml`](../../deploy/casaos/docker-compose.yml) |
| [Umbrel](#umbrel) | Home server | [`deploy/umbrel/`](../../deploy/umbrel/) |
| [Coolify](#coolify) | Your server or VPS, with HTTPS | [`deploy/coolify/docker-compose.yml`](../../deploy/coolify/docker-compose.yml) |
| [Render](#render) | Cloud | [`render.yaml`](../../render.yaml) — button below |

For the phone app (install, notifications, scanner) you need **HTTPS**. Coolify and Render give it to you; on CasaOS
and Umbrel use Tailscale (both have it in their app store) or a reverse proxy — see [self-hosting.md](self-hosting.md).

## CasaOS

1. **App Store → ⋯ (top right) → Install a customized app → Import**, paste
   [`deploy/casaos/docker-compose.yml`](../../deploy/casaos/docker-compose.yml) and install.
2. On first start, a small `secrets` container creates a random owner password and database password in
   `/DATA/AppData/autolog/secrets/` (only root can list that folder). **Your password** is shown once in the logs of the
   `secrets` container, and is kept in `/DATA/AppData/autolog/secrets/app/token`.
3. On a computer it's at `http://<casaos-ip>:8791`. On the phone, open `https://<your-address>/?token=<password>` once,
   through HTTPS (Tailscale or a reverse proxy, see above).

Back up `/DATA/AppData/autolog/` (data, database and secrets), or use **⚙ Settings → Your data → Backup with photos**.

## Umbrel

Umbrel installs community apps from an **app store repository**. Until AutoLog is in Umbrel's official store:

1. Create a repository (e.g. `umbrel-apps`) with the contents of [`deploy/umbrel/`](../../deploy/umbrel/):
   `umbrel-app-store.yml` at the root and the `davidniin-autolog/` folder next to it.
2. In umbrelOS: **App Store → ⋯ → Community App Stores**, add that repository's URL, and install AutoLog.
3. The owner password is shown in the app's page in the Umbrel dashboard (**Default password**). The database password
   is derived by Umbrel and never shown.

Umbrel's login page is turned off for AutoLog (`PROXY_AUTH_ADD: "false"`) because the phone app can't go through it;
AutoLog's own password protects it.

## Coolify

1. **New resource → Docker Compose Empty**, paste
   [`deploy/coolify/docker-compose.yml`](../../deploy/coolify/docker-compose.yml) and **Deploy**.
2. Coolify generates the owner password (`SERVICE_PASSWORD_64_AUTOLOG`, see the resource's **Environment Variables**),
   the database user and password, and a domain with **HTTPS** (`SERVICE_FQDN_AUTOLOG_8791`). Set your own domain there
   if you have one.
3. Open `https://<your-domain>/?token=<password>` once on your phone.

## Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/davidniin/autolog)

1. Press the button, sign in to Render and confirm. The blueprint ([`render.yaml`](../../render.yaml)) creates AutoLog
   with a 1 GB disk for attachments and a PostgreSQL database.
2. Render generates the owner password (`AUTOLOG_TOKEN`, in the service's **Environment** tab). The database accepts no
   connections from the internet (`ipAllowList: []`).
3. Open `https://<your-app>.onrender.com/?token=<password>` once on your phone.

**Costs:** the disk for attachments needs a paid instance (`starter`) and the database a paid plan. Check Render's
current prices before deploying. Render takes care of HTTPS and of database backups on paid plans.

## Updating

Templates pin a minor version (`:0.5`), which receives fixes. For a new version, change the tag in the template (or
in the platform's settings) to the one in the [release notes](https://github.com/davidniin/autolog/releases) and
redeploy. Database changes are applied automatically on start.
