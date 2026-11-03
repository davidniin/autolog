<script setup>
// Repostajes del vehículo, del más reciente al más antiguo, con el consumo de cada tramo lleno a lleno.
import { computed } from 'vue';
import { fmt } from './calc.js';
import { S } from './store.js';
import { t } from './i18n/index.js';

const props = defineProps({ fills: Array, stats: Object });
const emit = defineEmits(['edit']);

const clips = computed(() => {
  const n = {};
  for (const f of S.files) if (f.parent_kind === 'fuel') n[f.parent_id] = (n[f.parent_id] || 0) + 1;
  return n;
});
const rows = computed(() => [...props.fills].sort((a, b) => b.date.localeCompare(a.date) || b.km - a.km));
</script>

<template>
  <div>
    <p class="totals" v-if="rows.length">
      {{ t('fuelList.totals', { n: rows.length }) }} · {{ fmt.l(stats.liters) }} · <b>{{ fmt.eur(stats.spent) }}</b>
    </p>
    <div v-else class="empty"><div class="empty-icon">⛽</div><p>{{ t('fuelList.empty') }}</p></div>
    <button v-for="f in rows" :key="f.id" class="item" @click="emit('edit', 'fuel', f)">
      <span class="item-icon">⛽</span>
      <span class="item-body">
        {{ fmt.date(f.date) }}<span v-if="clips[f.id]" class="clip" :title="t('fuelList.clips', { n: clips[f.id] })"> 📎</span>
        <small>{{ fmt.km(f.km) }} · {{ fmt.l(f.liters) }} · {{ fmt.ppl(f.total / f.liters) }}</small>
      </span>
      <span class="item-end">
        <b>{{ fmt.eur(f.total) }}</b>
        <span v-if="stats.per[f.id] != null" class="pill">{{ fmt.l100(stats.per[f.id]) }} L/100</span>
        <span v-else-if="!f.full_tank" class="pill muted">{{ t('fuelList.partial') }}</span>
      </span>
    </button>
  </div>
</template>
