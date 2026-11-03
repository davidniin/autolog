<script setup>
// Avisos del vehículo, de más a menos urgente. Estado con icono + texto (no solo color).
import { computed } from 'vue';
import { reminderState } from './calc.js';
import { P, enablePush, disablePush, testPush } from './push.js';
import { t } from './i18n/index.js';
import { DEMO } from './store.js';

const props = defineProps({ reminders: Array, km: Number });
const emit = defineEmits(['edit', 'done', 'add']);

const ICON = { late: '⛔', soon: '⚠️', ok: '✅' };
const rows = computed(() =>
  props.reminders.map((r) => ({ r, st: reminderState(r, props.km) })).sort((a, b) => a.st.score - b.st.score),
);
</script>

<template>
  <div>
    <h3 class="h-row">{{ t('rem.heading') }} <button class="link" @click="emit('add', 'reminders')">{{ t('rem.add') }}</button></h3>
    <button v-if="!rows.length" class="item hint-card" @click="emit('add', 'reminders')">
      <span class="item-icon">🔔</span>
      <span class="item-body">{{ t('rem.emptyTitle') }}<small>{{ t('rem.emptySub') }}</small></span>
    </button>
    <div v-for="{ r, st } in rows" :key="r.id" class="item reminder" :class="st.level" @click="emit('edit', 'reminders', r)">
      <span class="item-icon" :title="t('rem.level.' + st.level)">{{ ICON[st.level] }}</span>
      <span class="item-body">
        {{ r.title }}
        <small><b class="lvl">{{ t('rem.level.' + st.level) }}</b> · {{ st.text }}</small>
      </span>
      <button class="done-btn" @click.stop="emit('done', r)">{{ t('rem.done') }}</button>
    </div>
    <div v-if="!DEMO && (P.supported || P.iosBrowser)" class="push">
      <template v-if="!P.supported">{{ t('rem.push.iosHint') }}</template>
      <template v-else-if="P.on">
        {{ t('rem.push.on') }}
        <span><button class="link" :disabled="P.busy" @click="testPush">{{ t('rem.push.test') }}</button><button class="link" :disabled="P.busy" @click="disablePush">{{ t('rem.push.off') }}</button></span>
      </template>
      <button v-else class="link" :disabled="P.busy" @click="enablePush">{{ t('rem.push.enable') }}</button>
      <small v-if="P.msg">{{ P.msg }}</small>
    </div>
  </div>
</template>
