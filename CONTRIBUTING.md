# Contributing to AutoLog

**English** · [Español](#contribuir-a-autolog)

Thanks for wanting to help! Bug reports, ideas, translations, docs and code are all welcome, in English or Spanish.

## Before you start

- **Bugs and ideas:** open an [issue](../../issues/new/choose) with the template. Check first that it isn't already
  reported.
- **Bigger changes** (new features, new dependencies, changes to the data model or the API): open an issue to discuss
  it before writing the code, so your work isn't wasted.
- **Security problems:** never in a public issue. See [SECURITY.md](SECURITY.md).
- Good places to start: issues labelled `good first issue` and `help wanted`, the **English translation** of the
  interface, and **receipt-scanner rules** for your country (`web/src/receipt.js`).

## Set up

You need Node 22+ and a PostgreSQL (for example `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:17-alpine`).

```sh
# server: create server/.env with
#   DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres
#   ALLOW_NO_AUTH=1
cd server && npm install && npm run dev     # http://localhost:8791
cd web && npm install && npm run dev        # http://localhost:5173 (proxies /v1 to :8791)
```

Without a server, `http://localhost:5173/?demo=1` opens the app with made-up data.

## Making a change

1. Fork the repo and create a branch: `git checkout -b fix/short-description`.
2. Keep the change focused: one pull request, one topic.
3. Add or update tests: `web/test/` (Vitest) and `server/test/` (`node:test`).
4. Check that everything passes:
   ```sh
   cd web && npm test && npm run build
   cd server && npm test
   ```
5. Update the docs if behaviour changes (`docs/en` **and** `docs/es`; if you only write one language, say so in the PR
   and someone will translate it).
6. Open the pull request and fill in the template.

## Style

- Plain JavaScript (ES modules), Vue 3 `<script setup>`, no TypeScript build step.
- Keep it small: add a dependency only if it saves a lot of code, and pin its exact version.
- Many code comments are in Spanish; new comments can be in English or Spanish.
- User-facing texts are in Spanish for now (i18n is on the roadmap).
- **Never include real personal data** in code, tests, fixtures or screenshots: no real plates, names, invoices or
  addresses. Use the demo mode for screenshots and made-up data in tests.

## Commits

Short, imperative summary (`Add CSV export`, `Fix km check for same-day fill-ups`). Reference the issue if there is one
(`Fixes #12`).

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE) and that you follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

---

# Contribuir a AutoLog

[English](#contributing-to-autolog) · **Español**

¡Gracias por querer ayudar! Avisos de fallos, ideas, traducciones, documentación y código son bienvenidos, en español o
en inglés.

## Antes de empezar

- **Fallos e ideas:** abre un [issue](../../issues/new/choose) con la plantilla. Mira antes si ya está abierto.
- **Cambios grandes** (funciones nuevas, dependencias nuevas, cambios en el modelo de datos o en la API): abre un issue
  para hablarlo antes de programar, así no pierdes trabajo.
- **Problemas de seguridad:** nunca en un issue público. Mira [SECURITY.md](SECURITY.md).
- Buenos sitios para empezar: los issues con `good first issue` y `help wanted`, la **traducción al inglés** de la
  interfaz y las **reglas del escáner** para tu país (`web/src/receipt.js`).

## Preparar el entorno

Necesitas Node 22+ y un PostgreSQL (por ejemplo `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:17-alpine`).

```sh
# servidor: crea server/.env con
#   DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres
#   ALLOW_NO_AUTH=1
cd server && npm install && npm run dev     # http://localhost:8791
cd web && npm install && npm run dev        # http://localhost:5173 (reenvía /v1 a :8791)
```

Sin servidor, `http://localhost:5173/?demo=1` abre la app con datos inventados.

## Hacer un cambio

1. Haz un fork y crea una rama: `git checkout -b fix/descripcion-corta`.
2. Un pull request, un tema.
3. Añade o actualiza tests: `web/test/` (Vitest) y `server/test/` (`node:test`).
4. Comprueba que todo pasa:
   ```sh
   cd web && npm test && npm run build
   cd server && npm test
   ```
5. Actualiza la documentación si cambia el comportamiento (`docs/es` **y** `docs/en`; si solo escribes en un idioma,
   dilo en el PR y alguien lo traducirá).
6. Abre el pull request y rellena la plantilla.

## Estilo

- JavaScript normal (módulos ES), Vue 3 con `<script setup>`, sin compilar TypeScript.
- Pocas dependencias: añade una solo si ahorra mucho código, y fija su versión exacta.
- Muchos comentarios del código están en español; los nuevos pueden ir en español o en inglés.
- Los textos de la interfaz están en español por ahora (i18n está en la hoja de ruta).
- **Nunca pongas datos personales reales** en código, tests, datos de ejemplo o capturas: ni matrículas, ni nombres,
  ni facturas, ni direcciones reales. Usa el modo demo para las capturas y datos inventados en los tests.

## Commits

Resumen corto en imperativo (`Add CSV export`, `Corrige la comprobación de km`). Menciona el issue si lo hay
(`Fixes #12`).

Al contribuir aceptas que tu aportación se publica con la [licencia MIT](LICENSE) y que sigues el
[Código de conducta](CODE_OF_CONDUCT.md).
