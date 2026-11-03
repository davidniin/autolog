// Texts the server sends to people: push notifications, in the language each phone subscribed with.
// Keep them in line with web/src/i18n (rem.*). Add a language here and in the web app at the same time.
const nf = (lang) => new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-US');
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
const KM_PER_MI = 1.609344;
// Distance (stored in km) in the installation's unit (settings.js)
const dist = (lang) => (km, unit) => nf(lang).format(Math.round(unit === 'mi' ? km / KM_PER_MI : km)) + (unit === 'mi' ? ' mi' : ' km');

export const MESSAGES = {
  es: {
    dist: dist('es'),
    overBy: (km) => 'pasado por ' + km,
    left: (km) => 'faltan ' + km,
    ago: (d) => 'venció hace ' + plural(d, 'día', 'días'),
    today: 'vence hoy',
    in: (d) => 'en ' + plural(d, 'día', 'días'),
    testBody: 'Las notificaciones funcionan en este móvil.',
  },
  en: {
    dist: dist('en'),
    overBy: (km) => km + ' over',
    left: (km) => km + ' to go',
    ago: (d) => 'due ' + plural(d, 'day', 'days') + ' ago',
    today: 'due today',
    in: (d) => 'in ' + plural(d, 'day', 'days'),
    testBody: 'Notifications work on this phone.',
  },
};

export const LANGS = Object.keys(MESSAGES);
export const msg = (lang) => MESSAGES[lang] || MESSAGES.en;
export const cleanLang = (l) => (LANGS.includes(String(l || '').slice(0, 2)) ? String(l).slice(0, 2) : 'en');
