import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { skeletonOf, skeletonTop, snapshotOf } from '../src/vue/dash/dashSkeleton.js'
import { columnsOf, largestOf } from '../src/vue/homeSizes.js'

// home-streaming-first-frame 2026-11-11: the overview drew itself idle, then flipped to the streaming layout when the session arrived, the star card named no client until the clients came, and a curve tile grew when its second sample
// arrived. The product now says when it can draw (ctx.pending); these tests keep the parts of that contract in the library.
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const cols = (w) => columnsOf(w)
const block = { key: 'grid', units: columnsOf(1200).columns, width: 0, template: '100px 100px 56px', boxed: [{ id: 'a', span: 2, rows: 2, cls: 'unit' }] }
const cellStyle = () => ({ gridRow: '1 / span 1', gridColumn: '1 / span 2' })

test('the skeleton keeps the place of the card above the grid, for the kind of window it was kept for', () => {
  const s = snapshotOf({ blocks: [block], cellStyle, sectioned: false, width: 1200, top: 69.6 })
  assert.equal(s.top, 70)
  assert.equal(skeletonTop(s, { sectioned: false, width: 1200, columnsOf: cols }), 70)
  assert.equal(skeletonTop(s, { sectioned: false, width: 600, columnsOf: cols }), 0, 'another column count: no kept place')
  assert.equal(skeletonTop(null, { sectioned: false, width: 1200, columnsOf: cols }), 0)
  assert.equal(snapshotOf({ blocks: [block], cellStyle, sectioned: false, width: 1200 }).top, 0, 'no card above it: nothing to keep')
  assert.ok(skeletonOf(s, { sectioned: false, width: 1200, columnsOf: cols }).length, 'the arrangement is still drawn')
})

test('a curve with its value now is not held at 中 for want of a second sample', () => {
  const live = { kind: 'curve', data: { points: [98.2], value: '98.2', facts: [] } }
  assert.equal(largestOf('bitrate', live), 'xl', 'one sample and a value: the same size the second sample would give')
  assert.equal(largestOf('bitrate', { kind: 'curve', data: { points: [], value: '', facts: [] } }), 'm', 'no value yet: still 中')
  assert.equal(largestOf('bitrate', { kind: 'curve', data: { points: [98.2, 99.1], value: '99.1', facts: [] } }), largestOf('bitrate', live), 'the size does not change with the number of samples')
})

test('MHomeDash waits for ctx.pending: the skeleton stands, no card at the top, and a card that is there in the first drawn frame does not open from nothing', () => {
  const d = read('src/vue/MHomeDash.vue'), skel = read('src/vue/dash/dashSkeletonUse.js'), plan = read('src/vue/dash/dashPlan.js')
  assert.match(d, /const pending = computed\(\(\) => !!props\.ctx\.pending\)/)
  assert.match(d, /<MClientPrompt v-if="clientRec && !edit && !pending"/); assert.match(d, /<MStarPrompt v-else-if="ctx\.star && !edit && !pending"/)
  assert.match(d, /@enter="onSlotEnter"/); assert.match(d, /const onSlotEnter = \(el, done\) => \(firstDraw \? done\(\) : slotIn\(el, done\)\)/, 'the first drawn frame is the frame of the release, not a time limit that a slow machine misses')
  assert.doesNotMatch(d, /performance\.now\(\) - drawnAt/)
  assert.match(read('src/vue/dash/dashDock.js'), /slotAhead\(above\)/, 'the grid is measured for the final height of a card that is opening or closing')
  assert.match(d, /v-if="skeleton && skeletonTop"/)
  assert.match(skel, /\(empty\.value \|\| pending\.value\) && !dockOn\.value && !edit\.value/, 'the skeleton stands while the product is pending, not only while there are no tiles')
  assert.match(skel, /empty\.value \|\| pending\.value \|\| edit\.value/, 'what is drawn while pending is not kept as the arrangement')
  // the plan follows at once while nothing is drawn; from the first drawn frame a change slides (a correction in the first moments, else after the hysteresis)
  assert.match(plan, /if \(props\.ctx\.pending === true\) \{ clearTimeout\(hysteresisTimer\); replan\(false\); return \}/)
  assert.match(plan, /CORRECTION_MS/)
  assert.match(plan, /watch\(\(\) => props\.ctx\.pending, \(p\) => \{ if \(p === false\)/)
})

test('the hero takes the cover colours from a cache, so a card that is drawn again has them in its first frame', () => {
  const hero = read('src/vue/tiles/cal/CalHero.vue'), cache = read('src/vue/tiles/cal/heroTintCache.js'), idx = read('src/vue/index.js')
  assert.match(hero, /heroTintOf\(art/); assert.doesNotMatch(hero, /tint\.value = null/, 'no reset to the theme colours before each read')
  assert.match(cache, /const cache = shallowReactive/); assert.match(cache, /export function heroArtReady/); assert.match(cache, /export function heroTintOf/)
  assert.match(idx, /coverOk, coverKnown/); assert.match(idx, /heroArtReady/)
})

test('coverKnown says when a cover is a picture or not (loaded or failed), and starts the load', async () => {
  const loads = []
  globalThis.Image = class { set src(v) { loads.push(v); this._src = v; queueMicrotask(() => { this.naturalWidth = this.naturalHeight = v.includes('bad') ? 1 : 300; (v.includes('err') ? this.onerror : this.onload)?.() }) } }
  const { coverKnown, coverOk } = await import(`../src/vue/coverOk.js?${Date.now()}`)
  assert.equal(coverKnown(''), true, 'no url: nothing to wait for')
  assert.equal(coverKnown('/x/a.png'), false, 'asked for the first time: loading')
  assert.deepEqual(loads, ['/x/a.png'])
  await new Promise((r) => setTimeout(r, 5))
  assert.equal(coverKnown('/x/a.png'), true); assert.equal(coverOk('/x/a.png'), true)
  coverKnown('/x/bad.png'); coverKnown('/x/err.png'); await new Promise((r) => setTimeout(r, 5))
  assert.equal(coverKnown('/x/bad.png'), true); assert.equal(coverOk('/x/bad.png'), false, 'a pixel is no cover, and that is known too')
  assert.equal(coverKnown('/x/err.png'), true); assert.equal(coverOk('/x/err.png'), false)
  delete globalThis.Image
})
