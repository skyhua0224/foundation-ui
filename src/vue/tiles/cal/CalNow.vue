<script setup>
// Calibration round: 正在玩. The cover is the one focal element.
//   方形: the cover full bleed (Android canonical "full bleed"), the title and the client at the bottom over a scrim.
//   中: the cover square on the left edge to edge, the title, the client and the stream on the right on the tonal surface (the medium Now Playing split).
import { computed } from 'vue'
import MIcon from '../../MIcon.vue'
import MTileCover from '../../MTileCover.vue'
import { coverOk } from '../../coverOk.js'
import { sizeOf } from '../tileData.js'

const props = defineProps({ card: { type: Object, required: true } })
const d = computed(() => props.card.data || {})
const size = computed(() => sizeOf(props.card))
const client = computed(() => d.value.rows?.find((r) => r.icon === 'devices')?.value || '')
const stream = computed(() => d.value.rows?.find((r) => r.icon === 'monitor')?.value || '')
// 大 adds what the stream is made of: the bitrate, the codec and how long it has run (the rows beyond the client and the screen)
const facts = computed(() => (d.value.rows || []).filter((r) => !['devices', 'monitor'].includes(r.icon)))
</script>

<template>
  <section class="m-tile m-cal m-caln" :class="[`is-${size}`, { 'has-art': coverOk(d.cover) }]" :data-size="size" data-accent="tertiary">
    <MTileCover class="m-caln__art" :name="d.name" :cover="d.cover" />
    <div class="m-caln__text">
      <span class="m-caln__label"><MIcon :name="d.icon" />{{ card.title }}</span>
      <b class="m-caln__name" data-redact="text">{{ d.name }}</b>
      <span class="m-caln__sub" data-redact="client"><span>{{ client }}</span><span v-if="size !== 's' && stream">{{ stream }}</span></span>
      <ul v-if="size === 'l' && facts.length" class="m-caln__facts"><li v-for="r in facts" :key="r.icon"><MIcon :name="r.icon" /><b class="m-dnum">{{ r.value }}</b></li></ul>
    </div>
  </section>
</template>
