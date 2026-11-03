<script setup>
// Primera vez (aún no hay vehículos): 1) bienvenida e idioma, 2) unidades y moneda, 3) el primer vehículo
// (se abre la ficha de siempre: emit 'vehicle'). El paso 2 se salta si otro móvil ya eligió las unidades.
// También se puede restaurar una copia o ver la demo.
import { ref, computed } from 'vue';
import { t, L, LANGS, setLang } from './i18n/index.js';
import { S, putSettings, DEMO, restoreBackup, pull } from './store.js';
import { PRESETS, currencyList, defaultPrefs } from './units.js';
import { planImport, planCounts, applyImport } from './dataio.js';

const emit = defineEmits(['vehicle', 'restored']);
const step = ref(1);

// Unidades: se proponen las típicas del país del móvil
const choice = ref({ ...defaultPrefs(), ...(S.settings || {}) });
const presetOn = (p) => Object.entries(p).every(([k, v]) => choice.value[k] === v);
const currencies = computed(() => currencyList(L.lang, choice.value.currency));

function next() {
  if (step.value === 1 && !S.settings) { step.value = 2; return; }
  if (step.value === 2) putSettings({ ...choice.value });
  emit('vehicle');
}

// Restaurar una copia (JSON) en lugar de empezar de cero
const restoreMsg = ref('');
async function restore(ev) {
  const f = ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  try {
    if (/\.zip$/i.test(f.name) || f.type === 'application/zip') {
      restoreMsg.value = t('io.zipUploading');
      const r = await restoreBackup(f, true, { reload: false });
      // Al recargar, ya hay vehículos y el asistente desaparece: el aviso lo enseña la pantalla principal
      emit('restored', t('io.zipDone', { n: Object.values(r.added).reduce((a, b) => a + b, 0) - r.added.files, files: r.added.files }));
      pull();
      return;
    }
    const plan = planImport(f.name, await f.text());
    if (plan.kind !== 'backup') throw new Error('backup');
    const n = Object.values(planCounts(plan)).reduce((a, b) => a + b, 0);
    applyImport(plan, { withSettings: true });
    emit('restored', t('io.done', { n }));
  } catch (e) {
    restoreMsg.value = e.message && !/^(backup|Unexpected)/.test(e.message) ? e.message : t('io.err.backup');
  }
}
</script>

<template>
  <div class="wizard">
    <div class="wiz-dots" aria-hidden="true"><i :class="{ on: step === 1 }"></i><i :class="{ on: step === 2 }"></i><i></i></div>

    <template v-if="step === 1">
      <div class="empty-icon wiz-logo">🚗</div>
      <h2>{{ t('app.welcomeTitle') }}</h2>
      <p>{{ t('app.welcomeText') }}</p>
      <div class="chips wiz-langs" role="group" :aria-label="t('settings.language')">
        <button v-for="[code, name] in LANGS" :key="code" type="button" :lang="code" :class="{ on: L.lang === code }" :aria-pressed="L.lang === code" @click="setLang(code)">{{ name }}</button>
      </div>
      <button class="primary wiz-main" @click="next">{{ t('wizard.start') }}</button>
      <div class="wiz-alt">
        <label class="link">📥 {{ t('wizard.restore') }}<input type="file" accept=".zip,.json,application/zip,application/json" @change="restore" /></label>
        <a v-if="!DEMO" class="link" href="/?demo=1">🧪 {{ t('wizard.demo') }}</a>
      </div>
      <p v-if="restoreMsg" class="hint">{{ restoreMsg }}</p>
    </template>

    <template v-else>
      <h2>{{ t('wizard.unitsTitle') }}</h2>
      <p>{{ t('wizard.unitsText') }}</p>
      <div class="wiz-presets">
        <button v-for="[id, p] in PRESETS" :key="id" type="button" :class="{ on: presetOn(p) }" :aria-pressed="presetOn(p)" @click="choice = { ...choice, ...p }">
          {{ t('settings.presets.' + id) }}
        </button>
      </div>
      <label class="lbl" for="wiz-currency">{{ t('settings.currency') }}</label>
      <span class="inp">
        <select id="wiz-currency" v-model="choice.currency">
          <option v-for="[code, name] in currencies" :key="code" :value="code">{{ name }}</option>
        </select>
      </span>
      <small class="form-note">{{ t('wizard.unitsLater') }}</small>
      <div class="wiz-nav">
        <button class="link" @click="step = 1">{{ t('wizard.back') }}</button>
        <button class="primary" @click="next">{{ t('wizard.next') }}</button>
      </div>
    </template>
  </div>
</template>
