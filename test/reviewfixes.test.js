import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildHomeModel, DEFAULT_TEXTS, TEXTS_ZH } from '../src/vue/homeModel.js'
import { pullNeighbours, packDash } from '../src/vue/homePack.js'
import { readDash } from './dashSource.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

test('R1: a rolling digit slides in at full opacity, it never fades in beside the digit it replaces', () => {
  const css = read('../src/css/dash.css')
  assert.ok(!/m-roll-fade/.test(css))
  assert.match(css, /\.m-roll__ch \{[^}]*animation: m-roll-move [^;,]*;/)
})

test('R2: a hero row with free columns is back-filled; a slim strip row is not; the columns of a tall card beside the row are not counted free', () => {
  const hero = (id, span) => ({ id, span, cls: 'hero', rows: 1 })
  const card = (id, span) => ({ id, span, cls: 'card', rows: 1 })
  const strip = (id, span) => ({ id, span, cls: 'strip', rows: 1 })
  // ten columns: the host (4) and two small hero tiles leave two columns: the next small card comes up
  const out = pullNeighbours([hero('host', 4), hero('cpu', 2), hero('gpu', 2), strip('quick', 8), card('mem', 2)], 10)
  assert.deepEqual(out.map((c) => c.id), ['host', 'cpu', 'gpu', 'mem', 'quick'])
  assert.equal(out[3].filled, true)
  assert.deepEqual(pullNeighbours([strip('a', 4), card('b', 2), card('c', 2)], 8).map((c) => c.id), ['a', 'b', 'c'], 'a strip row keeps its own height')
  assert.equal(pullNeighbours([strip('a', 4), card('b', 2)], 8)[1].filled, undefined)
  // a tall card stands beside the next row: its four columns are taken
  const tall = { id: 'big', span: 4, cls: 'hero', rows: 2 }
  const next = pullNeighbours([tall, hero('s1', 2), hero('s2', 2), card('n', 4)], 8)
  assert.deepEqual(next.map((c) => c.id), ['big', 's1', 's2', 'n'])
  assert.ok(!next.find((c) => c.id === 'n').filled)
  const packed = packDash([hero('host', 4), hero('cpu', 2), hero('gpu', 2), strip('quick', 8), card('mem', 2)], 10)
  assert.equal(packed.placed.get('mem').row, 0)
})

test('R2: the virtual display tile has a body when the size is not known yet', () => {
  const base = { host: { name: 'H', running: true }, session: null, clients: [], apps: null }
  for (const [T, text] of [[DEFAULT_TEXTS, 'follows the client'], [TEXTS_ZH, '跟随客户端']]) {
    const m = buildHomeModel({ ...base, vdd: { state: 'ready' } }, T)
    assert.match(m.vdd.sub, new RegExp(text))
  }
  const sized = buildHomeModel({ ...base, vdd: { state: 'ready', width: 2560, height: 1440, hz: 120 } })
  assert.match(sized.vdd.sub, /2560×1440/)
})

test('R3: the client is called 客户端 everywhere, in the tile titles and the first steps', () => {
  const model = read('../src/vue/homeModel.js')
  assert.ok(!/控制端/.test(model))
  assert.ok(!/control app/i.test(model))
  assert.equal(TEXTS_ZH.downloadTitle, '下载客户端')
  assert.equal(DEFAULT_TEXTS.downloadTitle, 'Download clients')
})

test('R4: the global unsaved bar is hidden while the first-run window is open', () => {
  assert.match(read('../src/css/onboard.css'), /html\.m-onboarding \.m-pbar \{ display: none; \}/)
})

test('R5: the dock has no row that scrolls (no fade, no arrow over a tile), and the clock block is centred above the tiles', () => {
  const vue = readDash()
  const css = read('../src/css/dash.css')
  assert.ok(!/is-more-r|dockScroll/.test(vue)); assert.ok(!/m-dock__more|m-dock__row/.test(css))
  assert.match(css, /\.m-dock__grid \{ display: grid;[^}]*justify-content: center;/)
  assert.match(css, /\.m-dock__head \{ flex: 1 0 auto; display: flex; flex-direction: column; justify-content: center;/)
})
