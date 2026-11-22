// The clock of the linear wavy progress indicator: what LinearWavyProgressNode does over time (LinearWavyProgressModifiers.kt, Compose Material3), with no DOM and no timers of its own:
// the caller gives it the time of each frame. `value` is what the app passes as `progress` (a number 0..1, or null while the length is not known, Float.NaN in Compose); the animation
// of the value itself is the app's (Compose: animateFloatAsState with ProgressAnimationSpec), kept here as `valueAnimation` so that one object is enough for a component.
import {
  AMPLITUDE_DECREASE, AMPLITUDE_INCREASE, FIRST_LINE_EXIT_MS, HANDOFF_MAX_SPEED, LINEAR_ANIMATION_DURATION, PROGRESS_ANIMATION, SECOND_LINE_HEAD, T,
  handoffExitDistance, handoffExitDuration, indeterminateFractions, indicatorAmplitude,
} from './linearWavy.js'

const MIN_WAVE_ANIMATION_MS = 50 // MinAnimationDuration

export function createWavyState({ amplitude = indicatorAmplitude, wavelength = T.wavelength, waveSpeed = T.waveSpeed, indeterminateWavelength = T.indeterminateWavelength, indeterminateWaveSpeed = T.indeterminateWaveSpeed, glide = PROGRESS_ANIMATION } = {}) {
  // ---- the value the app gives, eased as the app would ease it ----
  let target = null // null: not known
  let known = 0 // the last animated value (it is kept while the length is unknown, as the app's animated state would)
  let anim = null // { from, to, start }
  // ---- the indicator ----
  let indeterminate = false
  let clock = 0 // the indeterminate clock in ms
  let cyclePlay = 0
  let drawSecondLine = true
  let handoff = 1 // 1 while a determinate indicator; 0 -> 1 after an indeterminate one
  let exit = null // { start, distance, duration, from }: the lines leaving after the value became known
  let handoffAnim = null // { start }
  let lastNow = null
  // ---- the wave offset ----
  let offset = 0, offsetFrom = 0, offsetStart = 0, offsetMs = 0
  // ---- the amplitude ----
  let amp = null, ampTarget = -1, ampAnim = null

  const activeWavelength = () => (indeterminate ? indeterminateWavelength : wavelength)
  const activeSpeed = () => (indeterminate ? indeterminateWaveSpeed : waveSpeed)
  function restartOffset(now) {
    offsetFrom = offset; offsetStart = now
    offsetMs = activeSpeed() > 0 && activeWavelength() > 0 ? Math.max(MIN_WAVE_ANIMATION_MS, Math.round((activeWavelength() / activeSpeed()) * 1000)) : 0
    if (!offsetMs) offset = 0
  }
  const valueNow = (now) => {
    if (!anim) return known
    const p = Math.min(1, Math.max(0, (now - anim.start) / (glide.ms || 1)))
    known = anim.from + (anim.to - anim.from) * glide.ease(p)
    if (p >= 1) { known = anim.to; anim = null }
    return known
  }
  const determinateProgress = (now) => Math.min(1, Math.max(0, valueNow(now)))
  const targetAmplitude = (now) => (indeterminate ? 1 : Math.min(1, Math.max(0, amplitude(determinateProgress(now)))))
  function updateAmplitude(now) {
    const want = targetAmplitude(now)
    if (amp === null) { amp = want; ampTarget = want; return }
    if (ampTarget !== want) {
      ampTarget = want
      const spec = amp < want ? AMPLITUDE_INCREASE : AMPLITUDE_DECREASE
      ampAnim = { from: amp, to: want, start: now, spec }
    }
    if (ampAnim) {
      const p = Math.min(1, Math.max(0, (now - ampAnim.start) / ampAnim.spec.ms))
      amp = ampAnim.from + (ampAnim.to - ampAnim.from) * ampAnim.spec.ease(p)
      if (p >= 1) { amp = ampAnim.to; ampAnim = null }
    }
  }
  function startIndeterminate(now) {
    indeterminate = true; clock = 0; cyclePlay = 0; drawSecondLine = true; handoff = 1; exit = null; handoffAnim = null
    restartOffset(now)
    amp = null // the amplitude of the waiting indicator starts at its target
  }
  function finishHandoff(now) {
    indeterminate = false; cyclePlay = 0; handoff = 0; exit = null
    amp = targetAmplitude(now); ampTarget = amp; ampAnim = null // snapTo(determinateAmplitude)
    restartOffset(now)
    handoffAnim = { start: now }
  }

  return {
    /** The value changed (number 0..1, or null while the length is not known). */
    set(value, now) {
      if (value == null) {
        if (target != null) { valueNow(now); anim = null } // the animated value keeps what it had
        target = null
        return
      }
      const v = Math.min(1, Math.max(0, value))
      if (lastNow == null) { known = v; anim = null; target = v; return } // the first value is drawn as it is
      if (target === v) return
      valueNow(now)
      anim = { from: known, to: v, start: now }
      target = v
    },
    /** Advance to the time of a frame (ms) and give what to draw. */
    frame(now) {
      const first = lastNow == null
      const dt = first ? 0 : Math.max(0, now - lastNow)
      lastNow = now
      if (first) restartOffset(now)
      if (target == null && !indeterminate) startIndeterminate(now)
      if (indeterminate) {
        if (exit) {
          const e = Math.min(1, (now - exit.start) / exit.duration)
          const t = e * exit.duration
          const played = e >= 1 ? exit.distance : Math.min(exit.distance, handoffExitDistance(t))
          if (target == null) exit = null // cancelled: back to the cycle
          else {
            const nextClock = exit.from + played
            const play = nextClock % LINEAR_ANIMATION_DURATION
            if (play < cyclePlay) drawSecondLine = true
            clock = nextClock; cyclePlay = play
            if (e >= 1) finishHandoff(now)
          }
        } else if (target != null) {
          // the length is known: let the lines finish leaving the track at a ramped speed (handoffExitAnimationSpec)
          drawSecondLine = drawSecondLine && cyclePlay > SECOND_LINE_HEAD.delay
          const distance = (drawSecondLine ? LINEAR_ANIMATION_DURATION : FIRST_LINE_EXIT_MS) - cyclePlay
          if (distance > 0) exit = { start: now, distance, duration: handoffExitDuration(distance), from: clock }
          else finishHandoff(now)
        } else {
          clock += dt
          const play = clock % LINEAR_ANIMATION_DURATION
          if (play < cyclePlay) drawSecondLine = true
          cyclePlay = play
        }
      }
      if (handoffAnim) {
        const p = Math.min(1, (now - handoffAnim.start) / PROGRESS_ANIMATION.ms)
        handoff = PROGRESS_ANIMATION.ease(p)
        if (p >= 1) { handoff = 1; handoffAnim = null }
      }
      updateAmplitude(now)
      if (offsetMs) offset = (offsetFrom + (now - offsetStart) / offsetMs) % 1 // runs on while the wave is flat, as Compose's offset animation does
      const progress = determinateProgress(now)
      const fractions = indeterminate ? indeterminateFractions(cyclePlay, drawSecondLine) : [0, progress * handoff]
      return { indeterminate, fractions, amplitude: amp ?? 0, waveOffset: amp > 0 ? offset : 0, handoff, value: progress, settled: !indeterminate && !anim && !ampAnim && !handoffAnim && amp === 0 }
    },
    get indeterminate() { return indeterminate },
    maxHandoffSpeed: HANDOFF_MAX_SPEED,
  }
}
