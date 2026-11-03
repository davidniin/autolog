<script setup>
// Resumen del vehículo: ficha, consumo, gastos y últimos movimientos.
import { computed } from 'vue';
import { fmt, sum } from './calc.js';
import { KINDS, FUELS, CATS, label, text, emoji } from './forms.js';
import Reminders from './Reminders.vue';

const props = defineProps({ veh: Object, fills: Array, exps: Array, reminders: Array, stats: Object, km: Number });
const emit = defineEmits(['edit', 'add', 'done']);

const other = computed(() => sum(props.exps, 'amount'));
const recent = computed(() =>
  [
    ...props.fills.map((f) => ({ kind: 'fuel', rec: f, icon: '⛽', title: 'Repostaje · ' + fmt.l(f.liters), amount: f.total })),
    ...props.exps.map((e) => ({ kind: 'expenses', rec: e, icon: emoji(CATS, e.cat), title: e.title || text(CATS, e.cat), amount: e.amount })),
  ]
    .sort((a, b) => b.rec.date.localeCompare(a.rec.date))
    .slice(0, 6),
);
</script>

<template>
  <div>
    <section class="hero" role="button" tabindex="0" :aria-label="'Editar ' + veh.name" @click="emit('edit', 'vehicles', veh)" @keydown.enter="emit('edit', 'vehicles', veh)">
      <div class="hero-top">
        <span class="hero-icon">{{ emoji(KINDS, veh.kind) }}</span>
        <div class="hero-name">
          <b>{{ veh.name }}</b>
          <small>{{ label(FUELS, veh.fuel_type) }}</small>
        </div>
        <span class="hero-edit">Editar ›</span>
      </div>
      <div class="hero-bottom">
        <div class="odo"><small>Cuentakilómetros</small><b>{{ fmt.km(km) }}</b></div>
        <span v-if="veh.plate" class="plate"><i>E</i>{{ veh.plate }}</span>
      </div>
    </section>

    <div class="quick">
      <button class="quick-btn fuel" @click="emit('add', 'fuel')"><span>⛽</span>Repostaje</button>
      <button class="quick-btn exp" @click="emit('add', 'expenses')"><span>🧾</span>Gasto</button>
    </div>

    <Reminders :reminders="reminders" :km="km" @edit="(k, r) => emit('edit', k, r)" @add="(k) => emit('add', k)" @done="(r) => emit('done', r)" />

    <h3>Consumo y gastos</h3>
    <div class="stats">
      <div class="stat big"><small>Consumo medio</small><b>{{ fmt.l100(stats.avg) }}</b><span>L/100 km</span></div>
      <div class="stat big"><small>Último tramo</small><b>{{ fmt.l100(stats.last) }}</b><span>L/100 km</span></div>
      <div class="stat"><small>Precio medio</small><b>{{ fmt.ppl(stats.pricePerL) }}</b></div>
      <div class="stat"><small>Combustible</small><b>{{ fmt.eur(stats.spent) }}</b></div>
      <div class="stat"><small>Otros gastos</small><b>{{ fmt.eur(other) }}</b></div>
      <div class="stat"><small>Total</small><b>{{ fmt.eur(stats.spent + other) }}</b></div>
    </div>
    <p v-if="stats.avg == null" class="note">El consumo aparece cuando hay dos repostajes con el depósito lleno.</p>

    <h3 v-if="recent.length">Últimos movimientos</h3>
    <button v-for="r in recent" :key="r.kind + r.rec.id" class="item" @click="emit('edit', r.kind, r.rec)">
      <span class="item-icon">{{ r.icon }}</span>
      <span class="item-body">{{ r.title }}<small>{{ fmt.date(r.rec.date) }}</small></span>
      <b>{{ fmt.eur(r.amount) }}</b>
    </button>
  </div>
</template>
