// Texts the server sends to people: push notifications, in the language each phone subscribed with.
// Keep them in line with web/src/i18n (rem.*). Add a language here and in the web app at the same time.
const nf = (lang) => new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-US');
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

export const MESSAGES = {
  es: {
    km: (n) => nf('es').format(n) + ' km',
    overBy: (km) => 'pasado por ' + km,
    left: (km) => 'faltan ' + km,
    ago: (d) => 'venció hace ' + plural(d, 'día', 'días'),
    today: 'vence hoy',
    in: (d) => 'en ' + plural(d, 'día', 'días'),
    testBody: 'Las notificaciones funcionan en este móvil.',
  },
  en: {
    km: (n) => nf('en').format(n) + ' km',
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
