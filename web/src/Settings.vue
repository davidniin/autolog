<script setup>
// Ajustes: idioma (en este móvil). Se abre con el botón ⚙ de la cabecera.
import { t, L, LANGS, setLang } from './i18n/index.js';
import { refreshPush } from './push.js';

const emit = defineEmits(['close']);

function pickLang(l) {
  setLang(l);
  refreshPush(); // las notificaciones de este móvil, en el idioma nuevo
}
</script>

<template>
  <div class="sheet-bg" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-modal="true" :aria-label="t('settings.title')">
      <h2>{{ t('settings.title') }}</h2>
      <div class="field full" role="group" :aria-label="t('settings.language')">
        <span class="lbl">{{ t('settings.language') }}</span>
        <div class="chips">
          <button v-for="[code, name] in LANGS" :key="code" type="button" :lang="code" :class="{ on: L.lang === code }" :aria-pressed="L.lang === code" @click="pickLang(code)">{{ name }}</button>
        </div>
        <small class="form-note">{{ t('settings.languageNote') }}</small>
      </div>
      <div class="actions full">
        <button type="button" class="primary" @click="emit('close')">{{ t('common.close') }}</button>
      </div>
    </div>
  </div>
</template>
