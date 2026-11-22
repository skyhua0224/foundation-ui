// The linear wavy progress indicator of Material 3 Expressive, ported from Jetpack Compose Material3 (androidx-main, commit b8f12c706099a47e1e44d9772d03e14a4ae37146):
//   compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/internal/LinearWavyProgressModifiers.kt   (the drawing: paths, gap, stop indicator, amplitude and wave offset)
//   .../WavyProgressIndicator.kt        (LinearWavyProgressIndicator, WavyProgressIndicatorDefaults: amplitude function, ProgressAnimationSpec, amplitude animation specs)
//   .../ProgressIndicator.kt            (the indeterminate keyframes: LinearAnimationDuration, the four line specs)
//   .../tokens/LinearProgressIndicatorTokens.kt, MotionTokens.kt   (sizes, durations, easing curves)
// Sources are in docs/authority/source-index.tsv. Units: 1 dp = 1 CSS px. This file is the geometry and the pure rules; the clock is in linearWavyState.js, the SVG in MProgress.vue.

// ---- tokens (LinearProgressIndicatorTokens.kt; WavyProgressIndicatorDefaults) ----
export const T = Object.freeze({
  thickness: 4, // ActiveThickness (the stroke of the wave)
  trackThickness: 4, // TrackThickness
  amplitude: 3, // ActiveWaveAmplitude (what the path below produces from the container height)
  wavelength: 40, // ActiveWaveWavelength (LinearDeterminateWavelength)
  indeterminateWavelength: 20, // IndeterminateActiveWaveWavelength
  gap: 4, // TrackActiveSpace (LinearIndicatorTrackGapSize)
  stop: 4, // StopSize (LinearTrackStopIndicatorSize)
  height: 10, // WaveHeight (LinearContainerHeight)
  waveSpeed: 40, // dp per second: waveSpeed = wavelength, "1 wavelength per second"
  indeterminateWaveSpeed: 20, // indeterminateWaveSpeed = indeterminateWavelength
})

// ---- motion (MotionTokens.kt) ----
export const DURATION_LONG2 = 500
/** CSS-style cubic-bezier easing (the same four numbers as Compose's CubicBezierEasing). */
export function bezier(x1, y1, x2, y2) {
  if (x1 === y1 && x2 === y2) return (t) => t
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t) => ((ay * t + by) * t + cy) * t
  const slopeX = (t) => (3 * ax * t + 2 * bx) * t + cx
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i++) {
      const d = sampleX(t) - x
      if (Math.abs(d) < 1e-7) return sampleY(t)
      const s = slopeX(t)
      if (Math.abs(s) < 1e-6) break
      t -= d / s
    }
    let lo = 0, hi = 1
    t = x
    for (let i = 0; i < 40; i++) {
      const d = sampleX(t)
      if (Math.abs(d - x) < 1e-7) break
      if (d < x) lo = t; else hi = t
      t = (lo + hi) / 2
    }
    return sampleY(t)
  }
}
export const EASING = Object.freeze({
  linear: bezier(0, 0, 1, 1), // EasingLinearCubicBezier
  standard: bezier(0.2, 0, 0, 1), // EasingStandardCubicBezier
  emphasizedAccelerate: bezier(0.3, 0, 0.8, 0.15), // EasingEmphasizedAccelerateCubicBezier
})
/** ProgressAnimationSpec: tween(DurationLong2, EasingLinearCubicBezier): how an app animates the value it gives to the indicator. */
export const PROGRESS_ANIMATION = Object.freeze({ ms: DURATION_LONG2, ease: EASING.linear })
/** IncreasingAmplitudeAnimationSpec / DecreasingAmplitudeAnimationSpec. */
export const AMPLITUDE_INCREASE = Object.freeze({ ms: DURATION_LONG2, ease: EASING.standard })
export const AMPLITUDE_DECREASE = Object.freeze({ ms: DURATION_LONG2, ease: EASING.emphasizedAccelerate })

/** WavyProgressIndicatorDefaults.indicatorAmplitude: no wave at 10 % and below and at 95 % and above, the full wave between. */
export const indicatorAmplitude = (progress) => (progress <= 0.1 || progress >= 0.95 ? 0 : 1)

// ---- indeterminate keyframes (ProgressIndicator.kt) ----
export const LINEAR_ANIMATION_DURATION = 1750
export const FIRST_LINE_HEAD = Object.freeze({ delay: 0, duration: 1000 })
export const FIRST_LINE_TAIL = Object.freeze({ delay: 250, duration: 1000 })
export const SECOND_LINE_HEAD = Object.freeze({ delay: 650, duration: 850 })
export const SECOND_LINE_TAIL = Object.freeze({ delay: 900, duration: 850 })
export const FIRST_LINE_EXIT_MS = FIRST_LINE_TAIL.delay + FIRST_LINE_TAIL.duration
const lineEase = EASING.emphasizedAccelerate // LinearIndeterminateProgressEasing
/** keyframes { 0f at delay using easing; 1f at duration + delay } over the cycle: 0 before the delay, 1 after the end. */
export const keyframe = (spec, playMs) => {
  const t = Math.round(playMs)
  if (t <= spec.delay) return 0
  if (t >= spec.delay + spec.duration) return 1
  return lineEase((t - spec.delay) / spec.duration)
}
/** The four fractions of an indeterminate indicator at a play time of the cycle: [first tail, first head, second tail, second head]. */
export const indeterminateFractions = (playMs, drawSecondLine) => [keyframe(FIRST_LINE_TAIL, playMs), keyframe(FIRST_LINE_HEAD, playMs), drawSecondLine ? keyframe(SECOND_LINE_TAIL, playMs) : 0, drawSecondLine ? keyframe(SECOND_LINE_HEAD, playMs) : 0]

// ---- the handoff from indeterminate to determinate (handoffExitAnimationSpec) ----
export const HANDOFF_MAX_SPEED = 2.5
export const HANDOFF_RAMP_MS = 150
const HANDOFF_ACCEL = (HANDOFF_MAX_SPEED - 1) / HANDOFF_RAMP_MS
const HANDOFF_RAMP_DISTANCE = ((1 + HANDOFF_MAX_SPEED) / 2) * HANDOFF_RAMP_MS
/** The distance in the cycle covered after `t` ms of the exit. */
export const handoffExitDistance = (t) => (t <= HANDOFF_RAMP_MS ? t + (HANDOFF_ACCEL / 2) * t * t : HANDOFF_RAMP_DISTANCE + HANDOFF_MAX_SPEED * (t - HANDOFF_RAMP_MS))
/** How long playing `distance` ms of the cycle takes at the ramped speed. */
export const handoffExitDuration = (distance) => Math.max(1, Math.round(distance <= HANDOFF_RAMP_DISTANCE ? (Math.sqrt(1 + 2 * HANDOFF_ACCEL * distance) - 1) / HANDOFF_ACCEL : HANDOFF_RAMP_MS + (distance - HANDOFF_RAMP_DISTANCE) / HANDOFF_MAX_SPEED))

// ---- the wave path (LinearProgressDrawingCache.updateFullPaths) ----
const SAMPLES_PER_HALF_WAVE = 40

/**
 * The full path: moveTo(0, 0), then quadratic segments of half a wavelength alternating down and up, over width + two wavelengths; the control point is
 * height - stroke away so that a stroke-centre wave of amplitude (height - stroke) / 2 results. Flattened to a polyline with its cumulative length (a PathMeasure).
 */
export function buildWave(width, height, strokeWidth, wavelength) {
  const half = wavelength / 2
  const xs = [0], ys = [0], cum = [0]
  let anchorX = half, controlX = half / 2, controlY = height - strokeWidth, x0 = 0
  const limit = width + wavelength * 2
  while (anchorX <= limit) {
    for (let i = 1; i <= SAMPLES_PER_HALF_WAVE; i++) {
      const t = i / SAMPLES_PER_HALF_WAVE, u = 1 - t
      const x = u * u * x0 + 2 * u * t * controlX + t * t * anchorX
      const y = 2 * u * t * controlY // the anchors are at y 0
      const dx = x - xs[xs.length - 1], dy = y - ys[ys.length - 1]
      xs.push(x); ys.push(y); cum.push(cum[cum.length - 1] + Math.hypot(dx, dy))
    }
    x0 = anchorX
    anchorX += half; controlX += half; controlY *= -1
  }
  const bounds = xs[xs.length - 1] - xs[0]
  return { xs, ys, cum, length: cum[cum.length - 1], scale: cum[cum.length - 1] / (bounds + 1e-8), centre: height / 2, wavelength, flat: false }
}

/** The path when the amplitude is zero: a line, as Compose does (lineTo(width, 0)). */
export const flatWave = (width, height) => ({ xs: [0, width], ys: [0, 0], cum: [0, width], length: width, scale: 1, centre: height / 2, wavelength: 0, flat: true })

/** PathMeasure.getSegment: the points of the path between two distances, ends interpolated. */
export function segment(wave, d0, d1) {
  const { xs, ys, cum, length } = wave
  const a = Math.min(Math.max(d0, 0), length), b = Math.min(Math.max(d1, 0), length)
  if (!(b > a)) return []
  const at = (d) => {
    let lo = 0, hi = cum.length - 1
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m }
    const span = cum[hi] - cum[lo]
    const f = span > 0 ? (d - cum[lo]) / span : 0
    return [lo, xs[lo] + (xs[hi] - xs[lo]) * f, ys[lo] + (ys[hi] - ys[lo]) * f]
  }
  const [ia, xa, ya] = at(a)
  const [ib, xb, yb] = at(b)
  const out = [[xa, ya]]
  for (let i = ia + 1; i <= ib; i++) if (cum[i] > a && cum[i] < b) out.push([xs[i], ys[i]])
  out.push([xb, yb])
  return out
}

// ---- the paths to draw (LinearProgressDrawingCache.updateDrawPaths) ----
/**
 * @param {{ width: number, height: number, stroke?: number, trackStroke?: number, gap?: number, wavelength?: number }} size
 * @param {number[]} fractions pairs [tail, head] of progress fractions (2 for a determinate indicator, 4 for an indeterminate one)
 * @param {number} amplitude 0..1
 * @param {number} waveOffset 0..1 of a wavelength
 * @param {object} wave the path of buildWave (cached by the caller: it depends on the width, the height, the stroke and the wavelength only)
 * @returns {{ progress: number[][][], track: number[][][], capWidth: number }} progress: polylines; track: polylines (moveTo/lineTo chains)
 */
export function drawPaths(size, fractions, amplitude, waveOffset, wave) {
  const { width, height } = size
  const stroke = size.stroke ?? T.thickness, trackStroke = size.trackStroke ?? T.trackThickness, gap = size.gap ?? T.gap
  const wavelength = size.wavelength ?? T.wavelength
  const capWidth = height > width ? 0 : Math.max(stroke / 2, trackStroke / 2) // round caps on both strokes
  const halfHeight = height / 2
  let nextEndTrackOffset = width - capWidth
  const track = [[[nextEndTrackOffset, halfHeight]]]
  const progress = []
  let adjustedGap = gap
  let activeVisible = false
  for (let i = 0; i < fractions.length / 2; i++) {
    const startFraction = fractions[i * 2], endFraction = fractions[i * 2 + 1]
    const barTail = startFraction * width, barHead = endFraction * width
    if (i === 0) {
      adjustedGap = barHead < capWidth ? 0 : Math.min(barHead - capWidth, gap)
      activeVisible = barHead >= capWidth
    }
    const lo = capWidth, hi = width - capWidth
    const adjustedHead = Math.min(Math.max(barHead, lo), hi), adjustedTail = Math.min(Math.max(barTail, lo), hi)
    let line = []
    if (Math.abs(endFraction - startFraction) > 0) {
      const shift = amplitude !== 0 ? waveOffset * wavelength : 0
      const pts = segment(wave, (adjustedTail + shift) * wave.scale, (adjustedHead + shift) * wave.scale)
      // translate by -shift in x, scale the wave about the centre line by the amplitude (the path is taken at the maximum amplitude)
      line = pts.map(([x, y]) => [x - (shift > 0 ? shift : 0), (y + halfHeight) * (amplitude !== 1 ? amplitude : 1) + (1 - amplitude) * halfHeight])
    }
    progress.push(line)
    const spacing = activeVisible ? adjustedGap + capWidth * 2 : adjustedGap
    if (nextEndTrackOffset > adjustedHead + spacing) track[track.length - 1].push([Math.max(capWidth, adjustedHead + spacing), halfHeight])
    if (barHead > barTail) {
      nextEndTrackOffset = Math.max(capWidth, adjustedTail - spacing)
      track.push([[nextEndTrackOffset, halfHeight]])
    }
  }
  if (nextEndTrackOffset > capWidth) track[track.length - 1].push([capWidth, halfHeight])
  return { progress, track, capWidth }
}

// ---- the stop indicator (drawStopIndicator) ----
/** The dot at the end of the track: a circle of the track's thickness that shrinks away when the bar reaches it; null when there is none. */
export function stopIndicator(progressEnd, width, height, maxStop, capWidth, trackStroke = T.trackThickness) {
  let size = Math.min(trackStroke, maxStop)
  const xOffset = size === trackStroke ? 0 : trackStroke / 4
  let x = width - size - xOffset
  const progressX = width * progressEnd + capWidth
  if (x <= progressX) { size = Math.max(0, size - (progressX - x)); x = progressX }
  return size > 0 ? { r: size / 2, cx: x + size / 2, cy: height / 2 } : null
}

/** SVG path data for a list of polylines (moveTo, then lineTo for each next point). */
export const toSvg = (lines) => lines.filter((l) => l.length > 0).map((l) => `M${l.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}`).join('')
