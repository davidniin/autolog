// AutoLog landing page: language (EN/ES), repository links and the live demo (lazy iframe).
// Every GitHub link on the page comes from here.
const REPO = 'https://github.com/davidniin/autolog';

const ES = {
  'nav.features': 'Funciones', 'nav.demo': 'Demo', 'nav.install': 'Empezar', 'nav.github': 'GitHub',
  'hero.eyebrow': 'Gratis · sin cuenta · código abierto',
  'hero.title': 'El historial de tu vehículo,<br /><em>en tu bolsillo</em>.',
  'hero.lead': 'Apunta repostajes y gastos, mira cuánto consume y cuánto te cuesta de verdad tu coche o tu moto, y que te avise de la ITV, del aceite o del seguro. Ábrela en el móvil y empieza: sin instalar nada y sin registrarte. Tus datos se quedan contigo.',
  'hero.start': 'Empezar ahora', 'hero.demo': 'Ver la demo',
  'hero.p1': 'Funciona sin cobertura', 'hero.p2': 'Escanea facturas', 'hero.p3': 'Sin cuenta ni rastreo', 'hero.p4': 'Español · English',
  'demo.open': 'Probar la demo en vivo',
  'demo.note': 'Datos inventados. No se guarda nada.',
  'demo.full': 'Pantalla completa ↗',
  'cta.demo': 'Probar la demo', 'cta.start': 'Empezar ahora',
  'try.label': 'Prueba:', 'try.scan': '🧾 Escanea una factura', 'try.fuel': '⛽ Apunta un repostaje',
  'features.title': 'Todo sobre tu vehículo, en un solo sitio',
  'f1.n': '6,5 L/100 km', 'f2.n': '8 categorías', 'f3.n': '15.000 km', 'f4.n': '0,18 €/km',
  'f5.n': '0 fotos enviadas', 'f6.n': '0 rayitas', 'f7.n': 'mpg ⇄ L/100', 'f8.n': 'JSON · CSV · PDF',
  'f1.t': 'Consumo real', 'f1.d': 'Lleno a lleno, con los repostajes parciales. Gasolina, diésel, GLP, eléctricos e híbridos enchufables (kWh).',
  'f2.t': 'Gastos por categoría', 'f2.d': 'Revisión, reparación, ITV, seguro, impuestos, aparcamiento, peajes… con fotos y PDF adjuntos.',
  'f3.t': 'Avisos', 'f3.d': 'Por fecha, por km o lo primero que llegue. Notificaciones y calendario para Google, Apple u Outlook.',
  'f4.t': 'Lo que cuesta de verdad', 'f4.d': 'Al mes, por km o milla, con el precio de compra, gráfico de 12 meses y reparto por categoría.',
  'f5.t': 'Escáner de facturas', 'f5.d': 'Haz una foto a la factura del taller o al ticket de la gasolinera y el formulario se rellena solo. El OCR funciona en el móvil.',
  'f6.t': 'Sin cobertura', 'f6.d': 'Apunta el repostaje aunque en la gasolinera no haya red; se sincroniza al volver.',
  'f7.t': 'Tus unidades', 'f7.d': 'km o millas, litros o galones, L/100 km, km/L o mpg, y cualquier moneda.',
  'f8.t': 'Tus datos, contigo', 'f8.d': 'Copia con fotos, CSV para Excel, historial en PDF para vender el coche y varias personas con su propia clave.',
  'privacy.title': 'Privada desde el diseño',
  'privacy.lead': 'AutoLog no es un servicio en el que te registras. No hay cuenta, ni servidor central, ni analítica: tus datos son solo tuyos.',
  'privacy.c1': 'Tus datos se guardan en tu móvil (o en tu propio servidor, si lo prefieres). Nosotros nunca los vemos.',
  'privacy.c2': 'Las fotos de las facturas se leen en el móvil; nunca se envían a ningún sitio.',
  'privacy.c3': 'Si la montas en un servidor, va protegida con clave y bloquea los intentos repetidos.',
  'privacy.c4': 'Código abierto (MIT): puedes leer cada línea.',
  'install.title': 'Tres formas de empezar: elige la tuya',
  'install.lead': 'No hace falta saber de informática. Empieza en el móvil en segundos y, si algún día quieres, pasa después a tu propio espacio.',
  'way1.tag': 'La más fácil', 'way1.t': 'En tu móvil, ahora mismo',
  'way1.d': 'Abre AutoLog y pulsa «Añadir a pantalla de inicio». Ya está: tus datos se quedan solo en tu móvil, sin cuenta y sin registrarte.',
  'way1.cta': 'Abrir AutoLog', 'way1.n': 'Un solo móvil · sin avisos push · haz una copia de vez en cuando.',
  'way2.tag': 'Varios móviles', 'way2.t': 'Tu propia copia en internet, con un clic',
  'way2.d': 'Para usarla desde varios móviles o compartirla con tu familia: crea tu propia copia en la nube con un botón. Sin escribir comandos.',
  'way2.cta': 'Guía paso a paso', 'way2.n': 'Tus datos quedan en tu propia cuenta, no en la nuestra.',
  'way3.tag': 'Avanzado', 'way3.t': 'En tu propio servidor',
  'way3.d': 'Un servidor en casa, un NAS o una Raspberry Pi con Docker. Control total, fotos, avisos push y varias personas.',
  'way3.n': 'Requiere algunos conocimientos técnicos.',
  'adv.summary': 'Ver los comandos para tu servidor',
  'install.s1': 'Descarga y configura', 'install.s2': 'Arráncala', 'install.s3': 'Ponle HTTPS y ábrela en el móvil',
  'install.s3d': 'Con Tailscale, Caddy o Cloudflare Tunnel. Después, «Añadir a pantalla de inicio».',
  'install.self': 'Guía para tu servidor', 'install.cloud': 'Guía para la nube',
  'oss.title': 'Código abierto, abierto a ideas',
  'oss.lead': '¿Has encontrado un fallo o tienes una idea? Issues y pull requests bienvenidos, en español o en inglés: traducciones, reglas de facturas de tu país, funciones nuevas…',
  'oss.cta': 'Ver en GitHub',
  'coffee.title': 'Apoya el proyecto',
  'coffee.lead': 'AutoLog es gratis y lo seguirá siendo. Si te resulta útil, puedes invitarme a un café para que siga adelante.',
  'coffee.cta': 'Invítame a un café',
  'footer.made': 'Licencia MIT ·',
};

// The page is written in English; Spanish replaces the texts. The English originals are kept to switch back.
const EN = {};
let lang = 'en';

function demoUrl(query) {
  const f = document.getElementById('demo-frame');
  return f.dataset.src + '?lang=' + lang + (query ? '&' + query : '');
}

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
  if (frame && frame.src) frame.src = demoUrl(); // la demo, en el mismo idioma
  try { localStorage.setItem('autolog-site.lang', l); } catch (e) { /* private mode */ }
}

let saved = null;
try { saved = localStorage.getItem('autolog-site.lang'); } catch (e) { /* private mode */ }
apply(saved || ((navigator.language || '').toLowerCase().startsWith('es') ? 'es' : 'en'));
document.getElementById('lang').addEventListener('click', () => apply(lang === 'es' ? 'en' : 'es'));

// Live demo: only loaded on wide screens (on phones, the button opens it full screen) and when it scrolls into view
const frame = document.getElementById('demo-frame');
const wide = matchMedia('(min-width: 900px)');
function loadDemo(query) {
  if (!wide.matches) return;
  if (frame.src && typeof query !== 'string') return;
  frame.src = demoUrl(typeof query === 'string' ? query : '');
  frame.closest('.phone').classList.add('live');
}
// The shortcut chips jump the embedded demo straight to a screen (on phones the link opens the demo full screen)
for (const a of document.querySelectorAll('[data-demo-q]')) {
  a.addEventListener('click', (e) => {
    if (!wide.matches) { a.href = 'demo/?lang=' + lang + '&' + a.dataset.demoQ; return; }
    e.preventDefault();
    loadDemo(a.dataset.demoQ);
  });
}
// The demo is laid out as a real 390 px phone and scaled to fit the mock-up, so the app never looks cramped
const screen = frame.parentElement;
function fit() {
  const s = screen.clientWidth / 390;
  frame.style.width = '390px';
  frame.style.height = screen.clientHeight / s + 'px';
  frame.style.transform = 'scale(' + s + ')';
}
if ('ResizeObserver' in window) new ResizeObserver(fit).observe(screen); else fit();
if ('IntersectionObserver' in window) {
  new IntersectionObserver((entries, obs) => {
    if (entries.some((e) => e.isIntersecting)) { loadDemo(); if (frame.src) obs.disconnect(); }
  }, { rootMargin: '200px' }).observe(frame);
} else loadDemo();
wide.addEventListener('change', loadDemo);

// ---- mobile polish -------------------------------------------------------------------------------------------
document.documentElement.classList.add('js');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Sections fade up as they scroll into view
const revealEls = document.querySelectorAll('.feature, .section > h2, .shots, .privacy > *, .steps li, .card.big, .way');
revealEls.forEach((el) => el.classList.add('reveal'));
if ('IntersectionObserver' in window && !reduce) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px' });
  revealEls.forEach((el, i) => { el.style.transitionDelay = (i % 4) * 60 + 'ms'; io.observe(el); });
} else revealEls.forEach((el) => el.classList.add('in'));

// Sticky call to action (phones): shown once the hero buttons have scrolled away, hidden again at the install section
const bar = document.getElementById('sticky-cta');
const heroCtas = document.querySelector('.hero .ctas');
const install = document.getElementById('install');
if (bar && 'IntersectionObserver' in window) {
  let heroGone = false, atInstall = false, phoneInView = false;
  const sync = () => {
    const on = heroGone && !atInstall && !phoneInView; // the phone's own cover already has a button
    bar.classList.toggle('show', on);
    bar.setAttribute('aria-hidden', String(!on));
    bar.querySelectorAll('a').forEach((a) => a.tabIndex = on ? 0 : -1);
  };
  new IntersectionObserver(([e]) => { heroGone = !e.isIntersecting && e.boundingClientRect.top < 0; sync(); }).observe(heroCtas);
  new IntersectionObserver(([e]) => { atInstall = e.isIntersecting; sync(); }, { threshold: 0.35 }).observe(install);
  new IntersectionObserver(([e]) => { phoneInView = e.isIntersecting; sync(); }, { threshold: 0.25 }).observe(document.querySelector('.hero-phone'));
}

// "Copy" buttons on the install commands (tapping a code block on a phone to select it is fiddly)
for (const code of document.querySelectorAll('.steps code')) {
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'copy';
  const label = () => (lang === 'es' ? 'Copiar' : 'Copy');
  btn.textContent = label();
  btn.addEventListener('click', async () => {
    const text = [...code.childNodes].filter((n) => n !== btn).map((n) => (n.nodeName === 'BR' ? '\n' : n.textContent)).join('').replace(/^\s+/, '');
    try { await navigator.clipboard.writeText(text); } catch (e) { return; }
    btn.classList.add('done'); btn.textContent = lang === 'es' ? '¡Copiado!' : 'Copied!';
    if (navigator.vibrate) navigator.vibrate(10);
    setTimeout(() => { btn.classList.remove('done'); btn.textContent = label(); }, 1600);
  });
  code.appendChild(btn);
}
