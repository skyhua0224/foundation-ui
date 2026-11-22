<script>
export const tileIds = ['link-margin', 'frame-supply', 'mic-health', 'capture-method']
</script>

<script setup>
// Tiles of the second round of the catalogue growth (homeGrowth2.js; docs/home-tiles.md). One hero at every size:
//   链路余量  a ring of the room left on the host's network adapter (the ring is the link speed, its full); 中 the three numbers it is made of, 大 the free speed in display type over one bar that splits the link into stream, FEC and free
//   帧率来源  the sent rate in display type and the four stages of a frame (画面更新, 捕获, 送编码, 发出) as bars with the target as a tick; a stage that delivers clearly fewer frames than the one before it is red, with the frames it loses; the bars grow by a clip, never by their width (no layout per frame)
//   麦克风    the state of the microphone as a shape in the colour of the state with its three counters; the path (自动, VB-CABLE, USB/IP, 关闭) is chosen on the tile at 中 and 大
//   捕获方式  the method as a mark at 方形, the choice of four segments at 中, four rows with their long names at 大; the choice is saved like the settings page and takes effect after a restart of the host
import { computed } from 'vue'
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
const save = (v) => { if (!props.preview) emit('act', { type: 'setting', value: { key: d.value.key, value: v } }) }

// 链路余量
const speedText = (mbps) => (mbps >= 1000 ? { v: (mbps / 1000).toFixed(mbps >= 10000 ? 0 : 1).replace(/\.0$/, ''), u: T.value.lmGbps } : { v: String(Math.round(mbps)), u: T.value.lmMbps })
const free = computed(() => speedText(d.value.free || 0))
const freePct = computed(() => Math.round((1 - (d.value.ratio || 0)) * 100))
const lmTone = computed(() => (d.value.ratio > 0.9 ? 'error' : d.value.ratio > 0.7 ? 'warn' : 'primary'))
const mbps = (v) => (v >= 100 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, ''))
const barPct = (v) => `${Math.max(0, Math.min(100, (v / (d.value.nic?.speed || 1)) * 100))}%`
const nicIcon = computed(() => ({ ethernet: 'settings_ethernet', wifi: 'wifi' }[d.value.nic?.kind] || 'lan'))

// 帧率来源
const fsMax = computed(() => Math.max(d.value.target || 0, ...(d.value.stages || []).map((s) => s.fps), 1))
const fpsText = (v) => (v >= 100 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, ''))
const anyLost = computed(() => (d.value.stages || []).some((s) => s.lost))
const stageName = (k) => T.value[`fs${k[0].toUpperCase()}${k.slice(1)}${size.value === 's' || size.value === 'm' ? 'S' : ''}`]
const kindText = computed(() => T.value[`fsKind_${d.value.kind}`] || '')
const pct = (v) => `${Math.max(2, Math.min(100, (v / fsMax.value) * 100))}%`
const targetPct = computed(() => (d.value.target ? `${Math.min(100, (d.value.target / fsMax.value) * 100)}%` : null))

// 麦克风
const micTone = computed(() => ({ faulted: 'error', missing: 'warn', starting: 'warn', stopping: 'warn', active: 'ok', streaming: 'ok', capturing: 'ok' }[d.value.state] || ''))
const micAccent = computed(() => ({ error: 'error', warn: 'warn', ok: 'primary' }[micTone.value] || 'primary'))
const micIcon = computed(() => (d.value.state === 'disabled' || d.value.state === 'unsupported' ? 'mic_off' : d.value.state === 'faulted' || d.value.state === 'missing' ? 'error' : 'mic'))
const micBad = computed(() => (d.value.counters?.underruns || 0) + (d.value.counters?.dropped || 0) + (d.value.counters?.errors || 0) > 0)

// 捕获方式
const cmCurrent = computed(() => (d.value.options || []).find((o) => o.value === d.value.value) || null)
const cmLive = computed(() => (d.value.live ? (d.value.options.find((o) => o.value === d.value.live)?.label || d.value.live.toUpperCase()) : ''))
</script>

<template>
  <!-- 链路余量 -->
  <section v-if="id === 'link-margin'" class="m-tile m-cal m-gr2 m-gr2--link" :class="`is-${size}`" :data-size="size" :data-accent="lmTone">
    <MTileHead :icon="d.icon" :title="card.title" :chevron="chevron && size !== 's'" @open="emit('act', OPEN)" />
    <div v-if="size === 'l'" class="m-gr2__hero">
      <MTileNumeral :value="free.v" :unit="free.u" size="xl" />
      <MTileChip :label="`${d.nic.name} · ${speedText(d.nic.speed).v} ${speedText(d.nic.speed).u}`" :icon="nicIcon" />
    </div>
    <div v-else class="m-gr2__body">
      <MTileRing class="m-gr2__ring" :value="1 - d.ratio" :label="card.title"><MTileNumeral :value="String(freePct)" unit="%" size="s" /></MTileRing>
      <ul v-if="size === 'm'" class="m-gr2__facts">
        <li><span>{{ T.lmSpeed }}</span><b class="m-dnum">{{ speedText(d.nic.speed).v }} {{ speedText(d.nic.speed).u }}</b></li>
        <li><span>{{ T.lmStream }}</span><b class="m-dnum">{{ mbps(d.stream) }} {{ T.lmMbps }}</b></li>
        <li v-if="d.fecPct"><span>{{ T.lmFec }}</span><b class="m-dnum">+{{ mbps(d.fec) }} {{ T.lmMbps }}</b></li>
      </ul>
    </div>
    <template v-if="size === 'l'">
      <div class="m-gr2__split" role="img" :aria-label="card.title">
        <i class="is-stream" :style="{ width: barPct(d.stream) }" /><i v-if="d.fecPct" class="is-fec" :style="{ width: barPct(d.fec) }" />
      </div>
      <ul class="m-gr2__legend">
        <li><i class="is-stream" /><span>{{ T.lmStream }}</span><b class="m-dnum">{{ mbps(d.stream) }} {{ T.lmMbps }}</b><em>{{ T.lmTarget }}</em></li>
        <li v-if="d.fecPct"><i class="is-fec" /><span>{{ T.lmFec }}</span><b class="m-dnum">+{{ mbps(d.fec) }} {{ T.lmMbps }}</b><em>{{ d.fecPct }} %</em></li>
        <li v-if="d.nic.signal !== null"><i class="is-sig" /><span>{{ T.lmSignal }}</span><b class="m-dnum">{{ Math.round(d.nic.signal) }} %</b></li>
      </ul>
    </template>
  </section>

  <!-- 帧率来源 -->
  <section v-else-if="id === 'frame-supply'" class="m-tile m-cal m-gr2 m-fs" :class="`is-${size}`" :data-size="size" data-accent="primary">
    <MTileHead :icon="d.icon" :title="card.title" :chevron="chevron && size !== 's'" @open="emit('act', OPEN)" />
    <div class="m-fs__body">
      <div class="m-fs__hero">
        <MTileNumeral :value="d.encoded === null ? '–' : fpsText(d.encoded)" :unit="T.fsFps" :size="size === 'l' ? 'l' : size === 'm' ? 'm' : 's'" :weight="500" />
        <div v-if="size === 'l'" class="m-fs__chips"><MTileChip v-if="d.target" :label="`${T.fsTarget} ${d.target}`" icon="flag" /><MTileChip v-if="d.repeated" :label="`${T.fsRepeated} ${fpsText(d.repeated)}`" icon="sync" /></div>
      </div>
      <!-- the stages as rows of bars, in the order a frame goes through them; a stage that loses frames is red -->
      <ul class="m-fs__rows" role="img" :aria-label="card.title">
        <li v-for="st in d.stages" :key="st.key" :class="{ 'is-lost': st.lost }">
          <span v-if="size !== 's'" class="m-fs__name">{{ stageName(st.key) }}</span>
          <span class="m-fs__track"><i :style="{ '--w': pct(st.fps) }" /><s v-if="targetPct && size !== 's'" :style="{ left: targetPct }" /></span>
          <b v-if="size !== 's'" class="m-dnum">{{ fpsText(st.fps) }}<em v-if="st.lost && size === 'l'">−{{ fpsText(st.drop) }}</em></b>
        </li>
      </ul>
    </div>
    <div v-if="size === 'l' && (kindText || anyLost)" class="m-gr2__chips"><MTileChip v-if="kindText" :label="kindText" icon="desktop_windows" /><MTileChip v-if="anyLost" :label="T.fsLost" tone="warn" icon="warning" /></div>
  </section>

  <!-- 麦克风 -->
  <section v-else-if="id === 'mic-health'" class="m-tile m-cal m-gr2 m-gr2--mic" :class="`is-${size}`" :data-size="size" :data-accent="micAccent">
    <MTileHead :icon="d.icon" :title="card.title" :chevron="chevron && size !== 's'" @open="emit('act', OPEN)" />
    <div class="m-gr2__mic">
      <MTileShape class="m-gr2__shape" :icon="micIcon" shape="cookie" :tone="micTone === 'ok' ? 'solid' : 'container'" :size="size === 'l' ? '96px' : size === 'm' ? '46px' : '64px'" />
      <div class="m-gr2__micside">
        <b class="m-gr2__state">{{ T[`mhState_${d.state}`] }}</b>
        <ul v-if="size !== 's'" class="m-gr2__counts" :class="{ 'is-bad': micBad }">
          <li><span>{{ T.mhUnderruns }}</span><b class="m-dnum">{{ d.counters.underruns }}</b></li>
          <li><span>{{ T.mhDropped }}</span><b class="m-dnum">{{ d.counters.dropped }}</b></li>
          <li><span>{{ T.mhErrors }}</span><b class="m-dnum">{{ d.counters.errors }}</b></li>
        </ul>
      </div>
    </div>
    <div v-if="size !== 's' && d.canSave" class="m-gr2__seg is-4" role="radiogroup" :aria-label="T.mhBackend">
      <button v-for="o in d.options" :key="o.value" type="button" role="radio" :disabled="o.disabled" :class="{ 'is-on': o.value === d.backend }" :aria-checked="o.value === d.backend" @click.stop="o.value !== d.backend && save(o.value)"><span>{{ o.label }}</span></button>
    </div>
    <div v-if="size === 'l' && (d.fallback || d.active)" class="m-gr2__chips"><MTileChip v-if="d.active" :label="`${T.mhBackend} ${T[`mb_${d.active}`] || d.active}`" icon="cable" /><MTileChip v-if="d.fallback" :label="T.mhFallback" tone="warn" icon="arrow_downward" /></div>
  </section>

  <!-- 捕获方式 -->
  <section v-else class="m-tile m-cal m-gr2 m-gr2--capture" :class="`is-${size}`" :data-size="size" data-accent="secondary">
    <MTileHead :icon="d.icon" :title="card.title" :chevron="chevron && size === 'l'" @open="emit('act', OPEN)" />
    <div v-if="size === 's'" class="m-gr2__mark"><MTileNumeral :value="cmCurrent ? cmCurrent.label : String(d.value || '').toUpperCase()" size="m" :caption="cmLive && cmLive !== cmCurrent?.label ? cmLive : ''" /></div>
    <div v-else-if="size === 'm'" class="m-gr2__seg is-icons" role="radiogroup" :aria-label="card.title">
      <button v-for="o in d.options" :key="o.value" type="button" role="radio" :class="{ 'is-on': o.value === d.value }" :aria-checked="o.value === d.value" @click.stop="o.value !== d.value && save(o.value)"><MIcon :name="o.icon" /><span>{{ o.label }}</span></button>
    </div>
    <ul v-else class="m-gr2__rows" role="radiogroup" :aria-label="card.title">
      <li v-for="o in d.options" :key="o.value"><button type="button" role="radio" :class="{ 'is-on': o.value === d.value }" :aria-checked="o.value === d.value" @click.stop="o.value !== d.value && save(o.value)"><MTileShape :icon="o.icon" shape="squircle" size="36px" :tone="o.value === d.value ? 'solid' : 'container'" /><span class="m-gr2__txt"><b>{{ o.label }}</b><small>{{ o.full }}</small></span><MIcon v-if="o.value === d.value" name="check" /></button></li>
    </ul>
    <div v-if="size === 'l'" class="m-gr2__chips"><MTileChip v-if="cmLive" :label="`${T.cmSession} · ${cmLive}`" icon="play_circle" /><MTileChip :label="T.cmNext" icon="schedule" /></div>
  </section>
</template>
