import test from 'node:test'
import assert from 'node:assert/strict'
import { GAP, SECTION_MAX, SECTION_MIN, emptiness, fitDash, heightOf, sectionLayout, sectionedOf, unitsFor } from '../src/vue/homeFit.js'
import { boxOf, maxSpanOf, spanFor } from '../src/vue/homeSizes.js'
import { packDash } from '../src/vue/homePack.js'

test('columns follow the width, a tile of a size has a cap, a large tile is the width up to nine columns and six beyond', () => {
  assert.equal(unitsFor(1280), 8); assert.equal(unitsFor(1760), 10); assert.equal(unitsFor(2400), 13); assert.equal(unitsFor(900), 8)
  assert.equal(spanFor(8, 8), 8); assert.equal(spanFor(8, 9), 8); assert.equal(spanFor(8, 11), 6); assert.equal(spanFor(4, 11), 4); assert.equal(spanFor(2, 11), 2)
  assert.equal(maxSpanOf('l', 6, 11), 6); assert.equal(maxSpanOf('s', 2, 11), 3); assert.equal(maxSpanOf('m', 4, 11), 5)
  assert.deepEqual(boxOf('cpu', {}, 'l', 0, 12), { span: 4, rows: 2, max: 4 })
})

test('there is no sectioned layout any more: a very wide or ultrawide window is the same grid with a column cap and wider margins; the helper of the section widths stays', () => {
  for (const [w, h] of [[1920, 1080], [2560, 1440], [3840, 2160], [3440, 1440], [5120, 1440], [2400, 1000]]) assert.equal(sectionedOf(w, h), false, `${w}x${h}`)
  for (const w of [3440, 3840, 5120]) { const s = sectionLayout(w - 120); assert.ok(s.width <= SECTION_MAX && s.width >= SECTION_MIN, `${w}: ${s.width}`); assert.ok(s.across * s.width <= w) }
  assert.equal(sectionLayout(900).across, 1); assert.equal(sectionLayout(2000).across, 2)
})

// a set of tiles like the default overview, boxed per number of columns
const CARDS = [['hero', 'm', 'hero'], ['pair', 'm', 'hero'], ['download', 'm', 'card'], ['encoder', 's', 'card'], ['memory', 's', 'card'], ['cpu', 's', 'hero'], ['gpu', 's', 'hero'], ['gamepad-type', 'm', 'strip'], ['quick', 'm', 'strip'], ['devices', 's', 'card'], ['apps', 's', 'list'], ['sponsor', 's', 'list'], ['star', 'm', 'card']]
const cards = CARDS.map(([id, key, cls]) => ({ id, key, cls }))
const SPANS = { s: 2, m: 4, l: 8 }
const box = (c, units, lift = 0) => { const key = lift ? 'm' : c.key; const base = SPANS[key]; const span = spanFor(base, units); return { span, rows: 1, cls: c.cls, max: maxSpanOf(key, span, units) } }

test('a grid fitted to its width is complete: no row more than a quarter empty at the widths of the screens', () => {
  for (const width of [340, 440, 700, 1000, 1280, 1700, 2200, 2400, 2800, 3400]) {
    const narrow = width < 860
    const f = fitDash(cards, width, box, narrow ? { units: width < 640 ? 4 : 4 } : {})
    assert.ok(f.ratio <= 0.25, `${width}: ${Math.round(f.ratio * 100)} % empty (${f.units} columns)`)
    assert.ok(f.boxed.every((c) => c.span <= (c.max ?? c.span * 2)), 'no tile beyond its cap')
  }
})

test('a short row is made up by a promoted tile or a ghost; what is still short is closed by the tile beside the hole (no hole wider than a column), the boxes keep their caps', () => {
  const few = cards.slice(0, 3)
  const plain = fitDash(few, 2400, box)
  assert.ok(plain.boxed.every((c) => c.span <= c.max), 'caps hold with few tiles')
  const promoted = fitDash(few, 2400, box, { promote: true, priority: (c) => (c.id === 'hero' ? 2 : 1) })
  assert.ok(promoted.ratio <= plain.ratio, 'promotion never makes it emptier')
  const ghosts = [{ id: 'g1', key: 's', cls: 'card' }, { id: 'g2', key: 's', cls: 'card' }, { id: 'g3', key: 's', cls: 'hero' }]
  const filled = fitDash(few, 2400, box, { promote: true, priority: () => 1, ghosts })
  assert.ok(filled.ratio <= promoted.ratio); assert.ok(filled.ghosts.every((id) => ghosts.some((g) => g.id === id)))
  const e = emptiness(packDash([{ id: 'a', span: 2, cls: 'card', max: 2 }], 8), 8)
  assert.equal(e.ratio, 0, 'one capped tile in eight columns would be three quarters empty: the last word of the packer gives it the hole')
})

test('the second dimension: a section under its target height grows by promotions, then suggestions, within the caps and with complete rows', () => {
  const rowPx = () => 190
  const base = [{ id: 'a', key: 's', cls: 'card' }, { id: 'b', key: 's', cls: 'card' }, { id: 'c', key: 's', cls: 'card' }, { id: 'd', key: 's', cls: 'card' }]
  const ghosts = Array.from({ length: 12 }, (_, i) => ({ id: `g${i}`, key: 's', cls: 'card', ghost: true }))
  const plain = fitDash(base, 1000, box, { minUnits: 6, maxUnits: 8, promote: true, priority: () => 1 })
  const target = { min: 900, max: 1100, rowPx, gap: GAP }
  const grown = fitDash(base, 1000, box, { minUnits: 6, maxUnits: 8, promote: true, priority: () => 1, ghosts, target })
  assert.ok(heightOf(grown.packed, rowPx) > heightOf(plain.packed, rowPx), 'it grew')
  assert.ok(heightOf(grown.packed, rowPx) <= target.max, 'not past the largest height')
  assert.ok(grown.ratio <= 0.1 && grown.worst <= 0.2, 'every row stays complete')
  assert.ok(grown.boxed.every((c) => c.span <= (c.max ?? c.span)), 'no tile past its cap')
  assert.ok(grown.ghosts.every((id) => id.startsWith('g')))
  const none = fitDash(base, 1000, box, { minUnits: 6, maxUnits: 8, promote: true, priority: () => 1, target })
  assert.ok(heightOf(none.packed, rowPx) <= target.max, 'without suggestions it only promotes')
})

test('the guide card has one layout (medium): it is never promoted to a half-empty large tile', async () => {
  const { sizesOf, hasOwnLayout } = await import('../src/vue/homeSizes.js')
  assert.equal(hasOwnLayout('guide', {}, 'l'), false); assert.equal(hasOwnLayout('guide', {}, 'm'), true)
  assert.equal(sizesOf('guide').size, 'm')
})
