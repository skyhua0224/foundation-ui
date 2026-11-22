<script>
export const tileIds = ['ctl-audio', 'ctl-controller', 'ctl-cursor', 'ctl-keyboard', 'ctl-mouse', 'live-audio']
</script>

<script setup>
// The host's switches as Quick Settings toggles in the calibrated language (round 31; references: REFERENCES.md "控制"): the whole tile is the switch. On: the tile is
// the accent's container and the glyph's circle is filled with the accent; off: the card, the circle on the inner surface. The name at the bottom left and the state
// word under it in bold, always written (never colour alone, Apple HIG). What the person chose shows until the host's value comes back.
import { computed, ref, watch } from 'vue'
import MIcon from '../MIcon.vue'
import { b3Texts } from './b3Texts.js'
import { designProps } from './tileData.js'

const props = defineProps(designProps)
const emit = defineEmits(['act'])
const d = computed(() => props.card.data || {})
const L = computed(() => b3Texts(props.texts))
const onValue = computed(() => d.value.options?.[0]?.value)
const offValue = computed(() => d.value.options?.[1]?.value)
const draft = ref(null)
watch(() => d.value.value, () => { draft.value = null })
const on = computed(() => (draft.value !== null ? draft.value : String(d.value.value) === String(onValue.value)))
function flip() {
  if (props.preview) return
  draft.value = !on.value
  // a switch of the running stream (the host audio of the client) acts on the stream, it is not a saved setting: nothing says "after a restart" and the product sends the command
  if (d.value.runtime) { emit('act', { type: 'runtime-host-audio', value: { client: d.value.client, enabled: draft.value, failed: () => { draft.value = null } } }); return }
  emit('act', { type: 'setting', value: { key: d.value.key, value: draft.value ? onValue.value : offValue.value, failed: () => { draft.value = null } } })
}
</script>

<template>
  <button type="button" role="switch" class="m-tile m-cal m-cala m-b3t" :class="on ? 'is-on' : 'is-off'" data-size="s" data-accent="primary" :aria-checked="on" :aria-label="card.title" @click="flip">
    <span class="m-cala__glyph"><MIcon :name="d.icon" /></span>
    <span class="m-b3a__text"><b class="m-cala__name">{{ card.title }}</b><small class="m-b3a__state">{{ on ? L.on : L.off }}</small><small class="m-b3a__note">{{ d.runtime ? L.liveNote : L.restartNote }}</small></span>
  </button>
</template>
