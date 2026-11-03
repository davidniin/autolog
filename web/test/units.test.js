// Units and currency: data is stored in km / litres / L/100 km and only converted for display and input.
import { describe, it, expect } from 'vitest';
import { applyPrefs, conv, defaultPrefs, toDisplay, fromDisplay } from '../src/units.js';
import { setLang } from '../src/i18n/index.js';
import { fmt } from '../src/calc.js';
import { validate } from '../src/validate.js';
import { FORMS } from '../src/forms.js';

const US = { distance: 'mi', volume: 'gal_us', consumption: 'mpg_us', currency: 'USD' };
const ctx = { others: [], km: 0 };

describe('conversions', () => {
  it('converts consumption to every unit', () => {
    applyPrefs({ consumption: 'kml' });
    expect(conv.cons(5)).toBeCloseTo(20, 5);
    applyPrefs({ consumption: 'mpg_us' });
    expect(conv.cons(5)).toBeCloseTo(47.04, 2);
    applyPrefs({ consumption: 'mpg_uk' });
    expect(conv.cons(5)).toBeCloseTo(56.5, 1);
  });
  it('round-trips distance and volume', () => {
    applyPrefs(US);
    expect(fromDisplay('km', toDisplay('km', 1000))).toBeCloseTo(1000, 6);
    expect(toDisplay('L', 3.785411784)).toBeCloseTo(1, 6);
  });
  it('proposes defaults from the phone locale', () => {
    expect(defaultPrefs('en-US')).toEqual(US);
    expect(defaultPrefs('en-GB')).toMatchObject({ distance: 'mi', volume: 'l', consumption: 'mpg_uk', currency: 'GBP' });
    expect(defaultPrefs('es-ES')).toMatchObject({ distance: 'km', currency: 'EUR' });
    expect(defaultPrefs('es-MX')).toMatchObject({ consumption: 'kml', currency: 'MXN' });
  });
});

describe('formatting', () => {
  it('shows stored values in the chosen units and currency', () => {
    setLang('en');
    applyPrefs(US);
    expect(fmt.km(160934.4)).toBe('100,000 mi');
    expect(fmt.l(37.854)).toBe('10.00 gal');
    expect(fmt.cons(5)).toBe('47.0');
    expect(fmt.consUnit()).toBe('mpg');
    expect(fmt.money(12.5)).toBe('$12.50');
    expect(fmt.ppl(1)).toBe('$3.785/gal');
  });
  it('euros and litres in Spanish', () => {
    const sp = (s) => s.replace(/\s/g, ' '); // Intl usa espacio no separable antes de €
    expect(sp(fmt.money(1234.5))).toBe('1234,50 €');
    expect(sp(fmt.ppl(1.549))).toBe('1,549 €/L');
    expect(sp(fmt.perDist(0.179))).toBe('0,179 €/km');
  });
});

describe('forms in other units', () => {
  it('a fill-up typed in miles and gallons is stored in km and litres', () => {
    applyPrefs(US);
    const { r, errs } = validate(FORMS.fuel, { date: '2024-05-01', km: '50000', liters: '10', total: '35', full_tank: true }, ctx);
    expect(errs).toEqual({});
    expect(r.km).toBe(80467);
    expect(r.liters).toBeCloseTo(37.854, 3);
  });
  it('limits are shown in the chosen unit', () => {
    applyPrefs(US);
    expect(validate(FORMS.reminders, { title: 'x', every_km: '10' }, ctx).errs.every_km).toBe('Mínimo 62 mi');
  });
  it('the €/L realism check only applies to euro-like currencies', () => {
    expect(validate(FORMS.fuel, { date: '2024-05-01', km: '100', liters: '40', total: '6' }, ctx).errs.total).toMatch(/Sale a/);
    applyPrefs({ currency: 'JPY' });
    expect(validate(FORMS.fuel, { date: '2024-05-01', km: '100', liters: '40', total: '6800' }, ctx).errs).toEqual({});
  });
});
