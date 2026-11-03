// Seguridad de la API: clave (AUTOLOG_TOKEN), límite de intentos fallidos y comprobaciones al arrancar.
//
// - La clave va en la cabecera Authorization: Bearer <clave>.
// - Los adjuntos (/v1/files/:id) se abren con <img> o en otra pestaña, sin cabeceras: ahí la clave va en la cookie
//   autolog_token (la pone la web, solo para /v1/files). Ya no va en la URL, que acaba en historiales y logs.
// - Tras MAX_FAILS intentos fallidos desde la misma IP en WINDOW_MS, esa IP recibe 429 durante WINDOW_MS.
import crypto from 'node:crypto';
import { getCookie } from 'hono/cookie';
import { getConnInfo } from '@hono/node-server/conninfo';
import { CONFIG } from './config.js';

export const MIN_TOKEN = 16;
const MAX_FAILS = 10;
const WINDOW_MS = 15 * 60 * 1000;

// Al arrancar: sin clave solo si se pide expresamente (red de casa sin acceso desde fuera)
export function checkStartup() {
  if (!CONFIG.token && !CONFIG.allowNoAuth) {
    return 'Falta AUTOLOG_TOKEN. Genera una con `openssl rand -hex 24` y ponla en .env. ' +
      '(Solo en una red privada sin acceso desde internet: ALLOW_NO_AUTH=1 para arrancar sin clave.)';
  }
  if (CONFIG.token && CONFIG.token.length < MIN_TOKEN) {
    return 'AUTOLOG_TOKEN es demasiado corta (mínimo ' + MIN_TOKEN + ' caracteres). Usa `openssl rand -hex 24`.';
  }
  return '';
}

function same(a, b) {
  const x = crypto.createHash('sha256').update(a).digest(), y = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(x, y);
}

// IP del cliente. Detrás de un proxy (Caddy, Cloudflare, la plataforma de la nube...) hay que poner TRUST_PROXY=1
// para usar X-Forwarded-For; si no, cualquiera podría inventarse esa cabecera.
export function clientIp(c) {
  if (CONFIG.trustProxy) {
    const fwd = c.req.header('x-forwarded-for');
    if (fwd) return fwd.split(',')[0].trim();
  }
  try { return getConnInfo(c).remote.address || '?'; } catch (e) { return '?'; }
}

const fails = new Map(); // ip → { n, since }
setInterval(() => {
  const now = Date.now();
  for (const [ip, f] of fails) if (now - f.since > WINDOW_MS) fails.delete(ip);
}, 60 * 1000).unref();

export function auth() {
  return async (c, next) => {
    if (!CONFIG.token || c.req.path === '/v1/health' || c.req.method === 'OPTIONS') return next();
    const ip = clientIp(c), f = fails.get(ip);
    if (f && f.n >= MAX_FAILS && Date.now() - f.since < WINDOW_MS) {
      c.header('Retry-After', String(Math.ceil((WINDOW_MS - (Date.now() - f.since)) / 1000)));
      return c.json({ error: 'demasiados intentos, espera unos minutos' }, 429);
    }
    const h = c.req.header('authorization') || '';
    let given = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!given && c.req.method === 'GET' && c.req.path.startsWith('/v1/files/')) given = getCookie(c, 'autolog_token') || '';
    if (!given || !same(given, CONFIG.token)) {
      if (!f || Date.now() - f.since > WINDOW_MS) fails.set(ip, { n: 1, since: Date.now() });
      else f.n++;
      return c.json({ error: 'token no válido' }, 401);
    }
    if (f) fails.delete(ip);
    return next();
  };
}

// Content-Security-Policy de la web. El lector de facturas descarga el modelo de Hugging Face y el motor
// onnxruntime de jsdelivr (ver web/src/ocr.js); el resto sale del propio servidor.
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net",
  "connect-src 'self' https://cdn.jsdelivr.net https://huggingface.co https://*.huggingface.co https://*.hf.co",
  "img-src 'self' blob: data:",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
