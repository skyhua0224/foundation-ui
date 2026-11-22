import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const src = fs.readFileSync(new URL('../src/vue/MSlider.vue', import.meta.url), 'utf8')

test('an inset icon crosses to the inactive track when the active track is shorter than the icon needs', () => {
  assert.match(src, /const ICON_ROOM = 48/, '8 px inset + 24 px icon + 8 px inset')
  assert.match(src, /const startInActive = computed\(\(\) => handlePx\.value >= ICON_ROOM\)/)
  assert.match(src, /const endInActive = computed\(\(\) => trackW\.value - handlePx\.value < ICON_ROOM\)/)
  assert.match(src, /left: `\$\{handlePx\.value \+ 16\}px`/, 'start icon: handle + 8 gap + 8 inset')
  assert.match(src, /'is-active': startInActive/); assert.match(src, /'is-active': endInActive/)
})

test('the first and the last stop are inset by the radius of the track end', () => {
  assert.match(src, /f === 0 \? dims\[2\] : f === 1 \? -dims\[2\] : 0/)
})

test('a press writes on release, the arrow keys write 450 ms after the last key', () => {
  assert.match(src, /if \(active\.value >= 0\) \{ active\.value = -1; emit\('commit', model\.value\) \}/)
  assert.match(src, /keyTimer = setTimeout\(\(\) => \{ keyTimer = 0; emit\('commit', model\.value\) \}, 450\)/)
  assert.match(src, /function flushKeys\(\)/); assert.match(src, /@blur="focused = -1; flushKeys\(\)"/)
  assert.match(src, /onBeforeUnmount\(\(\) => \{ ro\?\.disconnect\(\); flushKeys\(\) \}\)/, 'a pending key write is not lost when the slider goes away')
})

test('a stop is not drawn where an inset icon stands, and the stops are centred on the track', () => {
  assert.match(src, /const stopHidden = \(f\) => \{ const x = stopX\(f\); return nearHandle\(f\) \|\| iconBoxes\.value\.some/)
  assert.match(src, /<i v-if="!stopHidden\(f\)" class="m-slider__stop"/)
  const css = fs.readFileSync(new URL('../src/css/expressive.css', import.meta.url), 'utf8')
  assert.match(css, /\.m-slider__stop \{ position: absolute; top: 50%; width: 4px; height: 4px; border-radius: 50%; transform: translate\(-50%, -50%\); background: var\(--md-sys-color-primary\);/, 'on the centre line of the track')
  assert.match(css, /\.m-slider__stop\.is-active \{ background: var\(--md-sys-color-on-primary\); \}/, 'on-primary on the active part')
})

test('the shared slider is the product slider by default: size m, a visible track, the icons and marks in the text colour', () => {
  const css = fs.readFileSync(new URL('../src/css/expressive.css', import.meta.url), 'utf8')
  const item = fs.readFileSync(new URL('../src/vue/MSliderItem.vue', import.meta.url), 'utf8')
  assert.match(src, /size: \{ type: String, default: 'm' \}/); assert.match(item, /size: \{ type: String, default: 'm' \}/)
  assert.match(css, /\.m-slider \{[^}]*--s-bg: color-mix\(in srgb, var\(--md-sys-color-on-surface\) 16%, transparent\)/, 'the unfilled track is a tint of the text colour, on any surface')
  assert.match(css, /\.m-slider__icon \{[^}]*color: var\(--md-sys-color-on-surface-variant\)/)
  assert.match(css, /\.m-slider__mark \{[^}]*background: var\(--md-sys-color-on-surface-variant\); opacity: \.55/)
  assert.match(item, /iconStart/); assert.match(item, /:off-text="offText"/); assert.match(item, /:bubble-text="readoutText"/)
})

test('a mark is not drawn under an inset icon, like a stop', () => {
  assert.match(src, /const markHidden = \(f\) => \{[^}]*iconBoxes\.value\.some/)
  assert.match(src, /v-show="!markHidden\(f\)"/)
})

test('the sliders of the home tiles and the mode card are the M3 Expressive slider: the same full track at every height of the tile, the live bitrate tile runs on the segmented bitrate scale', () => {
  const read = (p) => fs.readFileSync(new URL(`../src/vue/${p}`, import.meta.url), 'utf8')
  for (const p of ['tiles/TileLive.vue', 'tiles/TilePin.vue', 'tiles/TileRecent.vue', 'MDashWidget.vue', 'MModeCard.vue']) {
    const text = read(p)
    assert.match(text, /<MSlider\b/, p); assert.doesNotMatch(text, /<MSlider[^>]*size="xs"/, p)
  }
  for (const p of ['tiles/TileLive.vue', 'tiles/TilePin.vue']) assert.match(read(p), /const sliderSize = 'm'/, p)
  assert.match(read('MDashWidget.vue'), /<MSlider[^>]*size="m"/)
  for (const p of ['tiles/TileLive.vue', 'tiles/TilePin.vue', 'tiles/TileRecent.vue', 'MDashWidget.vue']) assert.doesNotMatch(read(p), /<MSlider[^>]*size="s"|\? 'm' : 's'/, `${p}: no thin track at any height`)
  const live = read('tiles/TileLive.vue')
  assert.match(live, /bitrateSliderSpan\(/); assert.match(live, /bitrateChipMarks\(\[5, 10, 20, 50, 100, 200\]/); assert.match(live, /bitrateFromProgress\(position\)/)
  assert.doesNotMatch(live, /<MSlider v-model="rate"/, 'not a linear Mbps track')
  const css = fs.readFileSync(new URL('../src/css/tiles-prerelease.css', import.meta.url), 'utf8')
  assert.match(css, /\.m-tile \.m-slider \{ --md-sys-color-track: var\(--md-sys-color-primary-container\)/, 'the fill is the container colour, not the flat on-primary white')
  assert.match(css, /\.m-tile \.m-slider__mark \{ width: 4px; height: 4px; border-radius: 50%/, 'the ticks are dots, not bars')
  assert.match(css, /\.m-slider__seg:not\(\.m-slider__seg--active\)::after/, 'the stop dot at the end of the track')
})
