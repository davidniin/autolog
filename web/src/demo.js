// Datos inventados para el modo demo (/?demo=1): capturas de pantalla y probar la app sin servidor.
// Las fechas son relativas a hoy para que la demo parezca siempre actual. Los textos, en el idioma de la app.
// Nada de esto es real.
import { addMonths, today } from './calc.js';
import { t } from './i18n/index.js';

const ago = (days) => new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);

export function demoData() {
  const v1 = 'demo-car', v2 = 'demo-moto';
  // ~1 repostaje cada 3 semanas durante un año, ~6,5 L/100 km
  const fuel = [];
  let km = 61200;
  for (let i = 17; i >= 0; i--) {
    const dist = 560 + ((i * 37) % 160);
    km += dist;
    const liters = Math.round(dist * (0.061 + ((i * 7) % 9) / 1000) * 100) / 100;
    const ppl = 1.55 + ((i * 13) % 17) / 100 - 0.08;
    fuel.push({ id: 'df' + i, vehicle_id: v1, date: ago(i * 21 + 2), km, liters, total: Math.round(liters * ppl * 100) / 100, full_tank: i % 5 !== 3, station: [t('demo.station1'), t('demo.station2'), ''][i % 3], note: '' });
  }
  const expenses = [
    { id: 'de1', vehicle_id: v1, date: ago(40), km: km - 1200, cat: 'revision', title: t('demo.service'), amount: 145.14, note: t('demo.workshop') },
    { id: 'de2', vehicle_id: v1, date: ago(120), km: null, cat: 'seguro', title: t('demo.insurance'), amount: 412, note: '' },
    { id: 'de3', vehicle_id: v1, date: ago(150), km: null, cat: 'impuestos', title: t('demo.tax'), amount: 68.4, note: '' },
    { id: 'de4', vehicle_id: v1, date: ago(210), km: km - 5200, cat: 'reparacion', title: t('demo.pads'), amount: 189.9, note: '' },
    { id: 'de5', vehicle_id: v1, date: ago(9), km: null, cat: 'aparcamiento', title: t('demo.parking'), amount: 36, note: '' },
    { id: 'de6', vehicle_id: v1, date: ago(300), km: km - 8000, cat: 'itv', title: t('demo.itv'), amount: 42.8, note: '' },
  ];
  const reminders = [
    { id: 'dr1', vehicle_id: v1, title: t('demo.remItv'), cat: 'itv', every_km: null, every_months: 12, due_date: addMonths(ago(300), 12), due_km: null, note: '' },
    { id: 'dr2', vehicle_id: v1, title: t('demo.remOil'), cat: 'revision', every_km: 15000, every_months: 12, due_date: addMonths(ago(40), 12), due_km: km - 1200 + 15000, note: '' },
    { id: 'dr3', vehicle_id: v1, title: t('demo.remInsurance'), cat: 'seguro', every_km: null, every_months: 12, due_date: addMonths(ago(120), 12), due_km: null, note: '' },
  ];
  return {
    vehicles: [
      { id: v1, name: t('demo.car'), kind: 'coche', plate: '0000 XYZ', fuel_type: 'gasolina', start_km: 61200, purchase_price: 16500, purchase_date: addMonths(today(), -30), note: '' },
      { id: v2, name: t('demo.moto'), kind: 'moto', plate: '', fuel_type: 'gasolina', start_km: 8200, purchase_price: null, purchase_date: null, note: '' },
    ],
    fuel, expenses, reminders, files: [], queue: [], current: v1,
  };
}
