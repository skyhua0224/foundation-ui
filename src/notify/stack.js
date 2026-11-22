import { reactive, watchEffect } from 'vue'

/**
 * The bottom of a window is one stack: the bar of unsaved changes, the snackbar, a toast. Each layer reports its height when it is on screen and
 * takes its place above the layers of lower order, so nothing overlaps another and a layer that comes or goes moves the ones above it.
 *   order: pbar 0 (the unsaved bar), snackbar 1, toast 3
 */
export const STACK_BASE = 20
export const STACK_GAP = 12
const layers = reactive({})
// the height of the bottom navigation bar of a phone (the scene reports it): the whole stack stands above it
const room = reactive({ bar: 0 })
export const bottomStack = {
  layers,
  report(id, order, height) { layers[id] = { order, height: Math.max(0, Math.round(height)) } },
  release(id) { delete layers[id] },
  setBarRoom(height) { room.bar = Math.max(0, Math.round(height || 0)) },
  /** distance of a layer's bottom edge from the bottom of the window */
  offsetOf(id) {
    const me = layers[id]
    const order = me ? me.order : Infinity
    let at = STACK_BASE + room.bar
    for (const l of Object.values(layers)) if (l.order < order && l.height > 0) at += l.height + STACK_GAP
    return at
  },
}

/**
 * How much of the bottom of the window the bar of unsaved changes takes: its height, the gap above it and the base below it. The scroll area of a page ends that far above the window's bottom while the bar is
 * shown (--m-bottom-reserve, layout.css), so the last row of a page can be scrolled clear of the bar. A snackbar comes and goes: it is not reserved.
 */
export const reserveOf = (stack) => (stack.pbar && stack.pbar.height > 0 ? room.bar + STACK_BASE + stack.pbar.height + STACK_GAP : 0)
if (typeof document !== 'undefined') watchEffect(() => { document.documentElement.style.setProperty('--m-bottom-reserve', `${reserveOf(layers)}px`) })
