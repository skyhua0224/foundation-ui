<script setup>
import { computed } from 'vue'
import MIconButton from '../MIconButton.vue'
import MIcon from '../MIcon.vue'
import { openFeedbackHere } from '../devmode/devReport.js'
import { feedbackTexts } from '../../feedback/texts.js'

// The 反馈 entry of the caption bar, next to the bell (the `announcements` slot of MCaption): an icon button; `labelled` adds the word for a bar with room.
const props = defineProps({ locale: { type: String, default: 'zh' }, labelled: { type: Boolean, default: false }, page: { type: String, default: '' } })
const label = computed(() => feedbackTexts(props.locale).button)
const open = () => openFeedbackHere({ page: props.page })
</script>

<template>
  <button v-if="labelled" type="button" class="fb-pill" data-fb="titlebar" @click="open"><MIcon name="feedback" /><span>{{ label }}</span></button>
  <MIconButton v-else icon="feedback" :label="label" data-fb="titlebar" @click="open" />
</template>

<style>
.fb-pill { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px 0 10px; border: 0; border-radius: 18px; cursor: pointer; font: var(--m-label-large); color: var(--md-sys-color-on-secondary-container); background: var(--md-sys-color-secondary-container); }
.fb-pill:hover { background: color-mix(in srgb, var(--md-sys-color-on-secondary-container) 8%, var(--md-sys-color-secondary-container)); }
.fb-pill .m-icon { font-size: 20px; width: 20px; height: 20px; }
</style>
