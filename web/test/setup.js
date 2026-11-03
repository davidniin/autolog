// Los tests comparan textos en español y unidades métricas en euros, salvo que digan lo contrario.
// Se fija aquí, y no según el idioma del sistema, para que pasen igual en cualquier máquina (la CI está en inglés).
// Se aplica al cargar (por los cálculos que hace un fichero al importarse) y antes de cada test (por si uno cambia).
import { beforeEach } from 'vitest';
import { setLang } from '../src/i18n/index.js';
import { applyPrefs } from '../src/units.js';

function reset() {
  setLang('es');
  applyPrefs({ distance: 'km', volume: 'l', consumption: 'l100', currency: 'EUR' });
}
reset();
beforeEach(reset);
