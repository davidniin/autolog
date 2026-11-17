# Instalación en un clic

[English](../en/one-click.md) · **Español**

> **¿Solo quieres usar AutoLog tú, en un móvil?** No necesitas nada de esto: abre [la app sin servidor](phone-only.md).
> Estas plantillas son para usarla desde **varios móviles**, compartirla con tu familia, o tener fotos adjuntas y avisos push.

## ¿Cuál me conviene?

- **No tengo servidor ni quiero uno en casa → [Render](#render).** Un botón y unos minutos; es la más sencilla, pero de pago.
- **Ya tengo un servidor en casa con CasaOS o Umbrel → [CasaOS](#casaos) / [Umbrel](#umbrel).** Gratis; instalas desde su
  tienda de apps.
- **Ya uso Coolify (o tengo un VPS) → [Coolify](#coolify).** Te da el HTTPS ya hecho.

Plantillas listas para no tener que escribir tú un `.env` ni un `docker-compose.yml`. Todas siguen las mismas reglas de
seguridad:

- **Ninguna contraseña por defecto.** Cada instalación genera su propia clave de propietario y la de la base de datos.
- **La base de datos nunca se publica:** solo llega a ella el contenedor de AutoLog.
- **Contenedor endurecido:** usuario sin privilegios, disco de solo lectura salvo `/data`, sin capacidades de Linux,
  `no-new-privileges`.
- **Versión de imagen fijada** (`ghcr.io/davidniin/autolog:0.5`), nunca `latest`. Para actualizar, cambia la etiqueta.
- `TRUST_PROXY` solo donde de verdad hay un proxy delante.

| Plataforma | Dónde | Plantilla |
|---|---|---|
| [CasaOS](#casaos) | Servidor en casa / NAS | [`deploy/casaos/docker-compose.yml`](../../deploy/casaos/docker-compose.yml) |
| [Umbrel](#umbrel) | Servidor en casa | [`deploy/umbrel/`](../../deploy/umbrel/) |
| [Coolify](#coolify) | Tu servidor o un VPS, con HTTPS | [`deploy/coolify/docker-compose.yml`](../../deploy/coolify/docker-compose.yml) |
| [Render](#render) | Nube | [`render.yaml`](../../render.yaml) — botón abajo |

Para la app del móvil (instalarla, notificaciones, escáner) hace falta **HTTPS**. Coolify y Render te lo dan; en CasaOS y
Umbrel usa Tailscale (los dos lo tienen en su tienda) o un proxy inverso: ver [self-hosting.md](self-hosting.md).

## CasaOS

1. **App Store → ⋯ (arriba a la derecha) → Install a customized app → Import**, pega
   [`deploy/casaos/docker-compose.yml`](../../deploy/casaos/docker-compose.yml) e instala.
2. La primera vez, un pequeño contenedor `secrets` crea una clave de propietario y otra de la base de datos aleatorias
   en `/DATA/AppData/autolog/secrets/` (solo root puede listar esa carpeta). **Tu clave** sale una sola vez en los logs
   del contenedor `secrets`, y queda en `/DATA/AppData/autolog/secrets/app/token`.
3. En el ordenador está en `http://<ip-de-casaos>:8791`. En el móvil, abre una vez `https://<tu-dirección>/?token=<clave>`
   por HTTPS (Tailscale o un proxy inverso, ver arriba).

Haz copia de `/DATA/AppData/autolog/` (datos, base de datos y secretos), o usa **⚙ Ajustes → Tus datos → Copia con
fotos**.

## Umbrel

Umbrel instala apps de la comunidad desde un **repositorio de tienda**. Mientras AutoLog no esté en la tienda oficial:

1. Crea un repositorio (p. ej. `umbrel-apps`) con el contenido de [`deploy/umbrel/`](../../deploy/umbrel/):
   `umbrel-app-store.yml` en la raíz y la carpeta `davidniin-autolog/` a su lado.
2. En umbrelOS: **App Store → ⋯ → Community App Stores**, añade la URL de ese repositorio e instala AutoLog.
3. La clave de propietario sale en la página de la app en el panel de Umbrel (**Default password**). La de la base de
   datos la deriva Umbrel y no se enseña nunca.

El login de Umbrel está desactivado para AutoLog (`PROXY_AUTH_ADD: "false"`) porque la app del móvil no puede pasar por
él; lo protege la clave de AutoLog.

## Coolify

1. **New resource → Docker Compose Empty**, pega
   [`deploy/coolify/docker-compose.yml`](../../deploy/coolify/docker-compose.yml) y **Deploy**.
2. Coolify genera la clave de propietario (`SERVICE_PASSWORD_64_AUTOLOG`, en las **Environment Variables** del
   recurso), el usuario y la contraseña de la base de datos, y un dominio con **HTTPS** (`SERVICE_FQDN_AUTOLOG_8791`).
   Pon ahí tu dominio si tienes uno.
3. Abre una vez en el móvil `https://<tu-dominio>/?token=<clave>`.

## Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/davidniin/autolog)

La forma más sencilla si no tienes servidor: no escribes ningún comando. **Cuánto tarda:** unos 10 minutos la primera vez.
**Cuánto cuesta:** Render cobra por el disco y la base de datos (ver [Costes](#costes-de-render)).

### Paso a paso

1. **Pulsa el botón de arriba.** Se abre Render. Si no tienes cuenta, créala (puedes entrar con tu cuenta de GitHub o de Google).
2. **Confirma el despliegue.** Render te enseña lo que va a crear: la app AutoLog y una base de datos. Pon un nombre si te lo
   pide (el que quieras) y pulsa el botón de crear o desplegar (*Deploy Blueprint*). Si te pide una tarjeta, es porque estos
   servicios son de pago.
3. **Espera.** La primera vez tarda varios minutos en construirse. Cuando termine, la app aparece como *Live* (en marcha).
4. **Mira tu clave.** Entra en la app (AutoLog) en el panel de Render → pestaña **Environment** → busca `AUTOLOG_TOKEN` y
   pulsa para ver su valor. **Es tu contraseña:** cópiala y guárdala en un gestor de contraseñas o en un sitio seguro.
5. **Mira tu dirección.** Arriba, en la página de la app, Render muestra su dirección: algo como `https://autolog-xxxx.onrender.com`.
6. **Ábrela en el móvil con tu clave.** En el navegador del móvil escribe la dirección seguida de `/?token=` y tu clave:

   ```
   https://autolog-xxxx.onrender.com/?token=TU-CLAVE
   ```

   La primera vez AutoLog te guía para crear tu primer vehículo. La clave se guarda en el móvil y desaparece de la barra de
   direcciones.
7. **Instálala en el móvil.** Android (Chrome): menú ⋮ → *Instalar aplicación*. iPhone (Safari): *Compartir ⬆︎ → Añadir a
   pantalla de inicio*.

Para usarla en otro móvil, o para tu familia, repite el paso 6 en ese móvil con la misma dirección y clave (o crea una
persona nueva en **⚙ Ajustes → Personas con acceso**, con su propia clave).

> Los nombres de los botones de Render pueden cambiar con el tiempo; la idea es siempre la misma: crear, esperar a *Live*,
> copiar la clave y la dirección.

### ¿Algo no va?

| Si ves… | Haz esto |
|---|---|
| El móvil pide la clave una y otra vez | La clave no coincide: cópiala otra vez de **Environment** y abre de nuevo `/?token=…` |
| La página tarda mucho en abrirse la primera vez tras un rato sin uso | Es normal en algunos planes de Render (la app «se duerme»); espera unos segundos |
| No aparece *Instalar* | La página tiene que abrirse con `https://` |
| Quiero guardar mis datos | **⚙ Ajustes → Tus datos → Copia con fotos (ZIP)** |

### Costes de Render

El disco para los adjuntos necesita una instancia de pago (`starter`) y la base de datos un plan de pago. Mira los precios
actuales de Render antes de desplegar. Render se encarga del HTTPS y, en los planes de pago, de las copias de la base de
datos. El blueprint ([`render.yaml`](../../render.yaml)) crea la app con un disco de 1 GB y una base de datos PostgreSQL
que no acepta conexiones desde internet (`ipAllowList: []`). Si solo quieres probarla gratis, usa
[la app sin servidor](phone-only.md).

## Actualizar

Las plantillas fijan una versión menor (`:0.5`), que recibe arreglos. Para una versión nueva, cambia la etiqueta en la
plantilla (o en los ajustes de la plataforma) por la de las [notas de versión](https://github.com/davidniin/autolog/releases)
y vuelve a desplegar. Los cambios de la base de datos se aplican solos al arrancar.
