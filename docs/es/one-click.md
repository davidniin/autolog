# AutoLog en internet, sin comandos (Render, CasaOS, Umbrel, Coolify)

[English](../en/one-click.md) · **Español**

> **Para quién:** quien quiere usar AutoLog en **varios móviles**, con su familia, o con fotos adjuntas y avisos push, sin
> montar nada a mano.
> **Tiempo:** 10–20 minutos. **Qué necesitas:** una de las plataformas de abajo.
> ¿Solo vas a usarla tú en un móvil? No hace falta nada de esto: [AutoLog solo en el móvil](phone-only.md).

## Elige tu plataforma

| Plataforma | Para quién | Dificultad | Coste |
|---|---|---|---|
| [**Render**](#render) | No tienes servidor y quieres lo más fácil | 🟢 Fácil | De pago |
| [CasaOS](#casaos) | Tienes un servidor en casa o un NAS con CasaOS | 🟡 Media | Gratis |
| [Umbrel](#umbrel) | Tienes un servidor en casa con Umbrel | 🟡 Media | Gratis |
| [Coolify](#coolify) | Ya usas Coolify en tu servidor o VPS | 🟡 Media | Tu servidor |

¿Tienes una Raspberry Pi, un PC o quieres tu propio dominio? Mira [tu propio servidor](self-hosting.md). ¿Otra nube
(Fly.io, Railway…)? Mira [nube](cloud.md).

## Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/davidniin/autolog)

La forma más sencilla si no tienes servidor: no escribes ningún comando. **Cuánto tarda:** unos 10 minutos la primera vez.
**Cuánto cuesta:** Render cobra por el disco y la base de datos (ver [Costes de Render](#costes-de-render)).

1. **Pulsa el botón de arriba.** Se abre Render. Si no tienes cuenta, créala (puedes entrar con GitHub o con Google).
2. **Confirma el despliegue.** Render te enseña lo que va a crear: la app AutoLog y una base de datos. Pon un nombre si te
   lo pide (el que quieras). Te pedirá también `PUSH_CONTACT`: escribe `mailto:` seguido de tu correo (por ejemplo
   `mailto:tu@correo.com`); solo sirve para los avisos push. Pulsa el botón de crear o desplegar (*Deploy Blueprint*). Si te
   pide una tarjeta, es porque estos servicios son de pago.
3. **Espera.** La primera vez tarda varios minutos. Cuando termine, la app aparece como *Live* (en marcha).
4. **Copia tu clave.** En el panel de Render abre la app (AutoLog) → pestaña **Environment** → busca `AUTOLOG_TOKEN` y
   pulsa para ver su valor. **Es tu contraseña:** guárdala en un gestor de contraseñas o en un sitio seguro.
5. **Copia tu dirección.** Arriba, en la página de la app, Render muestra su dirección, algo como
   `https://autolog-xxxx.onrender.com`.
6. **Ábrela en el móvil con tu clave.** En el navegador del móvil escribe la dirección seguida de `/?token=` y tu clave:

   ```
   https://autolog-xxxx.onrender.com/?token=TU-CLAVE
   ```

   La primera vez AutoLog te guía para crear tu primer vehículo. La clave se guarda en el móvil y desaparece de la barra de
   direcciones.
7. **Instálala.** Android (Chrome): menú ⋮ → *Instalar aplicación*. iPhone (Safari): *Compartir ⬆︎ → Añadir a pantalla de
   inicio*.

Para otro móvil, repite el paso 6 con la misma dirección y clave. Para tu familia, crea una persona en **⚙ Ajustes →
Personas con acceso**: cada una tiene su propia clave.

> Los nombres de los botones de Render pueden cambiar; la idea es siempre la misma: crear, esperar a *Live*, copiar la
> clave y la dirección.

**¿Algo no va?**

| Si ves… | Haz esto |
|---|---|
| El móvil pide la clave una y otra vez | La clave no coincide: cópiala otra vez de **Environment** y abre de nuevo `/?token=…` |
| La página tarda al abrirla tras un rato sin usar | Es normal en algunos planes de Render (la app «se duerme»): espera unos segundos |
| No aparece *Instalar* | La página tiene que abrirse con `https://` |
| Quiero guardar mis datos | **⚙ Ajustes → Tus datos → Copia con fotos (ZIP)** |

### Costes de Render

El disco para los adjuntos necesita una instancia de pago (`starter`) y la base de datos un plan de pago. Mira los precios
actuales de Render antes de desplegar. Render se encarga del HTTPS y, en los planes de pago, de las copias de la base de
datos. Si solo quieres probarla gratis, usa [la app sin servidor](phone-only.md).

## CasaOS

Para un servidor en casa o un NAS con CasaOS. Es gratis, pero para instalarla en el móvil necesitas
[HTTPS](#https-en-el-móvil-casaos-y-umbrel).

1. **App Store → ⋯ (arriba a la derecha) → Install a customized app → Import**, pega el contenido de
   [`deploy/casaos/docker-compose.yml`](../../deploy/casaos/docker-compose.yml) e instala.
2. **Tu clave** sale una sola vez en los logs del contenedor `secrets` (se crea solo la primera vez) y queda guardada en
   `/DATA/AppData/autolog/secrets/app/token`.
3. En el ordenador abre `http://<ip-de-casaos>:8791`. En el móvil, sigue [HTTPS en el móvil](#https-en-el-móvil-casaos-y-umbrel).

Haz copia de `/DATA/AppData/autolog/` (datos, base de datos y secretos), o usa **⚙ Ajustes → Tus datos → Copia con fotos**.

## Umbrel

Umbrel solo instala apps desde «tiendas». AutoLog aún no está en la oficial, así que hay que crear tu propia mini-tienda
(unos 5 minutos en GitHub):

1. En GitHub crea un repositorio público (p. ej. `umbrel-apps`) y sube a su raíz el fichero `umbrel-app-store.yml` y la
   carpeta `davidniin-autolog/` que están en [`deploy/umbrel/`](../../deploy/umbrel/).
2. En umbrelOS: **App Store → ⋯ → Community App Stores**, añade la URL de ese repositorio e instala AutoLog.
3. Tu clave sale en la página de la app, en **Default password**.
4. Para el móvil, sigue [HTTPS en el móvil](#https-en-el-móvil-casaos-y-umbrel).

El login de Umbrel está desactivado para AutoLog (`PROXY_AUTH_ADD: "false"`) porque la app del móvil no puede pasar por él;
la protege la clave de AutoLog.

## Coolify

Si ya usas Coolify, te da el HTTPS ya hecho.

1. **New resource → Docker Compose Empty**, pega
   [`deploy/coolify/docker-compose.yml`](../../deploy/coolify/docker-compose.yml) y **Deploy**.
2. Coolify genera la clave (`SERVICE_PASSWORD_64_AUTOLOG`, en las **Environment Variables** del recurso) y un dominio con
   HTTPS. Pon ahí tu dominio si tienes uno.
3. Abre en el móvil `https://<tu-dominio>/?token=<clave>` e instálala.

## HTTPS en el móvil (CasaOS y Umbrel)

Para instalar la app en el móvil, y para las notificaciones y el escáner, la dirección tiene que empezar por `https://`. En
tu red de casa solo tienes `http://`. La opción más sencilla es **Tailscale** (gratis para uso personal): instala su app en
el servidor y en el móvil, y crea una dirección `https://` privada. Los pasos exactos están en
[tu propio servidor → paso 3](self-hosting.md#3-https-y-acceso-desde-el-móvil). Después abre una vez
`https://<tu-dirección>/?token=<clave>` en el móvil.

## Qué hacen estas plantillas por tu seguridad

- **Ninguna contraseña por defecto:** cada instalación crea la suya.
- **La base de datos nunca se publica:** solo llega a ella AutoLog.
- **Contenedor endurecido:** usuario sin privilegios, disco de solo lectura salvo `/data`, sin capacidades de Linux.
- **Versión fijada:** nada cambia solo.

## Actualizar

Las plantillas usan una versión concreta de AutoLog (un número, p. ej. `0.5`) para que nada cambie por sorpresa. Cuando
salga una versión nueva la verás en [Releases](https://github.com/davidniin/autolog/releases). Para pasar a ella:

1. Copia el número nuevo de la versión.
2. Cámbialo en la plantilla (la línea `image: ghcr.io/davidniin/autolog:…`) o en los ajustes de tu plataforma.
3. Vuelve a desplegar.

Tus datos no se tocan y los cambios de la base de datos se aplican solos. Si no actualizas, tu AutoLog sigue funcionando.
