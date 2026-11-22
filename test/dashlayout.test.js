import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LAYOUT_VERSION, RETIRED_SIZES, useDashLayout } from '../src/vue/useDashLayout.js'
import { DEFAULT_ORDER, CARD_META, buildCards, packDash, rowTemplate, defaultVisible } from '../src/vue/homeCards.js'
import { CATALOGUE_IDS } from '../src/vue/homeCatalogue.js'

const memory = () => { const s = {}; return { s, getItem: (k) => s[k] ?? null, setItem: (k, v) => { s[k] = v } } }
const cards = (live = false) => DEFAULT_ORDER.map((id) => ({ id, ...CARD_META[id], available: !(id === 'bitrate' || id === 'fps') || live, def: CARD_META[id].def }))

test('defaults: idle shows the load curves, a live session the stream curves, a new setup the get started cards', () => {
  const l = useDashLayout('a', memory())
  const ids = (live, isNew) => l.visible(cards(live), { live, isNew }).map((c) => c.id)
  assert.deepEqual(ids(false, false).slice(0, 4), ['hero', 'pair', 'download', 'cpu'])
  // the default home ships the pairing card and the download guide (both ordinary cards: they can be hidden, resized and added back)
  assert.ok(ids(false, false).includes('pair') && ids(false, false).includes('download') && ids(true, false).includes('pair') && ids(true, false).includes('download'))
  assert.ok(ids(true, false).includes('bitrate') && !ids(true, false).includes('cpu'))
  // the 开始使用 card (steps that cannot be clicked) is not on the default overview, new setup or not: the first run covers it
  assert.ok(!ids(false, true).includes('guide') && !ids(false, false).includes('guide') && !ids(false, true).includes('table'))
  assert.ok(ids(false, false).includes('sponsor') && ids(false, false).indexOf('vdd') < ids(false, false).indexOf('devices'))
})
test('any card may move anywhere and keeps its place across reloads', () => {
  const store = memory()
  const l = useDashLayout('b', store)
  l.moveTo('table', 'journey')
  assert.equal(l.state.order[0], 'table')
  l.moveTo('table', 'memory')
  assert.ok(l.state.order.indexOf('table') === l.state.order.indexOf('memory') + 1)
  const again = useDashLayout('b', { getItem: () => store.s['foundation-ui.dash2.b'] })
  assert.deepEqual(again.state.order, l.state.order)
})
test('hide, add and reset', () => {
  const l = useDashLayout('c', memory())
  const ctx = { live: false, isNew: false }
  l.setVisible('memory', false)
  assert.ok(!l.visible(cards(), ctx).some((c) => c.id === 'memory'))
  assert.ok(l.addable(cards(), ctx).some((c) => c.id === 'memory'))
  l.setVisible('bitrate', true)
  assert.ok(!l.visible(cards(false), ctx).some((c) => c.id === 'bitrate'), 'a card without data is never shown')
  l.moveTo('sponsor', 'hero'); l.reset()
  assert.equal(l.isDefault.value, true)
})
test('step moves one place among the visible cards', () => {
  const l = useDashLayout('d', memory())
  const ids = l.visible(cards(), { live: false }).map((c) => c.id)
  l.step('cpu', 1, ids)
  assert.ok(l.state.order.indexOf('cpu') > l.state.order.indexOf('gpu'))
})
test('corrupted storage and unknown ids are ignored', () => {
  const l = useDashLayout('e', { getItem: () => JSON.stringify({ order: ['zzz', 'sponsor', 5], overrides: { zzz: true, hero: 'x', memory: false } }) })
  assert.equal(l.state.order[1], 'sponsor'); assert.equal(l.state.order[0], 'journey'); assert.deepEqual(l.state.overrides, { memory: false })
  assert.deepEqual(useDashLayout('f', { getItem: () => '{nope' }).state.order, [...DEFAULT_ORDER])
})
test('packer: rows fill the width, classes never share a row', () => {
  const vis = cards().filter((c) => !['bitrate', 'fps', 'guide', 'download', 'journey', 'star'].includes(c.id) && c.id !== 'display' && !c.id.startsWith('comp:') && !CATALOGUE_IDS.includes(c.id))
  const { rows, placed } = packDash(vis, 8)
  for (const r of rows) assert.equal(r.cells.reduce((n, c) => n + c.span, 0), 8)
  assert.deepEqual(rows.map((r) => r.cls), ['hero', 'strip', 'strip', 'card', 'list']) // the controls, then the quick actions
  assert.equal(placed.get('hero').span, 4)
  const odd = packDash(cards().filter((c) => ['memory', 'encoder', 'vdd'].includes(c.id)), 8)
  assert.deepEqual(odd.rows[0].cells.map((c) => c.span).sort(), [2, 3, 3]); // 6 units filled to 8, widest first
  assert.equal(packDash([{ id: 'x', span: 5, cls: 'card' }, { id: 'y', span: 5, cls: 'card' }], 8).rows.length, 2)
  assert.equal(packDash(vis, 2).rows.every((r) => r.cells.length === 1), true)
})
test('row template: only the last list row stretches', () => {
  const { rows } = packDash([{ id: 'a', span: 8, cls: 'list' }, { id: 'b', span: 8, cls: 'list' }], 8)
  assert.equal(rowTemplate(rows).split(') ').length >= 1, true)
  assert.ok(rowTemplate(rows).includes('1fr') && rowTemplate(rows).split('1fr').length === 2)
})
test('catalogue lists every card, with unavailable ones marked, and a download card', () => {
  const list = buildCards({ hero: { x: 1 }, curves: [], strip: null, info: [], vdd: null, table: null, apps: null }, { texts: {} })
  assert.deepEqual(list.map((c) => c.id), [...DEFAULT_ORDER])
  assert.equal(list.find((c) => c.id === 'hero').available, true)
  assert.equal(list.find((c) => c.id === 'cpu').available, false)
  assert.equal(defaultVisible('new', { isNew: true }), true)
})

test('a layout round-trips through save and load, sizes and the version included', () => {
  const store = memory()
  const a = useDashLayout('rt', store)
  a.setSize('pair', 's'); a.setSize('cpu', 'l'); a.setVisible('download', false); a.moveTo('apps', 'cpu')
  const saved = JSON.parse(store.getItem('foundation-ui.dash2.rt'))
  assert.equal(saved.v, LAYOUT_VERSION)
  const b = useDashLayout('rt', store)
  assert.deepEqual(JSON.parse(JSON.stringify(b.state)), JSON.parse(JSON.stringify(a.state)))
  assert.equal(b.state.sizes.pair, 's'); assert.equal(b.state.overrides.download, false)
})

test('a layout saved before the pairing card gets it after the host card, in the order the person kept', () => {
  const store = memory()
  store.setItem('foundation-ui.dash2.old', JSON.stringify({ order: ['gpu', 'hero', 'cpu', 'apps'], overrides: { apps: false }, sizes: { cpu: 'm' } }))
  const l = useDashLayout('old', store)
  assert.equal(l.state.order[l.state.order.indexOf('hero') + 1], 'pair')
  assert.ok(l.state.order.indexOf('gpu') < l.state.order.indexOf('hero') && l.state.order.indexOf('cpu') > l.state.order.indexOf('pair'))
  assert.equal(l.state.overrides.apps, false); assert.equal(l.state.sizes.cpu, 'm')
  // saved again, the version is current and a second load does not move the card
  l.moveTo('pair', 'apps'); const again = useDashLayout('old', store)
  assert.ok(again.state.order.indexOf('pair') > again.state.order.indexOf('apps') - 1)
  assert.equal(JSON.parse(store.getItem('foundation-ui.dash2.old')).v, LAYOUT_VERSION)
})

test('packer: a card alone in its row gets a neighbour of its class from further down instead of being stretched', () => {
  const cards = [{ id: 'a', span: 4, cls: 'card' }, { id: 'h1', span: 2, cls: 'hero' }, { id: 'h2', span: 2, cls: 'hero' }, { id: 'b', span: 4, cls: 'card' }, { id: 'h3', span: 4, cls: 'hero' }]
  const { rows, placed } = packDash(cards, 8)
  assert.equal(placed.get('a').row, placed.get('b').row, 'a and b share a row')
  assert.ok(rows.every((r) => r.cells.reduce((n, c) => n + c.span, 0) === 8))
  assert.ok([...placed.values()].every((p) => p.span <= 4), 'no card is stretched across the row')
})

test('the star card: not before a first pairing or stream, due after one, back at every stream after 以后再说', async () => {
  const { useStarCard, readStar } = await import('../src/vue/starCard.js')
  const { CARD_META } = await import('../src/vue/homeCards.js')
  const store = memory()
  const { ref, nextTick } = await import('vue')
  const trigger = ref(false), streaming = ref(false)
  const card = useStarCard({ storageKey: 'k', triggered: () => trigger.value, streaming: () => streaming.value, storage: store })
  assert.equal(card.visible.value, false, 'new setup: no star yet')
  trigger.value = true
  assert.equal(card.visible.value, true)
  trigger.value = false // a window that was closed in between still shows it
  assert.equal(useStarCard({ storageKey: 'k', triggered: () => false, storage: store }).visible.value, true)
  card.dismiss()
  assert.equal(card.visible.value, false, 'later: hidden'); assert.equal(readStar('k', store).hidden, true)
  assert.equal(useStarCard({ storageKey: 'k', triggered: () => true, storage: store }).visible.value, false, 'still hidden after a restart while nothing streams')
  streaming.value = true; await nextTick()
  assert.equal(card.visible.value, true, 'the next stream brings it back'); assert.equal(readStar('k', store).hidden, false)
  card.dismiss(); streaming.value = false; await nextTick(); assert.equal(card.visible.value, false, 'later again, the stream ended: hidden until the next one')
  streaming.value = true; await nextTick(); assert.equal(card.visible.value, true, 'and every stream after that')
  assert.equal(CARD_META.star, undefined, 'the ask is a compact prompt at the top of the overview, not a tile of the grid')
})

test('a first stream makes the card due, and an old stored dismissed no longer hides it for good', async () => {
  const { useStarCard } = await import('../src/vue/starCard.js')
  const { ref } = await import('vue')
  const fresh = memory(); const streaming = ref(true)
  assert.equal(useStarCard({ storageKey: 'a', triggered: () => false, streaming: () => streaming.value, storage: fresh }).visible.value, true, 'the very first stream shows it')
  const old = memory(); old.setItem('foundation-ui.star.b', JSON.stringify({ dismissed: true, triggered: true }))
  assert.equal(useStarCard({ storageKey: 'b', triggered: () => true, storage: old }).visible.value, true, 'dismissed of the one-time version is ignored')
})

test('the star of the client in use: from the family the host says, our three clients only, the host star for any other, the name only as a fallback', async () => {
  const { starClientInUse } = await import('../src/vue/starCard.js')
  const pad = (name, family, official, os) => ({ name, uuid: name, family, official, os, last_seen: 1 })
  const ours = starClientInUse({ clients: [pad('Pixel 9', 'moonlight-vplus-android', true, 'android')], session: { name: 'Pixel 9', uuid: 'Pixel 9' } })
  assert.equal(ours.name, 'Moonlight V+'); assert.match(ours.url, /moonlight-vplus/)
  assert.equal(starClientInUse({ clients: [pad('Mac', 'moonlight-macos-enhanced', true, 'macos')], session: { name: 'Mac' } }).name, 'Moonlight macOS Enhanced')
  assert.equal(starClientInUse({ clients: [pad('iPhone', 'voidlink', false, 'ios')], session: { name: 'iPhone' } }), null, 'a partner client: the host star')
  assert.equal(starClientInUse({ clients: [pad('Pixel 9', 'moonlight-upstream', false, 'android')], session: { name: 'Pixel 9' } }), null, 'upstream Moonlight is not ours')
  assert.equal(starClientInUse({ clients: [pad('My device', 'unknown', null, null)], session: { name: 'My device' } }), null, 'unknown with a name that says nothing: no client')
  assert.equal(starClientInUse({ clients: [pad('Pixel 9', 'unknown', null, null)], session: { name: 'Pixel 9' } }).name, 'Moonlight V+', 'unknown: the name is the fallback')
  assert.equal(starClientInUse({ clients: [pad('A', 'voidlink', false, 'ios'), pad('Pixel 9', 'moonlight-vplus-android', true, 'android')], session: { name: 'A' } }), null, 'the device of the session decides, not the latest paired one')
})

test('paired clients make the star card due: a host that was set up before has them, and the storage of a new panel is empty', async () => {
  const { useStarCard } = await import('../src/vue/starCard.js')
  const { ref } = await import('vue')
  const paired = ref(0)
  const card = useStarCard({ storageKey: 'p', triggered: () => false, paired: () => paired.value, storage: memory() })
  assert.equal(card.visible.value, false, 'a brand-new host with no client: no card')
  paired.value = 30
  assert.equal(card.visible.value, true, 'clients exist: the card is there (idle: the host star and the sponsor entry)')
  card.dismiss(); assert.equal(card.visible.value, false, 'later still hides it')
})

test('a saved 方形 of the 网卡 tile (it has none any more) is read as 中; the other sizes and the other tiles stay', () => {
  const at = (sizes) => useDashLayout('r', { getItem: () => JSON.stringify({ v: LAYOUT_VERSION, order: DEFAULT_ORDER, overrides: { net: true }, sizes, pins: {}, mode: 'manual' }), setItem() {} }).state.sizes
  assert.deepEqual(RETIRED_SIZES, { net: { s: 'm' } })
  assert.deepEqual(at({ net: 's', cpu: 's' }), { net: 'm', cpu: 's' })
  assert.deepEqual(at({ net: 'l' }), { net: 'l' }); assert.deepEqual(at({ net: 'xl' }), { net: 'xl' }); assert.deepEqual(at({}), {})
})

test('a layout saved before version 8 whose only choice is a 方形 网卡 stays the person\'s (manual) and reads it as 中', () => {
  const l = useDashLayout('r2', { getItem: () => JSON.stringify({ v: 7, order: DEFAULT_ORDER, overrides: {}, sizes: { net: 's' }, pins: {}, mode: 'manual' }), setItem() {} })
  assert.equal(l.state.sizes.net, 'm'); assert.equal(l.state.mode, 'manual')
})
