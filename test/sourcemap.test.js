import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeVlq, decodeMappings, loadMap, originalPosition, sourceLabel, unhashed, mapFrames } from '../src/build/sourcemap.js'

// the examples of the Source Map spec and of common encoders
test('base64 VLQ numbers: signs, continuation digits, several in one segment', () => {
  assert.deepEqual(decodeVlq('A'), [0])
  assert.deepEqual(decodeVlq('C'), [1])
  assert.deepEqual(decodeVlq('D'), [-1])
  assert.deepEqual(decodeVlq('gB'), [16])
  assert.deepEqual(decodeVlq('hB'), [-16])
  assert.deepEqual(decodeVlq('AAgBC'), [0, 0, 16, 1])
  assert.deepEqual(decodeVlq('2H'), [123])
  assert.throws(() => decodeVlq('A*'), /not a base64 VLQ/)
  assert.throws(() => decodeVlq('g'), /truncated/)
})

test('mappings are relative to the previous segment and the generated column restarts on every line', () => {
  // line 1: col 0 -> src0 0:0, col 4 -> src0 0:4 ; line 2 (empty) ; line 3: col 2 -> src1 5:0
  const lines = decodeMappings('AAAA,IAAI;;EACJ')
  assert.equal(lines.length, 3)
  assert.deepEqual(lines[0], [{ column: 0, source: 0, line: 0, col: 0 }, { column: 4, source: 0, line: 0, col: 4 }])
  assert.deepEqual(lines[1], [])
  assert.deepEqual(lines[2], [{ column: 2, source: 0, line: 1, col: 0 }])
  assert.throws(() => decodeMappings('AA'), /2 fields/)
})

const MAP = { version: 3, sources: ['../../src/util.js', '/home/someone/work/app/src/views/Home.vue'], names: [], mappings: 'AAAA,IAAI;;EACJ,ICEE' }

test('a position of the bundle is the original line of the last segment at or before the column', () => {
  const map = loadMap(MAP)
  assert.deepEqual(originalPosition(map, 1, 1), { source: '../../src/util.js', line: 1, column: 0 })
  assert.deepEqual(originalPosition(map, 1, 6), { source: '../../src/util.js', line: 1, column: 4 })
  assert.equal(originalPosition(map, 2, 1), null, 'an empty generated line maps to nothing')
  assert.equal(originalPosition(map, 9, 1), null)
  assert.equal(originalPosition(loadMap({ ...MAP, mappings: 'EAAA' }), 1, 1), null, 'before the first segment')
})

test('only maps of version 3 are read', () => {
  assert.throws(() => loadMap({ version: 2, sources: [], mappings: '' }), /version 3/)
  assert.throws(() => loadMap({ version: 3, sections: [] }), /version 3/)
  assert.throws(() => loadMap('{'), /JSON/)
})

test('a source is named from its src/ directory on, never by a build or home directory', () => {
  assert.equal(sourceLabel('../../src/util.js'), 'src/util.js')
  assert.equal(sourceLabel('/home/someone/work/app/src/views/Home.vue?vue&type=script'), 'src/views/Home.vue')
  assert.equal(sourceLabel('C:\\Users\\Eve\\app\\src\\a b.js'), 'src/a_b.js')
  assert.equal(sourceLabel('/home/someone/node_modules/vue/dist/vue.js'), 'vue.js')
})

test('a bundle name without its hash is the key of its map', () => {
  assert.equal(unhashed('https://x/assets/index-AbC123xy.js?x=1'), 'index.js')
  assert.equal(unhashed('vendor.AbC123xy.mjs'), 'vendor.mjs')
  assert.equal(unhashed('index.js'), 'index.js')
})

test('frames are mapped by the bundle name, the rest stay as they are', () => {
  const frames = ['index.js:1:6', 'index.js:2:1', 'other.js:1:1', 'sunshine.exe+0x10', 'src/a.cpp:3:fn']
  const out = mapFrames(frames, [{ file: 'index-AbC123xy.js', map: MAP }])
  assert.deepEqual(out, ['src/util.js:1', 'index.js:2:1', 'other.js:1:1', 'sunshine.exe+0x10', 'src/a.cpp:3:fn'])
})
