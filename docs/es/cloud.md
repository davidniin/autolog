# AutoLog en la nube (cualquier proveedor)

[English](../en/cloud.md) · **Español**

AutoLog es un solo contenedor Docker más una base de datos PostgreSQL, así que funciona en casi cualquier nube. Esta
guía dice qué tiene que ofrecer la plataforma y qué configurar; para los clics, sigue la documentación de tu proveedor.

Si tu proveedor te da una máquina virtual normal (VPS), es más sencillo seguir [self-hosting.md](self-hosting.md) en
ella.

## Lista de requisitos de la plataforma

| Requisito | Para qué | Cómo suele llamarse |
|---|---|---|
| **Ejecutar un contenedor** con el `Dockerfile` de este repo (o una imagen ya construida) | La app | "Deploy from GitHub / Dockerfile", "servicio de contenedores" |
| **PostgreSQL 14+** | Los datos | PostgreSQL gestionado del mismo proveedor o de otro; o un segundo contenedor con volumen |
| **Disco persistente montado en `/data`** | Fotos y PDF (adjuntos) | "Volume", "disco persistente". ⚠ Sin él, los adjuntos **se pierden en cada despliegue o reinicio** |
| **HTTPS** con dominio propio o el que te den | Instalar en el móvil, push, escáner | Casi todas lo dan |
| **Una instancia siempre encendida** | La revisión diaria de avisos y el bloqueo de intentos viven en memoria | Desactiva "scale to zero" / "sleep" si quieres los avisos a su hora; no uses más de 1 réplica |

Los precios cambian según el plan; basta con una instancia pequeña (256–512 MB de RAM). Comprueba que el plan incluye
volúmenes persistentes: algunos gratuitos no los tienen.

## Configuración

**Contenedor**

- Puerto: la app escucha en `$PORT` si la plataforma lo define, y si no en `8791`.
- Health check: `GET /v1/health` (no pide clave).
- Volumen: móntalo en `/data`.

**Variables de entorno / secretos**

| Variable | Valor |
|---|---|
| `AUTOLOG_TOKEN` | `openssl rand -hex 24`. Guárdala como **secreto**, no como configuración normal |
| `DATABASE_URL` | La URL de tu PostgreSQL, p. ej. `postgres://usuario:clave@host:5432/autolog?sslmode=require` |
| `TRUST_PROXY` | `1` (delante de la app está el balanceador de la plataforma) |
| `PUSH_CONTACT` | `mailto:` + una dirección tuya |
| `TZ` | Tu zona horaria, p. ej. `Europe/Madrid` (la revisión diaria de avisos es a `PUSH_HOUR`, las 9 por defecto) |

El Dockerfile ya define `STATIC_DIR` y `FILES_DIR=/data/files`. **Nunca** pongas `ALLOW_NO_AUTH` en una nube pública.

## Pasos (en general)

1. Haz un **fork** de este repositorio (o usa la imagen de `ghcr.io/davidniin/autolog` si los mantenedores la publican).
2. **Crea la base de datos**: un PostgreSQL gestionado, o un contenedor de PostgreSQL con su propio volumen. Copia la
   URL de conexión. Las gestionadas suelen necesitar `?sslmode=require` al final.
3. **Crea la app** desde tu fork con el `Dockerfile`. Añade las variables de arriba, un volumen en `/data` y el health
   check.
4. **Despliega** y abre `https://<tu-app>/v1/health`: tiene que decir `"db":true,"auth":true`.
5. **Instálala en el móvil**: abre una vez `https://<tu-app>/?token=<AUTOLOG_TOKEN>` y luego *Instalar aplicación*
   (Android) o *Compartir → Añadir a pantalla de inicio* (iPhone).

## Tipos de plataforma

- **PaaS de contenedores con volúmenes** (p. ej. Fly.io, Railway, Render con disco, Koyeb, Northflank…): despliega desde
  el Dockerfile, añade un volumen en `/data` y un PostgreSQL gestionado o de otro proveedor (Neon, Supabase, Aiven…).
- **Contenedores serverless sin disco** (p. ej. Google Cloud Run, AWS App Runner, Azure Container Apps sin file share):
  la app funciona, pero los adjuntos necesitan un almacenamiento de ficheros montado en `/data`; sin él se pierden.
  Además se apagan solos cuando no hay uso: pon un mínimo de 1 instancia para que los avisos lleguen a su hora.
- **Kubernetes**: un `Deployment` con 1 réplica, un `PersistentVolumeClaim` en `/data`, un `Secret` con las variables
  y un `Ingress` con TLS.
- **VPS / máquina virtual** (cualquier proveedor): usa Docker Compose como en [self-hosting.md](self-hosting.md), con
  Caddy.

Las funciones y los planes gratuitos de los proveedores cambian a menudo: mira su documentación actual. Si escribes un
paso a paso para un proveedor concreto, un pull request a `docs/` será muy bienvenido.

## Seguridad en una nube pública

- La clave es la única barrera: que sea larga y aleatoria, y guárdala como secreto.
- Mantén la app actualizada (`git pull` en tu fork, o despliegues automáticos).
- Activa copias de la base de datos (la mayoría de PostgreSQL gestionados las tienen) y del volumen `/data`.
- Tus datos están en la infraestructura del proveedor: elige una región y un proveedor de confianza.

## Copias de seguridad

- **Base de datos:** las copias automáticas del proveedor, o `pg_dump "$DATABASE_URL" | gzip > autolog-db.sql.gz` desde
  tu ordenador.
- **Adjuntos:** instantáneas del volumen si la plataforma las ofrece; si no, copia `/data/files` con la terminal de la
  plataforma o por SFTP.
