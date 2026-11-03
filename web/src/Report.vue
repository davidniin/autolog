<script setup>
// Informe del historial del vehículo, para enseñarlo al venderlo. Se "imprime" con el navegador y se guarda como PDF
// (Imprimir → Guardar como PDF; en iPhone: Compartir → Imprimir → compartir el PDF). Sin dependencias.
// Antes de imprimir se elige qué se enseña: importes, todos los gastos o solo mantenimiento, notas (pueden ser personales).
import { ref, computed, onMounted } from 'vue';
import { S } from './store.js';
import { fmt, sum, reminderState, energyStats, energiesOf, partState, today } from './calc.js';
import { optLabel, optText } from './forms.js';
import { t } from './i18n/index.js';
import { useDialog } from './dialog.js';

const props = defineProps({ veh: Object, km: Number });
const emit = defineEmits(['close']);
const panel = ref(null);
useDialog(panel, () => emit('close'), { focusFirstField: false });

// Opciones (se recuerdan en este móvil)
const OPT_KEY = 'autolog.reportOptions';
const opts = ref({ amounts: true, all: false, notes: false });
onMounted(() => { try { Object.assign(opts.value, JSON.parse(localStorage.getItem(OPT_KEY) || '{}')); } catch (e) { /* nada */ } });
const saveOpts = () => { try { localStorage.setItem(OPT_KEY, JSON.stringify(opts.value)); } catch (e) { /* nada */ } };

const MAINT = ['revision', 'reparacion', 'itv'];
const fills = computed(() => S.fuel.filter((f) => f.vehicle_id === props.veh.id));
const exps = computed(() => S.expenses.filter((e) => e.vehicle_id === props.veh.id));
const files = computed(() => {
  const n = {};
  for (const f of S.files) if (f.parent_kind === 'expenses') n[f.parent_id] = (n[f.parent_id] || 0) + 1;
  return n;
});
const rows = computed(() => exps.value
  .filter((e) => opts.value.all || MAINT.includes(e.cat))
  .sort((a, b) => a.date.localeCompare(b.date) || (a.km || 0) - (b.km || 0)));

// Kilometraje registrado: el más alto de cada año (repostajes, gastos y el inicial de la ficha)
const mileage = computed(() => {
  const byYear = {};
  for (const x of [...fills.value, ...exps.value]) {
    if (!x.km) continue;
    const y = x.date.slice(0, 4);
    byYear[y] = Math.max(byYear[y] || 0, x.km);
  }
  return Object.entries(byYear).sort((a, b) => a[0].localeCompare(b[0]));
});
const firstKm = computed(() => {
  const ks = [props.veh.start_km, ...fills.value.map((f) => f.km), ...exps.value.map((e) => e.km)].filter((k) => k > 0);
  return ks.length ? Math.min(...ks) : null;
});
const firstDate = computed(() => [...fills.value, ...exps.value].reduce((m, x) => (!m || x.date < m ? x.date : m), null));
const energies = computed(() => energiesOf(props.veh));
const stats = computed(() => energyStats(fills.value));
const maintTotal = computed(() => sum(exps.value.filter((e) => MAINT.includes(e.cat)), 'amount'));
const upcoming = computed(() => S.reminders.filter((r) => r.vehicle_id === props.veh.id)
  .map((r) => ({ r, st: reminderState(r, props.km) })).sort((a, b) => a.st.score - b.st.score));
const generated = computed(() => fmt.date(today()));
// Neumáticos y piezas: las montadas (con su uso) y las cambiadas (lo que duraron)
const parts = computed(() => S.parts.filter((p) => p.vehicle_id === props.veh.id)
  .map((p) => ({ p, st: partState(p, props.km) }))
  .sort((a, b) => (a.p.removed_date ? 1 : 0) - (b.p.removed_date ? 1 : 0) || b.p.installed_date.localeCompare(a.p.installed_date)));

function print() { window.print(); }
</script>

<template>
  <div ref="panel" class="report-wrap" role="dialog" aria-modal="true" aria-labelledby="report-title" tabindex="-1">
    <!-- Barra (no se imprime) -->
    <div class="report-bar">
      <b>{{ t('report.title') }}</b>
      <div class="report-opts" role="group" :aria-label="t('report.options')">
        <label><input v-model="opts.amounts" type="checkbox" @change="saveOpts" /> {{ t('report.optAmounts') }}</label>
        <label><input v-model="opts.all" type="checkbox" @change="saveOpts" /> {{ t('report.optAll') }}</label>
        <label><input v-model="opts.notes" type="checkbox" @change="saveOpts" /> {{ t('report.optNotes') }}</label>
      </div>
      <span class="report-acts">
        <button type="button" class="link" @click="emit('close')">{{ t('common.close') }}</button>
        <button type="button" class="primary small" @click="print">🖨 {{ t('report.print') }}</button>
      </span>
      <small class="report-help">{{ t('report.help') }}</small>
    </div>

    <!-- El informe -->
    <article class="report">
      <header class="rp-head">
        <div>
          <p class="rp-kicker">{{ t('report.kicker') }}</p>
          <h1 id="report-title">{{ veh.name }}</h1>
          <p class="rp-sub">{{ [optText('kind', veh.kind), optText('fuel', veh.fuel_type), veh.plate].filter(Boolean).join(' · ') }}</p>
        </div>
        <div class="rp-odo"><small>{{ t('summary.odometer') }}</small><b>{{ fmt.km(km) }}</b></div>
      </header>

      <section class="rp-grid">
        <div><small>{{ t('report.since') }}</small><b>{{ firstDate ? fmt.date(firstDate) : '—' }}</b></div>
        <div><small>{{ t('report.driven') }}</small><b>{{ firstKm != null ? fmt.km(km - firstKm) : '—' }}</b></div>
        <div><small>{{ t('report.maintCount') }}</small><b>{{ exps.filter((e) => ['revision', 'reparacion', 'itv'].includes(e.cat)).length }}</b></div>
        <div v-if="opts.amounts"><small>{{ t('report.maintTotal') }}</small><b>{{ fmt.money(maintTotal) }}</b></div>
        <div v-for="e in energies" :key="e"><small>{{ t('summary.avg') }}{{ energies.length > 1 ? ' · ' + t('opt.energy.' + e) : '' }}</small>
          <b>{{ e === 'kwh' ? fmt.econs(stats.kwh.avg) + ' ' + fmt.econsUnit() : fmt.cons(stats.fuel.avg) + ' ' + fmt.consUnit() }}</b></div>
      </section>

      <h2>{{ opts.all ? t('report.allExpenses') : t('report.maintenance') }}</h2>
      <p v-if="!rows.length" class="rp-empty">{{ t('report.none') }}</p>
      <table v-else class="rp-table">
        <thead>
          <tr>
            <th scope="col">{{ t('f.date') }}</th><th scope="col">{{ t('report.km') }}</th><th scope="col">{{ t('report.work') }}</th>
            <th scope="col">{{ t('f.cat') }}</th><th v-if="opts.amounts" scope="col" class="num">{{ t('f.amount') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in rows" :key="e.id">
            <td>{{ fmt.date(e.date) }}</td>
            <td>{{ e.km ? fmt.km(e.km) : '—' }}</td>
            <td>{{ e.title || optText('cat', e.cat) }}<span v-if="files[e.id]" class="rp-clip"> 📎 {{ t('report.invoice') }}</span>
              <small v-if="opts.notes && e.note">{{ e.note }}</small></td>
            <td>{{ optLabel('cat', e.cat) }}</td>
            <td v-if="opts.amounts" class="num">{{ fmt.money(e.amount) }}</td>
          </tr>
        </tbody>
      </table>

      <template v-if="parts.length">
        <h2>{{ t('parts.heading') }}</h2>
        <table class="rp-table">
          <thead><tr><th scope="col">{{ t('f.partKind') }}</th><th scope="col">{{ t('report.mounted') }}</th><th scope="col">{{ t('report.removed') }}</th><th scope="col" class="num">{{ t('report.used') }}</th></tr></thead>
          <tbody>
            <tr v-for="{ p, st } in parts" :key="p.id">
              <td>{{ optLabel('part', p.kind) }}<small>{{ [p.name, p.position].filter(Boolean).join(' · ') }}</small></td>
              <td>{{ fmt.date(p.installed_date) }}<small v-if="p.installed_km">{{ fmt.km(p.installed_km) }}</small></td>
              <td>{{ p.removed_date ? fmt.date(p.removed_date) : t('report.current') }}<small v-if="p.removed_km">{{ fmt.km(p.removed_km) }}</small></td>
              <td class="num">{{ st.km != null ? fmt.km(st.km) : '' }}<small>{{ t('parts.months', { m: Math.round(st.months) }) }}</small></td>
            </tr>
          </tbody>
        </table>
      </template>

      <div class="rp-cols">
        <section>
          <h2>{{ t('report.mileage') }}</h2>
          <p v-if="!mileage.length" class="rp-empty">{{ t('report.none') }}</p>
          <table v-else class="rp-table compact">
            <tbody><tr v-for="[y, k] in mileage" :key="y"><th scope="row">{{ y }}</th><td class="num">{{ fmt.km(k) }}</td></tr></tbody>
          </table>
        </section>
        <section v-if="upcoming.length">
          <h2>{{ t('report.upcoming') }}</h2>
          <table class="rp-table compact">
            <tbody><tr v-for="{ r, st } in upcoming" :key="r.id"><th scope="row">{{ r.title }}</th><td>{{ t('rem.level.' + st.level) }} · {{ st.text }}</td></tr></tbody>
          </table>
        </section>
      </div>

      <footer class="rp-foot">{{ t('report.footer', { date: generated }) }}</footer>
    </article>
  </div>
</template>
