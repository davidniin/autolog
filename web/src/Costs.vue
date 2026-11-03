<script setup>
// Costes: €/mes, €/km, gráfico de los últimos 12 meses (combustible + otros) y reparto por categoría.
import { ref, computed } from 'vue';
import { costs, fmt, monthName } from './calc.js';
import { optLabel } from './forms.js';
import { t } from './i18n/index.js';
import { distUnit } from './units.js';

const props = defineProps({ veh: Object, fills: Array, exps: Array, km: Number });
const C = computed(() => costs(props.veh, props.fills, props.exps, props.km));

// Gráfico: barras apiladas; tocar un mes muestra su detalle (por defecto, el actual)
const sel = ref(11);
const max = computed(() => Math.max(1, ...C.value.months.map((m) => m.fuel + m.other)));
const year = computed(() => C.value.months.reduce((s, m) => s + m.fuel + m.other, 0));
const cur = computed(() => C.value.months[sel.value]);
const pct = (v) => (v / max.value) * 100 + '%';

const catLabel = (c) => optLabel('cat', c);
</script>

<template>
  <div>
    <div class="stats">
      <div class="stat big"><small>{{ t('costs.perMonth') }}</small><b>{{ fmt.money(C.perMonth) }}</b></div>
      <div class="stat big"><small>{{ t('costs.perKm', { d: distUnit() }) }}</small><b>{{ fmt.perDist(C.perKm) }}</b></div>
      <div class="stat"><small>{{ t('costs.total') }}</small><b>{{ fmt.money(C.total) }}</b></div>
      <div class="stat"><small>{{ t('costs.driven', { d: distUnit() }) }}</small><b>{{ fmt.km(C.driven) }}</b></div>
    </div>
    <p v-if="C.first" class="note">{{ t('costs.since', { date: fmt.date(C.first) }) }}</p>

    <template v-if="C.purchase">
      <h2 class="sec">{{ t('costs.withPurchase') }}</h2>
      <div class="stats">
        <div class="stat"><small>{{ t('costs.purchaseTotal') }}</small><b>{{ fmt.money(C.purchase.total) }}</b></div>
        <div class="stat"><small>{{ t('costs.purchasePerMonth') }}</small><b>{{ fmt.money(C.purchase.perMonth) }}</b></div>
      </div>
      <p v-if="!C.purchase.since" class="note">{{ t('costs.setPurchaseDate') }}</p>
    </template>

    <h2 class="sec">{{ t('costs.last12', { total: fmt.money(year) }) }}</h2>
    <div class="card chart">
      <div class="chart-head">
        <b>{{ monthName(cur.key, true) }}</b>
        <span>{{ fmt.money(cur.fuel + cur.other) }}</span>
      </div>
      <div class="legend">
        <span><i class="sw fuel"></i>{{ t('costs.fuel') }} {{ fmt.money(cur.fuel) }}</span>
        <span><i class="sw other"></i>{{ t('costs.other') }} {{ fmt.money(cur.other) }}</span>
      </div>
      <div class="bars" role="group" :aria-label="t('costs.chartAria', { max: fmt.money(max) })">
        <span class="bars-max" aria-hidden="true">{{ fmt.money(max) }}</span>
        <button
          v-for="(m, i) in C.months" :key="m.key" class="col" :class="{ on: i === sel }"
          :aria-label="monthName(m.key, true) + ': ' + fmt.money(m.fuel + m.other)" :aria-pressed="i === sel" @click="sel = i"
        >
          <span class="stack">
            <i v-if="m.other" class="seg other" :style="{ height: pct(m.other) }"></i>
            <i v-if="m.fuel" class="seg fuel" :style="{ height: pct(m.fuel) }"></i>
          </span>
          <small>{{ monthName(m.key).slice(0, 1) }}</small>
        </button>
      </div>
    </div>

    <h2 class="sec" v-if="C.byCat.length">{{ t('costs.byCat') }}</h2>
    <div v-for="[c, v] in C.byCat" :key="c" class="cat-row">
      <span class="cat-name">{{ catLabel(c) }}</span>
      <b>{{ fmt.money(v) }}</b>
      <span class="cat-bar"><i :style="{ width: (v / C.total) * 100 + '%' }"></i></span>
      <small>{{ Math.round((v / C.total) * 100) }} %</small>
    </div>
  </div>
</template>
