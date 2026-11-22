import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_SIZE_KEYS, effectiveSize, offeredOf, sizeKeyOf, sizePx, SIZE_UNITS, unitPx, windowClassOf, WINDOW_CLASSES, XLP_MIN_HEIGHT } from '../src/vue/homeSizes.js'
import { TILE_RANGES, rangeOf } from '../src/vue/homeRanges.js'
import { CARD_META, DEFAULT_ORDER } from '../src/vue/homeCards.js'

const RANK = { s: 0, m: 1, l: 2, xl: 3, xlp: 3 }
const tile = (id) => ({ id, ...(CARD_META[id] || {}) })

test('the window classes of Material 3: compact < 600, medium < 840, expanded < 1200, large < 1600, extra-large from 1600', () => {
  assert.deepEqual([0, 599, 600, 839, 840, 1199, 1200, 1599, 1600, 2560].map(windowClassOf), ['compact', 'compact', 'medium', 'medium', 'expanded', 'expanded', 'large', 'large', 'extra', 'extra'])
})

test('the ladder in square units: 方形 1x1, 中 2x1, 大 2x2, 特大 4x2, 特大竖 2x4; one shape per name', () => {
  assert.deepEqual(SIZE_UNITS, { s: [1, 1], m: [2, 1], l: [2, 2], xl: [4, 2], xlp: [2, 4] })
  const u = 176
  assert.deepEqual(sizePx('s', u), [176, 176]); assert.deepEqual(sizePx('m', u), [364, 176]); assert.deepEqual(sizePx('l', u), [364, 364]); assert.deepEqual(sizePx('xl', u), [740, 364]); assert.deepEqual(sizePx('xlp', u), [364, 740])
  for (const w of [328, 380, 700, 1100, 1280, 1800]) assert.ok(unitPx(w) >= 140 && unitPx(w) <= 260, `${w}: ${unitPx(w)}`)
})

test('every tile declares a range whose bounds are ladder sizes in order, or a strip; 特大 only where a tile has a 特大 view', () => {
  for (const id of DEFAULT_ORDER) {
    const r = rangeOf(id, CARD_META[id])
    assert.ok(r.strip || (r.min in RANK && r.max in RANK && RANK[r.min] <= RANK[r.max]), id)
    if (r.max === 'xl' && !r.banner) assert.ok(['hero', 'clients-paired', 'covers', 'errors', 'journey', 'recent-actions', 'announcements', 'net'].includes(id), id)
  }
  assert.ok(Object.keys(TILE_RANGES).length > 60)
})

test('effectiveSize: the preference clamped to the tile and the class; the preference itself is never lost (a wider window brings it back)', () => {
  const cpu = tile('cpu')
  assert.deepEqual(WINDOW_CLASSES.map((c) => effectiveSize(tile('clients-paired'), 'xl', c)), ['m', 'l', 'l', 'xl', 'xl'])
  // a tile whose content needs a square of its own keeps it on a phone
  assert.deepEqual(WINDOW_CLASSES.map((c) => effectiveSize(tile('ctl-vdd'), undefined, c)), ['l', 'l', 'l', 'l', 'l'])
  assert.deepEqual(WINDOW_CLASSES.map((c) => effectiveSize(cpu, 'xl', c)), ['m', 'l', 'l', 'l', 'l'], 'no 特大 for the CPU: the host reports no load per core')
  assert.deepEqual(WINDOW_CLASSES.map((c) => effectiveSize(cpu, 's', c)), ['s', 's', 's', 's', 's'])
  // 本主机 has a square since round 31 (the name, the state, one fact): a saved 方形 draws 方形 everywhere; its default stays 中
  assert.deepEqual(WINDOW_CLASSES.map((c) => effectiveSize(tile('hero'), 's', c)), ['s', 's', 's', 's', 's'])
  // the journey is a banner: the row's width and its content's height in every class (not a step of the ladder)
  assert.deepEqual(WINDOW_CLASSES.map((c) => effectiveSize(tile('journey'), undefined, c)), ['xl', 'xl', 'xl', 'xl', 'xl'])
  assert.equal(rangeOf('journey').banner, true)
  // 特大竖 needs the room: no tile asks for it yet, and none is given it
  for (const id of DEFAULT_ORDER) for (const c of WINDOW_CLASSES) assert.ok(!offeredOf(id, CARD_META[id], c, XLP_MIN_HEIGHT - 1).includes('xlp'), id)
})

test('no tile is drawn below its class minimum or above its maximum, in any class, whatever was saved', () => {
  for (const id of DEFAULT_ORDER) for (const c of WINDOW_CLASSES) for (const saved of [undefined, ...ALL_SIZE_KEYS, 'huge']) {
    const k = effectiveSize(tile(id), saved, c)
    const offered = offeredOf(id, CARD_META[id], c)
    assert.ok(offered.includes(k), `${id} ${c} ${saved}: ${k} not in ${offered}`)
  }
})

test('a slow drag across each class boundary switches a size exactly once, and the same width always draws the same size', () => {
  for (const id of DEFAULT_ORDER) for (const saved of ['s', 'm', 'l', 'xl']) {
    let last = null; const at = new Map(); const flips = []
    for (let w = 320; w <= 2700; w++) { const k = effectiveSize(tile(id), saved, windowClassOf(w)); at.set(w, k); if (last && k !== last) flips.push(w); last = k }
    // a switch happens only at a class boundary, once per boundary
    for (const w of flips) assert.ok([600, 840, 1200, 1600].includes(w), `${id} ${saved}: switch at ${w}`)
    assert.equal(new Set(flips).size, flips.length)
    // back the other way: the same sizes at the same widths
    for (let w = 2700; w >= 320; w--) assert.equal(effectiveSize(tile(id), saved, windowClassOf(w)), at.get(w))
  }
})

test('the saved sizes of the builds before the ladder migrate deterministically: clamped into the tile\'s range, a control row stays a strip', () => {
  assert.equal(sizeKeyOf('table', CARD_META.table, 's'), 'm', 'below the minimum: the minimum')
  assert.equal(sizeKeyOf('vdd', CARD_META.vdd, 'xl'), 'm', 'above the maximum: the largest left')
  assert.equal(sizeKeyOf('bitrate', CARD_META.bitrate, 'xl'), 'l', 'a 特大 that is gone: 大')
  assert.equal(sizeKeyOf('gamepad-type', CARD_META['gamepad-type'], 'm'), 'm', '手柄类型 is offered at 中 now (the list beside its art)')
  assert.equal(sizeKeyOf('gamepad-type', CARD_META['gamepad-type'], 'xl'), 'strip', 'a size above its ladder is its control row')
  assert.equal(sizeKeyOf('gamepad-type', CARD_META['gamepad-type'], 's'), 's')
  assert.equal(sizeKeyOf('quick', CARD_META.quick, 'l'), 'strip')
  assert.equal(sizeKeyOf('clients-paired', CARD_META['clients-paired'], 'xl'), 'xl')
})
