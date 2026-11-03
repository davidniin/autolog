<script setup>
// Resumen del vehículo: ficha, consumo, gastos y últimos movimientos.
import { computed } from 'vue';
import { fmt, sum } from './calc.js';
import { optEmoji, optText } from './forms.js';
import { t } from './i18n/index.js';
import Reminders from './Reminders.vue';

const props = defineProps({ veh: Object, fills: Array, exps: Array, reminders: Array, stats: Object, km: Number });
const emit = defineEmits(['edit', 'add', 'done']);

const other = computed(() => sum(props.exps, 'amount'));
const recent = computed(() =>
  [
    ...props.fills.map((f) => ({ kind: 'fuel', rec: f, icon: '⛽', title: t('summary.fuelItem', { l: fmt.l(f.liters) }), amount: f.total })),
    ...props.exps.map((e) => ({ kind: 'expenses', rec: e, icon: optEmoji('cat', e.cat), title: e.title || optText('cat', e.cat), amount: e.amount })),
  ]
    .sort((a, b) => b.rec.date.localeCompare(a.rec.date))
    .slice(0, 6),
);
</script>

<template>
  <div>
    <section class="hero" :aria-label="veh.name" @click="emit('edit', 'vehicles', veh)">
      <div class="hero-top">
        <span class="hero-icon">{{ optEmoji('kind', veh.kind) }}</span>
        <div class="hero-name">
          <b>{{ veh.name }}</b>
          <small>{{ optText('fuel', veh.fuel_type) }}</small>
        </div>
        <button type="button" class="hero-edit" :aria-label="t('summary.editAria', { name: veh.name })" @click.stop="emit('edit', 'vehicles', veh)">{{ t('summary.edit') }}</button>
      </div>
      <div class="hero-bottom">
        <div class="odo"><small>{{ t('summary.odometer') }}</small><b>{{ fmt.km(km) }}</b></div>
        <span v-if="veh.plate" class="plate"><i>{{ t('summary.plateCountry') }}</i>{{ veh.plate }}</span>
      </div>
    </section>

    <div class="quick">
      <button class="quick-btn fuel" @click="emit('add', 'fuel')"><span>⛽</span>{{ t('summary.quickFuel') }}</button>
      <button class="quick-btn exp" @click="emit('add', 'expenses')"><span>🧾</span>{{ t('summary.quickExpense') }}</button>
    </div>

    <Reminders :reminders="reminders" :km="km" @edit="(k, r) => emit('edit', k, r)" @add="(k) => emit('add', k)" @done="(r) => emit('done', r)" />

    <h2 class="sec">{{ t('summary.heading') }}</h2>
    <div class="stats">
      <div class="stat big"><small>{{ t('summary.avg') }}</small><b>{{ fmt.cons(stats.avg) }}</b><span>{{ fmt.consUnit() }}</span></div>
      <div class="stat big"><small>{{ t('summary.last') }}</small><b>{{ fmt.cons(stats.last) }}</b><span>{{ fmt.consUnit() }}</span></div>
      <div class="stat"><small>{{ t('summary.avgPrice') }}</small><b>{{ fmt.ppl(stats.pricePerL) }}</b></div>
      <div class="stat"><small>{{ t('summary.fuel') }}</small><b>{{ fmt.money(stats.spent) }}</b></div>
      <div class="stat"><small>{{ t('summary.other') }}</small><b>{{ fmt.money(other) }}</b></div>
      <div class="stat"><small>{{ t('summary.total') }}</small><b>{{ fmt.money(stats.spent + other) }}</b></div>
    </div>
    <p v-if="stats.avg == null" class="note">{{ t('summary.noConsumption') }}</p>

    <h2 class="sec" v-if="recent.length">{{ t('summary.recent') }}</h2>
    <button v-for="r in recent" :key="r.kind + r.rec.id" class="item" @click="emit('edit', r.kind, r.rec)">
      <span class="item-icon">{{ r.icon }}</span>
      <span class="item-body">{{ r.title }}<small>{{ fmt.date(r.rec.date) }}</small></span>
      <b>{{ fmt.money(r.amount) }}</b>
    </button>
  </div>
</template>
