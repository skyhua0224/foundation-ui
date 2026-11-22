<script setup>
import { computed } from 'vue'
import MSection from '../MSection.vue'
import MGroup from '../MGroup.vue'
import MItem from '../MItem.vue'
import MButton from '../MButton.vue'
import { openDevReport } from '../devmode/devReport.js'
import { listMine } from '../../devmode/mine.js'
import { feedbackTexts, fillText } from '../../feedback/texts.js'

// 反馈 in 帮助与关于: one card that opens the one feedback panel, with the last report this computer sent (its reference and whether it went or waits for the network).
const props = defineProps({ locale: { type: String, default: 'zh' }, title: { type: String, default: '' } })
const F = computed(() => feedbackTexts(props.locale))
const last = computed(() => listMine().find((r) => r.ref && (r.status === 'sent' || r.status === 'queued')) || null)
const lastText = computed(() => (last.value ? fillText(F.value.cardLast, { state: last.value.status === 'sent' ? F.value.cardLastSent : F.value.cardLastQueued, ref: last.value.ref }) : ''))
const open = () => openDevReport({ kind: 'feedback' })
</script>

<template>
  <MSection :title="title || F.title" data-feedback-card>
    <MGroup>
      <MItem icon="feedback" wrap :title="F.card" :text="lastText || F.cardText" data-help-row="feedback" @click="open">
        <template #trail><MButton variant="tonal" size="sm" icon="send" @click.stop="open">{{ F.cardButton }}</MButton></template>
      </MItem>
    </MGroup>
  </MSection>
</template>
