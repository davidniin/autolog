# AutoLog online, no commands (Render, CasaOS, Umbrel, Coolify)

**English** · [Español](../es/one-click.md)

> **Who it's for:** anyone who wants AutoLog on **several phones**, with their family, or with photo attachments and push
> reminders, without setting anything up by hand.
> **Time:** 10–20 minutes. **What you need:** one of the platforms below.
> Just you, on one phone? You need none of this: [AutoLog on your phone only](phone-only.md).

## Pick your platform

| Platform | Who it's for | Difficulty | Cost |
|---|---|---|---|
| [**Render**](#render) | You have no server and want the easiest way | 🟢 Easy | Paid |
| [CasaOS](#casaos) | You have a home server or NAS with CasaOS | 🟡 Medium | Free |
| [Umbrel](#umbrel) | You have a home server with Umbrel | 🟡 Medium | Free |
| [Coolify](#coolify) | You already use Coolify on your server or VPS | 🟡 Medium | Your server |

Got a Raspberry Pi, a PC, or want your own domain? See [your own server](self-hosting.md). Another cloud (Fly.io,
Railway…)? See [cloud](cloud.md).

## Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/davidniin/autolog)

The simplest way if you have no server: you type no commands. **How long:** about 10 minutes the first time.
**How much:** Render charges for the disk and the database (see [Render costs](#render-costs)).

1. **Press the button above.** Render opens. If you have no account, create one (you can sign in with GitHub or Google).
2. **Confirm the deployment.** Render shows what it is going to create: the AutoLog app and a database. Give it a name if
   asked (anything). It will also ask for `PUSH_CONTACT`: type `mailto:` followed by your email (for example
   `mailto:you@mail.com`); it is only used for push reminders. Press the create/deploy button (*Deploy Blueprint*). If it
   asks for a card, it is because these services are paid.
3. **Wait.** The first build takes a few minutes. When it finishes, the app shows as *Live*.
4. **Copy your password.** In Render's dashboard open the app (AutoLog) → **Environment** tab → find `AUTOLOG_TOKEN` and
   reveal its value. **It's your password:** keep it in a password manager or somewhere safe.
5. **Copy your address.** At the top of the app's page Render shows its address, something like
   `https://autolog-xxxx.onrender.com`.
6. **Open it on your phone with your password.** In the phone's browser type the address followed by `/?token=` and your
   password:

   ```
   https://autolog-xxxx.onrender.com/?token=YOUR-PASSWORD
   ```

   The first time AutoLog guides you to create your first vehicle. The password is saved on the phone and disappears from
   the address bar.
7. **Install it.** Android (Chrome): menu ⋮ → *Install app*. iPhone (Safari): *Share ⬆︎ → Add to Home Screen*.

For another phone, repeat step 6 with the same address and password. For your family, add a person in **⚙ Settings →
People with access**: each gets their own password.

> Render's button names may change; the idea is always the same: create, wait for *Live*, copy the password and the
> address.

**Something wrong?**

| If you see… | Do this |
|---|---|
| The phone keeps asking for the password | It doesn't match: copy it again from **Environment** and open `/?token=…` again |
| The page is slow to open after a while unused | Normal on some Render plans (the app "sleeps"): wait a few seconds |
| No *Install* option | The page has to be opened with `https://` |
| I want to keep my data safe | **⚙ Settings → Your data → Backup with photos (ZIP)** |

### Render costs

The disk for attachments needs a paid instance (`starter`) and the database a paid plan. Check Render's current prices
before deploying. Render handles HTTPS and, on paid plans, database backups. If you only want to try it for free, use the
[no-server app](phone-only.md).

## CasaOS

For a home server or a NAS with CasaOS. It's free, but to install it on your phone you need
[HTTPS](#https-on-the-phone-casaos-and-umbrel).

1. **App Store → ⋯ (top right) → Install a customized app → Import**, paste the contents of
   [`deploy/casaos/docker-compose.yml`](../../deploy/casaos/docker-compose.yml) and install.
2. **Your password** is shown only once in the logs of the `secrets` container (created on first start) and stays in
   `/DATA/AppData/autolog/secrets/app/token`.
3. On a computer open `http://<casaos-ip>:8791`. On the phone, follow [HTTPS on the phone](#https-on-the-phone-casaos-and-umbrel).

Back up `/DATA/AppData/autolog/` (data, database and secrets), or use **⚙ Settings → Your data → Backup with photos**.

## Umbrel

Umbrel only installs apps from "stores". AutoLog isn't in the official one yet, so you create your own mini-store (about 5
minutes on GitHub):

1. On GitHub create a public repository (e.g. `umbrel-apps`) and upload to its root the `umbrel-app-store.yml` file and the
   `davidniin-autolog/` folder that are in [`deploy/umbrel/`](../../deploy/umbrel/).
2. In umbrelOS: **App Store → ⋯ → Community App Stores**, add that repository's URL and install AutoLog.
3. Your password is on the app's page, under **Default password**.
4. For the phone, follow [HTTPS on the phone](#https-on-the-phone-casaos-and-umbrel).

Umbrel's login is turned off for AutoLog (`PROXY_AUTH_ADD: "false"`) because the phone app can't go through it; AutoLog's
own password protects it.

## Coolify

If you already use Coolify, it gives you HTTPS out of the box.

1. **New resource → Docker Compose Empty**, paste
   [`deploy/coolify/docker-compose.yml`](../../deploy/coolify/docker-compose.yml) and **Deploy**.
2. Coolify generates the password (`SERVICE_PASSWORD_64_AUTOLOG`, in the resource's **Environment Variables**) and a
   domain with HTTPS. Put your own domain there if you have one.
3. On the phone open `https://<your-domain>/?token=<password>` and install it.

## HTTPS on the phone (CasaOS and Umbrel)

To install the app on the phone, and for notifications and the scanner, the address must start with `https://`. On your
home network you only have `http://`. The simplest option is **Tailscale** (free for personal use): install its app on the
server and on the phone, and it gives you a private `https://` address. The exact steps are in
[your own server → step 3](self-hosting.md#3-https-and-access-from-your-phone). Then open `https://<your-address>/?token=<password>`
once on the phone.

## What these templates do for your security

- **No default passwords:** every install creates its own.
- **The database is never published:** only AutoLog can reach it.
- **Hardened container:** unprivileged user, read-only filesystem except `/data`, no Linux capabilities.
- **Pinned version:** nothing changes by itself.

## Updating

The templates use a specific AutoLog version (a number, e.g. `0.5`) so nothing changes by surprise. When a new version is
out you'll see it in [Releases](https://github.com/davidniin/autolog/releases). To move to it:

1. Copy the new version number.
2. Change it in the template (the `image: ghcr.io/davidniin/autolog:…` line) or in your platform's settings.
3. Deploy again.

Your data isn't touched and database changes are applied automatically. If you don't update, your AutoLog keeps working.
