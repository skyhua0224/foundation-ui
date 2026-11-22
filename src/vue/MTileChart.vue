<script>
let seq = 0
</script>

<script setup>
// Tile kit (docs/tile-kit.md): the live full-bleed chart of a tile: a window of the newest samples aligned to the right edge, drawn as a full-bleed area, a line or a field
// of pills. A new sample moves the whole chart one step to the left on the compositor: the chart is one <svg> one step wider than its box, its path is
// redrawn once per sample with the new point outside the box on the right, and a transform animation slides it in (no layout, no per-frame path).
// The "now" dot is an element of its own that moves on a transform too. Nothing moves under reduced motion or while the tile is not seen.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { smoothPath } from './curve.js'
import { useDrawnPoints, useOnScreen } from './useOnScreen.js'
import { springOf } from './tileMotion.js'

const props = defineProps({
  points: { type: Array, default: () => [] },
  /** a fixed scale (a load: 100); without one the chart is drawn over the range of its own samples */
  max: { type: Number, default: null },
  kind: { type: String, default: 'area' }, // area | line | bars
  window: { type: Number, default: 36 },
  /** the share of the height kept free above the highest value */
  pad: { type: Number, default: 0.1 },
  dot: { type: Boolean, default: false },
  grid: { type: Boolean, default: false },
  /** px kept free at the bottom of the box for a caption under the line (the fill still runs to the bottom edge) */
  base: { type: Number, default: 0 },
  /** a value drawn as a dashed guide across the chart (a target frame rate) */
  target: { type: Number, default: null },
})
const root = ref(null)
const svg = ref(null)
const dotEl = ref(null)
const box = ref({ w: 0, h: 0 })
const gid = `m-tchart-${++seq}`
let ro = null
onMounted(() => {
  const read = () => { const r = root.value.getBoundingClientRect(); const w = Math.round(r.width), h = Math.round(r.height); if (w !== box.value.w || h !== box.value.h) box.value = { w, h } }
  read()
  ro = new ResizeObserver(read)
  ro.observe(root.value)
})
onBeforeUnmount(() => ro?.disconnect())

const drawn = useDrawnPoints(() => props.points, useOnScreen(root))
const finite = computed(() => drawn.value.filter((v) => Number.isFinite(v)))
// a history of a few samples is a short flat line with a dot at its end: it reads like the handle of a slider and says nothing. The chart is drawn from MIN_SAMPLES samples on.
const MIN_SAMPLES = 8
const enough = computed(() => finite.value.length >= MIN_SAMPLES)
// the samples on screen and the one that slides out on the left
// a line or an area spans the box edge to edge from the first samples on (it grows to its window), so a short history is a whole chart and not a stub with a dot at its end
const win = computed(() => (props.kind === 'bars' ? props.window : Math.max(2, Math.min(props.window, finite.value.length))))
const shown = computed(() => finite.value.slice(-(win.value + 1)))
const range = computed(() => {
  if (props.max != null) return { lo: 0, hi: props.max }
  const p = finite.value.slice(-win.value)
  if (!p.length) return { lo: 0, hi: 1 }
  const hi = Math.max(...p), lo = Math.min(...p), d = hi - lo
  // bars always start at zero (a bar's length is its value)
  if (props.kind === 'bars') return { lo: 0, hi: hi > 0 ? hi * 1.15 : 1 }
  // a series that does not move stays a line in the middle; one that moves is drawn over its own range so its movement shows
  return d < Math.abs(hi) * 0.02 ? { lo: 0, hi: Math.max(hi * 2, 1) } : { lo: Math.max(0, lo - d * 0.6), hi: hi + d * 0.25 }
})
// with the now dot the newest point stays one dot inside the right edge and the line runs on flat to the edge (as in Stocks)
const inset = computed(() => (props.dot && props.kind !== 'bars' ? 16 : 0))
const step = computed(() => (props.kind === 'bars' ? box.value.w / win.value : (box.value.w - inset.value) / Math.max(1, win.value - 1)))
// the end dot has a 6 px radius and a 8 px halo: the line keeps 14 px from the top and the bottom of its box so the dot and its ring are never on the box's edge (hero band, 码率, 帧率, 内存)
const vin = computed(() => (props.dot && props.kind !== 'bars' ? Math.min(14, box.value.h * 0.3) : 0))
const yOf = (v) => { const { lo, hi } = range.value; const h = box.value.h - props.base - 2 * vin.value; const t = (Math.min(Math.max(v, lo), hi) - lo) / Math.max(hi - lo, 1e-9); return vin.value + h - t * h * (1 - props.pad) }
// x in the svg (which rests one step to the left): the newest sample sits at the right edge of the box
const pts = computed(() => {
  const list = shown.value, n = list.length, s = step.value, w = box.value.w
  if (!w || n < 1) return []
  const right = props.kind === 'bars' ? w - s / 2 : w - inset.value
  return list.map((v, i) => ({ x: right - (n - 1 - i) * s + s, y: yOf(v) }))
})
const paths = computed(() => {
  const p = pts.value, h = box.value.h
  if (props.kind === 'bars') {
    const bw = Math.max(3, step.value * 0.58), r = bw / 2
    const bar = (q) => { const top = Math.min(q.y, h - bw); const x0 = q.x - r; return `M${x0.toFixed(1)} ${(h + r).toFixed(1)}V${(top + r).toFixed(1)}A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${(x0 + bw).toFixed(1)} ${(top + r).toFixed(1)}V${(h + r).toFixed(1)}Z` }
    return { past: p.slice(0, -1).map(bar).join(''), now: p.length ? bar(p[p.length - 1]) : '' }
  }
  if (p.length < 2) return { line: '', area: '' }
  const end = (box.value.w + step.value * 2).toFixed(1)
  const line = `${smoothPath(p)}${inset.value ? `H${end}` : ''}`
  return { line, area: `${line}L${inset.value ? end : p[p.length - 1].x.toFixed(1)} ${h + 2}L${p[0].x.toFixed(1)} ${h + 2}Z` }
})
const last = computed(() => (pts.value.length ? pts.value[pts.value.length - 1] : null))
const svgW = computed(() => box.value.w + step.value)
const rest = computed(() => `translateX(${(-step.value).toFixed(2)}px)`)
const dotX = computed(() => box.value.w - inset.value)
const dotRest = computed(() => (last.value ? `translate(${dotX.value}px, ${last.value.y.toFixed(1)}px)` : 'none'))

const reduced = () => { const m = document.documentElement.dataset.motion; return m === 'reduced' || (m !== 'full' && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) }
let lastAt = 0
// the slide runs on the M3 default spatial spring (tokens.css)
// a new sample (the list moved by one: its second newest is the newest drawn before) slides in; any other change is drawn at once
watch(shown, async (now, was) => {
  const t = performance.now(), gap = t - lastAt; lastAt = t
  if (!was?.length || now.length < 2 || reduced()) return
  const shifted = now[now.length - 2] === was[was.length - 1] && (now.length < 3 || was.length < 2 || now[now.length - 3] === was[was.length - 2])
  if (!shifted) return
  const prevY = yOf(was[was.length - 1])
  await nextTick()
  const { easing, duration } = springOf('default-spatial')
  svg.value?.animate?.([{ transform: 'translateX(0px)' }, { transform: rest.value }], { duration, easing })
  if (dotEl.value && last.value) dotEl.value.animate?.([{ transform: `translate(${dotX.value}px, ${prevY.toFixed(1)}px)` }, { transform: dotRest.value }], { duration, easing })
})
const gridYs = computed(() => (props.grid && box.value.h ? [0.25, 0.5, 0.75].map((f) => (box.value.h - f * box.value.h * (1 - props.pad)).toFixed(1)) : []))
const targetY = computed(() => (props.target != null && box.value.h ? yOf(props.target).toFixed(1) : null))
</script>

<template>
  <div ref="root" class="m-tchart" :class="`m-tchart--${kind}`" aria-hidden="true">
    <svg v-if="enough && (gridYs.length || targetY)" class="m-tchart__grid" :width="box.w" :height="box.h"><line v-for="y in gridYs" :key="y" x1="0" :x2="box.w" :y1="y" :y2="y" /><line v-if="targetY" class="m-tchart__target" x1="0" :x2="box.w" :y1="targetY" :y2="targetY" /></svg>
    <svg v-if="box.w && enough" ref="svg" class="m-tchart__svg" :width="svgW" :height="box.h" :viewBox="`0 0 ${svgW} ${box.h}`" :style="{ transform: rest }">
      <defs v-if="kind === 'area'">
        <linearGradient :id="gid" gradientUnits="userSpaceOnUse" x1="0" :y1="0" x2="0" :y2="box.h">
          <stop offset="0" class="m-tchart__stop0" />
          <stop offset="0.6" class="m-tchart__stop1" />
          <stop offset="1" class="m-tchart__stop2" />
        </linearGradient>
      </defs>
      <template v-if="kind === 'bars'">
        <path :d="paths.past" class="m-tchart__past" />
        <path :d="paths.now" class="m-tchart__now" />
      </template>
      <template v-else-if="paths.line">
        <path v-if="kind === 'area'" :d="paths.area" :fill="`url(#${gid})`" />
        <path :d="paths.line" class="m-tchart__line" />
      </template>
    </svg>
    <span v-if="enough && dot && kind !== 'bars' && last && paths.line" ref="dotEl" class="m-tchart__dot" :style="{ transform: dotRest }" />
  </div>
</template>
