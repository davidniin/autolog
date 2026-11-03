// Los tests comparan textos en español salvo que digan lo contrario (i18n.test.js cambia de idioma)
import { beforeEach } from 'vitest';
import { setLang } from '../src/i18n/index.js';

beforeEach(() => setLang('es'));
