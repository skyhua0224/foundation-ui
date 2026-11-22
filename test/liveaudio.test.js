import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import './helpers/settingsFixture.js'
import { recentCatalogue, RECENT_META, RECENT_SIZES } from '../src/vue/homeRecent.js'
import { CATALOGUE_TEXTS } from '../src/vue/homeCatalogueTexts.js'
import { pipelineAverages, perfExtras, PIPELINE_FIELDS } from '../src/vue/homePerfInputs.js'

const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const T = { ...CATALOGUE_TEXTS.en, __locale: 'en' }
const session = { client_name: 'Pixel 9', bitrate: 48000, host_audio: false }

// 主机音频 is a switch of the running stream, one tile for both products (it was an ad-hoc section of the Web UI home)
test('the host audio tile is there while a client streams on this computer and the host can switch it', () => {
  const d = recentCatalogue({ session, canRuntime: true, config: {} }, T)['live-audio']
  assert.equal(d.type, 'control')
  assert.equal(d.runtime, true)
  assert.equal(d.client, 'Pixel 9')
  assert.equal(d.value, 'false')
  assert.deepEqual(d.options.map((o) => o.value), ['true', 'false'])
  assert.equal(recentCatalogue({ session: { ...session, host_audio: true }, canRuntime: true, config: {} }, T)['live-audio'].value, 'true')
})

test('it is left out when nothing streams, when the command is not for this machine, and on a host that has no such field', () => {
  assert.equal(recentCatalogue({ session: null, canRuntime: true, config: {} }, T)['live-audio'], null)
  assert.equal(recentCatalogue({ session, canRuntime: false, config: {} }, T)['live-audio'], null)
  const { host_audio: _gone, ...old } = session
  assert.equal(recentCatalogue({ session: old, canRuntime: true, config: {} }, T)['live-audio'], null)
})

test('the tile is a standard small tile in the catalogue and in the plan of a stream', () => {
  assert.deepEqual(RECENT_SIZES['live-audio'], { s: [2, 1] })
  assert.equal(RECENT_META['live-audio'][0], 'stream')
  assert.match(src('../src/vue/homeRanges.js'), /'ctl-audio', 'live-audio', 'act-stop'\], R\('s', 's'\)/)
  assert.match(src('../src/vue/homeSmart.js'), /'live-audio': \[77, 'rLiveAudio', 's'\]/)
})

test('the whole tile is the switch and it sends the command of the stream, not a saved setting', () => {
  const tile = src('../src/vue/tiles/TileToggleB3.vue')
  assert.match(tile, /tileIds = \[[^\]]*'live-audio'\]/)
  assert.match(tile, /type: 'runtime-host-audio', value: \{ client: d\.value\.client, enabled: draft\.value/)
  assert.match(tile, /d\.runtime \? L\.liveNote : L\.restartNote/)
})

test('the overview reads the same perf fields in both products', () => {
  const s = { pipeline: { convert: { samples: 10, avg_ms: 0.8 }, encode: { samples: 0, avg_ms: 3 }, total: { samples: 5, avg_ms: 'x' } }, frame_rates: { encoded: { fps: 118 } }, capture: 'vdd' }
  assert.deepEqual(pipelineAverages(s), { pipeConvertMs: 0.8 })
  assert.deepEqual(perfExtras(s), { frameRates: { encoded: { fps: 118 } }, perfCapture: 'vdd' })
  assert.deepEqual(pipelineAverages(null), {})
  assert.equal(Object.keys(PIPELINE_FIELDS).length, 6)
})
