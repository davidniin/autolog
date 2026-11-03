// Invoice / fuel-ticket parser. To add support for a new invoice layout or country, add a case here first.
import { describe, it, expect } from 'vitest';
import { parseReceipt, moneyIn, datesIn, rowsOf } from '../src/receipt.js';

const WORKSHOP = `TALLERES EJEMPLO S.L.
CIF B00000000 Tel. 900 000 000
C/ Mayor 1, 28001 Madrid
FACTURA Nº F2024-0457    Fecha: 14/10/2024
Cliente: Demo   Matrícula: 1234 KLM   Km: 86.120
Aceite motor 5W30 4,5 L      4,5   9,90   44,55
Filtro de aceite             1    12,40   12,40
Filtro de aire               1    18,00   18,00
Mano de obra                 1,0  45,00   45,00
BASE IMPONIBLE 119,95
IVA 21% 25,19
TOTAL FACTURA 145,14 €`;

const FUEL = `REPSOL
E.S. EJEMPLO
FACTURA SIMPLIFICADA T-889231
FECHA 02.11.24 HORA 18:22
SURTIDOR 4 SIN PLOMO 95
LITROS 41,23
PRECIO €/L 1,549
TOTAL 63,87 EUR
IVA 21% INCLUIDO 11,08`;

describe('number and date helpers', () => {
  it('reads Spanish money formats', () => {
    expect(moneyIn('1.234,56 € y 99,90 y 12.50')).toEqual([1234.56, 99.9, 12.5]);
    expect(moneyIn('1,549 €/L')).toEqual([]); // 3 decimals: price per litre, not money
  });
  it('reads dates and drops future ones', () => {
    expect(datesIn('Fecha: 14/10/2024')).toEqual(['2024-10-14']);
    expect(datesIn('5 de marzo de 2024')).toEqual(['2024-03-05']);
    expect(datesIn('02.11.24')).toEqual(['2024-11-02']);
    expect(datesIn('31/02/2024')).toEqual([]); // not a real date
    expect(datesIn('01/01/2999')).toEqual([]);
  });
  it('joins OCR boxes on the same row', () => {
    const L = (text, x, y) => ({ text, box: { xmin: x, ymin: y, xmax: x + 100, ymax: y + 20 } });
    expect(rowsOf({ lines: [L('121,00 €', 300, 203), L('TOTAL', 0, 200), L('Fecha', 0, 40)] })).toEqual(['Fecha', 'TOTAL 121,00 €']);
  });
});

describe('workshop invoice', () => {
  const r = parseReceipt({ text: WORKSHOP }, { plate: '1234 KLM' });
  it('finds the total, not the tax base', () => expect(r.values.amount).toBe(145.14));
  it('finds date and mileage (not the plate digits)', () => {
    expect(r.values.date).toBe('2024-10-14');
    expect(r.values.km).toBe(86120);
  });
  it('guesses category and title', () => {
    expect(r.values.cat).toBe('revision');
    expect(r.values.title).toBe('Aceite, filtro de aceite y filtro de aire');
    expect(r.values.note).toBe('TALLERES EJEMPLO S.L. · Factura F2024-0457');
  });
  it('is not a fuel ticket and the plate matches', () => {
    expect(r.fuel).toBe(false);
    expect(r.warnings).toEqual([]);
  });
  it('warns when the plate belongs to another vehicle', () => {
    expect(parseReceipt({ text: WORKSHOP }, { plate: '9999 BBB' }).warnings[0]).toMatch(/1234 KLM/);
  });
});

describe('fuel ticket', () => {
  const r = parseReceipt({ text: FUEL });
  it('detects fuel and reads litres, total, date and station', () => {
    expect(r.fuel).toBe(true);
    expect(r.values).toMatchObject({ liters: 41.23, total: 63.87, date: '2024-11-02', station: 'REPSOL' });
  });
  it('computes litres from €/L when missing', () => {
    const r2 = parseReceipt({ text: FUEL.replace('LITROS 41,23\n', '') });
    expect(r2.values.liters).toBeCloseTo(41.23, 1);
  });
});

describe('other documents', () => {
  it('ITV ignores the next-inspection date', () => {
    const r = parseReceipt({ text: 'ITV Ejemplo S.A.\nFecha 5 de marzo de 2024\nPróxima inspección: 05/03/2025\nImporte total 42,80 €' });
    expect(r.values).toMatchObject({ cat: 'itv', amount: 42.8, date: '2024-03-05', title: 'ITV' });
  });
  it('insurance', () => {
    const r = parseReceipt({ text: 'ASEGURADORA EJEMPLO\nRecibo póliza 0012345\nFecha emisión: 01/08/2024\nPrima total a pagar 420,00 €' });
    expect(r.values).toMatchObject({ cat: 'seguro', amount: 420, date: '2024-08-01' });
  });
  it('says so when nothing is found', () => {
    expect(parseReceipt({ text: '' }).warnings[0]).toMatch(/No he encontrado/);
  });
});
