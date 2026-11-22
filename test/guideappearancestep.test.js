import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { appearanceTexts } from '../src/vue/appearanceTexts.js'

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

// guide p2b item 17: the appearance step opens with the wallpaper and the colour; the sliders and the colour style are under 更多, the rest stays on 个性化
test('the guide asks the appearance controls for their essential form; the 个性化 page and the quick sheet keep all of them', () => {
  const flow = read('src/vue/MGuideFlow.vue')
  assert.match(flow, /<MAppearance v-else-if="pageId === 'appearance'"[^>]*\bessential\b/)
  const ap = read('src/vue/MAppearance.vue')
  assert.match(ap, /essential: \{ type: Boolean, default: false \}/)
  // nothing in the essential form is folded away: no 更多外观选项 button, no hidden group
  assert.doesNotMatch(ap, /moreOpen|data-ap-more/)
})

test('in the essential form the order is the wallpaper, the colour, light or dark, then the colour style and the sliders, all shown', () => {
  const ap = read('src/vue/MAppearance.vue')
  const sections = [...ap.matchAll(/:style="ord\((\d)\)"/g)].map((m) => Number(m[1]))
  assert.deepEqual([...new Set(sections)].sort(), [0, 1, 2, 3, 4, 5])
  assert.match(ap, /<section (?:v-if="on\('theme'\)" )?class="m-ap__row" :style="ord\(0\)">\s*<h4>\{\{ T\.background \}\}/)
  assert.match(ap, /<section (?:v-if="on\('theme'\)" )?class="m-ap__row" :style="ord\(1\)">\s*<h4>\{\{ T\.colour \}\}/)
  assert.match(ap, /<section v-if="on\('theme'\) \|\| on\('frost'\)" class="m-ap__row" :style="ord\(2\)">\s*<template v-if="on\('theme'\)">\s*<h4>\{\{ T\.mode \}\}/)
  assert.match(ap, /<section (?:v-if="on\('theme'\)" )?class="m-ap__row" :style="ord\(3\)">\s*<h4>\{\{ T\.colourStyle \}\}/)
  // the blur and tint sliders (the frosted groups) follow the colour style; in the guide and on 个性化 alike they are the MSliderItem of the Panel's HDR page (size m, title, readout, an icon at each end): owner 2026-11-11, the new slider everywhere
  assert.match(ap, /<template v-if="wall && on\('frost'\)">[\s\S]*?T\.blur[\s\S]*?T\.dim/)
  assert.doesNotMatch(ap, /sliderSize/)
  assert.match(ap, /<MSliderItem :model-value="g\.v\.blur" :title="T\.blur"[^>]*size="m" icon-start="blur_off" icon-end="blur_on"/)
  assert.match(ap, /<MSliderItem :model-value="Math\.round\(g\.v\.dim \* 100\)" :title="T\.dim"[^>]*size="m" icon-start="brightness_7" icon-end="brightness_4"/)
  assert.doesNotMatch(ap, /<MSlider /, 'no thin slider rows are left on 个性化')
})

test('the essential form leaves out the tuning that lives on the 个性化 page: dark style, animations, icons, corners, text size, the overview and the tiles', () => {
  const ap = read('src/vue/MAppearance.vue')
  assert.match(ap, /<template v-if="!essential">\s*<template v-if="on\('theme'\)">\s*<h4>\{\{ T\.darkStyle \}\}/)
  assert.match(ap, /<section v-if="!essential && on\('theme'\)" class="m-ap__row m-ap__frost">\s*<h4>\{\{ T\.look \}\}/)
  assert.match(ap, /<section v-if="!essential && on\('home'\)" class="m-ap__row m-ap__tiles">/)
})

test('the pointer to 设置 › 个性化 is written in both languages', () => {
  for (const l of ['zh', 'en']) {
    const T = appearanceTexts(l)
    for (const k of ['elsewhere']) assert.ok(T[k] && T[k].length > 1, `${l} ${k}`)
  }
  assert.match(appearanceTexts('zh').elsewhere, /设置 › 个性化/)
})
