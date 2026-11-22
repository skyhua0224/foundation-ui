import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// The geometry of MProgressRing is Compose Material3's (docs/progress-ring.md): checked on the source text and on the numbers it derives.
const v = fs.readFileSync(new URL('../src/vue/MProgressRing.vue', import.meta.url), 'utf8')

test('stroke, gap, size, start and caps are the Material 3 tokens', () => {
  assert.match(v, /const S = 4, GAP = 4, AMP = 1\.6, WAVES = 8/, 'ActiveThickness 4, TrackActiveSpace 4, ActiveWaveAmplitude 1.6')
  assert.match(v, /props\.wavy && !props\.segments \? 48 : 40/, 'WaveSize 48, Size 40')
  assert.match(v, /\(\(GAP \+ S\) \/ \(Math\.PI \* D\.value\)\) \* 360/, 'the gap sweep adds the stroke for the round caps, as ProgressIndicator.kt does')
  assert.match(v, /Math\.sin\(a\), C\.value - r \* Math\.cos\(a\)|C\.value \+ r \* Math\.sin\(a\), C\.value - r \* Math\.cos\(a\)/, '12 o\'clock, clockwise')
})

test('the amplitude of the wavy indicator is 0 up to 10 % and from 95 % (WavyProgressIndicatorDefaults.indicatorAmplitude)', () => {
  assert.match(v, /v <= 0\.1 \|\| v >= 0\.95 \? 0 : AMP/)
})

test('near 0 the gaps shrink with the sweep and the track is gone at 100 %', () => {
  assert.match(v, /const shift = Math\.min\(at, g\)/)
  assert.match(v, /at >= 359\.99 \? ''/)
  assert.match(v, /if \(len <= 0\.01\) return ''/, 'nothing is drawn for an empty arc')
})

test('a gap of 22.9 degrees for the flat ring and 19.1 for the wavy one', () => {
  const deg = (D) => ((4 + 4) / (Math.PI * D)) * 360
  assert.ok(Math.abs(deg(40) - 22.92) < 0.01); assert.ok(Math.abs(deg(48) - 19.1) < 0.01)
})
