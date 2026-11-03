// Export / import: CSV round-trip, duplicates skipped, other date formats and separators, backups.
import { describe, it, expect, beforeEach } from 'vitest';
import { S } from '../src/store.js';
import { fuelCSV, expensesCSV, parseCSV, planImport, planCounts, backupJSON } from '../src/dataio.js';

beforeEach(() => {
  S.vehicles = [{ id: 'v1', name: 'Golf' }, { id: 'v2', name: 'Vespa' }];
  S.fuel = [{ id: 'f1', vehicle_id: 'v1', date: '2024-01-10', km: 1000, liters: 40, total: 60, full_tank: true, station: 'Repsol, Centro', note: '' }];
  S.expenses = [{ id: 'e1', vehicle_id: 'v2', date: '2024-02-01', km: null, cat: 'seguro', title: 'Seguro "todo riesgo"', amount: 120, note: '' }];
  S.reminders = [];
  S.parts = [];
  S.queue = [];
});

describe('CSV', () => {
  it('exports with header, BOM and quoting, and parses it back', () => {
    const csv = fuelCSV();
    expect(csv.startsWith('\ufeffvehicle,date,km,liters,total,full_tank,station,note,energy')).toBe(true);
    const rows = parseCSV(csv);
    expect(rows[1]).toEqual(['Golf', '2024-01-10', '1000', '40', '60', '1', 'Repsol, Centro', '', 'fuel']);
    expect(parseCSV(expensesCSV())[1][4]).toBe('Seguro "todo riesgo"');
  });
  it('re-importing an export adds nothing', () => {
    expect(planImport('fuel.csv', fuelCSV(), 'v1').skipped).toBe(1);
    expect(planCounts(planImport('exp.csv', expensesCSV(), 'v1')).expenses).toBe(0);
  });
  it('imports new rows: semicolons, dd/mm/yyyy, decimal commas, vehicle by name or the current one', () => {
    const csv = 'date;km;liters;total;full_tank\n15/03/2024;1500;38,5;59,90;0\n16/03/2024;;10;15;1\n';
    const plan = planImport('x.csv', csv, 'v1');
    expect(plan.kind).toBe('fuel');
    expect(plan.add.fuel).toHaveLength(1);
    expect(plan.add.fuel[0]).toMatchObject({ vehicle_id: 'v1', date: '2024-03-15', km: 1500, liters: 38.5, total: 59.9, full_tank: false });
    expect(plan.invalid).toBe(1); // sin km
    const exp = planImport('e.csv', 'vehicle,date,category,title,amount\nVespa,2024-04-01,itv,ITV,40\nVespa,2024-04-02,zzz,Otro,5\n', 'v1');
    expect(exp.add.expenses.map((e) => [e.vehicle_id, e.cat])).toEqual([['v2', 'itv'], ['v2', 'otros']]);
  });
  it('rejects files it does not understand', () => {
    expect(() => planImport('x.csv', 'a,b\n1,2\n', 'v1')).toThrow('columns');
    expect(() => planImport('x.json', '{"foo":1}', 'v1')).toThrow('backup');
  });
});

describe('backup', () => {
  it('a backup of the same data adds nothing; into an empty app it adds everything', () => {
    const json = backupJSON();
    expect(planCounts(planImport('b.json', json))).toEqual({ vehicles: 0, fuel: 0, expenses: 0, reminders: 0, parts: 0 });
    S.vehicles = []; S.fuel = []; S.expenses = [];
    expect(planCounts(planImport('b.json', json))).toEqual({ vehicles: 2, fuel: 1, expenses: 1, reminders: 0, parts: 0 });
  });
});
