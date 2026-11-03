<script setup>
// Costes: €/mes, €/km, gráfico de los últimos 12 meses (combustible + otros) y reparto por categoría.
import { ref, computed } from 'vue';
import { costs, fmt, monthName } from './calc.js';
import { CATS, label } from './forms.js';

const props = defineProps({ veh: Object, fills: Array, exps: Array, km: Number });
const C = computed(() => costs(props.veh, props.fills, props.exps, props.km));

// Gráfico: barras apiladas; tocar un mes muestra su detalle (por defecto, el actual)
const sel = ref(11);
const max = computed(() => Math.max(1, ...C.value.months.map((m) => m.fuel + m.other)));
const year = computed(() => C.value.months.reduce((s, m) => s + m.fuel + m.other, 0));
const cur = computed(() => C.value.months[sel.value]);
const pct = (v) => (v / max.value) * 100 + '%';

const catLabel = (c) => (c === 'fuel' ? '⛽ Combustible' : label(CATS, c));
</script>

<template>
  <div>
    <div class="stats">
      <div class="stat big"><small>Al mes</small><b>{{ fmt.eur(C.perMonth) }}</b></div>
      <div class="stat big"><small>Por km</small><b>{{ fmt.n3(C.perKm) }}</b><span>€/km</span></div>
      <div class="stat"><small>Gastado en total</small><b>{{ fmt.eur(C.total) }}</b></div>
      <div class="stat"><small>Km registrados</small><b>{{ fmt.km(C.driven) }}</b></div>
    </div>
    <p v-if="C.first" class="note">Desde el {{ fmt.date(C.first) }}, primer apunte de este vehículo.</p>

    <template v-if="C.purchase">
      <h3>Con la compra</h3>
      <div class="stats">
        <div class="stat"><small>Compra + gastos</small><b>{{ fmt.eur(C.purchase.total) }}</b></div>
        <div class="stat"><small>Al mes desde la compra</small><b>{{ fmt.eur(C.purchase.perMonth) }}</b></div>
      </div>
      <p v-if="!C.purchase.since" class="note">Pon la fecha de compra en la ficha para ver el coste al mes.</p>
    </template>

    <h3>Últimos 12 meses · {{ fmt.eur(year) }}</h3>
    <div class="card chart">
      <div class="chart-head">
        <b>{{ monthName(cur.key, true) }}</b>
        <span>{{ fmt.eur(cur.fuel + cur.other) }}</span>
      </div>
      <div class="legend">
        <span><i class="sw fuel"></i>Combustible {{ fmt.eur(cur.fuel) }}</span>
        <span><i class="sw other"></i>Otros {{ fmt.eur(cur.other) }}</span>
      </div>
      <div class="bars" role="img" :aria-label="'Gasto mensual de los últimos 12 meses, máximo ' + fmt.eur(max)">
        <span class="bars-max">{{ fmt.eur(max) }}</span>
        <button
          v-for="(m, i) in C.months" :key="m.key" class="col" :class="{ on: i === sel }"
          :aria-label="monthName(m.key, true) + ': ' + fmt.eur(m.fuel + m.other)" @click="sel = i"
        >
          <span class="stack">
            <i v-if="m.other" class="seg other" :style="{ height: pct(m.other) }"></i>
            <i v-if="m.fuel" class="seg fuel" :style="{ height: pct(m.fuel) }"></i>
          </span>
          <small>{{ monthName(m.key).slice(0, 1) }}</small>
        </button>
      </div>
    </div>

    <h3 v-if="C.byCat.length">Por categoría</h3>
    <div v-for="[c, v] in C.byCat" :key="c" class="cat-row">
      <span class="cat-name">{{ catLabel(c) }}</span>
      <b>{{ fmt.eur(v) }}</b>
      <span class="cat-bar"><i :style="{ width: (v / C.total) * 100 + '%' }"></i></span>
      <small>{{ Math.round((v / C.total) * 100) }} %</small>
    </div>
  </div>
</template>
