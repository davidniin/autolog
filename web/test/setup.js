// Los tests comparan textos en español y unidades métricas en euros, salvo que digan lo contrario
import { beforeEach } from 'vitest';
import { setLang } from '../src/i18n/index.js';
import { applyPrefs } from '../src/units.js';

beforeEach(() => {
  setLang('es');
  applyPrefs({ distance: 'km', volume: 'l', consumption: 'l100', currency: 'EUR' });
});
