# AutoLog en tu propio servidor

[English](../en/self-hosting.md) · **Español**

Vale cualquier máquina con Docker: un servidor en casa, un NAS, una Raspberry Pi 4/5 o un VPS de cualquier proveedor.
Para una plataforma en la nube sin acceso por terminal (PaaS), mira [cloud.md](cloud.md).

## Qué necesitas

- Docker con el plugin de Compose (`docker compose version`).
- Unos 300 MB de RAM y algo de disco para los adjuntos.
- **HTTPS** para el móvil: instalar la app, las notificaciones push y el escáner necesitan una conexión segura. Las
  opciones están en el paso 3.

## 1. Configurar

```sh
git clone https://github.com/<owner>/autolog.git
cd autolog
cp .env.example .env
```

Edita `.env`:

| Variable | Qué poner |
|---|---|
| `AUTOLOG_TOKEN` | La clave de la app. Genérala: `openssl rand -hex 24`. Mínimo 16 caracteres |
| `POSTGRES_PASSWORD` | Una contraseña larga para la base de datos incluida (`openssl rand -hex 24`) |
| `PUSH_CONTACT` | `mailto:` + una dirección tuya (los servicios de push la exigen; Apple rechaza las inventadas) |
| `TZ` | Tu zona horaria, p. ej. `Europe/Madrid`, `America/Mexico_City` |

El `.env` tiene tus secretos: está en `.gitignore` y nunca se sube ni se comparte.

## 2. Arrancar

```sh
docker compose up -d --build
curl http://127.0.0.1:8791/v1/health    # {"ok":true,...,"db":true,"auth":true}
```

Arranca dos contenedores: `autolog` y su propio PostgreSQL (`db`, al que no se llega desde fuera). La app escucha
**solo en 127.0.0.1:8791**: no queda nada abierto a tu red ni a internet hasta que elijas cómo en el paso 3.

## 3. HTTPS y acceso desde el móvil

Elige una opción.

### A. Tailscale: privado, sin abrir puertos (recomendado)

Solo tus dispositivos (con Tailscale instalado) llegan a la app. No se publica nada en internet.

```sh
sudo tailscale serve --bg --https=8444 http://127.0.0.1:8791
tailscale serve status        # muestra https://<máquina>.<tu-red>.ts.net:8444
```

Pon `TRUST_PROXY=1` en `.env` y haz `docker compose up -d`.

### B. Tu dominio con Caddy (público)

Apunta un registro DNS (p. ej. `autolog.ejemplo.com`) al servidor, abre los puertos 80/443 y usa este `Caddyfile`
(Caddy saca el certificado solo):

```
autolog.ejemplo.com {
    reverse_proxy 127.0.0.1:8791
}
```

Pon `TRUST_PROXY=1` en `.env` y haz `docker compose up -d`. Con Nginx, Traefik o similares es igual: proxy a
`127.0.0.1:8791` pasando `X-Forwarded-For`.

### C. Cloudflare Tunnel (público, sin abrir puertos)

Crea un túnel a `http://127.0.0.1:8791` (`cloudflared tunnel --url http://127.0.0.1:8791` para probar, o un túnel con
nombre para dejarlo fijo). Pon `TRUST_PROXY=1`. Puedes añadir Cloudflare Access delante para tener otro login.

> **Exponerla a internet (B y C):** la clave es lo único que hay entre internet y tus datos. Usa un `AUTOLOG_TOKEN`
> largo y aleatorio, mantén la app actualizada y no pongas nunca `ALLOW_NO_AUTH`.

## 4. Instalarla en el móvil

Abre una vez `https://<tu-dirección>/?token=<AUTOLOG_TOKEN>`. La clave se guarda en el móvil y se quita de la barra
de direcciones. Después:

- **Android (Chrome):** pulsa **⬇ Instalar** en la cabecera, o *Menú → Instalar aplicación*.
- **iPhone (Safari):** *Compartir → Añadir a pantalla de inicio*. Las notificaciones en iPhone necesitan iOS 16.4 o
  posterior y la app instalada.

Haz lo mismo en cada móvil que vaya a usarla (comparten los mismos datos).

## Actualizar

```sh
git pull
docker compose up -d --build
```

Los cambios de la base de datos se aplican solos al arrancar.

## Copias de seguridad

Tus datos están en dos sitios: la base de datos y el volumen de adjuntos. Guarda las copias **fuera de la carpeta del
repositorio** (tienen tus datos personales).

```sh
mkdir -p ~/autolog-backups
# base de datos
docker compose exec -T db pg_dump -U autolog autolog | gzip > ~/autolog-backups/db-$(date +%F).sql.gz
# adjuntos (el volumen se llama <carpeta>_autolog-data; compruébalo con: docker volume ls)
docker run --rm -v autolog_autolog-data:/d -v ~/autolog-backups:/b alpine tar czf /b/files-$(date +%F).tgz -C /d .
```

Restaurar:

```sh
gunzip -c ~/autolog-backups/db-2026-01-31.sql.gz | docker compose exec -T db psql -U autolog autolog
docker run --rm -v autolog_autolog-data:/d -v ~/autolog-backups:/b alpine tar xzf /b/files-2026-01-31.tgz -C /d
```

Automatízalo con `cron` y copia la carpeta a otra máquina o a una nube.

## Si ya tienes PostgreSQL

Si ya usas PostgreSQL (en Docker o no), usa `docker-compose.external-db.yml` en lugar del que lo incluye.

1. Crea un usuario y una base de datos:

   ```sh
   # <postgres> = tu contenedor de PostgreSQL (docker ps)
   docker exec -it <postgres> psql -U postgres -c "create user autolog with password 'CAMBIA_ESTO';"
   docker exec -it <postgres> psql -U postgres -c "create database autolog owner autolog;"
   ```

2. En `.env`, pon `DATABASE_URL` en vez de `POSTGRES_PASSWORD`:

   ```
   DATABASE_URL=postgres://autolog:CAMBIA_ESTO@host.docker.internal:5432/autolog
   ```

   `host.docker.internal` es la propia máquina. Si tu PostgreSQL es un contenedor en una red de Docker, descomenta el
   bloque `networks` del fichero y usa el nombre del contenedor.

3. Arranca: `docker compose -f docker-compose.external-db.yml up -d --build`

Las tablas se crean solas la primera vez. Haz la copia de la base de datos con tu copia habitual de PostgreSQL.

## Sin Docker

Node 22+ y PostgreSQL 14+:

```sh
cd web && npm ci && npm run build && cd ..
cd server && npm ci --omit=dev
AUTOLOG_TOKEN=... DATABASE_URL=postgres://... STATIC_DIR=../web/dist FILES_DIR=/var/lib/autolog node src/index.js
```

Déjalo como servicio (systemd, pm2…) y ponle HTTPS delante como en el paso 3.

## Problemas frecuentes

| Problema | Solución |
|---|---|
| El contenedor se para: `Falta AUTOLOG_TOKEN` / `demasiado corta` | Pon en `.env` una clave de 16 caracteres o más |
| `/v1/health` dice `"db":false` | Revisa `DATABASE_URL` / `POSTGRES_PASSWORD`; `docker compose logs db` |
| El móvil pide la clave una y otra vez | La del móvil no coincide con `AUTOLOG_TOKEN`. Abre otra vez `/?token=...` |
| `429 demasiados intentos` | 10 claves incorrectas desde esa IP: espera 15 minutos. Detrás de un proxy, pon `TRUST_PROXY=1` para que cada dispositivo cuente por separado |
| No sale "Instalar" o no llegan las notificaciones | La página no va por HTTPS (ver paso 3) |
| El escáner dice que necesita conexión | La primera vez descarga el modelo del OCR (~31 MB). Después funciona sin red |

Logs: `docker compose logs -f autolog`.
