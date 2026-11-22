<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import MButton from './MButton.vue'
import { useNotify } from '../notify/store.js'
import { useBottomLayer } from './useBottomLayer.js'
import { snackPlan } from '../notify/hostPlan.js'

// The place of the snackbars of the window: mount once in the shell. One message at a time; the next waits. The message is a pill like the bar of unsaved changes (same
// surface, type, padding, elevation and action button) in the bottom stack: above the bar when it is on screen, never over it. It is a popover (top layer), so a dialog
// that is open never covers it.
const notify = useNotify()
const box = ref(null)
const style = useBottomLayer('snackbar', 1, box)
let timer = 0
let shown = ''
// the message on screen: a new id enters; the same id with new content (a progress sentence that becomes its result) is changed in place, with a fresh timer
watch(() => notify.current.value, async (item) => {
  clearTimeout(timer)
  const plan = snackPlan(shown, item)
  shown = plan.id
  if (plan.id && plan.timeout > 0) timer = setTimeout(() => notify.dismissSnack(plan.id), plan.timeout)
  if (!plan.show) return
  await nextTick()
  const el = box.value
  if (el && 'showPopover' in el) { try { el.hidePopover() } catch { /* not open yet */ } try { el.showPopover() } catch { /* no top layer here: it is fixed */ } }
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <Teleport to="body">
    <Transition name="m-snack">
      <div v-if="notify.current.value" :key="notify.current.value.id" ref="box" class="m-snackbar" popover="manual" role="status" aria-live="polite" :style="style">
        <span class="m-snackbar__text">{{ notify.current.value.message }}</span>
        <MButton v-if="notify.current.value.action" variant="text" @click="notify.runSnackAction(notify.current.value.id)">{{ notify.current.value.action }}</MButton>
      </div>
    </Transition>
  </Teleport>
</template>
