// Configuración desde variables de entorno (.env en local, env_file en Docker). Ver .env.example.
const env = process.env;
const yes = (v) => /^(1|true|yes|si|sí)$/i.test(String(v || '').trim());

export const CONFIG = {
  port: +(env.PORT || 8791),
  // Clave de la app. Obligatoria salvo ALLOW_NO_AUTH=1 (ver security.js)
  token: (env.AUTOLOG_TOKEN || '').trim(),
  allowNoAuth: yes(env.ALLOW_NO_AUTH),
  // Detrás de un proxy inverso (Caddy, Nginx, Cloudflare, la plataforma de la nube): para saber la IP real del cliente
  trustProxy: yes(env.TRUST_PROXY),
  // Solo si la web se sirve desde OTRO dominio que la API (raro). Vacío = mismo origen, sin CORS.
  corsOrigin: (env.CORS_ORIGIN || '').trim(),
  databaseUrl: env.DATABASE_URL || 'postgres://autolog:autolog@localhost:5432/autolog',
  // Carpeta con la web compilada (web/dist). Vacío = solo API.
  staticDir: env.STATIC_DIR || '',
  // Carpeta de los adjuntos (fotos y PDF). En Docker es un volumen: ver docker-compose.yml.
  filesDir: env.FILES_DIR || './data/files',
  // Notificaciones push: contacto que se envía a los servicios de push (Google, Apple...) y hora de la revisión diaria
  pushContact: env.PUSH_CONTACT || 'mailto:autolog@example.com',
  pushHour: +(env.PUSH_HOUR || 9),
};
