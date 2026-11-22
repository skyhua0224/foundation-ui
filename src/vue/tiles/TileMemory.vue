<script>
export const tileIds = ['memory-trend']
</script>

<script setup>
// 内存 and 内存变化 (REFERENCES.md "memory", "memory-trend").
//   内存 variant 1, the Batteries / Activity rings widget: one ring whose segments are this host's programs and the others, the free part is the track.
//     方形: the ring, the share in it · 中: + the parts with their sizes beside it
//   内存 variant 2, a tank (Pixel Battery's fill, iOS Batteries' bar turned up): the tile fills from its bottom edge to the share in use, a wave on top.
//     方形: the fill and the share · 中: + the parts as a stacked bar and their sizes
//   内存变化: the Stocks curve of the share in use over the last hour, the share now (方形), + lowest, mean, highest (中)
import { computed } from 'vue'
import MTileHead from '../MTileHead.vue'
import MTileNumeral from '../MTileNumeral.vue'
import MTileRing from '../MTileRing.vue'
import MTileChart from '../MTileChart.vue'
import MTileEmpty from '../MTileEmpty.vue'
import { finite, hot, memoryOf, OPEN, sizeOf, statsOf, designProps } from './tileData.js'

const props = defineProps(designProps)
const emit = defineEmits(['act'])
const d = computed(() => props.card.data || {})
const size = computed(() => sizeOf(props.card))
const trend = computed(() => props.card.id === 'memory-trend')
const mem = computed(() => memoryOf(d.value))
// the ring's parts: the used ones (this host, the others or "used"), the free part is the track
const used = computed(() => mem.value.parts.filter((p) => p.tone !== 'free'))
const segments = computed(() => used.value.map((p, i) => ({ value: p.value, tone: i ? 'b' : 'a' })))
const pct = computed(() => Math.min(100, Math.max(0, mem.value.pct ?? 0)))
const pts = computed(() => finite(d.value.points))
const stats = computed(() => statsOf(pts.value, 0, '%'))
const label = (k) => ({ min: props.texts.statMin, avg: props.texts.statAvg, max: props.texts.statMax }[k] || k)
const toneOf = (p, i) => (p.tone === 'free' ? 'free' : i ? 'b' : 'a')
</script>

<template>
  <section class="m-tile m-tmem" :class="[`m-tmem--${trend ? 'trend' : `v${variant}`}`, `is-${size}`, { 'is-hot': !trend && hot(mem.pct, 100) }]" data-accent="secondary" :data-size="size">
    <MTileEmpty v-if="empty" :icon="empty.icon" :title="empty.title" :text="empty.value" :action="empty.action" :size="size" @act="(a) => emit('act', a)" />
    <template v-else-if="trend">
      <MTileHead :icon="d.icon" :title="card.title" :chevron="chevron && size !== 's'" @open="emit('act', OPEN)" />
      <div class="m-tmem__top">
        <MTileNumeral :value="d.value" unit="%" :size="size" :caption="size !== 's' ? d.caption : ''" />
        <dl v-if="size !== 's' && stats.length" class="m-tmem__stats"><div v-for="x in stats" :key="x.k"><dt>{{ label(x.k) }}</dt><dd class="m-dnum">{{ x.value }}</dd></div></dl>
      </div>
      <MTileChart class="m-tile__bleed" :points="pts" :max="100" kind="area" dot :window="size === 's' ? 20 : 40" />
    </template>
    <template v-else-if="variant === 2">
      <div class="m-tmem__tank" aria-hidden="true" :style="{ transform: `translateY(${100 - pct}%)` }">
        <svg class="m-tmem__wave" viewBox="0 0 120 10" preserveAspectRatio="none"><path d="M0 5 Q15 0 30 5 T60 5 T90 5 T120 5 V10 H0 Z" /></svg>
      </div>
      <MTileHead :icon="d.icon" :title="card.title" :chevron="chevron && size !== 's'" @open="emit('act', OPEN)" />
      <div class="m-tmem__row">
        <MTileNumeral :value="d.value" :unit="mem.unit" :size="size === 's' ? 's' : 'm'" :caption="mem.total" />
        <ul v-if="size !== 's'" class="m-tmem__legend">
          <li v-for="(p, i) in mem.parts" :key="p.label" :class="`is-${toneOf(p, i)}`"><i /><span>{{ p.label }}</span><b class="m-dnum">{{ p.text }}</b></li>
        </ul>
      </div>
    </template>
    <template v-else>
      <MTileHead :icon="d.icon" :title="card.title" :chevron="chevron && size !== 's'" @open="emit('act', OPEN)" />
      <div class="m-tmem__body">
        <MTileRing class="m-tmem__ring" :segments="segments">
          <MTileNumeral :value="d.value" :unit="mem.unit" size="s" :caption="size === 's' ? mem.total : ''" />
        </MTileRing>
        <div v-if="size !== 's'" class="m-tmem__side">
          <b class="m-tmem__total m-dnum">{{ mem.total }}</b>
          <ul class="m-tmem__legend">
            <li v-for="(p, i) in mem.parts" :key="p.label" :class="`is-${toneOf(p, i)}`"><i /><span>{{ p.label }}</span><b class="m-dnum">{{ p.text }}</b></li>
          </ul>
        </div>
      </div>
    </template>
  </section>
</template>
