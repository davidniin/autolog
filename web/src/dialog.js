// Fichas (FormSheet, Settings, Conflicts) accesibles con teclado y lector de pantalla:
// - al abrir, el foco entra en la ficha (primer campo, o la propia ficha); al cerrar, vuelve a donde estaba
// - Escape cierra
// - el tabulador no se sale de la ficha mientras está abierta
// Uso: const panel = ref(null); useDialog(panel, () => emit('close'));  <div ref="panel" role="dialog" tabindex="-1">
import { onMounted, onBeforeUnmount, nextTick } from 'vue';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function useDialog(panelRef, onClose, { focusFirstField = true } = {}) {
  let before = null;
  const visible = (el) => el.offsetParent !== null || el === document.activeElement;
  const items = () => [...panelRef.value.querySelectorAll(FOCUSABLE)].filter(visible);

  function onKey(e) {
    if (!panelRef.value) return;
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab') return;
    const list = items();
    if (!list.length) { e.preventDefault(); panelRef.value.focus(); return; }
    const first = list[0], last = list[list.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.value)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  onMounted(async () => {
    before = document.activeElement;
    document.addEventListener('keydown', onKey, true);
    await nextTick();
    if (!panelRef.value) return;
    const field = focusFirstField && panelRef.value.querySelector('input:not([type=checkbox]):not([type=file]), select, textarea');
    // En móvil no se abre el teclado solo: el foco va a la ficha (el lector de pantalla lee su título)
    const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    (field && !touch ? field : panelRef.value).focus({ preventScroll: true });
  });
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKey, true);
    if (before && document.contains(before)) before.focus({ preventScroll: true });
  });
}
