<script setup>
// Gastos del vehículo (revisiones, reparaciones, seguro...) con filtro por categoría.
import { ref, computed } from 'vue';
import { fmt, sum } from './calc.js';
import { OPTIONS, optLabel, optText, optEmoji } from './forms.js';
import { t } from './i18n/index.js';
import { S } from './store.js';

const props = defineProps({ exps: Array });
const emit = defineEmits(['edit']);

const cat = ref('');
const clips = computed(() => {
  const n = {};
  for (const f of S.files) if (f.parent_kind === 'expenses') n[f.parent_id] = (n[f.parent_id] || 0) + 1;
  return n;
});
const used = computed(() => OPTIONS.cat.filter(([c]) => props.exps.some((e) => e.cat === c)).map(([c]) => [c, optLabel('cat', c)]));
const rows = computed(() =>
  props.exps.filter((e) => !cat.value || e.cat === cat.value).sort((a, b) => b.date.localeCompare(a.date)),
);
</script>

<template>
  <div>
    <nav v-if="used.length > 1" class="tabs filter">
      <button :class="{ on: !cat }" @click="cat = ''">{{ t('expList.all') }}</button>
      <button v-for="[c, l] in used" :key="c" :class="{ on: cat === c }" @click="cat = c">{{ l }}</button>
    </nav>
    <p class="totals" v-if="rows.length">{{ t('expList.totals', { n: rows.length }) }} · <b>{{ fmt.eur(sum(rows, 'amount')) }}</b></p>
    <div v-else class="empty"><div class="empty-icon">🧾</div><p>{{ t('expList.empty') }}</p></div>
    <button v-for="e in rows" :key="e.id" class="item" @click="emit('edit', 'expenses', e)">
      <span class="item-icon">{{ optEmoji('cat', e.cat) }}</span>
      <span class="item-body">
        {{ e.title || optText('cat', e.cat) }}<span v-if="clips[e.id]" class="clip" :title="t('fuelList.clips', { n: clips[e.id] })"> 📎{{ clips[e.id] > 1 ? clips[e.id] : '' }}</span>
        <small>{{ [fmt.date(e.date), e.km ? fmt.km(e.km) : '', e.title ? optText('cat', e.cat) : ''].filter(Boolean).join(' · ') }}</small>
      </span>
      <b>{{ fmt.eur(e.amount) }}</b>
    </button>
  </div>
</template>
