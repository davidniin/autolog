<script setup>
// Neumáticos y piezas del vehículo: las montadas con su desgaste (km y meses frente a su vida esperada) y, plegado,
// el historial de las que se cambiaron con lo que duraron. "Cambiada" la retira y ofrece montar la nueva.
import { computed } from 'vue';
import { S } from './store.js';
import { partState, fmt } from './calc.js';
import { optEmoji, optText } from './forms.js';
import { t } from './i18n/index.js';

const props = defineProps({ vehicleId: String, km: Number });
const emit = defineEmits(['edit', 'add', 'off']);

const mine = computed(() => S.parts.filter((p) => p.vehicle_id === props.vehicleId));
const active = computed(() => mine.value.filter((p) => !p.removed_date)
  .map((p) => ({ p, st: partState(p, props.km) }))
  .sort((a, b) => (b.st.pct ?? -1) - (a.st.pct ?? -1)));
const history = computed(() => mine.value.filter((p) => p.removed_date)
  .map((p) => ({ p, st: partState(p, props.km) }))
  .sort((a, b) => b.p.removed_date.localeCompare(a.p.removed_date)));

const months = (m) => Math.round(m);
const pct = (st) => (st.pct == null ? null : Math.round(st.pct * 100));
const usage = (p, st) => [
  st.km != null ? (p.life_km ? t('parts.kmOf', { km: fmt.km(st.km), life: fmt.km(p.life_km) }) : fmt.km(st.km)) : '',
  p.life_months ? t('parts.monthsOf', { m: months(st.months), life: p.life_months }) : t('parts.months', { m: months(st.months) }),
].filter(Boolean).join(' · ');
const title = (p) => [p.name || optText('part', p.kind), p.position].filter(Boolean).join(' · ');
</script>

<template>
  <div>
    <h2 class="sec h-row">{{ t('parts.heading') }} <button class="link" @click="emit('add', 'parts')">{{ t('rem.add') }}</button></h2>
    <button v-if="!active.length" class="item hint-card" @click="emit('add', 'parts')">
      <span class="item-icon">🛞</span>
      <span class="item-body">{{ t('parts.emptyTitle') }}<small>{{ t('parts.emptySub') }}</small></span>
    </button>
    <div v-for="{ p, st } in active" :key="p.id" class="item part" :class="st.level" @click="emit('edit', 'parts', p)">
      <span class="item-icon" aria-hidden="true">{{ optEmoji('part', p.kind) }}</span>
      <span class="item-body">
        {{ title(p) }}
        <small>{{ usage(p, st) }}</small>
        <span v-if="pct(st) != null" class="wear" role="progressbar" :aria-valuenow="Math.min(pct(st), 100)" aria-valuemin="0" aria-valuemax="100"
          :aria-label="t('parts.wear', { p: pct(st) })"><i :style="{ width: Math.min(pct(st), 100) + '%' }"></i></span>
      </span>
      <span class="part-end">
        <b v-if="pct(st) != null" class="lvl">{{ pct(st) }} %</b>
        <button class="done-btn" @click.stop="emit('off', p)">{{ t('parts.replaced') }}</button>
      </span>
    </div>
    <details v-if="history.length" class="part-history">
      <summary>{{ t('parts.history', { n: history.length }) }}</summary>
      <button v-for="{ p, st } in history" :key="p.id" class="item" @click="emit('edit', 'parts', p)">
        <span class="item-icon" aria-hidden="true">{{ optEmoji('part', p.kind) }}</span>
        <span class="item-body">{{ title(p) }}
          <small>{{ fmt.date(p.installed_date) }} → {{ fmt.date(p.removed_date) }} · {{ t('parts.lasted', { what: usage({ ...p, life_km: null, life_months: null }, st) }) }}</small>
        </span>
      </button>
    </details>
  </div>
</template>
