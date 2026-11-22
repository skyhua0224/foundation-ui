<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { T, bezier, buildWave, drawPaths, flatWave, stopIndicator, toSvg } from './linearWavy.js'
import { createWavyState } from './linearWavyState.js'

// Wavy progress for work of known length (indeterminate when `value` is null). Use MLoading for short waits.
// The linear bar is Material 3 Expressive's LinearWavyProgressIndicator ported from Compose Material3 (linearWavy.js: the paths, the gap, the stop dot, the amplitude function;
// linearWavyState.js: the clock: the value eased by ProgressAnimationSpec, the amplitude eased by its two specs, the wave moving one wavelength per second, the indeterminate lines and their handoff).
const props = defineProps({
  value: { type: Number, default: null }, // 0..1
  circular: { type: Boolean, default: false },
  flat: { type: Boolean, default: false },
  label: { type: String, default: '' },
  /** how long a new value takes to be reached (ms); Compose's ProgressAnimationSpec is 500 ms, linear */
  glide: { type: Number, default: 500 },
  /** the easing of that: 'linear' (Compose), 'standard' or 'creep' (a slow start of a long glide) */
  glideEase: { type: String, default: 'linear' },
})
const p = computed(() => (props.value == null ? null : Math.min(1, Math.max(0, props.value))))
const EASES = { linear: (t) => t, standard: bezier(0.2, 0, 0, 1), creep: bezier(0.1, 0.5, 0.3, 1) }

const root = ref(null)
const activeEl = ref(null), trackEl = ref(null), stopEl = ref(null)
const width = ref(240)
let state = null, raf = 0, observer = null, mounted = false
let full = null, indWave = null, flatPath = null, builtFor = '', drawn = ''
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && document.documentElement.dataset.motion !== 'full'
const make = () => createWavyState({
  amplitude: props.flat ? () => 0 : undefined,
  glide: { ms: props.glide, ease: EASES[props.glideEase] || EASES.linear },
  ...(reduced() ? { waveSpeed: 0, indeterminateWaveSpeed: 0 } : {}),
})
function paint(now) {
  raf = 0
  if (!mounted || !state) return
  const model = state.frame(now)
  const w = width.value
  if (builtFor !== `${w}`) { // the paths of the full wave depend on the width only (LinearProgressDrawingCache.updateFullPaths)
    full = buildWave(w, T.height, T.thickness, T.wavelength); indWave = buildWave(w, T.height, T.thickness, T.indeterminateWavelength); flatPath = flatWave(w, T.height); builtFor = `${w}`
  }
  const wave = model.amplitude === 0 ? flatPath : model.indeterminate ? indWave : full
  const paths = drawPaths({ width: w, height: T.height, wavelength: model.indeterminate ? T.indeterminateWavelength : T.wavelength }, model.fractions, model.amplitude, model.waveOffset, wave)
  const stop = model.indeterminate ? null : stopIndicator(model.fractions[1], w, T.height, T.stop * model.handoff, paths.capWidth)
  const sig = `${toSvg(paths.track)}|${toSvg(paths.progress)}|${stop ? `${stop.r.toFixed(2)},${stop.cx.toFixed(2)}` : ''}`
  if (sig !== drawn) {
    drawn = sig
    trackEl.value?.setAttribute('d', toSvg(paths.track))
    activeEl.value?.setAttribute('d', toSvg(paths.progress))
    if (stopEl.value) {
      stopEl.value.setAttribute('r', stop ? stop.r.toFixed(2) : '0')
      if (stop) { stopEl.value.setAttribute('cx', stop.cx.toFixed(2)); stopEl.value.setAttribute('cy', stop.cy.toFixed(2)) }
    }
  }
  if (!model.settled) raf = requestAnimationFrame(paint)
}
const kick = () => { if (!raf && mounted && typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(paint) }
if (!props.circular) {
  watch(() => props.value, (v) => { state?.set(v == null ? null : v, performance.now()); kick() })
  watch(width, () => { drawn = ''; kick() })
}
onMounted(() => {
  if (props.circular) return
  mounted = true
  state = make()
  state.set(props.value, 0)
  // the layout width (not getBoundingClientRect: a sheet that is scaling in would be measured smaller)
  const measure = (w = root.value?.clientWidth || 0) => { w = Math.round(w); if (w > 0 && w !== width.value) width.value = w }
  measure()
  if (typeof ResizeObserver === 'function' && root.value) { observer = new ResizeObserver((entries) => measure(entries[entries.length - 1]?.contentRect?.width)); observer.observe(root.value) }
  kick()
})
onBeforeUnmount(() => { mounted = false; if (raf) cancelAnimationFrame(raf); observer?.disconnect() })

// circular (CircularProgressIndicatorTokens, Compose Material3): 48 px with the wave (WaveSize), stroke 4, amplitude 1.6, wavelength 15:
// a centre line of radius 24 - 2 - 1.6 = 20.4 carries 8 waves (2 pi 20.4 / 8 = 16.0, the nearest whole number of waves to a wavelength of 15)
const wave = computed(() => {
  const n = 8, amp = props.flat ? 0 : 1.6, r = 20.4, pts = []
  for (let i = 0; i <= 240; i++) {
    const a = (i / 240) * Math.PI * 2 - Math.PI / 2
    const rr = r + amp * Math.sin(a * n)
    pts.push(`${(24 + rr * Math.cos(a)).toFixed(2)} ${(24 + rr * Math.sin(a)).toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
})
</script>

<template>
  <div v-if="!circular" ref="root" class="m-wave" :class="{ 'm-wave--flat': flat, 'm-wave--indeterminate': p == null }" role="progressbar" :aria-label="label || undefined" :aria-valuemin="0" :aria-valuemax="100" :aria-valuenow="p == null ? undefined : Math.round(p * 100)">
    <svg class="m-wave__svg" :width="width" :height="T.height" :viewBox="`0 0 ${width} ${T.height}`" aria-hidden="true">
      <path ref="trackEl" class="m-wave__track" />
      <path ref="activeEl" class="m-wave__active" />
      <circle ref="stopEl" class="m-wave__stop" r="0" />
    </svg>
  </div>
  <!-- indeterminate (ProgressIndicator.kt circularIndeterminate*): the arc grows from 10 % to 87 % and back in 6 s while the whole turns 1080 degrees
       linearly and jumps a further 90 degrees every 1.5 s; no track (circularIndeterminateTrackColor is transparent) -->
  <svg v-else class="m-wave-circle" :class="{ 'm-wave-circle--spin': p == null }" viewBox="0 0 48 48" role="progressbar" :aria-label="label || undefined" :aria-valuenow="p == null ? undefined : Math.round(p * 100)">
    <template v-if="p != null">
      <circle class="m-wave-circle__track" cx="24" cy="24" r="20.4" pathLength="100" :stroke-dasharray="`${Math.max(0, 100 - p * 100 - 6)} 200`" :stroke-dashoffset="-(p * 100 + 3)" />
      <path class="m-wave-circle__active" :d="wave" pathLength="100" :stroke-dasharray="`${p * 100} 200`" />
    </template>
    <g v-else class="m-wave-circle__turn"><g class="m-wave-circle__jump"><path class="m-wave-circle__active m-wave-circle__arc" :d="wave" pathLength="100" /></g></g>
  </svg>
</template>
