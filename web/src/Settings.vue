<script setup>
// Ajustes: idioma (en este móvil) y unidades/moneda (para toda la instalación). Se abre con ⚙ en la cabecera.
import { computed, ref } from 'vue';
import { useDialog } from './dialog.js';
import { t, L, LANGS, setLang } from './i18n/index.js';
import { refreshPush } from './push.js';
import { S, putSettings, restoreBackup, DEMO, call, logout } from './store.js';
import { backupJSON, fuelCSV, expensesCSV, download, fileName, planImport, planCounts, applyImport } from './dataio.js';
import { UP, UNIT_OPTIONS, PRESETS, currencyList } from './units.js';
import { fmt } from './calc.js';

const props = defineProps({ vehicleId: String }); // vehículo actual: destino de un CSV sin columna "vehicle"
const emit = defineEmits(['close', 'imported']);
const VERSION = __APP_VERSION__; // de web/package.json (vite.config.js)
const panel = ref(null);
useDialog(panel, () => emit('close'), { focusFirstField: false });

function pickLang(l) {
  setLang(l);
  refreshPush(); // las notificaciones de este móvil, en el idioma nuevo
}

const prefs = () => ({ distance: UP.distance, volume: UP.volume, consumption: UP.consumption, currency: UP.currency });
const setPref = (k, v) => putSettings({ ...prefs(), [k]: v });
const applyPreset = (p) => putSettings({ ...prefs(), ...p });
const isPreset = (p) => Object.entries(p).every(([k, v]) => UP[k] === v);

// ------------------------------------------------------------ calendario de avisos (enlace con clave propia, solo lectura)
const cal = ref(''); // URL del calendario
const calMsg = ref('');
const calUrl = (key) => location.origin + '/v1/calendar.ics?key=' + encodeURIComponent(key) + '&lang=' + L.lang;
async function calendar(reset = false) {
  calMsg.value = '';
  if (reset && !confirm(t('cal.resetConfirm'))) return;
  try {
    const r = await call(reset ? 'POST' : 'GET', '/v1/calendar' + (reset ? '/reset' : ''));
    if (!r.ok) throw new Error();
    cal.value = calUrl((await r.json()).key);
    if (reset) calMsg.value = t('cal.resetDone');
  } catch (e) { calMsg.value = t('files.offline'); }
}
async function copyCal() {
  try { await navigator.clipboard.writeText(cal.value); calMsg.value = t('cal.copied'); } catch (e) { calMsg.value = t('cal.copyManual'); }
}

// ------------------------------------------------------------ personas con acceso (solo el propietario) y salir
const people = ref(null); // null = sin cargar
const newName = ref('');
const invite = ref(null); // { name, url }: el enlace se enseña una sola vez
const peopleMsg = ref('');
async function loadPeople() {
  try { const r = await call('GET', '/v1/users'); if (r.ok) people.value = await r.json(); } catch (e) { peopleMsg.value = t('files.offline'); }
}
async function addPerson() {
  peopleMsg.value = '';
  const name = newName.value.trim();
  if (!name) return;
  try {
    const r = await call('POST', '/v1/users', { name });
    if (!r.ok) throw new Error();
    const d = await r.json();
    invite.value = { name: d.user.name, url: location.origin + '/?token=' + encodeURIComponent(d.token) };
    newName.value = '';
    loadPeople();
  } catch (e) { peopleMsg.value = t('files.offline'); }
}
async function removePerson(u) {
  if (!confirm(t('people.removeConfirm', { name: u.name }))) return;
  try { await call('DELETE', '/v1/users/' + encodeURIComponent(u.id)); loadPeople(); } catch (e) { peopleMsg.value = t('files.offline'); }
}
async function copyInvite() {
  try { await navigator.clipboard.writeText(invite.value.url); peopleMsg.value = t('cal.copied'); } catch (e) { peopleMsg.value = t('cal.copyManual'); }
}
function leave() {
  if (confirm(S.queue.length ? t('people.logoutPending', { n: S.queue.length }) : t('people.logoutConfirm'))) logout();
}
const seen = (u) => (u.last_seen ? fmt.date(u.last_seen.slice(0, 10)) : t('people.never'));

// ------------------------------------------------------------ tus datos
const plan = ref(null); // importación pendiente de confirmar
const ioMsg = ref('');
const withSettings = ref(true);
const exportAll = () => download(fileName('backup', 'json'), backupJSON(), 'application/json');
const exportFuel = () => download(fileName('fuel', 'csv'), fuelCSV(), 'text/csv;charset=utf-8');
const exportExpenses = () => download(fileName('expenses', 'csv'), expensesCSV(), 'text/csv;charset=utf-8');

const zipBusy = ref(false);
async function pickImport(ev) {
  const f = ev.target.files[0];
  ev.target.value = '';
  plan.value = null;
  ioMsg.value = '';
  if (!f) return;
  // Copia con fotos: la restaura el servidor
  if (/\.zip$/i.test(f.name) || f.type === 'application/zip') {
    if (!confirm(t('io.zipConfirm'))) return;
    zipBusy.value = true;
    try {
      const r = await restoreBackup(f, true);
      const n = Object.values(r.added).reduce((a, b) => a + b, 0) - r.added.files; // registros (sin los adjuntos)
      ioMsg.value = t('io.zipDone', { n, files: r.added.files }) + (r.skipped ? ' ' + t('io.skipped', { n: r.skipped }) : '');
      emit('imported');
    } catch (e) {
      ioMsg.value = e.message;
    } finally { zipBusy.value = false; }
    return;
  }
  try {
    plan.value = planImport(f.name, await f.text(), props.vehicleId);
  } catch (e) {
    ioMsg.value = t('io.err.' + (['empty', 'columns', 'backup'].includes(e.message) ? e.message : 'read'));
  }
}
const counts = computed(() => (plan.value ? planCounts(plan.value) : null));
const total = computed(() => (counts.value ? Object.values(counts.value).reduce((a, b) => a + b, 0) : 0));
function confirmImport() {
  applyImport(plan.value, { withSettings: withSettings.value });
  ioMsg.value = t('io.done', { n: total.value });
  plan.value = null;
  emit('imported');
}

const currencies = computed(() => currencyList(L.lang));
</script>

<template>
  <div class="sheet-bg" @click.self="emit('close')">
    <div ref="panel" class="sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabindex="-1">
      <h2 id="settings-title">{{ t('settings.title') }}</h2>

      <div class="field full" role="group" :aria-label="t('settings.language')">
        <span class="lbl">{{ t('settings.language') }}</span>
        <div class="chips">
          <button v-for="[code, name] in LANGS" :key="code" type="button" :lang="code" :class="{ on: L.lang === code }" :aria-pressed="L.lang === code" @click="pickLang(code)">{{ name }}</button>
        </div>
        <small class="form-note">{{ t('settings.languageNote') }}</small>
      </div>

      <div class="field full settings-units">
        <span class="lbl">{{ t('settings.units') }}</span>
        <div class="chips presets">
          <button v-for="[id, p] in PRESETS" :key="id" type="button" :class="{ on: isPreset(p) }" :aria-pressed="isPreset(p)" @click="applyPreset(p)">{{ t('settings.presets.' + id) }}</button>
        </div>
        <template v-for="(opts, k) in UNIT_OPTIONS" :key="k">
          <span class="lbl sub">{{ t('settings.' + k) }}</span>
          <div class="chips" role="group" :aria-label="t('settings.' + k)">
            <button v-for="o in opts" :key="o" type="button" :class="{ on: UP[k] === o }" :aria-pressed="UP[k] === o" @click="setPref(k, o)">{{ t('units.' + k + '.' + o) }}</button>
          </div>
        </template>
        <label class="lbl sub" for="set-currency">{{ t('settings.currency') }}</label>
        <span class="inp">
          <select id="set-currency" :value="UP.currency" @change="setPref('currency', $event.target.value)">
            <option v-for="[code, name] in currencies" :key="code" :value="code">{{ name }}</option>
          </select>
        </span>
        <small class="form-note">{{ t('settings.unitsNote') }} {{ t('settings.currencyNote') }}</small>
      </div>

      <div v-if="!DEMO" class="field full settings-cal">
        <span class="lbl">📅 {{ t('cal.title') }}</span>
        <small class="form-note">{{ t('cal.text') }}</small>
        <button v-if="!cal" type="button" class="io-btn" @click="calendar()">{{ t('cal.get') }}</button>
        <template v-else>
          <span class="inp"><input :value="cal" readonly :aria-label="t('cal.title')" @focus="$event.target.select()" /></span>
          <div class="io-btns">
            <button type="button" class="io-btn" @click="copyCal">📋 {{ t('cal.copy') }}</button>
            <a class="io-btn" :href="cal.replace(/^https?:/, 'webcal:')">📅 {{ t('cal.open') }}</a>
          </div>
          <small class="form-note">{{ t('cal.google') }}</small>
          <button v-if="S.me && S.me.admin" type="button" class="link danger-soft" @click="calendar(true)">{{ t('cal.reset') }}</button>
        </template>
        <p v-if="calMsg" class="hint">{{ calMsg }}</p>
      </div>

      <div class="field full settings-data">
        <span class="lbl">{{ t('io.title') }}</span>
        <div class="io-btns">
          <a v-if="!DEMO" class="io-btn wide" href="/v1/backup" download>📦 {{ t('io.zip') }}</a>
          <button type="button" class="io-btn" @click="exportAll">💾 {{ t('io.backup') }}</button>
          <button type="button" class="io-btn" @click="exportFuel">⛽ {{ t('io.fuelCsv') }}</button>
          <button type="button" class="io-btn" @click="exportExpenses">🧾 {{ t('io.expensesCsv') }}</button>
          <label class="io-btn" :class="{ busy: zipBusy }">{{ zipBusy ? '⏳ ' + t('io.zipUploading') : '📥 ' + t('io.import') }}<input type="file" accept=".zip,.json,.csv,application/zip,application/json,text/csv" :disabled="zipBusy" @change="pickImport" /></label>
        </div>
        <small class="form-note">{{ t('io.note') }}</small>
        <div v-if="plan" class="io-plan" role="status">
          <p v-if="total"><b>{{ t('io.willAdd') }}</b> {{ Object.entries(counts).filter(([, n]) => n).map(([k, n]) => t('io.count.' + k, { n })).join(' · ') }}</p>
          <p v-else>{{ t('io.nothingNew') }}</p>
          <small v-if="plan.skipped">{{ t('io.skipped', { n: plan.skipped }) }}</small>
          <small v-if="plan.invalid" class="scan-warn">{{ t('io.invalid', { n: plan.invalid }) }}</small>
          <label v-if="plan.settings" class="check-inline"><input v-model="withSettings" type="checkbox" /> {{ t('io.useSettings') }}</label>
          <span class="scan-acts">
            <button type="button" class="link" @click="plan = null">{{ t('common.cancel') }}</button>
            <button v-if="total" type="button" class="primary small" @click="confirmImport">{{ t('io.confirm') }}</button>
          </span>
        </div>
        <p v-if="ioMsg" class="hint">{{ ioMsg }}</p>
      </div>

      <div v-if="!DEMO" class="field full settings-people">
        <span class="lbl">👥 {{ t('people.title') }}</span>
        <small class="form-note">{{ S.me && !S.me.admin ? t('people.youAre', { name: S.me.name }) : t('people.youAreOwner') }}</small>
        <template v-if="S.me && S.me.admin">
          <small class="form-note">{{ t('people.text') }}</small>
          <button v-if="people === null" type="button" class="io-btn" @click="loadPeople">{{ t('people.manage') }}</button>
          <template v-else>
            <ul class="people">
              <li v-for="u in people" :key="u.id"><span><b>{{ u.name }}</b><small>{{ t('people.lastSeen', { when: seen(u) }) }}</small></span>
                <button type="button" class="link danger" @click="removePerson(u)">{{ t('people.remove') }}</button></li>
              <li v-if="!people.length" class="form-note">{{ t('people.none') }}</li>
            </ul>
            <form class="people-add" @submit.prevent="addPerson">
              <span class="inp"><input v-model="newName" maxlength="40" :placeholder="t('people.namePh')" :aria-label="t('people.namePh')" /></span>
              <button class="primary small" :disabled="!newName.trim()">{{ t('people.add') }}</button>
            </form>
            <div v-if="invite" class="io-plan" role="status">
              <p v-html="t('people.inviteTitle', { name: invite.name })"></p>
              <span class="inp"><input :value="invite.url" readonly :aria-label="t('people.inviteLink')" @focus="$event.target.select()" /></span>
              <span class="scan-acts"><button type="button" class="primary small" @click="copyInvite">📋 {{ t('cal.copy') }}</button></span>
              <small>{{ t('people.inviteNote') }}</small>
            </div>
          </template>
        </template>
        <p v-if="peopleMsg" class="hint">{{ peopleMsg }}</p>
        <button type="button" class="link danger-soft" @click="leave">↩ {{ t('people.logout') }}</button>
      </div>

      <div class="field full about">
        <span class="lbl">{{ t('about.title') }}</span>
        <p class="form-note">{{ t('about.text', { v: VERSION }) }}</p>
        <a class="bmc-link" href="https://buymeacoffee.com/davidniin" target="_blank" rel="noopener">☕ {{ t('about.coffee') }}</a>
      </div>

      <div class="actions full">
        <button type="button" class="primary" @click="emit('close')">{{ t('common.close') }}</button>
      </div>
    </div>
  </div>
</template>
