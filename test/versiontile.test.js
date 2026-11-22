import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (p) => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8')

test('the 版本 tile has one status line (a label is never put in the sentence of a version) and the date as its hero', () => {
  const v = read('vue/tiles/TileInfoB3.vue')
  const tpl = /<section v-else-if="id === 'update'"[\s\S]*?<\/section>/.exec(v)[0]
  assert.equal((tpl.match(/m-b3u__state/g) || []).length >= 1, true); assert.doesNotMatch(tpl, /updateTo/)
  assert.match(v, /isVersionLike\(v\)/, 'only a version is taken for a version')
  assert.match(v, /fill\(L\.value\.updateTo, \{ v: '' \}\)\.trim\(\)/, 'the pill says 「有新版本」 and no version')
  assert.match(tpl, /vp\.main/); assert.match(tpl, /vp\.build/); assert.match(tpl, /vp\.rest/)
  const css = read('css/tiles-prerelease.css')
  assert.match(css, /\.m-b3u__hero \{[^}]*--vh: clamp\(13px, min\(calc\(100cqw \/ \(var\(--chars, 5\) \* 0\.6\)\)/, 'the hero follows the width of its widest line and the height left')
})

test('the chart of a tile spans the box from the first samples on, and from 8 samples on only', () => {
  const c = read('vue/MTileChart.vue')
  assert.match(c, /const MIN_SAMPLES = 8/); assert.match(c, /const win = computed\(\(\) => \(props\.kind === 'bars' \? props\.window : Math\.max\(2, Math\.min\(props\.window, finite\.value\.length\)\)\)\)/)
  assert.match(c, /v-if="box\.w && enough"/); assert.match(c, /enough && dot/)
  assert.match(read('css/tilekit.css'), /\.m-tchart__dot \{[^}]*width: 8px; height: 8px;[^}]*box-shadow: 0 0 0 2px/, 'a small dot, not a ringed handle')
})
