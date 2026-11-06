// Fichas (FormSheet, Settings, Conflicts) accesibles con teclado y lector de pantalla:
// - al abrir, el foco entra en la ficha (primer campo, o la propia ficha); al cerrar, vuelve a donde estaba
// - Escape cierra
// - el tabulador no se sale de la ficha mientras está abierta
// Uso: const panel = ref(null); useDialog(panel, () => emit('close'));  <div ref="panel" role="dialog" tabindex="-1">
import { onMounted, onBeforeUnmount, nextTick } from 'vue';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

// Deslizar la ficha hacia abajo la cierra (como en las apps nativas). Solo si la ficha está arriba del todo,
// para no pelear con el scroll; en ordenador no hace nada (es un gesto táctil).
function swipeToClose(root, onClose) {
  const sheet = root.classList.contains('sheet') ? root : root.querySelector('.sheet');
  if (!sheet) return () => {};
  let y0 = 0, t0 = 0, dy = 0, drag = false, active = false;
  const start = (e) => {
    if (e.touches.length !== 1 || sheet.scrollTop > 0) { active = false; return; }
    active = true; drag = false; dy = 0; y0 = e.touches[0].clientY; t0 = Date.now();
  };
  const move = (e) => {
    if (!active) return;
    dy = e.touches[0].clientY - y0;
    if (dy <= 0) { if (drag) sheet.style.transform = ''; if (!drag) active = false; return; }
    if (!drag && sheet.scrollTop > 0) { active = false; return; }
    drag = true;
    if (e.cancelable) e.preventDefault();
    sheet.style.transition = 'none';
    sheet.style.transform = 'translateY(' + dy + 'px)';
  };
  const end = () => {
    if (!active || !drag) { active = false; return; }
    active = false;
    sheet.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)';
    const fast = dy / Math.max(1, Date.now() - t0) > 0.6; // px/ms
    if (dy > 120 || (fast && dy > 40)) {
      sheet.style.transform = 'translateY(100%)';
      setTimeout(onClose, 160);
    } else sheet.style.transform = '';
  };
  sheet.addEventListener('touchstart', start, { passive: true });
  sheet.addEventListener('touchmove', move, { passive: false });
  sheet.addEventListener('touchend', end);
  sheet.addEventListener('touchcancel', end);
  return () => {
    sheet.removeEventListener('touchstart', start);
    sheet.removeEventListener('touchmove', move);
    sheet.removeEventListener('touchend', end);
    sheet.removeEventListener('touchcancel', end);
  };
}

// Vibración corta (si el móvil la tiene y no se ha pedido menos movimiento): confirma que se ha guardado o borrado
export function buzz(ms = 12) {
  try {
    if (navigator.vibrate && !matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate(ms);
  } catch (e) { /* sin vibración */ }
}

export function useDialog(panelRef, onClose, { focusFirstField = true } = {}) {
  let before = null;
  let offSwipe = () => {};
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
    offSwipe = swipeToClose(panelRef.value.closest('.sheet-bg') || panelRef.value, onClose);
    const field = focusFirstField && panelRef.value.querySelector('input:not([type=checkbox]):not([type=file]), select, textarea');
    // En móvil no se abre el teclado solo: el foco va a la ficha (el lector de pantalla lee su título)
    const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    (field && !touch ? field : panelRef.value).focus({ preventScroll: true });
  });
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKey, true);
    offSwipe();
    if (before && document.contains(before)) before.focus({ preventScroll: true });
  });
}
