<script setup>
// Cambios que chocan con otro móvil (store.js → S.conflicts). Se enseñan de uno en uno, con los campos que difieren
// lado a lado, y se elige con cuál quedarse.
import { computed, ref } from 'vue';
import { useDialog } from './dialog.js';
import { S, resolveConflict } from './store.js';
import { FORMS, optLabel, labelParams, fieldUnit } from './forms.js';
import { fmt } from './calc.js';
import { t } from './i18n/index.js';

const emit = defineEmits(['close']);
const c = computed(() => S.conflicts[0] || null);
const panel = ref(null);
useDialog(panel, () => emit('close'), { focusFirstField: false });

function show(f, v, rec) {
  const unit = fieldUnit(f, rec);
  if (v == null || v === '') return '—';
  if (f.type === 'date') return fmt.date(v);
  if (f.type === 'chips') return optLabel(f.options, v);
  if (f.type === 'check') return v ? t('common.yes') : t('common.no');
  if (f.type === 'num') {
    if (unit === 'km') return fmt.km(v);
    if (unit === 'L') return fmt.l(v);
    if (unit === 'kWh') return fmt.kwh(v);
    if (unit === '€') return fmt.money(v);
    if (unit === 'months') return v + ' ' + t('f.months');
    return fmt.num(v);
  }
  return String(v);
}
// Solo los campos que difieren (si se borró en el otro móvil, todos los del mío)
const rows = computed(() => {
  if (!c.value) return [];
  const { mine, theirs } = c.value;
  return FORMS[c.value.kind].fields
    .filter((f) => !theirs || String(mine[f.k] ?? '') !== String(theirs[f.k] ?? ''))
    .map((f) => ({ k: f.k, label: t(f.label, labelParams(mine)), mine: show(f, mine[f.k], mine), theirs: theirs ? show(f, theirs[f.k], theirs) : '' }));
});
const title = computed(() => (c.value ? c.value.mine.name || c.value.mine.title || fmt.date(c.value.mine.date) || '' : ''));

function pick(keepMine) {
  resolveConflict(c.value, keepMine);
  if (!S.conflicts.length) emit('close');
}
</script>

<template>
  <div class="sheet-bg" @click.self="emit('close')">
    <div v-if="c" ref="panel" class="sheet conflict" role="dialog" aria-modal="true" aria-labelledby="conflict-title" tabindex="-1">
      <h2 id="conflict-title">⚠ {{ c.theirs ? t('conflict.changed', { what: t('kinds.' + c.kind + '.one') }) : t('conflict.deleted', { what: t('kinds.' + c.kind + '.one') }) }}</h2>
      <p class="form-note full">
        <b>{{ title }}</b> · {{ t('conflict.explain') }}
        <span v-if="S.conflicts.length > 1"> · {{ t('conflict.count', { n: S.conflicts.length }) }}</span>
      </p>
      <table class="diff full">
        <thead><tr><th scope="col"></th><th scope="col">{{ t('conflict.mine') }}</th><th v-if="c.theirs" scope="col">{{ t('conflict.theirs') }}</th></tr></thead>
        <tbody>
          <tr v-for="r in rows" :key="r.k"><th scope="row">{{ r.label }}</th><td>{{ r.mine }}</td><td v-if="c.theirs">{{ r.theirs }}</td></tr>
        </tbody>
      </table>
      <div class="actions full conflict-actions">
        <button type="button" class="link" @click="pick(false)">{{ c.theirs ? t('conflict.keepTheirs') : t('conflict.keepDeleted') }}</button>
        <button type="button" class="primary" @click="pick(true)">{{ c.theirs ? t('conflict.keepMine') : t('conflict.restore') }}</button>
      </div>
    </div>
  </div>
</template>
