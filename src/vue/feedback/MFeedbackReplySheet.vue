<script setup>
import { computed } from 'vue'
import MSheet from '../MSheet.vue'
import MIcon from '../MIcon.vue'
import MButton from '../MButton.vue'
import { feedbackTexts, fillText } from '../../feedback/texts.js'
import { replySheet } from './useFeedbackReplies.js'

// The whole answer of the developers to one piece of feedback, opened from the status button. The text is drawn as text (never as markup); a "fixed" message has no text of its own.
const props = defineProps({ locale: { type: String, default: 'zh' } })
const F = computed(() => feedbackTexts(props.locale))
const item = computed(() => replySheet.item)
const when = computed(() => {
  const at = item.value?.at
  if (!Number.isFinite(at)) return ''
  try { return new Intl.DateTimeFormat(props.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(at) } catch { return '' }
})
const body = computed(() => (item.value?.kind === 'fixed' ? fillText(F.value.replyFixed, { version: item.value.version }) : item.value?.text || ''))
</script>

<template>
  <MSheet v-model="replySheet.open" :title="F.replyTitle" side="center" :close-label="F.replyClose" class="fb-reply">
    <section v-if="item" class="fb-reply__body" data-fb-reply>
      <header class="fb-reply__about">
        <span class="fb-reply__ico" :class="{ 'is-fixed': item.kind === 'fixed' }"><MIcon :name="item.kind === 'fixed' ? 'check_circle' : 'forum'" fill /></span>
        <span class="fb-reply__who"><small>{{ F.replyAbout }}</small><b data-fb-reply-title>{{ item.title || F.replyUntitled }}</b></span>
      </header>
      <p class="fb-reply__text" data-fb-reply-text>{{ body }}</p>
      <p v-if="when" class="fb-reply__when">{{ when }}</p>
    </section>
    <template #actions>
      <MButton variant="text" autofocus @click="replySheet.open = false">{{ F.replyClose }}</MButton>
    </template>
  </MSheet>
</template>
