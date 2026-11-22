<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import MIcon from './MIcon.vue'

/**
 * Expressive slider. Sizes XS 16 / S 24 / M 40 / L 56 / XL 96 (track), handle 4 x 44 with a 6 gap, inside corner 2,
 * stop indicators on stepped values, floating value indicator, optional inset icons (standard variant, M and larger),
 * centred variant (value around a default) and range variant (two handles when the model is [low, high]).
 */
const model = defineModel({ type: [Number, Array], default: 0 })
const props = defineProps({
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  step: { type: Number, default: 0 },
  size: { type: String, default: 'm' }, // xs | s | m | l | xl; m is the product slider (visible track, inside icons, value bubble), xs and s only inside a tile or a table row
  centered: { type: Boolean, default: false },
  /** Reference value of the centred variant. */
  center: { type: Number, default: null },
  iconStart: { type: String, default: '' },
  iconEnd: { type: String, default: '' },
  label: { type: String, default: '' },
  decimals: { type: Number, default: 0 },
  unit: { type: String, default: '' },
  /** logarithmic scale: the position follows the logarithm of the value (min must be above 0) */
  log: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  /** what the value bubble says instead of the number (a named value: 「30 Mbps」, 「150%」), for a single value */
  bubbleText: { type: String, default: '' },
  /** name of the lowest position when it means "automatic" or "off": written in the empty track so the bar does not read as broken */
  offText: { type: String, default: '' },
  /** Explicit fractional marks for a piecewise scale (0..1). */
  marks: { type: Array, default: () => [] },
})
const emit = defineEmits(['commit'])

const SIZES = { xs: [16, 44, 8], s: [24, 44, 8], m: [40, 44, 12], l: [56, 68, 16], xl: [96, 108, 28] }
const dims = computed(() => SIZES[props.size] || SIZES.xs)
const root = ref(null)
const active = ref(-1)
const pressing = ref(false) // a finger is down and has not decided yet
const touchy = ref(false) // the pointer of this press is a finger or a pen: the value bubble is bigger and higher, out from under it
const focused = ref(-1)

const isRange = computed(() => Array.isArray(model.value))
const values = computed(() => (isRange.value ? model.value : [model.value]))
const span = computed(() => props.max - props.min || 1)
const useLog = computed(() => props.log && props.min > 0 && props.max > props.min)
const frac = (v) => (useLog.value
  ? Math.min(1, Math.max(0, Math.log(Math.max(v, props.min) / props.min) / Math.log(props.max / props.min)))
  : Math.min(1, Math.max(0, (v - props.min) / span.value)))
const mid = computed(() => props.center ?? (props.min < 0 && props.max > 0 ? 0 : (props.min + props.max) / 2))

const clamp = (v) => Math.min(props.max, Math.max(props.min, v))
const snap = (v) => {
  if (props.step > 0) v = props.min + Math.round((v - props.min) / props.step) * props.step
  const f = 10 ** Math.max(props.decimals, 4)
  return clamp(Math.round(v * f) / f)
}
const fmt = (v) => `${Number(v).toFixed(props.decimals)}${props.unit}`
// the lowest position of a slider that has a name for it (自动) is read, heard and shown in the bubble by that name, not as "0 Mbps"
const isOff = (v) => !!props.offText && !isRange.value && v <= props.min
const say = (v) => (isOff(v) ? props.offText : props.bubbleText && !isRange.value ? props.bubbleText : fmt(v))

// Segments: [from, to, active]; a side that touches a handle leaves 2 + 6 px.
const segments = computed(() => {
  const v = values.value.map(frac)
  if (isRange.value) {
    const [a, b] = v
    return [[0, a, false, 'end', 'handle'], [a, b, true, 'handle', 'handle'], [b, 1, false, 'handle', 'end']]
  }
  if (props.centered) {
    const c = frac(mid.value)
    const p = v[0]
    return p >= c
      ? [[0, c, false, 'end', 'join'], [c, p, true, 'join', 'handle'], [p, 1, false, 'handle', 'end']]
      : [[0, p, false, 'end', 'handle'], [p, c, true, 'handle', 'join'], [c, 1, false, 'join', 'end']]
  }
  return [[0, v[0], true, 'end', 'handle'], [v[0], 1, false, 'handle', 'end']]
})
const gap = (kind) => (kind === 'handle' ? '8px' : '0px')
const segStyle = ([a, b, , l, r]) => ({
  left: `calc(${a * 100}% + ${gap(l)})`,
  right: `calc(${(1 - b) * 100}% + ${gap(r)})`,
  '--l': l === 'end' ? 'var(--s-end)' : '2px',
  '--r': r === 'end' ? 'var(--s-end)' : '2px',
})
const stops = computed(() => {
  if (!(props.step > 0)) return []
  const n = Math.round(span.value / props.step)
  if (n < 1 || n > 24) return []
  return Array.from({ length: n + 1 }, (_, i) => (i / n))
})
// the width of the track comes from the ResizeObserver, not from a clientWidth read for every stop while the slider renders (up to 25 stops a slider, a dozen sliders in a sheet:
// each read forced a layout of the page being mounted, 20 ms of one task when the 个性化 sheet opened)
const trackW = ref(300)
let ro = null
onMounted(() => { if (typeof ResizeObserver === 'undefined') { trackW.value = root.value?.clientWidth || 300; return } ro = new ResizeObserver(() => { trackW.value = root.value?.clientWidth || 300 }); ro.observe(root.value) })
onBeforeUnmount(() => { ro?.disconnect(); flushKeys() })
const nearHandle = (f) => values.value.some((v) => Math.abs(frac(v) - f) * trackW.value < 14)

function fromEvent(event) {
  const r = root.value.getBoundingClientRect()
  const f = Math.min(1, Math.max(0, (event.clientX - r.left) / r.width))
  return snap(useLog.value ? props.min * (props.max / props.min) ** f : props.min + f * span.value)
}
function setAt(index, v) {
  let next = v
  if (isRange.value) {
    next = [...model.value]
    next[index] = index === 0 ? Math.min(v, next[1]) : Math.max(v, next[0])
  }
  model.value = next
  return next // the model itself follows when the parent has rendered: a caller that commits in the same tick commits this
}
// A finger or a pen does not move the value on the press: the press is shown (the handle takes its pressed state at once) and the value follows once the finger has moved along the slider; a finger that lifts without
// moving is a tap on the track and jumps to that point; a finger that goes vertical (a scroll, a swipe of the page around it) leaves the slider alone. A mouse presses and moves the value at once, as always.
const SLOP = 6
let pend = null
function down(event) {
  if (props.disabled || event.button > 0) return
  // The slider takes the focus itself (the handle, in begin) and keeps the press. Left to the browser, the compatibility mousedown of a press on the track moves the focus to the page
  // after the handle took it: the focus leaves a surface that commits on focus loss (the DLSS NR page of the Panel) before the release, and the value jumps back. A press on the handle, which is focusable, never lost it.
  event.preventDefault()
  clearTimeout(keyTimer); keyTimer = 0
  touchy.value = event.pointerType === 'touch' || event.pointerType === 'pen'
  if (touchy.value) {
    pend = { id: event.pointerId, x: event.clientX, y: event.clientY, v: fromEvent(event) }
    pressing.value = true
    try { root.value.setPointerCapture(event.pointerId) } catch { /* the pointer is gone */ }
    return
  }
  begin(event)
}
function begin(event) {
  const v = fromEvent(event)
  let index = 0
  if (isRange.value) index = Math.abs(v - values.value[0]) <= Math.abs(v - values.value[1]) ? 0 : 1
  active.value = index
  pressing.value = false
  try { root.value.setPointerCapture(event.pointerId) } catch { /* already captured */ }
  setAt(index, v)
  root.value.querySelectorAll('[role=slider]')[index]?.focus({ preventScroll: true })
}
const move = (event) => {
  if (pend && event.pointerId === pend.id) {
    const dx = event.clientX - pend.x, dy = event.clientY - pend.y
    if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return
    if (Math.abs(dy) > Math.abs(dx)) { endPend(event, false); return } // vertical: not the slider's
    pend = null
    begin(event)
    return
  }
  if (active.value >= 0) setAt(active.value, fromEvent(event))
}
function endPend(event, tap) {
  const p = pend; pend = null; pressing.value = false
  try { root.value.releasePointerCapture(event.pointerId) } catch { /* released */ }
  if (tap && p) {
    let index = 0
    if (isRange.value) index = Math.abs(p.v - values.value[0]) <= Math.abs(p.v - values.value[1]) ? 0 : 1
    // the handle takes the focus as a mouse press gives it (the field that had it is left, as a press on the track left it before); then the value is written
    root.value.querySelectorAll('[role=slider]')[index]?.focus({ preventScroll: true })
    emit('commit', setAt(index, p.v))
  }
}
// A press moves the handle at once and the value is written on release (pointerup); the arrow keys write 450 ms after the last key, so a run of presses is one write.
let keyTimer = 0
function flushKeys() { if (keyTimer) { clearTimeout(keyTimer); keyTimer = 0; emit('commit', model.value) } }
const up = (event) => {
  if (pend && event && event.pointerId === pend.id) { endPend(event, event.type === 'pointerup'); return }
  pressing.value = false
  if (active.value >= 0) { active.value = -1; emit('commit', model.value) }
}
function key(event, index) {
  const unit = props.step > 0 ? props.step : span.value / 100
  const map = { ArrowRight: unit, ArrowUp: unit, ArrowLeft: -unit, ArrowDown: -unit, PageUp: unit * 10, PageDown: -unit * 10 }
  let v = values.value[index]
  if (event.key in map && useLog.value) v *= (props.max / props.min) ** (map[event.key] / unit / 100)
  else if (event.key in map) v += map[event.key]
  else if (event.key === 'Home') v = props.min
  else if (event.key === 'End') v = props.max
  else return
  event.preventDefault()
  setAt(index, snap(v))
  clearTimeout(keyTimer); keyTimer = setTimeout(() => { keyTimer = 0; emit('commit', model.value) }, 450)
}
const style = computed(() => ({ '--s-track': `${dims.value[0]}px`, '--s-handle': `${dims.value[1]}px`, '--s-end': `${dims.value[2]}px` }))
const showIcons = computed(() => !isRange.value && !props.centered && dims.value[0] >= 40)
// An inset icon (inset 8 + icon 24 + inset 8 = 48 px) stays in the active track while that track is long enough; a handle closer to the end
// would cut it in two, so the icon crosses to the inactive track beside the handle (M3 Expressive slider) and takes that track's colour.
const ICON_ROOM = 48
const handlePx = computed(() => frac(values.value[0]) * trackW.value)
const startInActive = computed(() => handlePx.value >= ICON_ROOM)
const endInActive = computed(() => trackW.value - handlePx.value < ICON_ROOM)
const startStyle = computed(() => (startInActive.value ? undefined : { left: `${handlePx.value + 16}px` }))
const endStyle = computed(() => (endInActive.value ? { right: `${trackW.value - handlePx.value + 16}px` } : undefined))
// a stop is not drawn where an inset icon stands (the first and the last stop of a slider with icons would sit on the icons): the icon's box with 6 px around it
const stopX = (f) => f * trackW.value + (f === 0 ? dims.value[2] : f === 1 ? -dims.value[2] : 0)
const iconBoxes = computed(() => {
  if (!showIcons.value) return []
  const w = trackW.value
  const boxes = []
  if (props.iconStart) { const l = startInActive.value ? 8 : handlePx.value + 16; boxes.push([l - 6, l + 30]) }
  if (props.iconEnd) { const l = endInActive.value ? handlePx.value - 40 : w - 32; boxes.push([l - 6, l + 30]) }
  return boxes
})
// a mark is not drawn under an inset icon either (the 200 Mbps mark of a bitrate slider stood against the end icon on a phone)
const markHidden = (f) => { const x = Math.min(1, Math.max(0, f)) * trackW.value; return iconBoxes.value.some(([a, b]) => x >= a && x <= b) }
const stopHidden = (f) => { const x = stopX(f); return nearHandle(f) || iconBoxes.value.some(([a, b]) => x >= a && x <= b) }
</script>

<template>
  <div
    ref="root"
    class="m-slider"
    :class="[`m-slider--${size}`, { 'm-slider--disabled': disabled, 'm-slider--drag': active >= 0, 'm-slider--press': pressing, 'm-slider--touch': touchy }]"
    :style="style"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="up"
    @pointercancel="up"
  >
    <span v-for="(seg, i) in segments" :key="i" class="m-slider__seg" :class="{ 'm-slider__seg--active': seg[2] }" :style="segStyle(seg)" />
    <template v-if="showIcons">
      <MIcon v-if="iconStart" class="m-slider__icon m-slider__icon--start" :class="{ 'is-active': startInActive }" :style="startStyle" :name="iconStart" />
      <MIcon v-if="iconEnd" class="m-slider__icon m-slider__icon--end" :class="{ 'is-active': endInActive }" :style="endStyle" :name="iconEnd" />
    </template>
    <span v-if="isOff(values[0])" class="m-slider__off" :class="{ 'm-slider__off--icon': showIcons && iconStart }" aria-hidden="true">{{ offText }}</span>
    <i v-if="centered && !isRange" class="m-slider__mid" :style="{ left: `${frac(mid) * 100}%` }" />
    <i v-for="f in marks" v-show="!markHidden(f)" :key="`mark-${f}`" class="m-slider__mark" :style="{ left: `${Math.min(1, Math.max(0, f)) * 100}%` }" />
    <template v-for="f in stops" :key="f">
      <i v-if="!stopHidden(f)" class="m-slider__stop" :class="{ 'is-active': segments.some((s) => s[2] && f >= s[0] && f <= s[1]) }" :style="{ left: `calc(${f * 100}% + ${f === 0 ? dims[2] : f === 1 ? -dims[2] : 0}px)` }" />
    </template>
    <span
      v-for="(v, i) in values"
      :key="i"
      class="m-slider__handle"
      :class="{ 'is-active': active === i, 'is-focus': focused === i }"
      :style="{ left: `${frac(v) * 100}%` }"
      role="slider"
      :tabindex="disabled ? -1 : 0"
      :aria-label="label || undefined"
      :aria-valuemin="min"
      :aria-valuemax="max"
      :aria-valuenow="v"
      :aria-valuetext="say(v)"
      :aria-disabled="disabled || undefined"
      @keydown="key($event, i)"
      @focus="focused = i"
      @blur="focused = -1; flushKeys()"
    >
      <output class="m-slider__bubble">{{ say(v) }}</output>
    </span>
  </div>
</template>
