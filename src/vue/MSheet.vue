<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MIconButton from './MIconButton.vue'
import { useModalBridge } from './useModalBridge.js'
import { warmDialogRaster } from './warmDialogRaster.js'
import { useHistoryClose } from './useHistoryClose.js'

// Side sheet (wide windows), bottom sheet, or a centred dialog (`center`: 600 wide, a bottom sheet under 600): detail that would crowd a small dialog. Modal, closes on Escape and scrim.
const open = defineModel({ type: Boolean, default: false })
const props = defineProps({
  title: { type: String, required: true },
  side: { type: String, default: 'end' }, // end | bottom | center
  wide: { type: Boolean, default: false }, // a side sheet for charts: about 640 wide
  closeLabel: { type: String, default: 'Close' },
  /** cannot be dismissed (work in progress) */
  persistent: { type: Boolean, default: false },
})
const el = ref(null)
let opener = null
watch(open, async (value) => {
  await nextTick()
  if (!el.value) return
  if (value && !el.value.open) { opener = document.activeElement; el.value.showModal() }
  else if (!value && el.value.open) el.value.close()
}, { immediate: true, flush: 'post' })
const close = () => { if (!props.persistent) open.value = false }
useModalBridge(open, close)
useHistoryClose(open, close, () => props.persistent)
const onClose = () => { if (open.value && !props.persistent) open.value = false; if (opener instanceof HTMLElement) opener.focus() }
// The first opening of a sheet styles and lays out its whole content inside the click (25 to 40 ms on the Skyward panel; the later ones 10 to 15). Once, at idle
// and unseen (offscreen, hidden), the closed sheet is laid out so that the first opening finds that done.
let warmTimer = 0
onMounted(() => {
  warmDialogRaster()
  warmTimer = window.setTimeout(function warm() {
    const dialog = el.value
    if (!dialog || dialog.open || open.value) return
    try { if (navigator.scheduling?.isInputPending?.()) { warmTimer = window.setTimeout(warm, 1000); return } } catch { /* no such API */ }
    const originalStyle = dialog.getAttribute('style')
    dialog.style.cssText = 'display:block;position:fixed;inset:auto;left:-99999px;top:0;visibility:hidden;pointer-events:none'
    void dialog.offsetHeight
    if (originalStyle === null) dialog.removeAttribute('style')
    else dialog.setAttribute('style', originalStyle)
  }, 4000 + Math.random() * 4000)
})
onBeforeUnmount(() => { clearTimeout(warmTimer); el.value?.open && el.value.close() })
</script>

<template>
  <dialog ref="el" class="m-sheet" :class="[`m-sheet--${props.side}`, { 'm-sheet--wide': wide }]" aria-labelledby="m-sheet-title" @cancel.prevent="close" @close="onClose" @click.self="close">
    <div class="m-sheet__panel">
      <header class="m-sheet__head">
        <h2 id="m-sheet-title">{{ title }}</h2>
        <MIconButton v-if="!persistent" icon="close" :label="closeLabel" data-tip-side="start" @click="close" />
      </header>
      <div class="m-sheet__body"><slot /></div>
      <footer v-if="$slots.actions" class="m-sheet__actions"><slot name="actions" /></footer>
    </div>
  </dialog>
</template>
