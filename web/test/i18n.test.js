// Translations: both languages must have the same keys, and texts must switch with the language.
import { describe, it, expect } from 'vitest';
import es from '../src/i18n/es.js';
import en from '../src/i18n/en.js';
import { t, setLang, L, list } from '../src/i18n/index.js';
import { validate } from '../src/validate.js';
import { FORMS, optLabel, preset } from '../src/forms.js';
import { reminderState, fmt } from '../src/calc.js';
import { parseReceipt } from '../src/receipt.js';

const keys = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, p + k + '.') : [p + k]));

describe('dictionaries', () => {
  it('es and en have exactly the same keys', () => {
    expect(keys(en).sort()).toEqual(keys(es).sort());
  });
  it('falls back to the key when missing', () => {
    expect(t('nope.missing')).toBe('nope.missing');
  });
});

describe('switching language', () => {
  it('translates texts, plurals and lists', () => {
    setLang('en');
    expect(L.lang).toBe('en');
    expect(t('app.tabs.fuel')).toBe('Fill-ups');
    expect(t('fuelList.totals', { n: 1 })).toBe('1 fill-up');
    expect(t('fuelList.totals', { n: 3 })).toBe('3 fill-ups');
    expect(list(['a', 'b', 'c'])).toBe('a, b and c');
    setLang('es');
    expect(t('fuelList.totals', { n: 3 })).toBe('3 repostajes');
    expect(list(['a', 'b'])).toBe('a y b');
  });
  it('formats numbers and dates per language', () => {
    setLang('en');
    expect(fmt.km(86120)).toBe('86,120 km');
    setLang('es');
    expect(fmt.km(86120)).toBe('86.120 km');
  });
  it('validation messages, options and presets follow the language', () => {
    setLang('en');
    expect(validate(FORMS.expenses, { amount: '', date: '' }, { others: [], km: 0 }).errs).toEqual({ amount: 'Required', date: 'Enter a date' });
    expect(optLabel('cat', 'reparacion')).toBe('🛠️ Repair');
    expect(preset(FORMS.reminders.presets[0])[1].title).toBe('Oil and filter change');
    expect(reminderState({ due_date: null, due_km: 900 }, 0).text).toBe('900 km to go');
  });
  it('scanner output follows the language (rules still read Spanish invoices)', () => {
    setLang('en');
    const r = parseReceipt({ text: 'TALLER EJEMPLO\nFecha 01/02/2024\nAceite y filtro de aire\nTOTAL 80,00 €' });
    expect(r.values.title).toBe('Oil and air filter');
  });
});
