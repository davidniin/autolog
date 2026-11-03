// Builds the landing page into site/dist/ (run from web/: `npm run build:site`, which first builds the demo app
// into site/dist/demo). Copies the landing files and the README screenshots. Deployed by .github/workflows/pages.yml.
import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'dist');
await mkdir(out, { recursive: true });
for (const f of ['index.html', 'landing.css', 'landing.js']) await cp(join(here, f), join(out, f));
await cp(join(here, '..', 'docs', 'screenshots'), join(out, 'screenshots'), { recursive: true });
console.log('site → ' + out);
