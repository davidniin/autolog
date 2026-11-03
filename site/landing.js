// AutoLog landing page: language (EN/ES), repository links and the live demo (lazy iframe).
// Every GitHub link on the page comes from here.
const REPO = 'https://github.com/davidniin/autolog';

const ES = {
  'nav.features': 'Funciones', 'nav.demo': 'Demo', 'nav.install': 'Instalar', 'nav.github': 'GitHub',
  'hero.eyebrow': 'Gratis · código abierto · autoalojada',
  'hero.title': 'El historial de tu vehículo.<br /><span>En tu propio servidor.</span>',
  'hero.lead': 'Apunta repostajes y gastos, mira cuánto consume y cuánto te cuesta de verdad tu coche o tu moto, y que te avise de la ITV, del aceite o del seguro. Una app que instalas en el móvil, con tus datos donde tú decides.',
  'hero.try': '▶ Probar la demo en vivo', 'hero.install': 'Instala la tuya',
  'hero.p1': '📶 Funciona sin cobertura', 'hero.p2': '📷 Escanea facturas', 'hero.p3': '🔒 Sin rastreo', 'hero.p4': '🌍 Español · English',
  'demo.open': '▶ Abrir la demo en vivo',
  'demo.note': 'Demo en vivo con datos inventados. Juega con ella: apunta un repostaje, escanea una factura, cambia las unidades… No se guarda nada.',
  'demo.full': 'Abrir a pantalla completa ↗',
  'features.title': 'Todo sobre tu vehículo, en un solo sitio',
  'f1.t': 'Consumo real', 'f1.d': 'Lleno a lleno, con los repostajes parciales. Gasolina, diésel, GLP, eléctricos e híbridos enchufables (kWh).',
  'f2.t': 'Gastos por categoría', 'f2.d': 'Revisión, reparación, ITV, seguro, impuestos, aparcamiento, peajes… con fotos y PDF adjuntos.',
  'f3.t': 'Avisos', 'f3.d': 'Por fecha, por km o lo primero que llegue. Notificaciones y calendario para Google, Apple u Outlook.',
  'f4.t': 'Lo que cuesta de verdad', 'f4.d': 'Al mes, por km o milla, con el precio de compra, gráfico de 12 meses y reparto por categoría.',
  'f5.t': 'Escáner de facturas', 'f5.d': 'Haz una foto a la factura del taller o al ticket de la gasolinera y el formulario se rellena solo. El OCR funciona en el móvil.',
  'f6.t': 'Sin cobertura', 'f6.d': 'Apunta el repostaje aunque en la gasolinera no haya red; se sincroniza al volver.',
  'f7.t': 'Tus unidades', 'f7.d': 'km o millas, litros o galones, L/100 km, km/L o mpg, y cualquier moneda.',
  'f8.t': 'Tus datos, contigo', 'f8.d': 'Copia con fotos, CSV para Excel, historial en PDF para vender el coche y varias personas con su propia clave.',
  'privacy.title': 'Privada desde el diseño',
  'privacy.lead': 'AutoLog no es un servicio en el que te registras: cada persona monta su propia copia. No hay servidor central, ni cuenta, ni analítica.',
  'privacy.c1': 'Tus datos están en tu PostgreSQL y en tu disco.',
  'privacy.c2': 'Las fotos de las facturas se leen en el móvil; nunca se envían a ningún sitio.',
  'privacy.c3': 'Protegida con clave, con bloqueo de intentos repetidos y cabeceras de seguridad estrictas.',
  'privacy.c4': 'Código abierto (MIT): puedes leer cada línea.',
  'install.title': 'Instala la tuya en unos minutos',
  'install.lead': 'Un contenedor Docker más PostgreSQL. En casa, en un NAS, una Raspberry Pi, un VPS o cualquier nube.',
  'install.s1': 'Descarga y configura', 'install.s2': 'Arráncala', 'install.s3': 'Ponle HTTPS y ábrela en el móvil',
  'install.s3d': 'Con Tailscale, Caddy o Cloudflare Tunnel. Después, «Añadir a pantalla de inicio».',
  'install.self': '🏠 Guía para tu servidor', 'install.cloud': '☁️ Guía para la nube',
  'oss.title': 'Código abierto, abierto a ideas',
  'oss.lead': '¿Has encontrado un fallo o tienes una idea? Issues y pull requests bienvenidos, en español o en inglés: traducciones, reglas de facturas de tu país, funciones nuevas…',
  'oss.cta': 'Ver en GitHub',
  'coffee.title': 'Apoya el proyecto',
  'coffee.lead': 'AutoLog es gratis y lo seguirá siendo. Si te resulta útil, puedes invitarme a un café para que siga adelante.',
  'coffee.cta': '☕ Invítame a un café',
  'footer.made': 'Hecho con ❤️ · Licencia MIT ·',
};

// The page is written in English; Spanish replaces the texts. The English originals are kept to switch back.
const EN = {};
let lang = 'en';

function apply(l) {
  lang = l;
  document.documentElement.lang = l;
  for (const el of document.querySelectorAll('[data-i18n],[data-i18n-html]')) {
    const html = el.hasAttribute('data-i18n-html');
    const key = el.getAttribute(html ? 'data-i18n-html' : 'data-i18n');
    if (!(key in EN)) EN[key] = html ? el.innerHTML : el.textContent;
    const text = l === 'es' ? ES[key] ?? EN[key] : EN[key];
    if (html) el.innerHTML = text; else el.textContent = text;
  }
  for (const el of document.querySelectorAll('[data-repo]')) {
    const path = (l === 'es' && el.getAttribute('data-repo-es')) || el.getAttribute('data-repo');
    el.href = REPO + path;
    el.target = '_blank';
    el.rel = 'noopener';
  }
  for (const el of document.querySelectorAll('[data-repo-text]')) el.textContent = REPO;
  document.getElementById('lang').textContent = l === 'es' ? 'EN' : 'ES';
  const frame = document.getElementById('demo-frame');
  if (frame && frame.src) frame.src = frame.dataset.src + '?lang=' + l; // la demo, en el mismo idioma
  try { localStorage.setItem('autolog-site.lang', l); } catch (e) { /* private mode */ }
}

let saved = null;
try { saved = localStorage.getItem('autolog-site.lang'); } catch (e) { /* private mode */ }
apply(saved || ((navigator.language || '').toLowerCase().startsWith('es') ? 'es' : 'en'));
document.getElementById('lang').addEventListener('click', () => apply(lang === 'es' ? 'en' : 'es'));

// Live demo: only loaded on wide screens (on phones, the button opens it full screen) and when it scrolls into view
const frame = document.getElementById('demo-frame');
const wide = matchMedia('(min-width: 900px)');
function loadDemo() {
  if (!wide.matches || frame.src) return;
  frame.src = frame.dataset.src + '?lang=' + lang;
  frame.closest('.phone').classList.add('live');
}
if ('IntersectionObserver' in window) {
  new IntersectionObserver((entries, obs) => {
    if (entries.some((e) => e.isIntersecting)) { loadDemo(); if (frame.src) obs.disconnect(); }
  }, { rootMargin: '200px' }).observe(frame);
} else loadDemo();
wide.addEventListener('change', loadDemo);
