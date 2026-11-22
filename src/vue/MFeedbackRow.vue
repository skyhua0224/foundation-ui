<script setup>
import { computed } from 'vue'
import MItem from './MItem.vue'
import { useErrors } from './useErrors.js'
import { feedbackTexts, fillText } from '../feedback/texts.js'
import { listMine } from '../devmode/mine.js'

// 反馈: the row that opens the feedback form (the report dialog of MErrorHost, kind `manual`) from 帮助与关于. It shows only where a form
// host is mounted in this window (an embedded frame has none), and says what is sent: the person's text and the last log lines.
//   logs: the last log lines, when the page has them (the diagnostics page does; the help page sends none)
const props = defineProps({ locale: { type: String, default: 'en' }, logs: { type: String, default: '' } })
const { state, reportFeedback } = useErrors()
const T = computed(() => feedbackTexts(props.locale))
const available = computed(() => state.hosted > 0)
// the last report this computer sent: its reference, and whether it went or waits for the network
const last = computed(() => listMine().find((r) => r.ref && (r.status === 'sent' || r.status === 'queued')) || null)
const text = computed(() => (last.value ? fillText(T.value.cardLast, { state: last.value.status === 'sent' ? T.value.cardLastSent : T.value.cardLastQueued, ref: last.value.ref }) : T.value.rowHint))
defineExpose({ open: () => reportFeedback({ logs: props.logs }) })
</script>

<template>
  <MItem v-if="available" action icon="feedback" :title="T.card" :text="text" data-help-row="feedback" @click="reportFeedback({ logs })" />
</template>
