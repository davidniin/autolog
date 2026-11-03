// Plural sencillo para los diccionarios: plural(n, 'día', 'días') → '1 día' / '3 días'
export const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
