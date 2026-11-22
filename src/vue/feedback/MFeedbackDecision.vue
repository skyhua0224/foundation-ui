<script setup>
import { computed } from 'vue'
import MDialog from '../MDialog.vue'
import MButton from '../MButton.vue'
import { devReport, clearDevReportAsk, openDevReport } from '../devmode/devReport.js'
import { feedbackTexts } from '../../feedback/texts.js'

// The centred dialog of the feedback flow: only for a short decision that needs an answer now (a crash that was just recovered: tell the developers or not). One or two sentences and two buttons; 发送反馈
// then opens the panel (the drawer) with the context filled in. The panel itself is never a dialog.
const props = defineProps({ locale: { type: String, default: 'zh' } })
const F = computed(() => feedbackTexts(props.locale))
const open = computed({ get: () => !!devReport.decision, set: (v) => { if (!v) clearDevReportAsk() } })
async function send() {
  const context = { ...devReport.context }
  clearDevReportAsk()
  await openDevReport({ kind: 'feedback', context })
}
</script>

<template>
  <MDialog v-model="open" :title="F.decisionCrashTitle" icon="feedback" tone="info" class="fb-decision" data-fb="decision">
    <p>{{ F.decisionCrashText }}</p>
    <template #actions>
      <MButton variant="text" data-fb="decision-skip" @click="open = false">{{ F.decisionSkip }}</MButton>
      <MButton icon="send" data-fb="decision-send" @click="send">{{ F.decisionSend }}</MButton>
    </template>
  </MDialog>
</template>
