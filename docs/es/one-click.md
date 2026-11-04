# Instalación en un clic

[English](../en/one-click.md) · **Español**

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

1. Pulsa el botón, entra en Render y confirma. El blueprint ([`render.yaml`](../../render.yaml)) crea AutoLog con un
   disco de 1 GB para los adjuntos y una base de datos PostgreSQL.
2. Render genera la clave de propietario (`AUTOLOG_TOKEN`, en la pestaña **Environment** del servicio). La base de datos
   no acepta conexiones desde internet (`ipAllowList: []`).
3. Abre una vez en el móvil `https://<tu-app>.onrender.com/?token=<clave>`.

**Costes:** el disco para los adjuntos necesita una instancia de pago (`starter`) y la base de datos un plan de pago.
Mira los precios actuales de Render antes de desplegar. Render se encarga del HTTPS y, en los planes de pago, de las
copias de la base de datos.

## Actualizar

Las plantillas fijan una versión menor (`:0.5`), que recibe arreglos. Para una versión nueva, cambia la etiqueta en la
plantilla (o en los ajustes de la plataforma) por la de las [notas de versión](https://github.com/davidniin/autolog/releases)
y vuelve a desplegar. Los cambios de la base de datos se aplican solos al arrancar.
