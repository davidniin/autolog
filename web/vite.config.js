import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// El lector de facturas (runonweb/ocr) carga el motor WASM de onnxruntime desde jsdelivr (versión fija; sw.js lo
// guarda para usarlo sin red). Vite copiaría además una copia de ~28 MB a dist/ que nadie pide: se quita.
const dropUnusedWasm = {
  name: 'drop-unused-ort-wasm',
  generateBundle(_, bundle) {
    for (const k of Object.keys(bundle)) if (/ort-wasm.*\.wasm$/.test(k)) delete bundle[k];
  },
};

// En desarrollo, /v1 va al servidor local (cd server && npm run dev)
export default defineConfig({
  plugins: [vue(), dropUnusedWasm],
  server: { proxy: { '/v1': 'http://localhost:8791' } },
});
