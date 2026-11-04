# AutoLog — el historial de tu vehículo

[English](README.md) · **Español**

[![Demo en vivo](https://img.shields.io/badge/demo%20en%20vivo-pru%C3%A9bala-2f5fd0)](https://davidniin.github.io/autolog/)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-blue)](LICENSE)
[![Invítame a un café](https://img.shields.io/badge/inv%C3%ADtame%20a%20un%20caf%C3%A9-☕-ffdd00)](https://buymeacoffee.com/davidniin)

Apunta los repostajes, gastos y avisos de tu coche o tu moto, y mira cuánto consume y cuánto te cuesta de verdad.
AutoLog es una web que se instala en el móvil (PWA) y que **alojas tú**: tus datos están en tu servidor, no en el de
otro.

<p align="center">
  <img src="docs/screenshots/light-summary.png" width="220" alt="Resumen: ficha del vehículo y avisos">
  <img src="docs/screenshots/light-scan.png" width="220" alt="Escanear una factura del taller rellena el formulario">
  <img src="docs/screenshots/light-costs.png" width="220" alt="Costes al mes y por km, gráfico de 12 meses">
  <img src="docs/screenshots/dark-summary.png" width="220" alt="Modo oscuro">
</p>

## Qué hace

- **Repostajes y recargas** con el consumo real (lleno a lleno): gasolina, diésel, GLP, **eléctricos e híbridos
  enchufables** (kWh).
- **Gastos** por categoría (revisión, reparación, ITV, seguro, impuestos, aparcamiento, peajes…) con fotos y PDF.
- **Avisos** por fecha y/o km (aceite, ITV, seguro…), con **notificaciones push** y **calendario** para Google, Apple
  u Outlook.
- **Neumáticos y piezas**: desgaste por km y por tiempo, e historial de lo que duró cada juego.
- **Informe del historial (PDF)** para enseñar a quien compra el mantenimiento, los km y las piezas.
- **Varias personas**: mismos datos, cada una con su clave; se ve quién apuntó cada cosa.
- **Costes**: al mes, por km, con el precio de compra, gráfico de 12 meses y reparto por categoría.
- **Escanear facturas y tickets** (foto o PDF, en español o en inglés): se rellenan importe, fecha, km, litros y
  concepto. El OCR funciona
  **en el propio móvil** ([runonweb](https://runonweb.ai/models/ocr), PP-OCRv6): la foto no sale del dispositivo.
- **Sin cobertura**: los cambios se guardan en el móvil y se envían cuando vuelve la red.
- **Validación** de cada campo (km imposibles, €/L poco creíble, fechas futuras…).
- **Tus unidades**: km o millas, litros o galones, L/100 km, km/L o mpg, y cualquier moneda.
- **Tus datos, contigo**: copia con fotos (ZIP) y restauración, exportar/importar CSV (Excel, Google Sheets).
- **Varios móviles**: si dos móviles editan lo mismo, eliges con qué versión quedarte; no se pierde nada sin avisar.
- **Accesible**: revisada con axe-core (WCAG 2.1 AA), se usa bien con teclado y lector de pantalla.
- **Español e inglés** (según el idioma del móvil; se cambia en ⚙ Ajustes), modo claro y oscuro, instalable en
  Android y iPhone, varios vehículos.

## Pruébala

**[Demo en vivo](https://davidniin.github.io/autolog/)**: la app de verdad con datos inventados, en tu navegador. No se
guarda nada ni se envía nada.

En local: arráncala (ver [Desarrollo](#desarrollo)) y abre `http://localhost:5173/?demo=1`.

## Instala la tuya

AutoLog es **autoalojada**: cada persona monta su propia copia. No hay un servicio central y nadie más ve tus datos.

| Dónde | Guía |
|---|---|
| Tu servidor / NAS / Raspberry Pi / VPS (Docker) | [docs/es/self-hosting.md](docs/es/self-hosting.md) |
| Cualquier nube (contenedor + PostgreSQL) | [docs/es/cloud.md](docs/es/cloud.md) |
| **En un clic:** CasaOS, Umbrel, Coolify, Render | [docs/es/one-click.md](docs/es/one-click.md) |

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/davidniin/autolog)

Inicio rápido con Docker:

```sh
git clone https://github.com/davidniin/autolog.git && cd autolog
cp .env.example .env          # pon AUTOLOG_TOKEN (openssl rand -hex 24) y POSTGRES_PASSWORD
docker compose up -d --build  # la app en 127.0.0.1:8791 + su propio PostgreSQL
```

Después ponle HTTPS delante (Tailscale, Caddy, Cloudflare Tunnel…): hace falta para instalarla en el móvil.

## Privacidad y seguridad

- Tus datos se quedan en **tu** PostgreSQL y en **tu** disco. La app no tiene analítica ni rastreo.
- Las únicas peticiones fuera de tu servidor son la descarga, una sola vez, del modelo del OCR (Hugging Face) y de su
  motor (jsdelivr), y las notificaciones push (a través de los servicios de Google, Apple o Mozilla, como cualquier web).
- Para entrar hace falta una clave (`AUTOLOG_TOKEN`, mínimo 16 caracteres); sin ella el servidor no arranca. Los
  intentos fallidos repetidos se bloquean, y se envían cabeceras de seguridad (CSP…).
- ¿Has encontrado una vulnerabilidad? Avisa en privado: ver [SECURITY.md](SECURITY.md).

## Cómo funciona

Consumo, avisos, costes, push, adjuntos, escáner, validación, API y copias de seguridad:
[docs/es/how-it-works.md](docs/es/how-it-works.md).

```
Móvil (PWA) ──HTTPS──▶ autolog (Node + Hono, puerto 8791) ──▶ PostgreSQL
                         └── /data/files (adjuntos)
```

- `web/` — PWA con Vue 3 + Vite. `server/` — Node 22+ y Hono: la API `/v1` y la web compilada, en un solo contenedor.

## Desarrollo

```sh
cd server && npm install && npm run dev   # :8791 — necesita PostgreSQL (DATABASE_URL en server/.env)
cd web && npm install && npm run dev      # :5173, reenvía /v1 a :8791
npm test                                  # en web/ y en server/
cd web && npm run build:site              # landing page + demo en vivo → site/dist/
```

En desarrollo puedes poner `ALLOW_NO_AUTH=1` en `server/.env`.

## Contribuir

Las ideas, los avisos de fallos y los pull requests son bienvenidos, en español o en inglés. Lee
[CONTRIBUTING.md](CONTRIBUTING.md) y el [Código de conducta](CODE_OF_CONDUCT.md).

## Hoja de ruta

1. Más idiomas, y reglas del escáner para más países: se busca ayuda.
2. Avisos por email.
3. Integración con Home Assistant.
4. Historial en PDF para enseñarlo al vender el vehículo.
5. Imagen Docker ya construida en cada versión (`ghcr.io`).

## Apoya el proyecto

AutoLog es gratis y lo seguirá siendo. Si te resulta útil, puedes **[invitarme a un café ☕](https://buymeacoffee.com/davidniin)**.
¡Gracias!

## Licencia

[MIT](LICENSE)
