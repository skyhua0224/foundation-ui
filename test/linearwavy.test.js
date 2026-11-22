// The linear wavy progress indicator against the Compose Material3 source it is ported from (see the header of src/vue/linearWavy.js and docs/authority/source-index.tsv):
// the numbers, the drawing rules and the animation specs are checked one by one; the clock is driven by hand.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AMPLITUDE_DECREASE, AMPLITUDE_INCREASE, EASING, FIRST_LINE_EXIT_MS, LINEAR_ANIMATION_DURATION, PROGRESS_ANIMATION, T, bezier, buildWave, drawPaths, flatWave, handoffExitDistance, handoffExitDuration,
  indeterminateFractions, indicatorAmplitude, keyframe, FIRST_LINE_HEAD, SECOND_LINE_TAIL, segment, stopIndicator,
} from '../src/vue/linearWavy.js'
import { createWavyState } from '../src/vue/linearWavyState.js'

const near = (a, b, eps = 1e-3, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} vs ${b}`)

test('tokens: 4 dp stroke and track, 3 dp amplitude, 40 dp wavelength, 4 dp gap and stop, 10 dp height, one wavelength per second', () => {
  assert.deepEqual({ ...T }, { thickness: 4, trackThickness: 4, amplitude: 3, wavelength: 40, indeterminateWavelength: 20, gap: 4, stop: 4, height: 10, waveSpeed: 40, indeterminateWaveSpeed: 20 })
})

test('the amplitude function: zero at 10 % and below and at 95 % and above, one between', () => {
  for (const v of [0, 0.05, 0.1, 0.95, 1]) assert.equal(indicatorAmplitude(v), 0, String(v))
  for (const v of [0.1001, 0.5, 0.9499]) assert.equal(indicatorAmplitude(v), 1, String(v))
})

test('the wave path: half-wavelength quadratics whose control point is height - stroke away give a centre line of amplitude (height - stroke) / 2 = 3', () => {
  const wave = buildWave(240, T.height, T.thickness, T.wavelength)
  const peak = Math.max(...wave.ys.map(Math.abs))
  near(peak, T.amplitude, 0.01, 'peak')
  assert.ok(wave.ys[5] > 0, 'it starts downwards (the control point is positive)')
  // one wavelength = two half waves: back to 0 and rising again
  const i40 = wave.xs.findIndex((x) => Math.abs(x - 40) < 1e-9)
  near(wave.ys[i40], 0, 1e-9)
  assert.ok(wave.scale > 1, 'a wavy path is longer than it is wide (progressPathScale)')
  assert.ok(wave.xs[wave.xs.length - 1] >= 240 + 40, 'it carries two extra wavelengths for the moving offset')
})

test('the determinate drawing at 50 %: wave from the start cap to the head, a gap, a straight track to the end cap, the stop dot after it', () => {
  const size = { width: 240, height: T.height }
  const wave = buildWave(240, 10, 4, 40)
  const g = drawPaths(size, [0, 0.5], 1, 0, wave)
  assert.equal(g.capWidth, 2)
  const line = g.progress[0]
  // the segment is cut by distance along the path (x times progressPathScale), as Compose does, so the ends are near, not exactly at, the x positions
  near(Math.min(...line.map((p) => p[0])), 2, 0.3, 'starts at the cap width')
  near(Math.max(...line.map((p) => p[0])), 120, 0.3, 'ends at the head')
  // the track starts at head + gap + two caps (the round caps take 2 + 2 of the 8: a visible gap of 4)
  const drawn = g.track.filter((c) => c.length > 1) // a lone moveTo (after the bar, at the start cap) draws nothing
  assert.equal(drawn.length, 1)
  const [from, to] = drawn[0]
  near(from[0], 240 - 2, 1e-9); near(to[0], 120 + 4 + 4, 1e-9)
  assert.equal(from[1], 5); assert.equal(to[1], 5)
  const stop = stopIndicator(0.5, 240, 10, 4, 2)
  near(stop.r, 2); near(stop.cx, 240 - 4 + 2); near(stop.cy, 5)
})

test('the track is only right of the progress: never under the wave, at every progress value', () => {
  const wave = buildWave(240, 10, 4, 40)
  for (let v = 0.01; v <= 1; v += 0.01) {
    const g = drawPaths({ width: 240, height: 10 }, [0, v], 1, 0.3, wave)
    const head = Math.max(2, Math.min(238, v * 240))
    const spacing = head >= 2 ? Math.min(head - 2, 4) + 4 : 0
    for (const chain of g.track.filter((c) => c.length > 1)) for (const [x] of chain) assert.ok(x >= head + spacing - 1e-9, `v ${v.toFixed(2)}: a track point at ${x} is under the progress (head ${head}, spacing ${spacing})`)
    const wavePts = g.progress[0].map((p) => p[0])
    const trackLeft = Math.min(...g.track.filter((c) => c.length > 1).flat().map((p) => p[0]), Infinity)
    if (Number.isFinite(trackLeft) && wavePts.length) assert.ok(trackLeft > Math.max(...wavePts), `v ${v.toFixed(2)}: the track starts at ${trackLeft}, the wave ends at ${Math.max(...wavePts)}`)
  }
})

test('near the start the gap shrinks with the head (it is taken out of the track, not out of the bar) and near the end the stop dot shrinks away', () => {
  const wave = buildWave(240, 10, 4, 40)
  const early = drawPaths({ width: 240, height: 10 }, [0, 0.005], 1, 0, wave) // head 1.2 px: the cap does not fit yet
  near(early.track[0][1][0], 2, 1e-9, 'the track runs up to the start cap: no gap yet')
  assert.equal(stopIndicator(0.5, 240, 10, 4, 2).r, 2)
  assert.ok(stopIndicator(0.985, 240, 10, 4, 2).r < 2, 'the dot shrinks when the bar nears it')
  assert.equal(stopIndicator(1, 240, 10, 4, 2), null, 'and is gone at the end')
})

test('with zero amplitude the path is a line (lineTo) and the wave offset is not applied', () => {
  const g = drawPaths({ width: 240, height: 10 }, [0, 0.4], 0, 0.7, flatWave(240, 10))
  assert.ok(g.progress[0].every(([, y]) => y === 5))
  near(g.progress[0][0][0], 2); near(g.progress[0].at(-1)[0], 96)
})

test('half the amplitude is a wave of half the height around the same centre line', () => {
  const wave = buildWave(240, 10, 4, 40)
  const full = drawPaths({ width: 240, height: 10 }, [0, 0.5], 1, 0, wave).progress[0]
  const half = drawPaths({ width: 240, height: 10 }, [0, 0.5], 0.5, 0, wave).progress[0]
  near(Math.max(...full.map((p) => p[1])) - 5, 3, 0.02); near(Math.max(...half.map((p) => p[1])) - 5, 1.5, 0.02)
})

test('the easing curves are the four numbers of MotionTokens', () => {
  near(EASING.linear(0.37), 0.37, 1e-9)
  near(bezier(0.2, 0, 0, 1)(0.5), 0.8777, 2e-3) // standard: x(t) = 0.6 t (1-t)^2 + t^3 = 0.5 at t = 0.7815, y = 3 (1-t) t^2 + t^3
  assert.ok(EASING.emphasizedAccelerate(0.5) < 0.25 && EASING.emphasizedAccelerate(0.9) > 0.55, 'accelerates late')
  for (const e of [EASING.standard, EASING.emphasizedAccelerate]) { assert.equal(e(0), 0); assert.equal(e(1), 1) }
  assert.equal(PROGRESS_ANIMATION.ms, 500); assert.equal(AMPLITUDE_INCREASE.ms, 500); assert.equal(AMPLITUDE_DECREASE.ms, 500)
})

test('indeterminate keyframes: 1750 ms cycle, first line head 0-1000, tail 250-1250, second line head 650-1500, tail 900-1750, each eased with emphasized-accelerate', () => {
  assert.equal(LINEAR_ANIMATION_DURATION, 1750)
  assert.deepEqual(indeterminateFractions(0, true), [0, 0, 0, 0])
  assert.deepEqual(indeterminateFractions(1750, true), [1, 1, 1, 1])
  assert.equal(keyframe(FIRST_LINE_HEAD, 1000), 1)
  assert.ok(keyframe(FIRST_LINE_HEAD, 500) < 0.5, 'emphasized accelerate: slow first')
  assert.equal(keyframe(SECOND_LINE_TAIL, 899), 0)
  assert.equal(FIRST_LINE_EXIT_MS, 1250)
  assert.deepEqual(indeterminateFractions(2000 % 1750, false).slice(2), [0, 0])
})

test('the handoff exit plays the rest of the cycle at a speed that ramps from 1x to 2.5x over 150 ms', () => {
  near(handoffExitDistance(0), 0); near(handoffExitDistance(150), 150 + (1.5 / 150 / 2) * 150 * 150, 1e-6)
  const d = 600
  const dur = handoffExitDuration(d)
  near(handoffExitDistance(dur), d, 3, 'the duration covers the distance')
  assert.ok(dur < d && dur > d / 2.5)
})

// ---- the clock, driven frame by frame ----
const run = (steps) => { const s = createWavyState(); let out; for (const [t, fn] of steps) { fn?.(s, t); out = s.frame(t) } return { s, out } }

test('a value is eased over 500 ms, linearly (ProgressAnimationSpec): a jump from 0 to 100 % takes half a second and passes every value on the way', () => {
  const s = createWavyState()
  s.set(0, 0); s.frame(0)
  s.set(1, 1000)
  const samples = [0, 125, 250, 375, 500, 600].map((dt) => s.frame(1000 + dt).value)
  samples.slice(0, 5).forEach((v, i) => near(v, i * 0.25, 1e-9, `t ${i * 125}`))
  assert.equal(samples[5], 1)
})

test('the wave amplitude follows the amplitude function of the animated value: it rises after 10 %, falls after 95 %, each over 500 ms with its own curve', () => {
  const s = createWavyState()
  s.set(0, 0); assert.equal(s.frame(0).amplitude, 0)
  s.set(1, 100)
  const trace = {}
  for (let t = 0; t <= 1200; t += 5) trace[t] = s.frame(100 + t).amplitude // frames every 5 ms
  assert.equal(trace[0], 0)
  // the value passes 10 % at 50 ms: the amplitude starts rising then (standard easing, 500 ms)
  near(trace[300], EASING.standard(0.5), 0.02, 'half way of the rise (250 ms after it started)')
  assert.ok(trace[550] >= 0.99 || trace[500] > 0.9, 'risen')
  // the value passes 95 % at 475 ms: the amplitude starts falling (emphasized accelerate, 500 ms), from where it is
  assert.ok(trace[470] > 0.95)
  const falling = trace[725]
  assert.ok(falling < trace[470] && falling > 0, `falling, not yet flat (${falling})`)
  assert.equal(trace[1000], 0)
})

test('the wave moves one wavelength per second while it is wavy, and the amplitude is not touched by a stall', () => {
  const s = createWavyState()
  s.set(0.5, 0); s.frame(0)
  near(s.frame(250).waveOffset, 0.25, 1e-9); near(s.frame(500).waveOffset, 0.5, 1e-9); near(s.frame(1000).waveOffset, 0, 1e-9)
  for (let t = 1000; t < 4000; t += 500) { const f = s.frame(t); assert.equal(f.amplitude, 1); assert.equal(f.value, 0.5) }
})

test('a step back is eased like any other change (the value goes down over 500 ms, never snaps)', () => {
  const s = createWavyState()
  s.set(0.7, 0); s.frame(0)
  s.set(0.1, 100)
  near(s.frame(350).value, 0.4, 1e-9)
  near(s.frame(600).value, 0.1, 1e-9)
})

test('while the length is unknown the indeterminate lines run; when it is known they finish leaving the track at a ramped speed, then the value grows in from no progress', () => {
  const s = createWavyState()
  s.set(null, 0)
  let f = s.frame(0)
  assert.equal(f.indeterminate, true)
  assert.equal(f.fractions.length, 4)
  f = s.frame(700)
  assert.ok(f.fractions[1] > 0 && f.fractions[1] < 1, 'the first line is on its way')
  s.set(0.3, 700)
  let seen = []
  for (let t = 716; t < 4000; t += 16) { f = s.frame(t); seen.push(f) }
  const done = seen.findIndex((x) => !x.indeterminate)
  assert.ok(done > 0, 'the lines left')
  assert.equal(seen[done].fractions.length, 2)
  near(seen[done].handoff, 0, 0.05)
  const last = seen.at(-1)
  assert.equal(last.handoff, 1)
  near(last.fractions[1], 0.3, 1e-9, 'the value is reached')
  assert.ok(seen.slice(done).every((x) => x.fractions[1] <= 0.3 + 1e-9), 'it grows in; it never jumps over the value')
})

test('the first value is drawn as given (no animation from nothing), and the finished bar has no wave (the amplitude function is zero from 95 %)', () => {
  const s = createWavyState()
  s.set(0.4, 0)
  near(s.frame(0).value, 0.4)
  const full = createWavyState()
  full.set(1, 0); full.frame(0)
  const f = full.frame(5000)
  assert.equal(f.value, 1)
  assert.equal(f.amplitude, 0, 'at 100 % Compose draws no wave: the amplitude function is zero from 95 %')
})
