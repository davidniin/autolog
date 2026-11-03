import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

// El lector de facturas (runonweb/ocr) carga el motor WASM de onnxruntime desde jsdelivr (versión fija; sw.js lo
// guarda para usarlo sin red). Vite copiaría además una copia de ~28 MB a dist/ que nadie pide: se quita.
const dropUnusedWasm = {
  name: 'drop-unused-ort-wasm',
  generateBundle(_, bundle) {
    for (const k of Object.keys(bundle)) if (/ort-wasm.*\.wasm$/.test(k)) delete bundle[k];
  },
};

// Build "solo demo" para la landing (npm run build:site): sin manifest, para que no se ofrezca instalar la demo
const demoHtml = (mode) => ({
  name: 'demo-html',
  transformIndexHtml: (html) => (mode === 'demo' ? html.replace(/\s*<link rel="manifest"[^>]*>/, '') : html),
});

// En desarrollo, /v1 va al servidor local (cd server && npm run dev)
export default defineConfig(({ mode }) => ({
  plugins: [vue(), dropUnusedWasm, demoHtml(mode)],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { proxy: { '/v1': 'http://localhost:8791' } },
  test: { setupFiles: ['test/setup.js'] },
}));
