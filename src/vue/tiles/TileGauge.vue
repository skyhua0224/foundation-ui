<script>
export const tileIds = ['temperature', 'load', 'budget', 'session-time']
</script>

<script setup>
// 温度 and CPU 与 GPU (REFERENCES.md "temperature", "load").
//   温度 (Apple Watch gauge complication, Pixel Battery's temperature): an open 270° gauge in the colour of its zone (ok, warn, error), the hottest reading in it.
//     (a closed ring from the top: an open 270° gauge read as a ring broken on one side)
//     方形: the gauge · 中: + the CPU and the GPU reading as two bars beside it
//   延迟预算: the share of a frame's time the host latency takes, in the colour of its zone; 中 adds the host latency and the frame time as numbers and the latency curve against the frame time behind them
//   串流时长: the time the stream has run is the whole tile: tabular condensed digits as wide as the tile allows, the client under it when the session or a paired client names it (an elapsed time has no full, so no ring and no progress)
//   CPU 与 GPU (Stocks comparison, iStat's combined graph): both curves edge to edge over one scale, each number in its colour above them. 中 only.
import { computed } from 'vue'
import MTileHead from '../MTileHead.vue'
import MTileNumeral from '../MTileNumeral.vue'
import MTileRing from '../MTileRing.vue'
import MTileChart from '../MTileChart.vue'
import MTileEmpty from '../MTileEmpty.vue'
import { finite, num, OPEN, sizeOf, designProps } from './tileData.js'

const props = defineProps(designProps)
const emit = defineEmits(['act'])
const d = computed(() => props.card.data || {})
const size = computed(() => sizeOf(props.card))
const isTemp = computed(() => props.card.id === 'temperature')
const isBudget = computed(() => props.card.id === 'budget')
const isTime = computed(() => props.card.id === 'session-time')
const zone = computed(() => ({ ok: 'ok', warn: 'warn', err: 'error' }[(d.value.zones || []).find((z) => d.value.value <= z.to)?.tone] || 'ok'))
// 'CPU 62 °C · GPU 78 °C' -> [{ label: 'CPU', v: 62 }, ...]
const readings = computed(() => String(d.value.caption || '').split(' · ').map((s) => { const m = /^(.*?)\s*([\d.]+)\s*°C$/.exec(s.trim()); return m ? { label: m[1], v: +m[2] } : null }).filter(Boolean))
// the stages of the frame budget (when the host sends them) and what is left of the frame after them
const stages = computed(() => (isBudget.value && Array.isArray(d.value.stages) ? d.value.stages : []))
const stageRest = computed(() => Math.max(0, Math.max(d.value.frameMs || 0, stages.value.reduce((a, x) => a + x.ms, 0)) - stages.value.reduce((a, x) => a + x.ms, 0)))
const series = computed(() => (d.value.series || []).map((s) => ({ ...s, values: finite(s.values) })))
const nowOf = (s) => { const v = s.values[s.values.length - 1]; return v === undefined ? '' : String(Math.round(v)) }
</script>

<template>
  <section class="m-tile m-tgauge" :class="[`m-tgauge--${card.id}`, `is-${size}`]" :data-accent="isTemp || isBudget ? (zone === 'ok' ? 'primary' : zone) : isTime ? 'secondary' : 'primary'" :data-size="size">
    <MTileEmpty v-if="empty" :icon="empty.icon" :title="empty.title" :text="empty.value" :action="empty.action" :size="size" @act="(a) => emit('act', a)" />
    <template v-else-if="isTemp">
      <MTileHead :icon="d.icon" :title="card.title" :chevron="chevron && size !== 's'" @open="emit('act', OPEN)" />
      <div class="m-tgauge__body">
        <MTileRing class="m-tgauge__ring" :value="num(d.value) ?? 0">
          <MTileNumeral :value="d.centre" :unit="d.unit" size="s" />
        </MTileRing>
        <ul v-if="size !== 's' && readings.length" class="m-tgauge__bars">
          <li v-for="r in readings" :key="r.label"><span>{{ r.label }}</span><i><b :style="{ transform: `scaleX(${Math.min(1, r.v / 100)})` }" /></i><em class="m-dnum">{{ r.v }} °C</em></li>
        </ul>
      </div>
    </template>
    <template v-else-if="isBudget">
      <MTileHead :icon="d.icon" :title="card.title" :chevron="chevron && size !== 's'" @open="emit('act', OPEN)" />
      <div class="m-tgauge__body">
        <MTileRing class="m-tgauge__ring" :value="num(d.value) ?? 0">
          <MTileNumeral :value="d.centre" :unit="d.unit" size="s" />
        </MTileRing>
        <!-- 中: what the ring is made of. With the host's stages: the frame budget as one bar (each stage a part of it, the rest of the frame is the free track) and the stages with their milliseconds, the frame
             time last; without them: the host latency and the frame time as numbers and the latency curve against the frame time behind them -->
        <div v-if="size !== 's' && stages.length" class="m-tgauge__side m-tgauge__side--stages">
          <div class="m-tgauge__stagebar" role="img" :aria-label="stages.map((x) => `${x.title} ${x.value}`).join(', ')"><i v-for="x in stages" :key="x.key" :class="`is-s${x.i}`" :style="{ flex: `${x.ms} 0 0` }" /><i class="is-rest" :style="{ flex: `${stageRest} 0 0` }" /></div>
          <ul class="m-tgauge__stagelist"><li v-for="x in stages" :key="x.key"><i :class="`is-s${x.i}`" /><span>{{ x.title }}</span><b class="m-dnum">{{ x.value }}</b></li><li v-if="d.facts?.[1]" class="is-frame"><i /><span>{{ d.facts[1].title }}</span><b class="m-dnum">{{ d.facts[1].value }}</b></li></ul>
        </div>
        <div v-else-if="size !== 's' && d.facts?.length" class="m-tgauge__side">
          <dl class="m-tgauge__facts"><div v-for="f in d.facts" :key="f.title"><dt>{{ f.title }}</dt><dd class="m-dnum">{{ f.value }}</dd></div></dl>
        </div>
      </div>
      <MTileChart v-if="size !== 's' && !stages.length && finite(d.spark).length > 1" class="m-tile__bleed m-tgauge__history" :points="finite(d.spark)" kind="area" :dot="true" :window="40" :max="d.frameMs ? d.frameMs * 1.15 : null" :target="d.frameMs || null" />
    </template>
    <template v-else-if="isTime">
      <MTileHead :icon="d.icon" :title="card.title" />
      <div class="m-tgauge__body m-tgauge__clock" :style="{ '--chars': String(d.centre || '').length || 4 }">
        <MTileNumeral :value="d.centre" size="xl" width="condensed" />
        <span v-if="d.caption" class="m-tgauge__cap">{{ d.caption }}</span>
      </div>
    </template>
    <template v-else>
      <MTileHead :icon="d.icon" :title="card.title" :chevron="chevron" @open="emit('act', OPEN)" />
      <div class="m-tgauge__pair">
        <div v-for="(s, i) in series" :key="s.id" class="m-tgauge__one" :class="`is-${i ? 'b' : 'a'}`"><span>{{ s.label }}</span><MTileNumeral :value="nowOf(s)" unit="%" size="m" /></div>
      </div>
      <div class="m-tile__bleed m-tgauge__charts">
        <MTileChart v-for="(s, i) in series" :key="s.id" class="m-tgauge__chart" :class="`is-${i ? 'b' : 'a'}`" :points="s.values" :max="100" kind="area" :dot="true" :window="40" />
      </div>
    </template>
  </section>
</template>
