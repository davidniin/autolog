<script setup>
// Adjuntos de un gasto o vehículo: miniaturas (fotos) o icono (PDF). Tocar abre; × borra; 📎 sube (cámara o archivo).
import { ref, computed } from 'vue';
import { S, upload, delFile, fileUrl } from './store.js';
import { t, locale } from './i18n/index.js';

const props = defineProps({ vehicleId: String, kind: String, parentId: String });
const emit = defineEmits(['uploaded']);

const list = computed(() => S.files.filter((f) => f.parent_kind === props.kind && f.parent_id === props.parentId));
const busy = ref(0);
const err = ref('');

async function pick(ev) {
  const files = [...ev.target.files];
  ev.target.value = '';
  err.value = '';
  for (const f of files) {
    busy.value++;
    try {
      const rec = await upload(f, { vehicle_id: props.vehicleId, parent_kind: props.kind, parent_id: props.parentId });
      emit('uploaded', rec.id);
    } catch (e) {
      err.value = e.message;
    } finally { busy.value--; }
  }
}
function remove(f) { if (confirm(t('files.confirm', { name: f.name }))) delFile(f.id); }
const kb = (n) => (n > 1048576 ? (n / 1048576).toLocaleString(locale(), { maximumFractionDigits: 1 }) + ' MB' : Math.round(n / 1024) + ' KB');
</script>

<template>
  <div class="field full">
    {{ t('files.title') }}
    <div class="files">
      <div v-for="f in list" :key="f.id" class="file">
        <a :href="fileUrl(f.id)" target="_blank" rel="noopener" :title="f.name">
          <img v-if="f.mime.startsWith('image/')" :src="fileUrl(f.id)" :alt="f.name" loading="lazy" />
          <span v-else class="file-doc">📄<small>{{ f.name }}</small></span>
        </a>
        <small class="file-size">{{ kb(f.size) }}</small>
        <button type="button" class="file-del" :aria-label="t('files.deleteAria', { name: f.name })" @click="remove(f)">×</button>
      </div>
      <label class="file file-add" :class="{ busy }">
        <input type="file" accept="image/*,application/pdf" multiple @change="pick" :disabled="!!busy" />
        <span>{{ busy ? '⏳' : '📎' }}<small>{{ busy ? t('files.uploading') : t('files.add') }}</small></span>
      </label>
    </div>
    <p v-if="err" class="err">{{ err }}</p>
  </div>
</template>
