<script setup>
import { computed, ref } from 'vue'
import MIcon from './MIcon.vue'
import MGroup from './MGroup.vue'
import MItem from './MItem.vue'
import MGuideUpdate from './MGuideUpdate.vue'
import { channelOf } from './guideModel.js'

// The update channel step of the first-run guide: 稳定版 (the default, recommended) or 测试版, each with one plain sentence, and where the downloads come from (the update source and the
// optional Mirror酱 CDK, MGuideUpdate: the labels 国内高速 and 付费 and the words about it being a way to sponsor the developers are its own). A choice is saved at once.
//   state.channel: { value: 'stable' | 'prerelease' }; callbacks.loadChannel(), callbacks.setChannel(value) -> { ok }; `source` false leaves the update source out (a product without one).
const props = defineProps({
  T: { type: Object, required: true },
  locale: { type: String, default: 'en' },
  state: { type: Object, required: true },
  callbacks: { type: Object, default: () => ({}) },
  source: { type: Boolean, default: true },
})
const emit = defineEmits(['open-url'])
const C = computed(() => props.T.channel)
const picked = ref('')
const failed = ref(false)
const channel = computed(() => picked.value || channelOf(props.state.channel?.value))
const rows = computed(() => [
  { value: 'stable', icon: 'verified_user', title: C.value.stable, text: C.value.stableText },
  { value: 'prerelease', icon: 'science', title: C.value.beta, text: C.value.betaText },
])
async function pick(value) {
  if (value === channel.value) return
  picked.value = value; failed.value = false
  try {
    const result = (await props.callbacks.setChannel?.(value)) || { ok: false }
    if (!result.ok) { picked.value = ''; failed.value = true }
  } catch { picked.value = ''; failed.value = true }
}
</script>

<template>
  <div class="m-gchan">
    <h2 class="m-guide__label">{{ C.channel }}</h2>
    <MGroup role="radiogroup" :aria-label="C.channel">
      <MItem v-for="r in rows" :key="r.value" action role="radio" :icon="r.icon" :title="r.title" :text="r.text" :data-channel="r.value" :selected="channel === r.value" :aria-checked="channel === r.value" @click="pick(r.value)">
        <template #trail><MIcon v-if="channel === r.value" name="check" /></template>
      </MItem>
    </MGroup>
    <p v-if="failed" class="m-guide__note" role="alert"><MIcon name="error" />{{ C.failed }}</p>
    <template v-if="source">
      <h2 class="m-guide__label">{{ C.source }}</h2>
      <MGuideUpdate :locale="locale" :state="state" :callbacks="callbacks" @open-url="(url) => emit('open-url', url)" />
    </template>
  </div>
</template>
