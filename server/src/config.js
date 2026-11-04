// Configuración desde variables de entorno (.env en local, env_file en Docker). Ver .env.example.
// Secretos también desde ficheros (patrón de Docker secrets): AUTOLOG_TOKEN_FILE, DATABASE_PASSWORD_FILE. Así no
// aparecen en las variables del contenedor (docker inspect). Si están las dos formas, gana la variable.
import fs from 'node:fs';

const env = process.env;
const yes = (v) => /^(1|true|yes|si|sí)$/i.test(String(v || '').trim());

// Lee un secreto de un fichero (sin espacios ni saltos de línea al final). '' si no hay fichero.
export function readSecret(path) {
  if (!path) return '';
  try { return fs.readFileSync(path, 'utf8').trim(); } catch (e) {
    console.error('[config] no se puede leer el secreto ' + path + ': ' + e.code);
    return '';
  }
}

// DATABASE_URL con la contraseña de un fichero: postgres://usuario@host/db + DATABASE_PASSWORD_FILE
export function withPassword(url, password) {
  if (!password) return url;
  try {
    const u = new URL(url);
    u.password = encodeURIComponent(password);
    return u.toString();
  } catch (e) { return url; }
}

export const CONFIG = {
  port: +(env.PORT || 8791),
  // Clave de la app (del propietario). Obligatoria salvo ALLOW_NO_AUTH=1 (ver security.js)
  token: (env.AUTOLOG_TOKEN || readSecret(env.AUTOLOG_TOKEN_FILE)).trim(),
  allowNoAuth: yes(env.ALLOW_NO_AUTH),
  // Cuántos proxies inversos hay delante (Caddy, Nginx, Cloudflare, la plataforma de la nube), para saber la IP real
  // del cliente: 0 = ninguno; 1 = uno (lo habitual; "1"/"true"/"yes"); 2 = p. ej. Cloudflare delante de Caddy.
  trustProxy: /^\d+$/.test(String(env.TRUST_PROXY || '').trim()) ? +env.TRUST_PROXY : yes(env.TRUST_PROXY) ? 1 : 0,
  // Solo si la web se sirve desde OTRO dominio que la API (raro). Vacío = mismo origen, sin CORS.
  corsOrigin: (env.CORS_ORIGIN || '').trim(),
  databaseUrl: withPassword(env.DATABASE_URL || 'postgres://autolog:autolog@localhost:5432/autolog', readSecret(env.DATABASE_PASSWORD_FILE)),
  // Carpeta con la web compilada (web/dist). Vacío = solo API.
  staticDir: env.STATIC_DIR || '',
  // Tamaño máximo de una copia con fotos al restaurarla (POST /v1/restore), en MB
  restoreMaxMb: +(env.RESTORE_MAX_MB || 2048),
  // Carpeta de los adjuntos (fotos y PDF). En Docker es un volumen: ver docker-compose.yml.
  filesDir: env.FILES_DIR || './data/files',
  // Notificaciones push: contacto que se envía a los servicios de push (Google, Apple...) y hora de la revisión diaria
  pushContact: env.PUSH_CONTACT || 'mailto:autolog@example.com',
  pushHour: +(env.PUSH_HOUR || 9),
};
