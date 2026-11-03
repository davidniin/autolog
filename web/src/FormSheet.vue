<script setup>
// Ficha inferior genérica: pinta los campos de FORMS[kind], los valida (validate.js) y devuelve el registro limpio.
// Los errores de cada campo aparecen al salir de él o al pulsar Guardar; al guardar se salta al primer campo con error.
import { reactive, ref, computed, nextTick } from 'vue';
import { FORMS, OPTIONS, optLabel, unitLabel, labelParams, preset } from './forms.js';
import { toDisplay } from './units.js';
import { today, numInput } from './calc.js';
import { t } from './i18n/index.js';
import { validate, sanitizeNum } from './validate.js';
import { delFile } from './store.js';
import Attachments from './Attachments.vue';
import ReceiptScan from './ReceiptScan.vue';

const props = defineProps({
  kind: String,
  value: Object, // registro a editar (o uno en blanco)
  isNew: Boolean,
  ctx: { type: Object, default: () => ({ others: [], km: 0 }) }, // ver forms.js
  heading: String, // título en lugar de "Nuevo/Editar ..."
  plate: String, // matrícula del vehículo (para el escáner)
  prefill: Object, // { values, file }: datos escaneados en otra ficha (gasto → repostaje)
});
const emit = defineEmits(['save', 'delete', 'close', 'switch']);

const form = FORMS[props.kind];
const m = reactive({});
const touched = reactive({});
const auto = reactive({}); // campos rellenados por el escáner (se marcan hasta que se tocan)
const submitted = ref(false);
fill(props.value);
const orig = { ...m }; // valores iniciales: el escáner puede sustituirlos (p. ej. la fecha de hoy)
if (props.prefill) applyScan({ values: props.prefill.values });

// Valor guardado (km, litros) → texto del campo en las unidades elegidas, redondeado como se escribe
function show(f, v) {
  const d = toDisplay(f.unit, Number(v));
  const dec = f.int ? 0 : f.dec ?? 3;
  return numInput(Math.round(d * 10 ** dec) / 10 ** dec);
}

// Plantillas (p. ej. "Aceite cada 15.000 km"): rellenan el formulario
function fill(v) {
  Object.assign(m, v);
  for (const f of form.fields) if (f.type === 'num' && v[f.k] != null) m[f.k] = show(f, v[f.k]);
  for (const k in touched) delete touched[k];
  submitted.value = false;
}

// Datos de la factura: rellenan los campos vacíos o que siguen con su valor inicial; lo que ya se ha escrito no se pisa
function applyScan({ values }) {
  for (const f of form.fields) {
    const v = values[f.k];
    if (v == null || v === '') continue;
    const cur = m[f.k];
    if (!(cur == null || cur === '' || cur === orig[f.k] || auto[f.k])) continue;
    m[f.k] = f.type === 'num' ? show(f, v) : v;
    auto[f.k] = true;
    touched[f.k] = true;
  }
}

const result = computed(() => validate(form, m, props.ctx));
const errOf = (k) => (touched[k] || submitted.value ? result.value.errs[k] || '' : '');
const hint = computed(() => (form.hint ? form.hint(m) : ''));
const presets = computed(() => (form.presets || []).map(preset));
const chips = (f) => OPTIONS[f.options].map(([v]) => [v, optLabel(f.options, v)]);
const dateAttr = (d) => (d === 'today' ? today() : d);

function onInput(f, ev) {
  let s = ev.target.value;
  if (f.type === 'num') {
    const clean = sanitizeNum(s, f.int);
    if (clean !== s) ev.target.value = s = clean;
  }
  m[f.k] = s;
  delete auto[f.k];
}
function pickChip(f, v) {
  m[f.k] = v;
  delete auto[f.k];
}

async function submit() {
  submitted.value = true;
  const { r, errs, general } = result.value;
  const bad = form.fields.find((f) => errs[f.k]);
  if (bad) {
    await nextTick();
    const el = document.getElementById('f-' + bad.k);
    if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    return;
  }
  if (general) return;
  emit('save', r);
}

// Adjuntos subidos en esta ficha: si era nueva y se cancela, se borran (no quedan huérfanos)
const uploaded = [];
function close() {
  if (props.isNew) uploaded.forEach(delFile);
  emit('close');
}
// Gasto escaneado que resulta ser un ticket de gasolinera: se cierra esta ficha y se abre la de repostaje
function switchTo(kind, data) {
  if (props.isNew) uploaded.forEach(delFile);
  emit('switch', kind, data);
}

function remove() {
  if (confirm(t('kinds.' + props.kind + '.confirm'))) emit('delete');
}
</script>

<template>
  <div class="sheet-bg" @click.self="close">
    <form class="sheet" @submit.prevent="submit" novalidate>
      <h2>{{ heading || t('kinds.' + kind + (isNew ? '.new' : '.edit')) }}</h2>
      <div v-if="isNew && presets.length" class="chips presets full">
        <button v-for="[l, v] in presets" :key="l" type="button" @click="fill(v)">{{ l }}</button>
      </div>
      <ReceiptScan
        v-if="form.scan"
        :kind="kind" :vehicle-id="m.vehicle_id" :parent-id="m.id" :plate="plate" :pending-file="prefill && prefill.file"
        @result="applyScan" @uploaded="(id) => uploaded.push(id)" @switch="switchTo"
      />
      <template v-for="f in form.fields" :key="f.k">
        <div v-if="f.type === 'chips'" class="field full" :class="{ auto: auto[f.k] }" role="group" :aria-label="t(f.label)">
          <span class="lbl">{{ t(f.label, labelParams()) }}<em v-if="auto[f.k]" class="auto-tag">{{ t('f.autoTag') }}</em></span>
          <div class="chips">
            <button v-for="[v, l] in chips(f)" :key="v" type="button" :class="{ on: m[f.k] === v }" :aria-pressed="m[f.k] === v" @click="pickChip(f, v)">{{ l }}</button>
          </div>
        </div>
        <label v-else-if="f.type === 'check'" class="check full">
          <input type="checkbox" v-model="m[f.k]" /> {{ t(f.label, labelParams()) }}
        </label>
        <div v-else class="field" :class="[f.half ? 'half' : 'full', { bad: errOf(f.k), auto: auto[f.k] && !errOf(f.k) }]">
          <label class="lbl" :for="'f-' + f.k">{{ t(f.label, labelParams()) }}<i v-if="f.req" class="req" aria-hidden="true"> *</i><em v-if="auto[f.k]" class="auto-tag">{{ t('f.autoTag') }}</em></label>
          <span class="inp">
            <input
              :id="'f-' + f.k"
              :value="m[f.k] ?? ''"
              :type="f.type === 'num' ? 'text' : f.type"
              :inputmode="f.type === 'num' ? (f.int ? 'numeric' : 'decimal') : undefined"
              :placeholder="f.ph && f.ph.startsWith('f.') ? t(f.ph) : f.ph"
              :maxlength="f.len"
              :min="f.type === 'date' ? dateAttr(f.min) : undefined"
              :max="f.type === 'date' ? dateAttr(f.max) : undefined"
              :autocapitalize="f.upper ? 'characters' : undefined"
              :required="f.req"
              :aria-invalid="!!errOf(f.k)"
              :aria-describedby="errOf(f.k) ? 'e-' + f.k : undefined"
              autocomplete="off"
              @input="onInput(f, $event)"
              @blur="touched[f.k] = true"
            />
            <span v-if="f.unit" class="unit" aria-hidden="true">{{ unitLabel(f.unit) }}</span>
          </span>
          <small v-if="errOf(f.k)" :id="'e-' + f.k" class="field-err" role="alert">{{ errOf(f.k) }}</small>
        </div>
      </template>
      <template v-if="form.files">
        <Attachments
          v-if="!(isNew && kind === 'vehicles')"
          :vehicle-id="kind === 'vehicles' ? m.id : m.vehicle_id" :kind="kind" :parent-id="m.id"
          @uploaded="(id) => uploaded.push(id)"
        />
        <p v-else class="form-note full">{{ t('f.attachLater') }}</p>
      </template>
      <p v-if="form.note" class="form-note full">{{ t(form.note) }}</p>
      <p v-if="hint" class="hint full">{{ hint }}</p>
      <p v-if="submitted && result.general" class="err full" role="alert">{{ result.general }}</p>
      <div class="actions full">
        <button v-if="!isNew && kind !== 'done'" type="button" class="link danger" @click="remove">{{ t('common.delete') }}</button>
        <button type="button" class="link" @click="close">{{ t('common.cancel') }}</button>
        <button class="primary">{{ t('common.save') }}</button>
      </div>
    </form>
  </div>
</template>
