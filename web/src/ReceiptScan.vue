<script setup>
// Escanear una factura o un ticket: foto (cámara o galería) → OCR en el móvil (ocr.js) → datos (receipt.js).
// Emite 'result' con lo encontrado para rellenar el formulario y sube la foto como adjunto del registro.
// Si en un gasto la foto parece un ticket de gasolinera, ofrece apuntarlo como repostaje ('switch').
import { ref, onMounted } from 'vue';
import { OCRS, readImage, modelReady } from './ocr.js';
import { parseReceipt } from './receipt.js';
import { upload } from './store.js';
import { t } from './i18n/index.js';

const props = defineProps({
  kind: String, // 'expenses' | 'fuel'
  vehicleId: String,
  parentId: String,
  plate: String, // matrícula del vehículo, para avisar si la factura es de otro
  pendingFile: Object, // foto que viene de otra ficha (gasto → repostaje): solo se adjunta
});
const emit = defineEmits(['result', 'uploaded', 'switch']);

const ready = ref(true);
const err = ref('');
const res = ref(null); // resultado de parseReceipt
const attached = ref('');
let lastFile = null;


onMounted(async () => {
  ready.value = await modelReady();
  if (props.pendingFile) attach(props.pendingFile);
});

async function attach(file) {
  attached.value = t('scan.saving');
  try {
    const rec = await upload(file, { vehicle_id: props.vehicleId, parent_kind: props.kind, parent_id: props.parentId });
    emit('uploaded', rec.id);
    attached.value = t('scan.saved');
  } catch (e) {
    attached.value = t('scan.saveFailed', { msg: e.message });
  }
}

async function pick(ev) {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  err.value = '';
  res.value = null;
  attached.value = '';
  lastFile = file;
  try {
    const ocr = await readImage(file);
    ready.value = true;
    const r = parseReceipt(ocr, { plate: props.plate });
    res.value = r;
    // Ticket de gasolinera en un gasto: mejor como repostaje (se adjunta allí)
    if (r.fuel && props.kind === 'expenses' && (r.values.liters || r.values.total)) return;
    emit('result', r);
    attach(file);
  } catch (e) {
    err.value = e.message;
  }
}

function toFuel() {
  emit('switch', 'fuel', { values: res.value.values, file: lastFile });
}
function keepExpense() {
  const r = res.value;
  const v = { ...r.values };
  if (v.total != null) v.amount = v.total;
  emit('result', { ...r, values: v, found: Object.keys(v) });
  r.fuel = false;
  attach(lastFile);
}
const foundText = (r) => [...new Set(r.found.map((k) => t('scan.names.' + k)).filter((n) => !n.startsWith('scan.')))].join(', ');
</script>

<template>
  <div class="scan full">
    <label class="scan-btn" :class="{ busy: OCRS.busy }">
      <input type="file" accept="image/*" :disabled="OCRS.busy" @change="pick" />
      <span class="scan-ico">{{ OCRS.busy ? '⏳' : '📷' }}</span>
      <span class="scan-txt">
        <b>{{ OCRS.busy ? (OCRS.phase === 'download' ? t('scan.downloading', { p: OCRS.progress }) : t('scan.reading')) : kind === 'fuel' ? t('scan.ticket') : t('scan.invoice') }}</b>
        <small v-if="OCRS.busy && OCRS.phase === 'download'">{{ t('scan.firstTimeOnly') }}</small>
        <small v-else-if="OCRS.busy">{{ t('scan.mayTake') }}</small>
        <small v-else-if="!ready">{{ t('scan.firstDownload') }}</small>
        <small v-else>{{ kind === 'fuel' ? t('scan.fillsFuel') : t('scan.fillsExpense') }}</small>
      </span>
    </label>
    <div v-if="OCRS.busy && OCRS.phase === 'download'" class="scan-bar"><i :style="{ width: OCRS.progress + '%' }"></i></div>

    <p v-if="err" class="err">{{ err }}</p>
    <small v-if="attached && !res" class="scan-note">{{ attached }}</small>

    <div v-if="res" class="scan-res">
      <template v-if="res.fuel && kind === 'expenses'">
        <p>{{ t('scan.looksFuel') }}</p>
        <span class="scan-acts">
          <button type="button" class="link" @click="keepExpense">{{ t('scan.keepExpense') }}</button>
          <button type="button" class="primary small" @click="toFuel">{{ t('scan.toFuel') }}</button>
        </span>
      </template>
      <template v-else>
        <p v-if="res.found.length" v-html="t('scan.filled', { fields: foundText(res) })"></p>
        <p v-for="w in res.warnings" :key="w" class="scan-warn">⚠ {{ w }}</p>
        <small v-if="attached">{{ attached }}</small>
      </template>
      <details>
        <summary>{{ t('scan.showText') }}</summary>
        <pre>{{ res.rows.join('\n') }}</pre>
      </details>
    </div>
  </div>
</template>
