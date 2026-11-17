# AutoLog on your phone only (no server)

**English** · [Español](../es/phone-only.md)

> **Who it's for:** anyone. It's the easiest way: no account, no sign-up and no server to set up.
> **Level:** 🟢 none. **Time:** 1 minute. **What you need:** a phone with Chrome (Android) or Safari (iPhone).
> **Limit:** your data is only on that phone (see [what it can't do](#what-it-does-and-doesnt-do)). For several phones or
> your family, see [one-click](one-click.md) or [your own server](self-hosting.md).

## Start in 3 steps

1. **Open [davidniin.github.io/autolog/app](https://davidniin.github.io/autolog/app/) on your phone.**
2. **Add it to your home screen:**
   - **Android (Chrome):** menu **⋮ → Install app** (or *Add to Home screen*).
   - **iPhone (Safari):** **Share ⬆︎ → Add to Home Screen**.
3. **Open it from the new icon**, create your vehicle and log your first fill-up. It works offline.

Your data is saved in the phone's own storage and never sent anywhere.

## What it does and doesn't do

| | Phone only | Own server |
|---|---|---|
| Fill-ups, expenses, reminders, tyres and parts, costs | ✅ | ✅ |
| Invoice scanner (reads the photo on the phone) | ✅ | ✅ |
| History report (PDF) and CSV/JSON export | ✅ | ✅ |
| Works offline | ✅ | ✅ |
| Several phones sharing the same data | ❌ | ✅ |
| Several people with their own password | ❌ | ✅ |
| Push reminders and the calendar feed | ❌ | ✅ |
| Photos and PDFs attached to expenses | ❌ (the scanner still reads them) | ✅ |

**Why not?** Sharing between phones or people and push reminders need a server to deliver them, so they are not possible
on the phone alone. Attached photos could be stored on the phone itself: it is on the roadmap.

## Keep your data safe

Everything lives **only on that phone**. If you clear the browser's site data, uninstall the app or change phone
without a backup, it is gone. So:

1. In **⚙ Settings → Your data**, tap **Backup without photos (JSON)** now and then. AutoLog reminds you after a month without one.
2. Keep the file somewhere safe (your cloud drive, your email…).
3. On a new phone: open AutoLog, choose **I have a backup** and pick the file.

On iPhone, use the app from the **Home Screen icon** (not from a Safari tab): Safari may clear the storage of sites you
don't open for a few weeks, but not of apps added to the Home Screen.

## Moving to your own server later

Export a backup in ⚙ Settings, set up your server ([one click](one-click.md) or [self-hosting](self-hosting.md)), open it and
import the same file (*I have a backup*). Photos were never stored, so nothing is lost.

## For developers

The phone-only app is the same code as the server app, built with `npm run build:app` (`--mode phone`): no sync, no
sign-in, no attachments. It is published at `/app/` by `.github/workflows/pages.yml`. Data is stored in `localStorage`
(`autolog.*` keys) of the site's origin; if you host it under a domain shared with other sites, any of them can read it,
so prefer a dedicated domain.
