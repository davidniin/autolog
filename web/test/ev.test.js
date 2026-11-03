// Electric and plug-in hybrid vehicles: kWh charges, consumption per energy, forms, CSV and the scanner.
import { describe, it, expect } from 'vitest';
import { energyStats, energiesOf, fmt } from '../src/calc.js';
import { validate } from '../src/validate.js';
import { FORMS } from '../src/forms.js';
import { applyPrefs } from '../src/units.js';
import { parseReceipt } from '../src/receipt.js';
import { parseCSV } from '../src/dataio.js';

const F = (id, km, liters, total, energy, full = true) => ({ id, vehicle_id: 'v', date: '2024-01-' + String(id).padStart(2, '0'), km, liters, total, full_tank: full, energy });

describe('energies', () => {
  it('per vehicle type', () => {
    expect(energiesOf({ fuel_type: 'gasolina' })).toEqual(['fuel']);
    expect(energiesOf({ fuel_type: 'electrico' })).toEqual(['kwh']);
    expect(energiesOf({ fuel_type: 'hibrido' })).toEqual(['fuel', 'kwh']);
  });
  it('a plug-in hybrid keeps fuel and electricity consumption apart', () => {
    const s = energyStats([F(1, 1000, 30, 45, 'fuel'), F(2, 1050, 10, 2, 'kwh'), F(3, 1200, 8, 2, 'kwh'), F(4, 1500, 15, 22, 'fuel')]);
    expect(s.fuel.avg).toBeCloseTo(3, 5);   // 15 L / 500 km
    expect(s.kwh.avg).toBeCloseTo(5.333, 2); // 8 kWh / 150 km
    expect(s.spent).toBe(71);
  });
});

describe('formatting', () => {
  it('kWh/100 km, or mi/kWh with miles', () => {
    expect(fmt.econs(16)).toBe('16,0');
    expect(fmt.econsUnit()).toBe('kWh/100 km');
    applyPrefs({ distance: 'mi' });
    expect(fmt.econs(16)).toBe('3,9'); // 100 / (16 × 1,609)
    expect(fmt.econsUnit()).toBe('mi/kWh');
  });
  it('quantity and unit price of a charge', () => {
    const c = F(1, 100, 40, 6, 'kwh');
    expect(fmt.qty(c)).toBe('40,0 kWh');
    expect(fmt.unitPrice(c).replace(/\s/g, ' ')).toBe('0,150 €/kWh');
  });
});

describe('form', () => {
  const ctx = { others: [], km: 0, energies: ['kwh'] };
  it('a charge is stored in kWh, never converted as gallons', () => {
    applyPrefs({ volume: 'gal_us' });
    const { r, errs } = validate(FORMS.fuel, { energy: 'kwh', date: '2024-01-02', km: '100', liters: '42,5', total: '9,50' }, ctx);
    expect(errs).toEqual({});
    expect(r).toMatchObject({ energy: 'kwh', liters: 42.5 });
  });
  it('price check uses €/kWh', () => {
    expect(validate(FORMS.fuel, { energy: 'kwh', date: '2024-01-02', km: '100', liters: '40', total: '400' }, ctx).errs.total).toMatch(/kWh/);
  });
});

describe('scanner and CSV', () => {
  it('reads a charging receipt in kWh', () => {
    const r = parseReceipt({ text: 'IONITY\nFecha 12/03/2024\nEnergía 38,6 kWh\nPrecio 0,59 €/kWh\nTOTAL 22,77 €' });
    expect(r.fuel).toBe(true);
    expect(r.values).toMatchObject({ energy: 'kwh', liters: 38.6, total: 22.77, date: '2024-03-12', station: 'IONITY' });
  });
  it('CSV has an energy column', () => {
    expect(parseCSV('vehicle,date,km,liters,total,full_tank,station,note,energy\nEV,2024-01-01,100,40,6,1,,,kwh\n')[1][8]).toBe('kwh');
  });
});
