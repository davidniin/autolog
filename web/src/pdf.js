// Facturas en PDF (pdf.js, Apache-2.0; se carga solo al usarlo). Se lee la primera página:
// - Si el PDF tiene texto (lo normal en facturas digitales): se devuelven las líneas con su posición, como las del OCR,
//   así receipt.js las analiza igual. Es exacto y no necesita descargar el modelo del OCR.
// - Si es un escaneo (sin texto): se dibuja la página en un canvas para pasarla por el OCR (ocr.js).
// isEvalSupported: false = sin eval() con PDFs de origen desconocido (recomendación de seguridad de pdf.js).

const MIN_CHARS = 20; // menos texto que esto = escaneo
const MAX_SIDE = 2000; // px al dibujarlo para el OCR

export async function readPdf(file) {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/build/pdf.min.mjs'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, enableXfa: false });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const vp = page.getViewport({ scale: 1 });
    const { items } = await page.getTextContent();
    // transform = [a, b, c, d, x, y] con y hacia arriba: se pasa a cajas con y hacia abajo, como las del OCR
    const lines = items
      .filter((i) => i.str && i.str.trim())
      .map((i) => {
        const [, , c, d, x, y] = i.transform;
        const h = Math.hypot(c, d) || i.height || 10;
        const top = vp.height - y - h;
        return { text: i.str, score: 1, box: { xmin: x, ymin: top, xmax: x + (i.width || 0), ymax: top + h } };
      });
    if (lines.reduce((n, l) => n + l.text.trim().length, 0) >= MIN_CHARS) {
      return { kind: 'text', ocr: { text: lines.map((l) => l.text).join('\n'), lines, confidence: 1 } };
    }
    const scale = Math.min(3, MAX_SIDE / Math.max(vp.width, vp.height));
    const view = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(view.width);
    canvas.height = Math.round(view.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport: view }).promise;
    return { kind: 'image', canvas };
  } finally {
    task.destroy(); // libera el documento y el worker (pdf.js 6: se destruye la tarea, no el documento)
  }
}
