# Cómo funciona AutoLog

[English](../en/how-it-works.md) · **Español**

## Arquitectura

```
Móvil (PWA) ──HTTPS──▶ autolog (Node + Hono, puerto 8791) ──▶ PostgreSQL
                         └── /data/files (adjuntos)
```

- **Web** (`web/`): Vue 3 + Vite. Selector de vehículo arriba y cuatro pestañas: **Resumen** (ficha, avisos, consumo,
  gastos), **Repostajes**, **Gastos** (con filtro por categoría) y **Costes**.
- **Primero sin conexión**: cada cambio se ve al momento, se guarda en el móvil (`localStorage`) en una cola y se envía
  en orden cuando hay red. Mientras haya cambios en cola no se recarga del servidor, así no se pisa lo local. Los ids
  los genera el móvil, así que reenviar un cambio no lo duplica.
- **Servidor** (`server/`): Node 22+ y Hono. Sirve la API `/v1` y la web compilada en un solo contenedor. Las tablas
  (`autolog_*`) se crean solas al arrancar.

## Idiomas

La interfaz está en español e inglés. La primera vez sigue el idioma del móvil, y se cambia en **⚙ Ajustes** (se
guarda en cada móvil). Los textos están en `web/src/i18n/` (`es.js`, `en.js`, mismas claves); las fechas y los números
usan el formato del idioma elegido. Las notificaciones push llegan en el idioma que tenía cada móvil al activarlas
(`server/src/messages.js`). Los errores de la API van en inglés con un `code` estable que la app traduce.

## Consumo: método lleno a lleno

En cada repostaje se marca si se ha llenado el depósito. Entre dos llenados, el consumo es la suma de los litros
repostados después del primero, incluidos los parciales, dividida por los km recorridos. El **consumo medio** junta
todos los tramos y el **último tramo** es el más reciente.

## Avisos

Cada aviso vence en una fecha, en unos km o en las dos cosas, y salta con lo primero que llegue. Pasa a ⚠️ *Pronto*
cuando faltan 30 días o 1.000 km, y a ⛔ *Vencido* cuando se pasa. Puede repetirse cada X km y/o cada X meses.

Al pulsar **Hecho** se indican la fecha, los km y, si se quiere, un importe. Con importe se apunta como gasto en la
categoría del aviso. Si el aviso se repite, se programa el siguiente desde esa fecha y esos km; si no, se borra.
Plantillas: aceite, revisión, ITV, seguro, impuesto y neumáticos.

## Costes

- **Al mes:** total de gastos (combustible incluido) entre los meses desde el primer apunte.
- **Por km:** total entre los km recorridos desde el primer km conocido.
- **Con la compra:** si la ficha tiene precio de compra, compra + gastos y coste al mes desde la fecha de compra.
- **Gráfico de los últimos 12 meses:** combustible y otros gastos apilados; al tocar un mes se ve su detalle.
- **Reparto por categoría.**

## Notificaciones push

En **Resumen → Avisos**, *🔔 Avisarme también con notificaciones en este móvil* pide permiso y suscribe el móvil; llega
una notificación de prueba. Se puede activar en varios móviles.

- **Revisión diaria:** el servidor revisa todos los avisos una vez al día a partir de `PUSH_HOUR` (las 9 por defecto,
  hora del servidor, `TZ`).
- **Cuándo:** cuando un aviso pasa a *Pronto* o a *Vencido*, o cambia su vencimiento. Si sigue vencido, una vez por
  semana.
- **Requisitos:** HTTPS. En iPhone (iOS 16.4 o posterior) la app tiene que estar instalada en la pantalla de inicio.
- **Claves VAPID:** se generan la primera vez y se guardan en `autolog_setting`. Si se borran, hay que volver a activar
  las notificaciones en cada móvil.
- **Revisar al momento:** `curl -X POST -H "Authorization: Bearer $AUTOLOG_TOKEN" https://<tu-app>/v1/push/check`
  (no repite lo ya avisado).

## Adjuntos

Fotos y PDF en los **gastos** (facturas), los **repostajes** (tickets) y la **ficha del vehículo** (permiso de
circulación, póliza…). Hasta 15 MB cada uno. Las fotos se reducen a 2000 px en el móvil antes de subirlas (una de 5 MB
queda en unos 300 KB). Subir necesita conexión. Al borrar un gasto, repostaje o vehículo se borran también sus archivos.

## Escanear facturas y tickets

En un gasto o repostaje nuevo, **📷 Escanear la factura** lee la foto y rellena el formulario.

- **Gasto:** importe total, fecha, km, categoría, concepto, taller y nº de factura.
- **Repostaje:** litros, importe, fecha y gasolinera; si faltan los litros, los calcula con el €/L.
- Los campos rellenados llevan la marca **✨ leído** hasta que se tocan. Lo que ya se haya escrito no se pisa. La foto
  se guarda como adjunto.
- Avisa si la matrícula de la factura no es la del vehículo, y si en un gasto se escanea un ticket de gasolinera
  ofrece apuntarlo como repostaje.
- **OCR en el móvil** con [runonweb](https://runonweb.ai/models/ocr) (PP-OCRv6 de PaddleOCR, WebGPU o WASM). La foto
  no se envía a ningún sitio. La primera vez descarga el modelo de Hugging Face (~31 MB) y el motor onnxruntime de
  jsdelivr; los dos se guardan en el móvil y después funciona sin conexión.
- **Código:** `web/src/ocr.js` (se carga solo al usarlo), `web/src/receipt.js` (saca los datos del texto; hoy con
  reglas para España) y `web/src/ReceiptScan.vue`. Tests con facturas de ejemplo: `web/test/receipt.test.js`.
- **Versiones fijadas:** `runonweb` 0.1.0 y `onnxruntime-web` 1.30.0 (en `overrides`): el WASM que se carga del CDN
  tiene que ser de la misma versión que el JS. Al actualizar runonweb, revisa su constante `ORT_WASM` y ajusta el
  override y la CSP.

## Validación de los formularios

Las reglas de cada campo están en `web/src/forms.js` (obligatorio, mínimo y máximo, decimales, fechas no futuras…) y
se aplican con `web/src/validate.js`. El error aparece al salir del campo o al guardar, y el cursor salta al primer
campo con error. En los repostajes se comprueba además que los km cuadren con los repostajes de antes y de después y
que el €/L sea creíble (0,30–5 €/L). El servidor hace su propia comprobación básica (`server/src/db.js`, `clean()`).

## Seguridad

- `AUTOLOG_TOKEN` es obligatoria (16 caracteres o más); sin ella el servidor no arranca, salvo con `ALLOW_NO_AUTH=1`.
- Todas las rutas de la API excepto `/v1/health` piden `Authorization: Bearer <clave>`. Los adjuntos (que se abren con
  `<img>` o en otra pestaña) usan la cookie `autolog_token`, limitada a `/v1/files`. La clave nunca se acepta en la URL,
  salvo el enlace `/?token=` de la primera vez, que la web guarda y quita de la barra de direcciones.
- 10 intentos fallidos desde una IP en 15 minutos → `429` durante 15 minutos. Detrás de un proxy pon `TRUST_PROXY=1`
  (y solo entonces) para usar la IP real del cliente.
- Cabeceras de seguridad en todas las respuestas y Content-Security-Policy en la web (ver `server/src/security.js`).
- Solo mismo origen: sin CORS salvo que se defina `CORS_ORIGIN`. Los errores internos van al log, no al cliente.

## Modo demo

`/?demo=1` carga datos inventados en la pestaña actual (`sessionStorage`), sin peticiones al servidor y sin tocar los
datos de verdad guardados en el móvil. Sirve para probar la app y para hacer capturas. *Salir* la borra.

## API

| Método | Ruta | |
|---|---|---|
| GET | `/v1/health` | Estado (sin clave) |
| GET | `/v1/data` | `{ vehicles, fuel, expenses, reminders, files }`, todo de una vez |
| PUT | `/v1/{vehicles,fuel,expenses,reminders}/:id` | Crea o actualiza (idempotente: el id lo pone el cliente) |
| DELETE | `/v1/{vehicles,fuel,expenses,reminders}/:id` | Borra. Borrar un vehículo borra todo lo suyo |
| POST | `/v1/files` | Sube un adjunto (multipart: `file`, `id`, `vehicle_id`, `parent_kind` = vehicles · expenses · fuel, `parent_id`) |
| GET / DELETE | `/v1/files/:id` | Abre o borra un adjunto |
| GET | `/v1/alerts` | Avisos pendientes (*pronto* / *vencido*) de todos los vehículos, p. ej. para un panel en casa |
| GET | `/v1/push/key` | Clave pública VAPID |
| POST | `/v1/push/subscribe` · `/unsubscribe` · `/test` · `/check` | Suscripciones y envío |

## Variables de configuración

| Variable | Por defecto | |
|---|---|---|
| `AUTOLOG_TOKEN` | — | Clave de la app, obligatoria (16 caracteres o más) |
| `DATABASE_URL` | `postgres://autolog:autolog@localhost:5432/autolog` | Conexión a PostgreSQL |
| `PORT` | `8791` | Puerto dentro del contenedor |
| `TRUST_PROXY` | `0` | `1` detrás de un proxy inverso (IP real del cliente desde `X-Forwarded-For`) |
| `CORS_ORIGIN` | vacío | Solo si la web se sirve desde otro origen |
| `PUSH_CONTACT` | `mailto:autolog@example.com` | Contacto para los servicios de push: usa una dirección real |
| `PUSH_HOUR` | `9` | Hora de la revisión diaria de avisos |
| `TZ` | `Europe/Madrid` | Zona horaria del servidor |
| `STATIC_DIR` | vacío (`web` en Docker) | Web compilada que se sirve |
| `FILES_DIR` | `./data/files` (`/data/files` en Docker) | Carpeta de los adjuntos |
| `ALLOW_NO_AUTH` | `0` | `1` = arrancar sin clave. Solo en una red privada sin acceso desde internet |
| `BIND_ADDR` / `HOST_PORT` | `127.0.0.1` / `8791` | Solo Docker Compose: dónde se publica el puerto en la máquina |
