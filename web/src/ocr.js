// Lector de texto de fotos (OCR) en el propio móvil con runonweb (PP-OCRv6 de PaddleOCR, WebGPU o WASM).
// La foto no sale del móvil: solo se descarga, la primera vez, el modelo (~31 MB, que queda en la caché del
// navegador) y el motor onnxruntime (lo guarda sw.js). Después funciona sin cobertura.
// La librería se carga al usarla por primera vez (import dinámico), así que no pesa al abrir la app.
import { reactive } from 'vue';
import { t } from './i18n/index.js';

const MODEL_CACHE = 'runonweb-ppocrv6'; // el de runonweb/src/core/cache.ts
const MAX_SIDE = 2000; // px: más no mejora la lectura y tarda más

export const OCRS = reactive({
  busy: false,
  phase: '', // 'download' | 'read' | ''
  progress: 0, // % de la descarga del modelo
  device: '', // 'webgpu' | 'wasm'
});

let ocr = null;

// ¿Ya está descargado el modelo? (para avisar de la descarga antes de la primera vez)
export async function modelReady() {
  try { return typeof caches !== 'undefined' && (await caches.open(MODEL_CACHE).then((c) => c.keys())).length >= 3; } catch (e) { return false; }
}

async function engine() {
  if (ocr) return ocr;
  const { OCR } = await import('runonweb/ocr');
  ocr = new OCR({
    size: 'small', // tiny solo lee chino e inglés; small ya incluye el español
    onProgress: (i) => {
      if (i.status === 'progress' && i.progress != null) { OCRS.phase = 'download'; OCRS.progress = Math.round(i.progress); }
      if (i.status === 'recognizing') OCRS.phase = 'read';
    },
  });
  try {
    await ocr.load();
  } catch (e) {
    ocr = null;
    throw new Error(navigator.onLine ? t('ocr.loadFailed', { msg: e.message }) : t('ocr.needsNet'));
  }
  OCRS.device = ocr.device || '';
  return ocr;
}

// Reduce la foto (las del móvil tienen 12 MP o más) antes de leerla
async function prepare(file) {
  const img = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  img.close();
  return c;
}

// file = foto (File/Blob) o un canvas ya dibujado (página de un PDF escaneado, ver pdf.js)
// → { text, lines: [{ text, score, box }], confidence }
export async function readImage(file) {
  if (OCRS.busy) throw new Error(t('ocr.busy'));
  OCRS.busy = true;
  OCRS.phase = 'read';
  OCRS.progress = 0;
  try {
    let canvas;
    if (typeof HTMLCanvasElement !== 'undefined' && file instanceof HTMLCanvasElement) canvas = file;
    else try { canvas = await prepare(file); } catch (e) { throw new Error(t('ocr.badImage')); }
    const o = await engine();
    OCRS.phase = 'read';
    return await o.read(canvas);
  } finally {
    OCRS.busy = false;
    OCRS.phase = '';
  }
}
