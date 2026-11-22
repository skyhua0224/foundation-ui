<script>
export const tileIds = ['live-bitrate', 'live-ds5']
</script>

<script setup>
// What really acts on a running stream (host audit 2026-11-05): the bitrate of one client (GET /api/runtime/bitrate, localhost only) and the common DualSense tuning
// (POST /api/dualsense/tuning). The tiles say what the host does with the value: the bitrate is limited to the ceiling the host started with.
import { computed, reactive, ref, watch } from 'vue'
import MIcon from '../MIcon.vue'
import MSlider from '../MSlider.vue'
import { designProps } from './tileData.js'
import { bitrateChipMarks, bitrateFromProgress, bitrateSliderProgress, bitrateSliderSpan } from '../../settings/bitrate.js'

const props = defineProps(designProps)
const emit = defineEmits(['act'])
const d = computed(() => props.card.data || {})
const T = computed(() => props.texts || {})
const rate = ref(d.value.now ?? d.value.min ?? 1)
watch(() => d.value.now, (v) => { if (v !== null && v !== undefined) rate.value = v })
// the target bitrate of the stream runs on the shared segmented bitrate scale (the 5-200 Mbps of everyday use spread over the track, marks under the usual values), between the limits the host gave (Mbps)
const lo = computed(() => Math.round((d.value.min ?? 1) * 1000)), hi = computed(() => Math.round((d.value.max ?? 800) * 1000))
const span = computed(() => bitrateSliderSpan(lo.value, hi.value))
const marks = computed(() => bitrateChipMarks([5, 10, 20, 50, 100, 200], lo.value, hi.value))
// the shared M3 Expressive slider at every size of the tile; the layout makes room for it
const sliderSize = 'm'
const rateProgress = computed({
  get: () => Math.min(span.value.max, Math.max(span.value.min, bitrateSliderProgress(rate.value * 1000))),
  set: (position) => { rate.value = Math.max(lo.value, bitrateFromProgress(position)) / 1000 },
})
const sendRate = () => { if (!props.preview) emit('act', { type: 'runtime-bitrate', value: { client: d.value.client, kbps: Math.round(rate.value * 1000) } }) }
const levels = reactive({})
watch(() => d.value.sliders, () => { for (const k of Object.keys(levels)) delete levels[k] })
const levelOf = (s) => (s.key in levels ? levels[s.key] : s.value)
const f2 = (v) => (Math.round(v * 100) / 100).toString()
// 中 holds one slider, 大 three; the rest of the tuning is on the gamepad page, which the head of the tile opens
const shown = computed(() => (d.value.sliders || []).slice(0, props.card.size === 'l' ? 3 : 1))
const hidden = computed(() => (d.value.sliders || []).length - shown.value.length)
const tune = (s, v) => { levels[s.key] = v; if (!props.preview) emit('act', { type: 'ds5-tune', value: { key: s.key, value: v } }) }
</script>

<template>
  <section v-if="card.id === 'live-bitrate'" class="m-tile m-cal m-rc m-rc--live is-m" data-size="m" data-accent="primary">
    <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span></header>
    <div class="m-rc__mid"><b class="m-rc__big m-dnum"><span>{{ rate }}</span><small>Mbps</small></b><small class="m-rc__note">{{ d.note }}</small></div>
    <div class="m-rc__live">
      <MSlider v-model="rateProgress" :min="span.min" :max="span.max" :step="1" :size="sliderSize" :label="card.title" :marks="marks" :bubble-text="`${rate} Mbps`" @commit="sendRate" />
    </div>
  </section>
  <section v-else class="m-tile m-cal m-rc m-rc--live" :class="card.size === 'l' ? 'is-l' : 'is-m'" :data-size="card.size === 'l' ? 'l' : 'm'" data-accent="secondary">
    <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span><button v-if="hidden > 0 && !preview" type="button" class="m-rc__all" :aria-label="d.more || card.title" @click.stop="emit('act', { type: 'open', value: 'gamepad' })"><span v-if="d.more">{{ d.more }}</span><MIcon name="chevron_right" /></button></header>
    <ul class="m-rc__rows">
      <li v-for="s in shown" :key="s.key" class="m-rc__row is-slider is-full is-hv">
        <span class="m-rc__text"><span class="m-rc__line"><b>{{ s.label }}</b><strong class="m-rc__val m-dnum">{{ f2(levelOf(s)) }}</strong></span><small>{{ d.applies }}</small></span>
        <span class="m-rc__ctl"><MSlider :model-value="levelOf(s)" :min="s.min" :max="s.max" :step="s.step" :size="sliderSize" :label="s.label" @update:model-value="(v) => { levels[s.key] = v }" @commit="(v) => tune(s, v)" /></span>
      </li>
    </ul>
  </section>
</template>
