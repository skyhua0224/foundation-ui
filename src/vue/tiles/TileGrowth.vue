<script>
export const tileIds = ['ports-check', 'file-maps', 'encode-budget', 'web-access']
</script>

<script setup>
// Tiles of the catalogue growth round (homeGrowth.js; docs/home-tiles.md). Each has one hero at every size it offers:
//   端口      a ring of the ports that are reachable out of all of them (a closed share: the ring has a natural full); 中 adds what the numbers are made of, 大 the ports one by one
//   文件映射  the folder shape and the count of shared folders; 中 the first two with their access, 大 the shape and the count in one line, the port, and up to three folders as cards (the fewer, the larger the shape)
//   编码预算  the host's estimate of the encode time as a share of the frame time (a ring: the frame time is its full), the estimate in display type; 中 and 大 the frame time, the preset and the engines
//   网页访问范围  one choice of three, on the tile: the list of the three at 方形, three large segments at 中. A change that locks the person out or opens the page to the internet asks first.
import { computed, ref } from 'vue'
import MDialog from '../MDialog.vue'
import MIcon from '../MIcon.vue'
import MTileHead from '../MTileHead.vue'
import MTileChip from '../MTileChip.vue'
import MTileNumeral from '../MTileNumeral.vue'
import MTileRing from '../MTileRing.vue'
import MTileShape from '../MTileShape.vue'
import { designProps, OPEN } from './tileData.js'

const props = defineProps(designProps)
const emit = defineEmits(['act'])
const d = computed(() => props.card.data || {})
const id = computed(() => props.card.id)
const size = computed(() => (['s', 'm', 'l'].includes(props.card.size) ? props.card.size : 's'))
const T = computed(() => props.texts || {})

// 端口: the ring shows the ports that are reachable; a port whose firewall state is unknown is a second, warning arc of its own, never part of the reachable share (the tile keeps its own colour so the two arcs differ), and in the list a hollow warning dot
const portsBad = computed(() => id.value === 'ports-check' && (d.value.blocked > 0 || d.value.closed > 0))
const portsAccent = computed(() => (portsBad.value ? 'error' : 'primary'))
const portsSegs = computed(() => {
  const t = d.value.total || 0
  return t ? [{ value: d.value.ok / t, tone: 'a' }, ...(d.value.unknown ? [{ value: d.value.unknown / t, tone: 'warning' }] : [])] : null
})
const portTone = (r) => (r.unknownFw ? 'is-warn' : r.ok ? '' : 'is-bad')
const portName = (r) => r.name || r.role
// 文件映射
// 大 lists up to three folders (a fourth would take the hero's room): with more, the third line says how many are not shown
const fmAll = computed(() => d.value.rows || [])
const fmMore = computed(() => size.value === 'l' && fmAll.value.length > 3)
const fmRows = computed(() => fmAll.value.slice(0, size.value === 'l' ? (fmMore.value ? 2 : 3) : 2))
const fmMoreText = computed(() => String(T.value.fmMore || '').replace('{n}', fmAll.value.length - 2))
// who a folder is open to: the names of the paired clients (two, one with three folders in the list, then how many more), or the count when none of the ids is a paired client, or every client
const fmWho = (r) => {
  const w = r.who
  if (!w || !w.total) return T.value.fmAll
  if (!w.names.length) return `${w.total} ${T.value.fmClients}`
  const shown = w.names.slice(0, fmAll.value.length >= 3 ? 1 : 2), rest = w.names.length - shown.length + w.unnamed
  return shown.join(T.value.fmSep) + (rest ? T.value.fmSep + String(T.value.fmMore || '').replace('{n}', rest) : '')
}
const modeText = (m) => (m === 'read' ? T.value.fmRead : m === 'write' || m === 'readwrite' ? T.value.fmWrite : m)
const modeTone = (m) => (m === 'read' ? '' : 'warn')
// 编码预算
const ebTone = computed(() => (d.value.ratio > 1 ? 'error' : d.value.clamped || d.value.ratio >= 0.9 ? 'warn' : 'primary'))
const ms = (v) => (v === null || v === undefined ? '' : v < 10 ? v.toFixed(1) : String(Math.round(v)))
const presetText = computed(() => (d.value.effective !== null && d.value.effective !== d.value.preset ? `P${d.value.preset} → P${d.value.effective}` : d.value.preset !== null ? `P${d.value.preset}` : ''))
// 网页访问范围
const ask = ref(null)
const current = computed(() => d.value.value)
const save = (v) => { ask.value = null; if (!props.preview) emit('act', { type: 'setting', value: { key: d.value.key, value: v } }) }
const choose = (v) => { if (v === current.value) return; if (d.value.confirm?.[v]) ask.value = { value: v }; else save(v) }
</script>

<template>
  <!-- 端口 -->
  <section v-if="id === 'ports-check'" class="m-tile m-cal m-gr m-gr--ports" :class="`is-${size}`" :data-size="size" :data-accent="portsAccent">
    <MTileHead :icon="d.icon" :title="card.title" :chevron="chevron && size !== 's'" @open="emit('act', OPEN)" />
    <div class="m-gr__body">
      <MTileRing class="m-gr__ring" :value="d.total ? d.ok / d.total : 0" :segments="portsSegs" :label="card.title">
        <MTileNumeral :value="String(d.ok)" :unit="`/${d.total}`" size="s" />
      </MTileRing>
      <ul v-if="size === 'm'" class="m-gr__facts">
        <li><span>{{ T.pcTcp }}</span><b class="m-dnum">{{ d.tcpUp }}/{{ d.tcp }}</b><small>{{ T.pcUp }}</small></li>
        <li><span>{{ T.pcUdp }}</span><b class="m-dnum">{{ d.udpReady }}/{{ d.udp }}</b><small>{{ T.pcSession }}</small></li>
        <li v-if="d.blocked" class="is-bad"><span>{{ T.pcFirewall }}</span><b class="m-dnum">{{ d.blocked }}</b><small>{{ T.pcBlocked }}</small></li>
        <li v-if="d.unknown" class="is-warn"><span>{{ T.pcFirewall }}</span><b class="m-dnum">{{ d.unknown }}</b><small>{{ T.pcUnknownShort }}</small></li>
        <li v-if="!d.blocked && !d.unknown"><span>{{ T.pcFirewall }}</span><b class="m-dnum">✓</b></li>
      </ul>
      <div v-else-if="size === 'l'" class="m-gr__side">
        <ul class="m-gr__facts">
          <li><span>{{ T.pcTcp }}</span><b class="m-dnum">{{ d.tcpUp }}/{{ d.tcp }}</b><small>{{ T.pcUp }}</small></li>
          <li><span>{{ T.pcUdp }}</span><b class="m-dnum">{{ d.udpReady }}/{{ d.udp }}</b><small>{{ T.pcSession }}</small></li>
          <li v-if="d.blocked" class="is-bad"><span>{{ T.pcFirewall }}</span><b class="m-dnum">{{ d.blocked }}</b><small>{{ T.pcBlocked }}</small></li>
          <li v-if="d.unknown" class="is-warn"><span>{{ T.pcFirewall }}</span><b class="m-dnum">{{ d.unknown }}</b><small>{{ T.pcUnknownShort }}</small></li>
        </ul>
      </div>
    </div>
    <ul v-if="size === 'l'" class="m-gr__ports">
      <li v-for="r in d.rows" :key="`${r.proto}${r.port}`" :class="portTone(r)" :title="r.unknownFw ? T.pcUnknown : undefined"><i /><span>{{ portName(r) }}</span><em class="m-dnum">{{ r.proto }} {{ r.port }}</em></li>
    </ul>
  </section>

  <!-- 文件映射 -->
  <section v-else-if="id === 'file-maps'" class="m-tile m-cal m-gr m-gr--maps" :class="`is-${size}`" :data-size="size" :data-rows="size === 'l' ? fmRows.length + (fmMore ? 1 : 0) : undefined" data-accent="tertiary">
    <MTileHead :icon="d.icon" :title="card.title" :chevron="chevron && size !== 's'" @open="emit('act', OPEN)" />
    <div v-if="size === 'l'" class="m-gr__hero">
      <MTileShape class="m-gr__shape" icon="folder_shared" shape="cookie" size="var(--gr-shape)" />
      <div class="m-gr__heroside">
        <MTileNumeral :value="String(d.count)" :unit="d.count ? T.fmCount : ''" :caption="d.count ? '' : T.fmNone" size="m" />
        <MTileChip v-if="d.port" :label="`${T.fmPort} ${d.port}`" icon="lan" />
      </div>
    </div>
    <div v-else class="m-gr__body">
      <div class="m-gr__count">
        <MTileShape v-if="size === 's'" class="m-gr__shape" icon="folder_shared" shape="cookie" size="56px" />
        <MTileNumeral :value="String(d.count)" :caption="d.count ? T.fmCount : T.fmNone" size="s" />
      </div>
      <ul v-if="size === 'm'" class="m-gr__rows"><li v-for="r in fmRows" :key="r.id"><MIcon name="folder" /><b>{{ r.name }}</b><MTileChip :label="modeText(r.mode)" :tone="modeTone(r.mode)" /></li></ul>
    </div>
    <ul v-if="size === 'l' && fmRows.length" class="m-gr__list">
      <li v-for="r in fmRows" :key="r.id"><MTileShape icon="folder" shape="squircle" size="var(--gr-row-shape)" /><span class="m-gr__txt"><b>{{ r.name }}</b><small>{{ fmWho(r) }}</small></span><MTileChip :label="modeText(r.mode)" :tone="modeTone(r.mode)" /></li>
      <li v-if="fmMore" class="is-more"><span class="m-gr__txt"><b>{{ fmMoreText }}</b></span></li>
    </ul>
  </section>

  <!-- 编码预算 -->
  <section v-else-if="id === 'encode-budget'" class="m-tile m-cal m-gr m-gr--budget" :class="`is-${size}`" :data-size="size" :data-accent="ebTone">
    <MTileHead :icon="d.icon" :title="card.title" :chevron="chevron && size !== 's'" @open="emit('act', OPEN)" />
    <div class="m-gr__body">
      <MTileRing class="m-gr__ring" :value="Math.min(1, d.ratio)" :label="card.title">
        <MTileNumeral :value="ms(d.estimatedMs)" unit="ms" size="s" />
      </MTileRing>
      <ul v-if="size !== 's'" class="m-gr__facts">
        <li><span>{{ T.ebFrame }}</span><b class="m-dnum">{{ ms(d.budgetMs) }} ms</b></li>
        <li v-if="presetText"><span>{{ T.ebPreset }}</span><b class="m-dnum">{{ presetText }}</b></li>
        <li v-if="d.engines"><span>{{ T.ebEngines }}</span><b class="m-dnum">× {{ d.engines }}</b></li>
      </ul>
    </div>
    <div v-if="size === 'l'" class="m-gr__chips"><MTileChip v-if="d.width" :label="`${d.width}×${d.height} · ${d.fps}`" icon="aspect_ratio" /><MTileChip v-if="d.clamped" :label="T.ebLowered" tone="warn" icon="arrow_downward" /></div>
  </section>

  <!-- 网页访问范围 -->
  <section v-else class="m-tile m-cal m-gr m-gr--access" :class="`is-${size}`" :data-size="size" data-accent="primary">
    <MTileHead :icon="d.icon" :title="card.title" />
    <ul v-if="size === 's'" class="m-b2opts" role="radiogroup" :aria-label="card.title">
      <li v-for="o in d.options" :key="o.value"><button type="button" role="radio" class="m-b2opt" :class="{ 'is-on': o.value === current }" :aria-checked="o.value === current" @click.stop="choose(o.value)"><span>{{ o.label }}</span><MIcon v-if="o.value === current" name="check" /></button></li>
    </ul>
    <div v-else class="m-gr__seg" role="radiogroup" :aria-label="card.title">
      <button v-for="o in d.options" :key="o.value" type="button" role="radio" :class="{ 'is-on': o.value === current }" :aria-checked="o.value === current" @click.stop="choose(o.value)"><MIcon :name="o.icon" /><span>{{ o.label }}</span></button>
    </div>
    <MDialog v-if="ask" :model-value="true" :title="d.confirm[ask.value].title" icon="warning" @update:model-value="(v) => { if (!v) ask = null }">
      <p>{{ d.confirm[ask.value].body }}</p>
      <template #actions><button type="button" class="m-dpill" @click.stop="ask = null">{{ d.confirm.cancel }}</button><button type="button" class="m-dpill m-dpill--fill" @click.stop="save(ask.value)">{{ d.confirm.change }}</button></template>
    </MDialog>
  </section>
</template>
