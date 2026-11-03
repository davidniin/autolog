<script setup>
// AutoLog: selector de vehículo arriba, pestañas abajo (Resumen, Repostajes, Gastos, Costes).
import { ref, computed, onMounted } from 'vue';
import { S, put, del, newId, setCurrent, setToken, DEMO, exitDemo } from './store.js';
import { FORMS, KINDS, emoji } from './forms.js';
import { fuelStats, currentKm, nextDue } from './calc.js';
import { I, install, hideIosTip } from './install.js';
import Summary from './Summary.vue';
import FuelList from './FuelList.vue';
import ExpenseList from './ExpenseList.vue';
import Costs from './Costs.vue';
import FormSheet from './FormSheet.vue';

const TABS = [['resumen', '🏠', 'Resumen'], ['fuel', '⛽', 'Repostajes'], ['expenses', '🧾', 'Gastos'], ['costs', '📊', 'Costes']];
const tab = ref('resumen');

const veh = computed(() => S.vehicles.find((v) => v.id === S.current) || S.vehicles[0] || null);
const fills = computed(() => (veh.value ? S.fuel.filter((f) => f.vehicle_id === veh.value.id) : []));
const exps = computed(() => (veh.value ? S.expenses.filter((e) => e.vehicle_id === veh.value.id) : []));
const rems = computed(() => (veh.value ? S.reminders.filter((r) => r.vehicle_id === veh.value.id) : []));
const stats = computed(() => fuelStats(fills.value));
const km = computed(() => (veh.value ? currentKm(veh.value, fills.value, exps.value) : 0));

const status = computed(() => DEMO ? { cls: 'demo', txt: 'Demo' } :
  S.queue.length ? { cls: S.online ? 'busy' : 'off', txt: S.online ? 'Guardando…' : S.queue.length + ' sin enviar' }
    : { cls: S.online ? '' : 'off', txt: S.online ? 'Al día' : 'Sin conexión' });

// ------------------------------------------------------------ aviso breve tras guardar o borrar
const toast = ref('');
let toastTimer = 0;
function notify(msg) {
  toast.value = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.value = ''; }, 2400);
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ------------------------------------------------------------ ficha de edición
const sheet = ref(null); // props de FormSheet: { kind, value, isNew, ctx, heading }
let doneOf = null; // recordatorio que se está marcando como hecho

function open(kind, rec, prefill) {
  const isNew = !rec;
  const value = rec ? { ...rec } : { ...FORMS[kind].blank(veh.value && veh.value.id), id: newId() };
  const others = kind === 'fuel' ? fills.value.filter((f) => f.id !== value.id) : [];
  sheet.value = { kind, value, isNew, ctx: { others, km: km.value }, plate: veh.value && veh.value.plate, prefill };
}
// El escáner de un gasto ha visto un ticket de gasolinera: se abre un repostaje con esos datos y la foto
function onSwitch(kind, data) {
  open(kind, null, data);
}
function openDone(r) {
  doneOf = r;
  sheet.value = { kind: 'done', value: { ...FORMS.done.blank(km.value), id: 'done' }, isNew: true, heading: '✓ ' + r.title };
}
function onSave(rec) {
  const { kind, isNew } = sheet.value;
  sheet.value = null;
  if (kind === 'done') { markDone(doneOf, rec); return notify('✓ Hecho: ' + doneOf.title); }
  put(kind, rec);
  if (kind === 'vehicles') setCurrent(rec.id);
  notify('✓ ' + cap(FORMS[kind].title) + (isNew ? ' añadido' : ' guardado'));
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
  const kind = sheet.value.kind;
  del(kind, sheet.value.value.id);
  sheet.value = null;
  notify(cap(FORMS[kind].title) + ' borrado');
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
  const t = token.value.trim();
  if (/\s/.test(t)) return 'La clave no lleva espacios';
  if (tokenTried.value && !S.auth) return 'Clave incorrecta. Revisa el AUTOLOG_TOKEN del servidor.';
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
        <button v-if="I.prompt" class="install" @click="install">⬇ Instalar</button>
        <span class="status" :class="status.cls">{{ status.txt }}</span>
      </div>
      <nav class="tabs" aria-label="Vehículos">
        <button v-for="v in S.vehicles" :key="v.id" :class="{ on: veh && v.id === veh.id }" @click="setCurrent(v.id)">
          {{ emoji(KINDS, v.kind) }} {{ v.name }}
        </button>
        <button class="add-veh" @click="open('vehicles')">＋ Vehículo</button>
      </nav>
    </header>

    <div v-if="DEMO" class="demo-bar">
      <span>🧪 <b>Modo demo</b>: datos inventados. Lo que cambies se borra al cerrar la pestaña.</span>
      <button class="link" @click="exitDemo">Salir</button>
    </div>

    <div v-if="I.iosTip && !DEMO" class="install-tip">
      <span>📲 Instálala en tu iPhone: pulsa <b>Compartir</b> <span class="ios-share" aria-label="icono compartir">⬆︎</span> y luego <b>Añadir a pantalla de inicio</b>.</span>
      <button class="link" aria-label="Cerrar" @click="hideIosTip">✕</button>
    </div>

    <main v-if="veh">
      <Transition name="fade" mode="out-in">
        <Summary v-if="tab === 'resumen'" :veh="veh" :fills="fills" :exps="exps" :reminders="rems" :stats="stats" :km="km" @edit="open" @add="open" @done="openDone" />
        <FuelList v-else-if="tab === 'fuel'" :fills="fills" :stats="stats" @edit="open" />
        <ExpenseList v-else-if="tab === 'expenses'" :exps="exps" @edit="open" />
        <Costs v-else :veh="veh" :fills="fills" :exps="exps" :km="km" />
      </Transition>
    </main>
    <div v-else class="empty welcome">
      <div class="empty-icon">🚗</div>
      <h2>Bienvenido a AutoLog</h2>
      <p>Apunta repostajes y gastos, mira cuánto consume y cuánto te cuesta, y que te avise de la ITV o del aceite.</p>
      <button class="primary" @click="open('vehicles')">Añadir mi vehículo</button>
    </div>

    <button v-if="veh && FORMS[tab]" class="fab" :aria-label="'Añadir ' + FORMS[tab].title" @click="open(tab)">＋</button>

    <nav v-if="veh" class="bottom" aria-label="Secciones">
      <button v-for="[id, icon, name] in TABS" :key="id" :class="{ on: tab === id }" :aria-current="tab === id ? 'page' : undefined" @click="tab = id">
        <span>{{ icon }}</span>{{ name }}
      </button>
    </nav>

    <Transition name="sheet">
      <FormSheet v-if="sheet" :key="sheet.value.id" v-bind="sheet" @save="onSave" @delete="onDelete" @close="sheet = null" @switch="onSwitch" />
    </Transition>

    <Transition name="toast">
      <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    </Transition>

    <div v-if="!S.auth" class="gate">
      <form @submit.prevent="login" novalidate>
        <div class="gate-icon">🔑</div>
        <h2>Clave de AutoLog</h2>
        <p>Es el AUTOLOG_TOKEN del servidor. Se pide una sola vez en este móvil.</p>
        <input v-model="token" type="password" autocomplete="off" placeholder="Clave" :aria-invalid="!!tokenErr" @input="tokenTried = false" />
        <small v-if="tokenErr" class="field-err" role="alert">{{ tokenErr }}</small>
        <button class="primary" :disabled="!token.trim() || !!tokenErr">Entrar</button>
      </form>
    </div>
  </div>
</template>
