<script setup>
// AutoLog: selector de vehículo arriba, pestañas abajo (Resumen, Repostajes, Gastos, Costes).
import { ref, computed, onMounted } from 'vue';
import { S, put, del, newId, setCurrent, setToken, DEMO, DEMO_ONLY, exitDemo } from './store.js';
import { FORMS, optEmoji } from './forms.js';
import { energyStats, energiesOf, currentKm, nextDue } from './calc.js';
import { I, install, hideIosTip } from './install.js';
import { t } from './i18n/index.js';
import Summary from './Summary.vue';
import FuelList from './FuelList.vue';
import ExpenseList from './ExpenseList.vue';
import Costs from './Costs.vue';
import FormSheet from './FormSheet.vue';
import Settings from './Settings.vue';
import Wizard from './Wizard.vue';
import Conflicts from './Conflicts.vue';
import Report from './Report.vue';

const TABS = [['resumen', '🏠'], ['fuel', '⛽'], ['expenses', '🧾'], ['costs', '📊']];
const tab = ref('resumen');
const settings = ref(false);
const conflicts = ref(false); // ficha de cambios que chocan con otro móvil
const report = ref(false); // informe del historial (para imprimir / PDF)

const veh = computed(() => S.vehicles.find((v) => v.id === S.current) || S.vehicles[0] || null);
const fills = computed(() => (veh.value ? S.fuel.filter((f) => f.vehicle_id === veh.value.id) : []));
const exps = computed(() => (veh.value ? S.expenses.filter((e) => e.vehicle_id === veh.value.id) : []));
const rems = computed(() => (veh.value ? S.reminders.filter((r) => r.vehicle_id === veh.value.id) : []));
const stats = computed(() => energyStats(fills.value));
const energies = computed(() => energiesOf(veh.value)); // ['fuel'], ['kwh'] o las dos (híbrido enchufable)
// Pestaña y mensajes: "Recargas" en un eléctrico
const tabLabel = (id) => (id === 'fuel' && energies.value[0] === 'kwh' && energies.value.length === 1 ? t('app.tabs.charges') : t('app.tabs.' + id));
const km = computed(() => (veh.value ? currentKm(veh.value, fills.value, exps.value) : 0));

const status = computed(() => DEMO ? { cls: 'demo', txt: t('app.status.demo') } :
  S.queue.length ? { cls: S.online ? 'busy' : 'off', txt: S.online ? t('app.status.saving') : t('app.status.pending', { n: S.queue.length }) }
    : { cls: S.online ? '' : 'off', txt: S.online ? t('app.status.synced') : t('app.status.offline') });

// Textos con negrita (vienen de los diccionarios, no del usuario)
const iosTip = computed(() => t('app.iosTip', { icon: '<span class="ios-share" aria-label="' + t('app.iosShare') + '">⬆︎</span>' }));

// ------------------------------------------------------------ aviso breve tras guardar o borrar
const toast = ref('');
let toastTimer = 0;
function notify(msg) {
  toast.value = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.value = ''; }, 2400);
}

// ------------------------------------------------------------ ficha de edición
const sheet = ref(null); // props de FormSheet: { kind, value, isNew, ctx, heading }
let doneOf = null; // recordatorio que se está marcando como hecho

function open(kind, rec, prefill) {
  const isNew = !rec;
  const value = rec ? { ...rec } : { ...FORMS[kind].blank(veh.value && veh.value.id), id: newId() };
  if (kind === 'fuel' && !rec) value.energy = energies.value[0]; // en un eléctrico, una recarga
  if (kind === 'parts' && !rec) value.installed_km = km.value || null;
  if (kind === 'fuel' && !value.energy) value.energy = 'fuel';
  const others = kind === 'fuel' ? fills.value.filter((f) => f.id !== value.id) : [];
  sheet.value = { kind, value, isNew, ctx: { others, km: km.value, energies: energies.value }, plate: veh.value && veh.value.plate, prefill };
}
// El escáner de un gasto ha visto un ticket de gasolinera: se abre un repostaje con esos datos y la foto
function onSwitch(kind, data) {
  open(kind, null, data);
}
// Pieza cambiada: se guarda cuándo se quitó y, si se pide, se abre la ficha de la nueva (mismo tipo, posición y vida)
let partOf = null;
function openPartOff(p) {
  partOf = p;
  sheet.value = { kind: 'partOff', value: { ...FORMS.partOff.blank(km.value), id: 'partoff' }, isNew: true, heading: '🔁 ' + (p.name || t('opt.part.' + p.kind)) };
}
function openDone(r) {
  doneOf = r;
  sheet.value = { kind: 'done', value: { ...FORMS.done.blank(km.value), id: 'done' }, isNew: true, heading: '✓ ' + r.title };
}
function onSave(rec) {
  const { kind, isNew } = sheet.value;
  sheet.value = null;
  if (kind === 'done') { markDone(doneOf, rec); return notify(t('app.toastDone', { title: doneOf.title })); }
  if (kind === 'partOff') {
    const p = partOf;
    put('parts', { ...p, removed_date: rec.removed_date, removed_km: rec.removed_km });
    if (!rec.replace) return notify(t('parts.retired'));
    const next = { ...FORMS.parts.blank(p.vehicle_id, rec.removed_km), id: newId(), kind: p.kind, position: p.position, life_km: p.life_km, life_months: p.life_months, installed_date: rec.removed_date };
    sheet.value = { kind: 'parts', value: next, isNew: true, ctx: { others: [], km: km.value } };
    return;
  }
  put(kind, rec);
  if (kind === 'vehicles') setCurrent(rec.id);
  notify(t('kinds.' + (kind === 'fuel' && rec.energy === 'kwh' ? 'charge' : kind) + (isNew ? '.added' : '.saved')));
}
// Hecho: con importe se apunta el gasto; si se repite, se programa el siguiente aviso; si no, se borra
function markDone(r, d) {
  if (d.amount > 0) {
    put('expenses', { id: newId(), vehicle_id: r.vehicle_id, date: d.date, km: d.km, cat: r.cat || 'otros', title: r.title, amount: d.amount, note: '' });
  }
  const next = nextDue(r, d.date, d.km != null ? d.km : km.value);
  if (next) put('reminders', { ...r, ...next });
  else del('reminders', r.id);
}
function onDelete() {
  const kind = sheet.value.kind, charge = kind === 'fuel' && sheet.value.value.energy === 'kwh';
  del(kind, sheet.value.value.id);
  sheet.value = null;
  notify(t('kinds.' + (charge ? 'charge' : kind) + '.deleted'));
}

// Accesos directos del icono (manifest: /?add=fuel, /?add=expenses)
onMounted(() => {
  const add = new URLSearchParams(location.search).get('add');
  if (!add) return;
  history.replaceState(null, '', location.pathname + location.hash);
  if (veh.value && (add === 'fuel' || add === 'expenses')) { tab.value = add; open(add); }
});

// ------------------------------------------------------------ clave
const token = ref('');
const tokenTried = ref(false);
const tokenErr = computed(() => {
  const tk = token.value.trim();
  if (/\s/.test(tk)) return t('gate.noSpaces');
  if (tokenTried.value && !S.auth) return t('gate.wrong');
  return '';
});
function login() {
  if (!token.value.trim() || /\s/.test(token.value.trim())) return;
  tokenTried.value = true;
  setToken(token.value);
}
</script>

<template>
  <div class="app">
    <header class="top">
      <div class="top-row">
        <h1 class="brand">
          <svg viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="120" fill="var(--accent)" /><path d="M136 330a120 120 0 1 1 240 0" fill="none" stroke="#fff" stroke-width="40" stroke-linecap="round" /><path d="M256 330 330 238" stroke="#ffb547" stroke-width="34" stroke-linecap="round" /><circle cx="256" cy="330" r="28" fill="#fff" /></svg>
          AutoLog
        </h1>
        <button v-if="I.prompt" class="install" @click="install">{{ t('app.install') }}</button>
        <span class="status" :class="status.cls">{{ status.txt }}</span>
        <button class="gear" :aria-label="t('app.settings')" :title="t('app.settings')" @click="settings = true">⚙</button>
      </div>
      <nav class="tabs" :aria-label="t('app.vehiclesNav')">
        <button v-for="v in S.vehicles" :key="v.id" :class="{ on: veh && v.id === veh.id }" @click="setCurrent(v.id)">
          {{ optEmoji('kind', v.kind) }} {{ v.name }}
        </button>
        <button class="add-veh" @click="open('vehicles')">{{ t('app.addVehicle') }}</button>
      </nav>
    </header>

    <main>
    <div v-if="S.conflicts.length" class="conflict-bar" role="alert">
      <span>⚠ {{ t('conflict.bar', { n: S.conflicts.length }) }}</span>
      <button class="link" @click="conflicts = true">{{ t('conflict.review') }}</button>
    </div>

    <div v-if="DEMO" class="demo-bar">
      <span>🧪 <span v-html="t('app.demoBar')"></span></span>
      <button class="link" @click="exitDemo">{{ DEMO_ONLY ? t('app.demoReset') : t('common.exit') }}</button>
    </div>

    <div v-if="I.iosTip && !DEMO" class="install-tip">
      <span>📲 <span v-html="iosTip"></span></span>
      <button class="link" :aria-label="t('common.close')" @click="hideIosTip">✕</button>
    </div>

    <template v-if="veh">
      <Transition name="fade" mode="out-in">
        <Summary v-if="tab === 'resumen'" :veh="veh" :fills="fills" :exps="exps" :reminders="rems" :stats="stats" :km="km" :energies="energies" @edit="open" @add="open" @done="openDone" @report="report = true" @part-off="openPartOff" />
        <FuelList v-else-if="tab === 'fuel'" :fills="fills" :stats="stats" :energies="energies" @edit="open" />
        <ExpenseList v-else-if="tab === 'expenses'" :exps="exps" @edit="open" />
        <Costs v-else :veh="veh" :fills="fills" :exps="exps" :km="km" />
      </Transition>
    </template>
    <Wizard v-else @vehicle="open('vehicles')" @restored="notify" />
    </main>

    <button v-if="veh && FORMS[tab]" class="fab" :aria-label="t('app.fab', { what: t('kinds.' + tab + '.one') })" @click="open(tab)">＋</button>

    <nav v-if="veh" class="bottom" :aria-label="t('app.sectionsNav')">
      <button v-for="[id, icon] in TABS" :key="id" :class="{ on: tab === id }" :aria-current="tab === id ? 'page' : undefined" @click="tab = id">
        <span>{{ id === 'fuel' && energies.length === 1 && energies[0] === 'kwh' ? '⚡' : icon }}</span>{{ tabLabel(id) }}
      </button>
    </nav>

    <Transition name="sheet">
      <FormSheet v-if="sheet" :key="sheet.value.id" v-bind="sheet" @save="onSave" @delete="onDelete" @close="sheet = null" @switch="onSwitch" />
    </Transition>
    <Transition name="sheet">
      <Conflicts v-if="conflicts && S.conflicts.length" @close="conflicts = false" />
    </Transition>
    <Transition name="sheet">
      <Settings v-if="settings" :vehicle-id="veh && veh.id" @close="settings = false" />
    </Transition>

    <Report v-if="report && veh" :veh="veh" :km="km" @close="report = false" />

    <Transition name="toast">
      <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    </Transition>

    <div v-if="!S.auth" class="gate">
      <form @submit.prevent="login" novalidate>
        <div class="gate-icon">🔑</div>
        <h2>{{ t('gate.title') }}</h2>
        <p>{{ t('gate.text') }}</p>
        <details class="gate-help">
          <summary>{{ t('gate.whereQ') }}</summary>
          <p>{{ t('gate.whereA') }}</p>
        </details>
        <input v-model="token" type="password" autocomplete="off" :placeholder="t('gate.placeholder')" :aria-invalid="!!tokenErr" @input="tokenTried = false" />
        <small v-if="tokenErr" class="field-err" role="alert">{{ tokenErr }}</small>
        <button class="primary" :disabled="!token.trim() || !!tokenErr">{{ t('gate.enter') }}</button>
      </form>
    </div>
  </div>
</template>
