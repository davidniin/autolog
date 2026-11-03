<script setup>
// Avisos del vehículo, de más a menos urgente. Estado con icono + texto (no solo color).
import { computed } from 'vue';
import { reminderState } from './calc.js';
import { P, enablePush, disablePush, testPush } from './push.js';

const props = defineProps({ reminders: Array, km: Number });
const emit = defineEmits(['edit', 'done', 'add']);

const LEVEL = { late: ['⛔', 'Vencido'], soon: ['⚠️', 'Pronto'], ok: ['✅', 'Al día'] };
const rows = computed(() =>
  props.reminders.map((r) => ({ r, st: reminderState(r, props.km) })).sort((a, b) => a.st.score - b.st.score),
);
</script>

<template>
  <div>
    <h3 class="h-row">Avisos <button class="link" @click="emit('add', 'reminders')">＋ Añadir</button></h3>
    <button v-if="!rows.length" class="item hint-card" @click="emit('add', 'reminders')">
      <span class="item-icon">🔔</span>
      <span class="item-body">Añade avisos: aceite, ITV, seguro…<small>Por fecha, por km o lo primero que llegue</small></span>
    </button>
    <div v-for="{ r, st } in rows" :key="r.id" class="item reminder" :class="st.level" @click="emit('edit', 'reminders', r)">
      <span class="item-icon" :title="LEVEL[st.level][1]">{{ LEVEL[st.level][0] }}</span>
      <span class="item-body">
        {{ r.title }}
        <small><b class="lvl">{{ LEVEL[st.level][1] }}</b> · {{ st.text }}</small>
      </span>
      <button class="done-btn" @click.stop="emit('done', r)">Hecho</button>
    </div>
    <div v-if="P.supported || P.iosBrowser" class="push">
      <template v-if="!P.supported">📲 En iPhone, añade AutoLog a la pantalla de inicio para recibir los avisos como notificación.</template>
      <template v-else-if="P.on">
        🔔 Notificaciones activadas en este móvil
        <span><button class="link" :disabled="P.busy" @click="testPush">Probar</button><button class="link" :disabled="P.busy" @click="disablePush">Desactivar</button></span>
      </template>
      <button v-else class="link" :disabled="P.busy" @click="enablePush">🔔 Avisarme también con notificaciones en este móvil</button>
      <small v-if="P.msg">{{ P.msg }}</small>
    </div>
  </div>
</template>
