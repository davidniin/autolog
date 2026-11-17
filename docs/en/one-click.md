# One-click install

**English** · [Español](../es/one-click.md)

> **Just want to use AutoLog yourself, on one phone?** You don't need any of this: open the [no-server app](phone-only.md).
> These templates are for using it from **several phones**, sharing it with your family, or having photo attachments and
> push reminders.

## Which one is for me?

- **I have no server and don't want one at home → [Render](#render).** One button and a few minutes; the simplest, but paid.
- **I already have a home server with CasaOS or Umbrel → [CasaOS](#casaos) / [Umbrel](#umbrel).** Free; install from their
  app store.
- **I already use Coolify (or have a VPS) → [Coolify](#coolify).** It gives you HTTPS out of the box.

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

The simplest way if you have no server: you type no commands. **How long:** about 10 minutes the first time.
**How much:** Render charges for the disk and the database (see [Costs](#render-costs)).

### Step by step

1. **Press the button above.** Render opens. If you have no account, create one (you can sign in with GitHub or Google).
2. **Confirm the deployment.** Render shows what it is going to create: the AutoLog app and a database. Give it a name if
   asked (anything) and press the create/deploy button (*Deploy Blueprint*). If it asks for a card, it is because these
   services are paid.
3. **Wait.** The first build takes a few minutes. When it finishes, the app shows as *Live*.
4. **Get your password.** In Render's dashboard open the app (AutoLog) → **Environment** tab → find `AUTOLOG_TOKEN` and
   reveal its value. **It's your password:** copy it and keep it in a password manager or somewhere safe.
5. **Get your address.** At the top of the app's page Render shows its address: something like
   `https://autolog-xxxx.onrender.com`.
6. **Open it on your phone with your password.** In the phone's browser type the address followed by `/?token=` and your
   password:

   ```
   https://autolog-xxxx.onrender.com/?token=YOUR-PASSWORD
   ```

   The first time AutoLog guides you to create your first vehicle. The password is saved on the phone and disappears from
   the address bar.
7. **Install it on the phone.** Android (Chrome): menu ⋮ → *Install app*. iPhone (Safari): *Share ⬆︎ → Add to Home Screen*.

To use it on another phone, or for your family, repeat step 6 on that phone with the same address and password (or add a
new person in **⚙ Settings → People with access**, with their own password).

> Render's button names may change over time; the idea is always the same: create, wait for *Live*, copy the password and
> the address.

### Something wrong?

| If you see… | Do this |
|---|---|
| The phone keeps asking for the password | It doesn't match: copy it again from **Environment** and open `/?token=…` again |
| The page is slow to open the first time after a while | Normal on some Render plans (the app "sleeps"); wait a few seconds |
| No *Install* option | The page has to be opened with `https://` |
| I want to keep my data safe | **⚙ Settings → Your data → Backup with photos (ZIP)** |

### Render costs

The disk for attachments needs a paid instance (`starter`) and the database a paid plan. Check Render's current prices
before deploying. Render handles HTTPS and, on paid plans, database backups. The blueprint
([`render.yaml`](../../render.yaml)) creates the app with a 1 GB disk and a PostgreSQL database that doesn't accept
connections from the internet (`ipAllowList: []`). If you only want to try it for free, use the
[no-server app](phone-only.md).

## Updating

Templates pin a minor version (`:0.5`), which receives fixes. For a new version, change the tag in the template (or
in the platform's settings) to the one in the [release notes](https://github.com/davidniin/autolog/releases) and
redeploy. Database changes are applied automatically on start.
