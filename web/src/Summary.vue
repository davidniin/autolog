<script setup>
// Resumen del vehículo: ficha, consumo, gastos y últimos movimientos.
import { computed } from 'vue';
import { fmt, sum } from './calc.js';
import { optEmoji, optText } from './forms.js';
import { t } from './i18n/index.js';
import Reminders from './Reminders.vue';
import Parts from './Parts.vue';

const props = defineProps({ veh: Object, fills: Array, exps: Array, reminders: Array, stats: Object, km: Number, energies: { type: Array, default: () => ['fuel'] } });
const emit = defineEmits(['edit', 'add', 'done', 'report', 'part-off']);

const other = computed(() => sum(props.exps, 'amount'));
const multi = computed(() => props.energies.length > 1); // híbrido enchufable: consumo de cada energía
const onlyKwh = computed(() => props.energies.length === 1 && props.energies[0] === 'kwh');
const label = (key, e) => (multi.value ? t('summary.' + key + 'E', { e: t('opt.energy.' + e) }) : t('summary.' + key));
const cons = (e, v) => (e === 'kwh' ? fmt.econs(v) : fmt.cons(v));
const consUnit = (e) => (e === 'kwh' ? fmt.econsUnit() : fmt.consUnit());
const price = (e) => (e === 'kwh' ? fmt.ppkwh(props.stats.kwh.pricePerL) : fmt.ppl(props.stats.fuel.pricePerL));
const noCons = computed(() => props.energies.every((e) => props.stats[e].avg == null));
const recent = computed(() =>
  [
    ...props.fills.map((f) => ({ kind: 'fuel', rec: f, icon: f.energy === 'kwh' ? '⚡' : '⛽', title: t(f.energy === 'kwh' ? 'summary.chargeItem' : 'summary.fuelItem', { l: fmt.qty(f) }), amount: f.total })),
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
      <button class="quick-btn fuel" @click="emit('add', 'fuel')"><span>{{ onlyKwh ? '⚡' : '⛽' }}</span>{{ onlyKwh ? t('summary.quickCharge') : t('summary.quickFuel') }}</button>
      <button class="quick-btn exp" @click="emit('add', 'expenses')"><span>🧾</span>{{ t('summary.quickExpense') }}</button>
    </div>

    <Reminders :reminders="reminders" :km="km" @edit="(k, r) => emit('edit', k, r)" @add="(k) => emit('add', k)" @done="(r) => emit('done', r)" />
    <Parts :vehicle-id="veh.id" :km="km" @edit="(k, p) => emit('edit', k, p)" @add="(k) => emit('add', k)" @off="(p) => emit('part-off', p)" />

    <h2 class="sec">{{ t('summary.heading') }}</h2>
    <div class="stats">
      <template v-for="e in energies" :key="e">
        <div class="stat big"><small>{{ label('avg', e) }}</small><b>{{ cons(e, stats[e].avg) }}</b><span>{{ consUnit(e) }}</span></div>
        <div class="stat big"><small>{{ label('last', e) }}</small><b>{{ cons(e, stats[e].last) }}</b><span>{{ consUnit(e) }}</span></div>
      </template>
      <div v-for="e in energies" :key="'p' + e" class="stat"><small>{{ label('avgPrice', e) }}</small><b>{{ price(e) }}</b></div>
      <div class="stat"><small>{{ onlyKwh || multi ? t('summary.energy') : t('summary.fuel') }}</small><b>{{ fmt.money(stats.spent) }}</b></div>
      <div class="stat"><small>{{ t('summary.other') }}</small><b>{{ fmt.money(other) }}</b></div>
      <div class="stat"><small>{{ t('summary.total') }}</small><b>{{ fmt.money(stats.spent + other) }}</b></div>
    </div>
    <p v-if="noCons" class="note">{{ t('summary.noConsumption') }}</p>

    <button type="button" class="item report-btn" @click="emit('report')">
      <span class="item-icon">📄</span>
      <span class="item-body">{{ t('report.open') }}<small>{{ t('report.openSub') }}</small></span>
      <span aria-hidden="true">›</span>
    </button>

    <h2 class="sec" v-if="recent.length">{{ t('summary.recent') }}</h2>
    <button v-for="r in recent" :key="r.kind + r.rec.id" class="item" @click="emit('edit', r.kind, r.rec)">
      <span class="item-icon">{{ r.icon }}</span>
      <span class="item-body">{{ r.title }}<small>{{ fmt.date(r.rec.date) }}</small></span>
      <b>{{ fmt.money(r.amount) }}</b>
    </button>
  </div>
</template>
