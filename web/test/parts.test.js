// Tyres and parts: wear by distance and time (whichever is higher), and how long removed ones lasted.
import { describe, it, expect } from 'vitest';
import { partState, addMonths, today } from '../src/calc.js';
import { validate } from '../src/validate.js';
import { FORMS } from '../src/forms.js';

const ago = (months) => addMonths(today(), -months);

describe('partState', () => {
  it('distance wear', () => {
    const st = partState({ installed_date: ago(12), installed_km: 50000, life_km: 40000, life_months: 60 }, 70000);
    expect(st.km).toBe(20000);
    expect(st.pct).toBeCloseTo(0.5, 2);
    expect(st.level).toBe('ok');
  });
  it('time wear wins when it is higher (battery after 4,5 years)', () => {
    const st = partState({ installed_date: ago(54), installed_km: 10000, life_km: null, life_months: 60 }, 30000);
    expect(st.pct).toBeCloseTo(0.9, 1);
    expect(st.level).toBe('soon');
  });
  it('overdue', () => {
    expect(partState({ installed_date: ago(6), installed_km: 0, life_km: 1000 }, 1500).level).toBe('late');
  });
  it('a removed part lasted from fitting to removal', () => {
    const st = partState({ installed_date: '2020-01-01', installed_km: 10000, removed_date: '2023-01-01', removed_km: 48200, life_km: 40000 }, 99999);
    expect(st.km).toBe(38200);
    expect(Math.round(st.months)).toBe(36);
  });
  it('no expected life: no percentage', () => {
    expect(partState({ installed_date: ago(3), installed_km: 0 }, 100).pct).toBeNull();
  });
});

describe('part form', () => {
  it('needs the fitting date; life limits', () => {
    const ctx = { others: [], km: 0 };
    expect(validate(FORMS.parts, { kind: 'tyres', installed_date: '' }, ctx).errs.installed_date).toBeTruthy();
    expect(validate(FORMS.parts, { kind: 'tyres', installed_date: '2024-01-01', life_months: '0' }, ctx).errs.life_months).toBeTruthy();
    expect(validate(FORMS.parts, { kind: 'zzz', installed_date: '2024-01-01' }, ctx).r.kind).toBe('tyres');
  });
});
