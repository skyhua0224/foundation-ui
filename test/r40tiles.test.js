import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (p) => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8')
const metrics = read('css/tiles-metrics.css'), kit = read('css/tilekit.css'), b2 = read('css/tiles-b2.css'), b3 = read('css/tiles-b3.css'), connect = read('css/connect.css')
const setting = read('vue/tiles/TileSettingB3.vue')

test('码率 方形: the corner shape is inside the gauge, so its children are lifted over it here, not by the tile rule that does not reach them', () => {
  assert.match(metrics, /\.m-tstream__gauge > :not\(\.m-tile__corner\) \{ position: relative; z-index: 1; \}/)
  assert.match(kit, /\.m-tile > :not\(\.m-tile__bleed, \.m-tile__corner\) \{ position: relative; z-index: 1; \}/, 'the rule it stands beside')
})

test('chips: a neutral chip is the accent mixed toward the text colour, so it reads 4.5:1 over a tonal shape in both themes', () => {
  assert.match(kit, /\.m-tchip \{[^}]*color: color-mix\(in srgb, var\(--tk\) 72%, var\(--md-sys-color-on-surface\)\);/)
})

test('已配对客户端 中: a device name wraps to a second line before it is cut', () => {
  assert.match(b2, /\.m-b2paired__people ul \+ ul li \{[^}]*-webkit-line-clamp: 2;/)
  assert.doesNotMatch(b2, /\.m-b2paired__people ul \+ ul li \{[^}]*white-space: nowrap/)
})

test('connect journey: the seven systems are one row of equal large chips, only inside the journey', () => {
  assert.match(connect, /\.m-journey \.m-oschips\.is-big \{ display: grid; grid-template-columns: repeat\(auto-fit, minmax\(132px, 1fr\)\);/)
  assert.match(connect, /\.m-journey \.m-oschips\.is-big \.m-oschips__chip \{ height: 68px;/)
})

test('the foot of a metric tile (caption, stats) takes the card text colour in the dark theme, where its on-container colour is dark on a dark card', () => {
  assert.match(read('css/tiles-cal.css'), /html\[data-bs-theme='dark'\] \.m-tile > \.m-calm__foot, html\[data-theme='dark'\] \.m-tile > \.m-calm__foot \{ color: var\(--tile-text-2, var\(--md-sys-color-on-surface-variant\)\); \}/)
})
