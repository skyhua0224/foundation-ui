<script setup>
// The one determinate ring of the kit: Material 3 circular progress indicator, drawn as Jetpack Compose Material3 draws it (see docs/progress-ring.md for the sources).
//   - 12 o'clock start, clockwise, active indicator and a separate track, round caps, nothing drawn for the active part at 0
//   - the track starts one gap after the active indicator and ends one gap before its start; both gaps shrink with the sweep near 0 (min(sweep, gap)) and the track is gone at 100 %
//   - flat: 40 unit box, stroke 4, gap 4 (CircularProgressIndicatorTokens Size / ActiveThickness / TrackActiveSpace); wavy (Expressive): 48 unit box, stroke 4, amplitude 1.6, 8 waves
//     (WaveSize, ActiveWaveAmplitude, wavelength 15 rounded to a whole wave count), flat below 10 % and from 95 % (WavyProgressIndicatorDefaults.indicatorAmplitude)
// The box scales with the element, so stroke and gap keep the spec's ratio at every size. A part of a whole (内存) is a list of segments that share the ring, a gap apart.
// The slot is the centre; it is kept inside the ring's inner circle (--mpr-inner), and `.m-pring` is a size container so a numeral can be set in cqw.
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  /** 0..1 */
  value: { type: Number, default: 0 },
  /** [{ value 0..1, tone }]: parts that add up to at most 1, drawn instead of `value` (flat only) */
  segments: { type: Array, default: null },
  /** the colour of a single value: a | b | c (tile tones) or primary | secondary | tertiary | success | warning | error */
  tone: { type: String, default: 'a' },
  /** the Material 3 Expressive wavy active indicator (a single value only) */
  wavy: { type: Boolean, default: false },
  label: { type: String, default: '' },
})

const S = 4, GAP = 4, AMP = 1.6, WAVES = 8
const D = computed(() => (props.wavy && !props.segments ? 48 : 40))
const R = computed(() => (D.value === 48 ? 20.4 : 18))
const C = computed(() => D.value / 2)
// Compose measures the gap along the circumference of the whole box, in degrees, and adds the stroke width because the caps are round
const gapDeg = computed(() => ((GAP + S) / (Math.PI * D.value)) * 360)
const clamp = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)

const motionOff = () => {
  if (typeof document === 'undefined') return true
  const m = document.documentElement.dataset.motion
  if (m === 'reduced') return true
  if (m === 'full') return false
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
const target = computed(() => (props.segments ? props.segments.map((s) => clamp(s.value)) : [clamp(props.value)]))
const shown = ref(target.value.slice())
let raf = 0
watch(target, (to) => {
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf)
  const from = shown.value.slice()
  if (motionOff() || typeof requestAnimationFrame !== 'function' || from.length !== to.length) { shown.value = to.slice(); return }
  const t0 = performance.now(), dur = 420
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - (1 - k) ** 3
    shown.value = to.map((v, i) => from[i] + (v - from[i]) * e)
    if (k < 1) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
})
onBeforeUnmount(() => { if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf) })

// angle in degrees clockwise from 12 o'clock -> point on the circle of radius r
const pt = (deg, r) => { const a = (deg * Math.PI) / 180; return [C.value + r * Math.sin(a), C.value - r * Math.cos(a)] }
const f = (n) => n.toFixed(2)
const flatArc = (a, z) => {
  const len = z - a
  if (len <= 0.01) return ''
  if (len >= 359.99) { const [x, y] = pt(a, R.value); const [x2, y2] = pt(a + 180, R.value); return `M${f(x)} ${f(y)}A${R.value} ${R.value} 0 1 1 ${f(x2)} ${f(y2)}A${R.value} ${R.value} 0 1 1 ${f(x)} ${f(y)}` }
  const [x1, y1] = pt(a, R.value), [x2, y2] = pt(z, R.value)
  return `M${f(x1)} ${f(y1)}A${R.value} ${R.value} 0 ${len > 180 ? 1 : 0} 1 ${f(x2)} ${f(y2)}`
}
const wavyArc = (a, z, amp) => {
  if (amp <= 0) return flatArc(a, z)
  const len = z - a
  if (len <= 0.01) return ''
  const n = Math.max(2, Math.ceil(len / 1.5))
  let d = ''
  for (let i = 0; i <= n; i++) {
    const deg = a + (len * i) / n
    const r = R.value + amp * Math.sin(WAVES * ((deg - a) * Math.PI) / 180)
    const [x, y] = pt(deg, r)
    d += `${i ? 'L' : 'M'}${f(x)} ${f(y)}`
  }
  return d
}

const geometry = computed(() => {
  const vals = shown.value
  const g = gapDeg.value
  const arcs = []
  let at = 0
  vals.forEach((v, i) => {
    const len = v * 360
    const from = at + (i ? Math.min(g, len) : 0)
    at += len
    const tone = props.segments ? props.segments[i]?.tone || 'a' : props.tone
    if (props.wavy && !props.segments) {
      const amp = v <= 0.1 || v >= 0.95 ? 0 : AMP
      arcs.push({ tone, d: wavyArc(0, len, amp) })
    } else if (at - from > 0.01) arcs.push({ tone, d: flatArc(from, at) })
  })
  const shift = Math.min(at, g)
  const trackFrom = at + shift, trackTo = 360 - shift
  const track = at >= 359.99 ? '' : flatArc(at <= 0.01 ? 0 : trackFrom, at <= 0.01 ? 360 : trackTo)
  return { arcs: arcs.filter((a) => a.d), track }
})
const pct = computed(() => Math.round(target.value.reduce((s, v) => s + v, 0) * 100))
const innerFrac = computed(() => (D.value === 48 ? (R.value - S / 2 - AMP) / (D.value / 2) : (R.value - S / 2) / (D.value / 2)))
</script>

<template>
  <div class="m-pring" :class="{ 'is-wavy': D === 48 }" :style="{ '--mpr-inner': innerFrac.toFixed(3) }" role="progressbar" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="pct" :aria-label="label || undefined">
    <svg :viewBox="`0 0 ${D} ${D}`" aria-hidden="true">
      <path v-if="geometry.track" class="m-pring__track" :d="geometry.track" :stroke-width="S" />
      <path v-for="(a, i) in geometry.arcs" :key="i" class="m-pring__arc" :class="`m-pring__arc--${a.tone}`" :d="a.d" :stroke-width="S" />
    </svg>
    <div v-if="$slots.default" class="m-pring__centre"><slot /></div>
  </div>
</template>
