<script>
export const tileIds = ['loss', 'dropped', 'latency', 'stream-bitrate', 'stream-fps']
</script>

<script setup>
// The live numbers of a stream (REFERENCES.md "bitrate", "fps", "loss", "dropped", "stream-bitrate", "stream-fps"); 延迟 (latency) is drawn as the bitrate is: the number and its curve.
//   码率 v1 (Stocks): the curve edge to edge over its own range, the now dot · v2 (Screen Time / Nothing bars): a tonal tile, one pill per sample, the newest in the accent.
//     方形: the number and the chart · 中: + the resolution and the peak · 大: + lowest, mean, highest
//   帧率: the curve against the target, dashed, behind the number; a frame rate has no natural full, so it is never a ring.
//     方形: the number and the curve · 中: + the target · 大: + lowest, mean, highest
//   丢包 and 丢帧: one bar per sample (a spike is an event), the tile turns warn or error with the value · 码率 (stream-bitrate): an open gauge against the cap when there is one
//   帧率 (stream-fps): the measured rate as the number, the recent history of the rate as the curve behind it, the target as its dashed line (edge to edge at every size)
import { computed } from 'vue'
import MTileHead from '../MTileHead.vue'
import MTileNumeral from '../MTileNumeral.vue'
import MTileChart from '../MTileChart.vue'
import MTileRing from '../MTileRing.vue'
import MTileChip from '../MTileChip.vue'
import MTileShape from '../MTileShape.vue'
import MTileEmpty from '../MTileEmpty.vue'
import { finite, firstNumber, num, OPEN, sizeOf, statsOf, designProps } from './tileData.js'

const props = defineProps(designProps)
const emit = defineEmits(['act'])
const id = computed(() => props.card.id)
const d = computed(() => props.card.data || {})
const size = computed(() => sizeOf(props.card))
const pts = computed(() => finite(d.value.points))
const dec = computed(() => (['bitrate', 'loss', 'latency', 'stream-bitrate'].includes(id.value) ? 1 : 0))
const stats = computed(() => statsOf(pts.value, dec.value, d.value.unit))
const label = (k) => ({ min: props.texts.statMin, avg: props.texts.statAvg, max: props.texts.statMax }[k] || k)
const peak = computed(() => (d.value.peak ? `${props.texts.peak || ''} ${d.value.peak} ${d.value.unit || ''}`.trim() : ''))
// 帧率: the target is the number of its caption (目标 120 fps); the dashed line of the curve
// how many samples the curve shows: the frame rate's curve spans the tile edge to edge from the first samples on (it grows to its window), the others keep their window
const chartWindow = computed(() => {
  const w = ((id.value === 'bitrate' && props.variant === 2) || ['loss', 'dropped'].includes(id.value) ? { s: 12, m: 24, l: 30 } : { s: 20, m: 36, l: 48 })[size.value]
  return isFps.value ? Math.max(2, Math.min(w, pts.value.length)) : w
})
const isFps = computed(() => id.value === 'fps' || id.value === 'stream-fps')
const target = computed(() => (id.value === 'fps' ? firstNumber(d.value.caption) : id.value === 'stream-fps' ? num(d.value.target) : null))
// 丢包, 丢帧: none is fine, some is a warning, a lot an error
const issueTone = computed(() => { const v = num(d.value.value) ?? 0; return v <= 0 ? 'primary' : (id.value === 'loss' ? v >= 2 : v >= 10) ? 'error' : 'warn' })
// the rows tiles of the session (stream-bitrate, stream-fps)
const rowsBig = computed(() => String(d.value.big || ''))
const bigNum = computed(() => { const m = /^([\d.]+)\s*(.*)$/.exec(rowsBig.value); return m ? { v: m[1], u: m[2] } : { v: rowsBig.value, u: '' } })
const cap = computed(() => (id.value === 'stream-bitrate' ? firstNumber(d.value.rows?.[0]?.value) : null))
const capText = computed(() => (d.value.rows?.[0] ? `${d.value.rows[0].title} ${d.value.rows[0].value}` : ''))
const accent = computed(() => (['loss', 'dropped'].includes(id.value) ? issueTone.value : id.value === 'fps' || id.value === 'stream-fps' ? 'primary' : 'secondary'))
</script>

<template>
  <section class="m-tile m-tstream" :class="[`m-tstream--${id}`, `is-${size}`, `is-v${variant}`, { 'm-tile--tonal': id === 'bitrate' && variant === 2 }]" :data-accent="accent" :data-size="size">
    <MTileEmpty v-if="empty" :icon="empty.icon" :title="empty.title" :text="empty.value" :action="empty.action" :size="size" @act="(a) => emit('act', a)" />

    <template v-else-if="id === 'stream-bitrate'">
      <MTileShape v-if="!cap" class="m-tile__corner" shape="clover" size="150px" tone="tonal" />
      <MTileHead :icon="d.icon" :title="card.title" :chevron="chevron && size !== 's'" @open="emit('act', OPEN)" />
      <div class="m-tstream__gauge">
        <MTileRing v-if="cap" class="m-tstream__ring" :value="(num(bigNum.v) ?? 0) / cap">
          <MTileNumeral :value="bigNum.v" :unit="bigNum.u" size="s" />
        </MTileRing>
        <template v-else>
          <MTileNumeral class="m-tstream__alone" :value="bigNum.v" :unit="bigNum.u" :size="size === 's' ? 's' : 'm'" />
        </template>
        <div v-if="size !== 's'" class="m-tstream__side">
          <MTileChip v-for="r in d.rows || []" :key="r.title" :icon="r.icon" :label="`${r.title} ${r.value}`" />
        </div>
      </div>
      <span v-if="size === 's' && id === 'stream-bitrate' && capText" class="m-tstream__foot">{{ capText }}</span>
      <!-- 中: the lowest, mean and highest of the session in a row, and its curve under the gauge -->
      <dl v-if="id === 'stream-bitrate' && size === 'm' && pts.length > 1 && stats.length" class="m-tstream__stats m-tstream__stats--row"><div v-for="x in stats" :key="x.k"><dt>{{ label(x.k) }}</dt><dd class="m-dnum">{{ x.value }}</dd></div></dl>
      <MTileChart v-if="id === 'stream-bitrate' && size === 'm' && pts.length > 1" class="m-tile__bleed m-tstream__spark m-tstream__spark--bitrate" :points="pts" kind="area" :dot="true" :window="36" :pad="0.12" :target="cap" />
    </template>

    <template v-else>
      <MTileHead :icon="d.icon" :title="card.title" :chevron="chevron && size !== 's'" @open="emit('act', OPEN)"><MTileChip v-if="size !== 's' && peak" :label="peak" /></MTileHead>
      <div class="m-tstream__top">
        <MTileNumeral :value="d.value" :unit="d.unit" :size="size === 'l' ? 'xl' : size" :caption="size !== 's' ? d.caption : ''" />
        <dl v-if="(size === 'l' || (size === 'm' && ['loss', 'dropped'].includes(id))) && stats.length" class="m-tstream__stats"><div v-for="x in stats" :key="x.k"><dt>{{ label(x.k) }}</dt><dd class="m-dnum">{{ x.value }}</dd></div></dl>
      </div>
      <MTileChart v-if="pts.length > 1" class="m-tile__bleed" :points="pts" :max="isFps && target ? target * 1.1 : null" :target="isFps ? target : null"
        :kind="(id === 'bitrate' && variant === 2) || ['loss', 'dropped'].includes(id) ? 'bars' : 'area'" :dot="!(id === 'bitrate' && variant === 2) && !['loss', 'dropped'].includes(id)" :grid="size === 'l'"
        :window="chartWindow" />
    </template>
  </section>
</template>
