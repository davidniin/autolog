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

## Unidades y moneda

Se eligen en **⚙ Ajustes → Unidades y moneda** (o en el asistente de la primera vez) y valen para todos los móviles
de la instalación (se guardan en el servidor, `PUT /v1/settings`): km o millas; litros, galones de EE. UU. o del
Reino Unido; L/100 km, km/L, mpg (EE. UU.) o mpg (R. Unido); y cualquier moneda ISO 4217. Mientras nadie elija, cada
móvil propone las habituales de su país (p. ej. `en-US` → millas, galones, mpg, USD).

Los datos se guardan **siempre en km, litros y L/100 km**; las unidades solo cambian cómo se ven y se escriben, así que
se pueden cambiar en cualquier momento. La moneda no se convierte: es la de los importes que apuntas. La comprobación
de «€/L poco creíble» solo se hace en monedas con precios parecidos al euro (EUR, USD, GBP, CHF, CAD, AUD). Código:
`web/src/units.js`.

## Tus datos: copia, exportar e importar

En **⚙ Ajustes → Tus datos**:

- **Copia con fotos (ZIP):** todo: datos, ajustes, fotos y PDF. Se descarga directamente del servidor
  (`GET /v1/backup`, en streaming). Se restaura desde el mismo menú o desde el asistente de la primera vez («Tengo una
  copia»): el servidor la **fusiona** (`POST /v1/restore`): añade lo que falta y nunca cambia ni borra lo que ya tienes,
  así que restaurar dos veces no pasa nada. Tamaño máximo `RESTORE_MAX_MB` (2048 por defecto). Código:
  `server/src/backup.js`.
- **Copia sin fotos (JSON):** los mismos datos sin adjuntos; funciona sin conexión.
- **CSV de repostajes / gastos** para Excel o Google Sheets, siempre en km, litros y la moneda de la instalación:
  - repostajes: `vehicle, date, km, liters, total, full_tank, station, note`
  - gastos: `vehicle, date, km, category, title, amount, note`
- **Importar** una copia o uno de esos CSV (coma o punto y coma, `AAAA-MM-DD` o `DD/MM/AAAA`, coma o punto decimal).
  Antes de cambiar nada se enseña un resumen. Lo que ya existe se salta, así que importar dos veces el mismo fichero
  no duplica nada. Un CSV sin columna `vehicle` se importa en el vehículo actual. Código: `web/src/dataio.js`.

## Varios móviles a la vez

Cada registro tiene una revisión (`rev`). Al guardar una edición, el móvil envía la revisión que tenía (`base_rev`); si
otro móvil lo cambió o lo borró mientras tanto, el servidor no lo pisa y responde `409` con la versión actual. El móvil
aparta el choque y avisa: **⚠ 1 cambio choca con otro móvil · Revisar**, con los datos que difieren lado a lado, para
quedarte con una versión o con la otra (o volver a crearlo / dejarlo borrado). Editar dos veces sin conexión se
encadena y no es un conflicto. Borrar siempre gana. Código: `server/src/db.js` (`upsert`), `web/src/store.js` (`run`,
`resolveConflict`) y `web/src/Conflicts.vue`.

## La primera vez

Si aún no hay vehículos, un asistente corto pide el idioma, las unidades y la moneda (se salta si otro móvil ya las
eligió) y abre la ficha del primer vehículo. También permite restaurar una copia o abrir la demo. La pantalla de la
clave explica dónde se encuentra `AUTOLOG_TOKEN`.

## Coches eléctricos e híbridos enchufables

Pon como combustible del vehículo **Eléctrico** o **Híbrido enchufable**. Cada repostaje lleva entonces una energía:
combustible (litros) o electricidad (kWh); en un eléctrico siempre es kWh, y en un híbrido enchufable se elige en cada
uno. El consumo se calcula por separado, lleno a lleno («Cargado al 100 %»): L/100 km para el combustible y kWh/100 km
(mi/kWh con millas) para la electricidad. El formulario, las listas, los costes y el escáner (kWh en los tickets de
recarga) se adaptan. Se guarda en la misma tabla con `energy = kwh`.

## Informe del historial (PDF para vender)

**Resumen → Historial para vender** abre un informe pensado para enseñarlo a quien compra: datos del vehículo,
recorrido registrado, consumo medio, el **mantenimiento, las reparaciones y las ITV** con fecha, km y factura, los
**neumáticos y piezas** (lo que se montó y lo que duraron los anteriores), el **kilometraje registrado por año**
(cuentakilómetros coherente) y los próximos avisos. Se elige si se enseñan los importes, todos los gastos y las notas
(pueden ser personales). Se imprime con el navegador: *Imprimir → Guardar como PDF* (en iPhone: *Compartir →
Imprimir* y se comparte el PDF). Código: `web/src/Report.vue`.

## Calendario de avisos

**⚙ Ajustes → Calendario de avisos** da una URL para suscribirse desde Google Calendar, Apple o Outlook; se actualiza
sola (`GET /v1/calendar.ics`). Los avisos con fecha son eventos de día completo con una alerta una semana antes; los
que van solo por km llevan una **fecha estimada** por los km que haces al día en los últimos meses (marcada con «~»).
Los calendarios no pueden enviar la clave, así que la URL lleva **su propia clave: solo de lectura y solo para esto**.
El propietario puede cambiarla, y la URL anterior deja de funcionar. **Google Calendar descarga el calendario desde
los servidores de Google**: solo funciona si AutoLog es accesible desde internet; con una instalación privada
(Tailscale) usa Apple Calendar u Outlook en el móvil. Código: `server/src/calendar.js`.

## Neumáticos y piezas

**Resumen → Neumáticos y piezas**: neumáticos, batería, pastillas y discos, correa de distribución, escobillas… con la
fecha y los km de montaje y su vida esperada (km y/o meses; plantillas con valores típicos). El desgaste es lo que más
se acerque: los km o el tiempo (⚠ desde el 85 %, ⛔ desde el 100 %). **Cambiada** guarda cuándo y con cuántos km se
quitó, la pasa al historial («duró 38.100 km») y ofrece montar la nueva con la misma posición y vida.

## Personas con acceso

El `AUTOLOG_TOKEN` de la instalación es la clave del **propietario**. En **⚙ Ajustes → Personas con acceso** el
propietario añade personas por su nombre; cada una tiene **su propia clave**, que se enseña una sola vez como enlace de
invitación (`/?token=…`). Todos comparten los mismos datos; quitar el acceso a alguien lo desconecta al momento sin
cambiar la clave de nadie más. Solo se guarda el **hash SHA-256** de cada clave. Cada registro dice quién lo editó por
última vez («Última edición: Ana · 3 nov»), y eso lo pone el servidor, no el móvil. Solo el propietario puede gestionar
personas, restaurar una copia o cambiar el enlace del calendario. **Salir de este móvil** borra la clave y los datos
guardados en ese móvil. Código: `server/src/users.js`.

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

En un gasto o repostaje nuevo, **📷 Escanear la factura** lee una **foto o un PDF** y rellena el formulario.

- **PDF con texto** (la mayoría de facturas digitales): el texto se lee directamente con
  [pdf.js](https://mozilla.github.io/pdf.js/): exacto, al momento y sin descargar el modelo del OCR. **PDF escaneado**:
  se dibuja la primera página y se lee con el OCR. Código: `web/src/pdf.js` (se carga solo al usarlo;
  `isEvalSupported: false`).
- Lee documentos **en español y en inglés**: `1.234,56 €` y `$1,234.56`; `dd/mm/aaaa`, y `mm/dd/aaaa` en documentos de
  EE. UU.; «5 de marzo de 2024» y «Mar 5, 2024»; km o millas y litros o galones (se pasan a km y litros).

- **Gasto:** importe total, fecha, km, categoría, concepto, taller y nº de factura.
- **Repostaje:** litros, importe, fecha y gasolinera; si faltan los litros, los calcula con el €/L.
- Los campos rellenados llevan la marca **✨ leído** hasta que se tocan. Lo que ya se haya escrito no se pisa. La foto
  se guarda como adjunto.
- Avisa si la matrícula de la factura no es la del vehículo, y si en un gasto se escanea un ticket de gasolinera
  ofrece apuntarlo como repostaje.
- **OCR en el móvil** con [runonweb](https://runonweb.ai/models/ocr) (PP-OCRv6 de PaddleOCR, WebGPU o WASM). La foto
  no se envía a ningún sitio. La primera vez descarga el modelo de Hugging Face (~31 MB) y el motor onnxruntime de
  jsdelivr; los dos se guardan en el móvil y después funciona sin conexión.
- **Código:** `web/src/ocr.js` (se carga solo al usarlo), `web/src/receipt.js` (saca los datos del texto) y
  `web/src/ReceiptScan.vue`. Tests con facturas de ejemplo: `web/test/receipt.test.js`: para otro país o formato, añade
  sus palabras a las reglas y una factura de ejemplo a los tests.
- **Versión fijada:** `pdfjs-dist` 6.4.299.
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
  `<img>` o en otra pestaña) y la descarga de la copia usan la cookie `autolog_token`, limitada a `/v1/files` y
  `/v1/backup`. La clave nunca se acepta en la URL,
  salvo el enlace `/?token=` de la primera vez, que la web guarda y quita de la barra de direcciones.
- 10 intentos fallidos desde una IP en 15 minutos → `429` durante 15 minutos. Detrás de un proxy pon en `TRUST_PROXY`
  cuántos proxies hay delante (normalmente `1`), y solo entonces: la IP del cliente es la que añade tu proxy más
  externo, así que una cabecera `X-Forwarded-For` falsa no sirve para saltarse el bloqueo.
- La imagen Docker corre con un usuario sin privilegios y funciona con el disco de solo lectura (`/data` es lo único
  escribible); los compose y las plantillas quitan todas las capacidades de Linux y ponen `no-new-privileges`. Las
  claves se pueden dar como ficheros (`AUTOLOG_TOKEN_FILE`, `DATABASE_PASSWORD_FILE`) para que no salgan en
  `docker inspect`.
- Cabeceras de seguridad en todas las respuestas y Content-Security-Policy en la web (ver `server/src/security.js`).
- Solo mismo origen: sin CORS salvo que se defina `CORS_ORIGIN`. Los errores internos van al log, no al cliente.
- Al restaurar una copia solo se aceptan adjuntos de los mismos tipos que al subirlos (imágenes y PDF) y se ignora
  cualquier otra ruta del ZIP: una copia manipulada no puede colar ficheros ni páginas en tu servidor.

## Accesibilidad

Revisada con [axe-core](https://github.com/dequelabs/axe-core) en todas las pantallas, en claro y oscuro (WCAG 2.1 AA:
sin incidencias): contraste de color ≥ 4,5:1, regiones y orden de títulos, controles etiquetados (`aria-pressed`,
`aria-current`, `aria-invalid` + texto del error). Las fichas son diálogos: el foco entra al abrirlas y vuelve al
cerrarlas, `Esc` las cierra y `Tab` no se sale de ellas (`web/src/dialog.js`). Las animaciones se reducen si el sistema
lo pide. Avisa si algo es difícil de usar con lector de pantalla o teclado.

## Modo demo y landing page

`/?demo=1` carga datos inventados en la pestaña actual (`sessionStorage`), sin peticiones al servidor y sin tocar los
datos de verdad guardados en el móvil. Sirve para probar la app y para hacer capturas. *Salir* la borra.

La **landing page** (`site/`) incluye una **demo en vivo**: un build «solo demo» de la app (`vite build --mode demo`)
que siempre está en modo demo, no tiene service worker y no se puede instalar. Se construyen las dos en `site/dist/`
con `cd web && npm run build:site`; `.github/workflows/pages.yml` las publica en GitHub Pages (`/` la landing, `/demo/`
la app). La URL del repositorio de todos los enlaces de la landing es la constante `REPO` de `site/landing.js`. La demo
acepta `?lang=es|en`.

## API

| Método | Ruta | |
|---|---|---|
| GET | `/v1/health` | Estado (sin clave) |
| GET | `/v1/data` | `{ vehicles, fuel, expenses, reminders, parts, files, settings }`, todo de una vez |
| PUT | `/v1/settings` | Unidades y moneda: `{ distance: km\|mi, volume: l\|gal_us\|gal_uk, consumption: l100\|kml\|mpg_us\|mpg_uk, currency: "EUR" }` |
| PUT | `/v1/{vehicles,fuel,expenses,reminders,parts}/:id` | Crea o actualiza (idempotente: el id lo pone el cliente). Con `base_rev`, `409` si otro móvil lo cambió |
| DELETE | `/v1/{vehicles,fuel,expenses,reminders,parts}/:id` | Borra. Borrar un vehículo borra todo lo suyo |
| POST | `/v1/files` | Sube un adjunto (multipart: `file`, `id`, `vehicle_id`, `parent_kind` = vehicles · expenses · fuel, `parent_id`) |
| GET / DELETE | `/v1/files/:id` | Abre o borra un adjunto |
| GET | `/v1/backup` | Copia con fotos (ZIP: `autolog.json` + `files/<id>`) |
| POST | `/v1/restore` | Restaura ese ZIP (el cuerpo es el ZIP), fusionándolo. `?settings=1` aplica también sus unidades y moneda |
| GET | `/v1/me` | Quién soy: `{ id, name, admin }` (`name` vacío = el propietario) |
| GET · POST | `/v1/users` | Personas con acceso (solo el propietario). POST `{ name }` → `{ user, token }`, la clave solo sale aquí |
| DELETE | `/v1/users/:id` | Quita el acceso a una persona (solo el propietario) |
| GET | `/v1/calendar` | La clave del calendario · POST `/v1/calendar/reset` la cambia (solo el propietario) |
| GET | `/v1/calendar.ics?key=…&lang=es\|en` | Avisos como calendario iCalendar (clave propia de solo lectura, sin la clave de la app) |
| GET | `/v1/alerts` | Avisos pendientes (*pronto* / *vencido*) de todos los vehículos, p. ej. para un panel en casa |
| GET | `/v1/push/key` | Clave pública VAPID |
| POST | `/v1/push/subscribe` · `/unsubscribe` · `/test` · `/check` | Suscripciones y envío |

## Variables de configuración

| Variable | Por defecto | |
|---|---|---|
| `AUTOLOG_TOKEN` | — | Clave de la app, obligatoria (16 caracteres o más) |
| `DATABASE_URL` | `postgres://autolog:autolog@localhost:5432/autolog` | Conexión a PostgreSQL |
| `PORT` | `8791` | Puerto dentro del contenedor |
| `TRUST_PROXY` | `0` | Cuántos proxies inversos hay delante: `1` lo normal, `2` p. ej. Cloudflare delante de Caddy. La IP del cliente se toma de `X-Forwarded-For` contando desde la derecha, así una cabecera falsa no sirve para saltarse el bloqueo de intentos |
| `AUTOLOG_TOKEN_FILE` | — | Leer la clave del propietario de un fichero (Docker secrets); si están las dos, gana la variable |
| `DATABASE_PASSWORD_FILE` | — | Contraseña de la base de datos desde un fichero; se añade a `DATABASE_URL` |
| `CORS_ORIGIN` | vacío | Solo si la web se sirve desde otro origen |
| `PUSH_CONTACT` | `mailto:autolog@example.com` | Contacto para los servicios de push: usa una dirección real |
| `PUSH_HOUR` | `9` | Hora de la revisión diaria de avisos |
| `TZ` | `Europe/Madrid` | Zona horaria del servidor |
| `STATIC_DIR` | vacío (`web` en Docker) | Web compilada que se sirve |
| `FILES_DIR` | `./data/files` (`/data/files` en Docker) | Carpeta de los adjuntos |
| `RESTORE_MAX_MB` | `2048` | Tamaño máximo de una copia (ZIP) al restaurarla |
| `ALLOW_NO_AUTH` | `0` | `1` = arrancar sin clave. Solo en una red privada sin acceso desde internet |
| `BIND_ADDR` / `HOST_PORT` | `127.0.0.1` / `8791` | Solo Docker Compose: dónde se publica el puerto en la máquina |
