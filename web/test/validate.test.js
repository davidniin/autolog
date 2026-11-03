// Form validation rules (forms.js + validate.js)
import { describe, it, expect } from 'vitest';
import { FORMS } from '../src/forms.js';
import { validate, sanitizeNum, parseField } from '../src/validate.js';

const ctx = { others: [{ date: '2024-10-01', km: 10000 }, { date: '2024-10-20', km: 10500 }], km: 10500 };
const errs = (kind, m) => validate(FORMS[kind], m, ctx).errs;

describe('fuel', () => {
  it('accepts a valid fill-up and converts the numbers', () => {
    const { r, errs: e } = validate(FORMS.fuel, { date: '2024-10-25', km: '10600', liters: '40,5', total: '62,30', full_tank: true }, ctx);
    expect(e).toEqual({});
    expect(r).toMatchObject({ km: 10600, liters: 40.5, total: 62.3 });
  });
  it('checks mileage against earlier and later fill-ups', () => {
    expect(errs('fuel', { date: '2024-10-25', km: '9000', liters: '40', total: '60' }).km).toMatch(/anterior/);
    expect(errs('fuel', { date: '2024-10-10', km: '10800', liters: '40', total: '60' }).km).toMatch(/posterior/);
  });
  it('flags an unrealistic price per litre', () => {
    expect(errs('fuel', { date: '2024-10-25', km: '10600', liters: '40', total: '6' }).total).toMatch(/€\/L/);
  });
  it('rejects future dates, bad numbers and missing fields', () => {
    const e = errs('fuel', { date: '2999-01-01', km: '', liters: 'abc', total: '1,234' });
    expect(e).toMatchObject({ date: expect.stringMatching(/futura/), km: 'Obligatorio', liters: expect.any(String), total: expect.stringMatching(/decimales/) });
  });
});

describe('other forms', () => {
  it('vehicle: name required, plate format, upper case', () => {
    expect(errs('vehicles', { name: ' ', plate: '12$4' })).toMatchObject({ name: 'Obligatorio', plate: expect.any(String) });
    expect(validate(FORMS.vehicles, { name: 'Golf', plate: '1234 abc' }, ctx).r.plate).toBe('1234 ABC');
  });
  it('expense: amount > 0 and integer km', () => {
    expect(errs('expenses', { amount: '-5', date: '2024-01-01', km: '1,5' })).toMatchObject({ amount: expect.any(String), km: 'Sin decimales' });
  });
  it('reminder: limits, singular unit and "needs a due date or interval"', () => {
    expect(errs('reminders', { title: 'x', every_km: '50', every_months: '0' })).toEqual({ every_km: 'Mínimo 100 km', every_months: 'Mínimo 1 mes' });
    expect(validate(FORMS.reminders, { title: 'x' }, ctx).general).toMatch(/km o meses/);
    expect(validate(FORMS.reminders, { title: 'ITV', every_months: '12' }, ctx).r.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('chips fall back to the first option', () => {
    expect(parseField({ type: 'chips', options: [['a'], ['b']] }, 'zzz').v).toBe('a');
  });
});

describe('sanitizeNum', () => {
  it('keeps digits and one decimal separator', () => {
    expect(sanitizeNum('1a2.3,4', false)).toBe('12.34');
    expect(sanitizeNum('15.000', true)).toBe('15000');
  });
});
