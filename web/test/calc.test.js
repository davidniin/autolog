// Fuel consumption (full-to-full method), reminders and dates
import { describe, it, expect } from 'vitest';
import { fuelStats, addMonths, nextDue, num } from '../src/calc.js';

describe('fuelStats (full to full)', () => {
  it('includes partial fills between two full tanks', () => {
    const s = fuelStats([
      { id: 'a', date: '2024-01-01', km: 1000, liters: 40, total: 60, full_tank: true },
      { id: 'b', date: '2024-01-10', km: 1300, liters: 10, total: 15, full_tank: false },
      { id: 'c', date: '2024-01-20', km: 1600, liters: 26, total: 39, full_tank: true },
    ]);
    expect(s.per.c).toBeCloseTo(6, 5); // (10 + 26) L / 600 km
    expect(s.avg).toBeCloseTo(6, 5);
    expect(s.spent).toBe(114);
  });
  it('has no consumption with a single full tank', () => {
    expect(fuelStats([{ id: 'a', date: '2024-01-01', km: 1000, liters: 40, total: 60, full_tank: true }]).avg).toBeNull();
  });
});

describe('dates and reminders', () => {
  it('addMonths clamps to the end of the month', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2023-01-31', 1)).toBe('2023-02-28');
  });
  it('nextDue from the done date and km', () => {
    expect(nextDue({ every_km: 15000, every_months: 12 }, '2024-05-01', 80000)).toEqual({ due_date: '2025-05-01', due_km: 95000 });
    expect(nextDue({ every_km: null, every_months: null }, '2024-05-01', 1)).toBeNull();
  });
  it('num accepts a decimal comma', () => {
    expect(num('42,5')).toBe(42.5);
    expect(num('')).toBeNull();
    expect(num('abc')).toBeNaN();
  });
});
