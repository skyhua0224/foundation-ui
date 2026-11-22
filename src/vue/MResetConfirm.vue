<script setup>
import { computed, ref, watch } from 'vue'
import MButton from './MButton.vue'
import MDialog from './MDialog.vue'
import MGroup from './MGroup.vue'
import MSwitchItem from './MSwitchItem.vue'
import { useCountdown } from './useCountdown.js'
import { RESET_SECONDS, countdownLabel, fill } from '../reset/model.js'
import { resetTexts } from '../reset/texts.js'

// The question before a reset: what is reset and what stays, and a confirm button that counts down (RESET_SECONDS) before it can be pressed.
//   kind  'host' (restore the defaults of the host: offers to clear the application list too), 'panel' (the preferences of the control panel), 'restore' (the last backup)
// A restore can be undone (the settings it replaces are backed up), so its button does not count down.
const open = defineModel({ type: Boolean, default: false })
const props = defineProps({
  kind: { type: String, default: 'host' },
  locale: { type: String, default: 'en' },
  /** restore: when the backup was made, as text */
  time: { type: String, default: '' },
  /** restore: the backup has an application list too */
  hasApps: { type: Boolean, default: false },
  /** a stream is running: the question says it ends */
  streaming: { type: Boolean, default: false },
  /** the call is on its way: the button shows it and cannot be pressed again */
  busy: { type: Boolean, default: false },
  seconds: { type: Number, default: RESET_SECONDS },
})
const emit = defineEmits(['confirm', 'cancel'])
const T = computed(() => resetTexts(props.locale))
const K = computed(() => T.value[props.kind] || T.value.host)
// the label of a list and its words: “会重置：…” / “Resets: …”
const sep = computed(() => (/^zh/i.test(String(props.locale)) ? '：' : ': '))
const clearApps = ref(false)
const counts = computed(() => props.kind !== 'restore')
const countdown = useCountdown(props.seconds)
watch(open, (value) => {
  if (value) {
    clearApps.value = false
    if (counts.value) countdown.begin()
  } else countdown.end()
}, { immediate: true })
const canConfirm = computed(() => !props.busy && (!counts.value || countdown.ready.value))
const label = computed(() => (counts.value ? countdownLabel(T.value, K.value.confirm, countdown.remaining.value) : K.value.confirm))
function confirm() {
  if (!canConfirm.value) return
  emit('confirm', { clearApps: props.kind === 'host' && clearApps.value })
}
function cancel() {
  if (props.busy) return
  open.value = false
  emit('cancel')
}
</script>

<template>
  <MDialog v-model="open" :title="K.title" icon="restart_alt" tone="warning" persistent @cancel="emit('cancel')">
    <template v-if="kind === 'restore'">
      <p class="m-dialog__message">{{ fill(K.body, { time }) }}</p>
      <p v-if="hasApps" class="m-dialog__message">{{ K.apps }}</p>
    </template>
    <template v-else>
      <p class="m-dialog__message"><strong>{{ K.resetsLabel }}</strong>{{ sep }}{{ K.resets }}</p>
      <p class="m-dialog__message"><strong>{{ K.keepsLabel }}</strong>{{ sep }}{{ K.keeps }}</p>
      <MGroup v-if="kind === 'host'"><MSwitchItem v-model="clearApps" :title="K.clearApps" :text="K.clearAppsText" /></MGroup>
      <p v-if="kind === 'host'" class="m-dialog__message">{{ K.backup }}</p>
    </template>
    <p class="m-dialog__message">{{ K.restarts }}<template v-if="streaming && kind !== 'panel'"> {{ T.host.streaming }}</template></p>
    <template #actions>
      <MButton variant="text" :disabled="busy" @click="cancel">{{ T.cancel }}</MButton>
      <MButton variant="danger" :disabled="!canConfirm && !busy" :loading="busy" data-reset-confirm @click="confirm">{{ label }}</MButton>
    </template>
  </MDialog>
</template>
