import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { appliesText } from '../src/settings/applies.js'
import './helpers/settingsFixture.js'
import { RECENT_ROWS, ds5Sliders, recentCatalogue, recentRow, recentRows } from '../src/vue/homeRecent.js'
import { CATALOGUE_TEXTS } from '../src/vue/homeCatalogueTexts.js'
import { smartPlan } from '../src/vue/homeSmart.js'

// 最近操作 (the settings the person used last, operated on the tile) and the live controls of a running stream
const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const T = { ...CATALOGUE_TEXTS.zh, __locale: 'zh' }

test('a row has the control of the setting\'s pin: a switch with the values the host keeps, a few values, a slider in Mbps; the rest open the setting\'s page', () => {
  const config = { controller: 'disabled', stream_audio: false, gamepad: 'ds4', max_bitrate: 50000, platform: 'windows', usb_forwarding_enabled: 'disabled', nvenc_preset: 4 }
  const ctx = { config, platform: 'windows', locale: 'zh' }
  const c = recentRow('controller', ctx)
  assert.deepEqual([c.control, c.on, c.onValue, c.offValue, c.appliesText], ['switch', false, 'enabled', 'disabled', '重启后生效'])
  assert.deepEqual([recentRow('stream_audio', ctx).control, recentRow('stream_audio', ctx).on, recentRow('stream_audio', ctx).onValue], ['switch', false, true])
  const g = recentRow('gamepad', ctx); assert.deepEqual([g.control, g.value, g.options.length, g.appliesText], ['seg', 'ds4', 4, '新建的手柄生效'])
  const b = recentRow('max_bitrate', ctx); assert.deepEqual([b.control, b.value, b.scale, b.max, b.appliesText], ['slider', 50, 1000, 300, '立即生效,正在串流的会话也会变'])
  assert.equal(recentRow('usb_forwarding_enabled', ctx).control, 'jump', 'a risky setting is changed on its own page')
  assert.equal(recentRow('nvenc_preset', ctx).control, 'jump', 'a setting with no control of the tile opens its row')
  assert.equal(recentRow('controller', { config: null, locale: 'zh' }).control, 'jump', 'a switch whose value is not known is not drawn')
  assert.equal(recentRow('no_such_key', ctx), null)
  assert.deepEqual(recentRows(['nope', 'controller', 'gamepad'], ctx).map((r) => r.key), ['controller', 'gamepad'])
})

test('the size says how many rows: one, two, four, eight', () => {
  assert.deepEqual(RECENT_ROWS, { s: 1, m: 2, l: 4, xl: 8 })
  const tile = src('../src/vue/tiles/TileRecent.vue')
  assert.ok(tile.includes("rows = computed(() => (d.value.rows || []).slice(0, RECENT_ROWS[size.value]))"))
  assert.ok(tile.includes("emit('act', { type: 'setting', value: { key, value, failed: () => { delete draft[key] } } })") && tile.includes('Math.round(v * r.scale)'), 'saved by the one saving path, a slider in the unit the host keeps')
  assert.ok(tile.includes("emit('act', { type: 'pin-open', value: { key: r.key } })"), 'a row that is too complex opens its page')
})

test('it is in the idle and after lists after the quick actions, and not while streaming; the live controls come with a stream', () => {
  const cards = ['hero', 'pair', 'quick', 'announcements', 'recent-actions', 'live-bitrate', 'live-ds5', 'act-stop', 'public-address', 'last-session'].map((id) => ({ id, available: true, sizes: ['s', 'm', 'l'] }))
  const idle = smartPlan({ cards, signals: { pairedCount: 3 }, capacity: 48 })
  assert.ok(idle.visible.indexOf('recent-actions') > idle.visible.indexOf('quick') && idle.visible.indexOf('recent-actions') < idle.visible.indexOf('announcements'), idle.visible.join())
  const after = smartPlan({ cards, signals: { pairedCount: 3, lastStreamAt: Date.now() - 60000 }, capacity: 48 })
  assert.equal(after.scenario, 'after'); assert.ok(after.visible.includes('recent-actions'))
  const live = smartPlan({ cards, signals: { pairedCount: 3, streaming: true }, capacity: 48 })
  assert.equal(live.visible.includes('recent-actions'), false)
  for (const id of ['live-bitrate', 'live-ds5', 'act-stop']) assert.ok(live.visible.includes(id), id)
})

test('the bitrate command: the tile says what the host does with the number, and is not there where the host refuses the command', () => {
  const session = { client_name: 'Pixel 9', bitrate: 56000 }
  const on = recentCatalogue({ session, canRuntime: true, config: { max_bitrate: 50000 } }, T)['live-bitrate']
  assert.deepEqual([on.client, on.now, on.min, on.max, on.cap], ['Pixel 9', 56, 1, 50, 50])
  assert.ok(on.note.includes('50 Mbps') && /上限/.test(on.note), on.note)
  const free = recentCatalogue({ session, canRuntime: true, config: { max_bitrate: 0 } }, T)['live-bitrate']
  assert.deepEqual([free.cap, free.max], [0, 800], 'with no ceiling the control reaches 800 Mbps'); assert.ok(/不设上限/.test(free.note), free.note)
  assert.equal(recentCatalogue({ session, canRuntime: false, config: {} }, T)['live-bitrate'], null, 'the host takes the command from this computer only')
  assert.equal(recentCatalogue({ session: null, canRuntime: true, config: {} }, T)['live-bitrate'], null)
  const tile = src('../src/vue/tiles/TileLive.vue')
  assert.ok(tile.includes("emit('act', { type: 'runtime-bitrate', value: { client: d.value.client, kbps: Math.round(rate.value * 1000) } })"))
})

test('the DualSense tuning: the common sliders the host applies, in the order of the gamepad page', () => {
  const k = (id, key, extra = {}) => ({ id, key, label: key, control: 'slider', tier: 'common', implemented: true, min: 0, max: 2, step: 0.01, value: 1, default: 1, ...extra })
  const list = ds5Sliders([k(14, 'ds5.rumble.strength'), k(3, 'ds5.haptics.hd.gain'), k(99, 'ds5.x', { implemented: false }), k(98, 'ds5.y', { tier: 'advanced' }), k(97, 'ds5.z', { control: 'toggle' })], 'en')
  assert.deepEqual(list.map((s) => s.key), ['ds5.haptics.hd.gain', 'ds5.rumble.strength'])
  const d = recentCatalogue({ ds5Keys: [k(3, 'ds5.haptics.hd.gain')], canRuntime: true }, T)['live-ds5']
  assert.equal(d.sliders.length, 1); assert.equal(d.applies, '手柄使用中实时生效')
  assert.equal(recentCatalogue({ ds5Keys: [], canRuntime: true }, T)['live-ds5'], null, 'nothing is invented')
  assert.ok(src('../src/vue/tiles/TileLive.vue').includes("emit('act', { type: 'ds5-tune', value: { key: s.key, value: v } })"))
})

test('with no setting used yet the tile is empty: it is small and goes after the tiles that have something to say; its small form says what it is', async () => {
  const { hasNoData } = await import('../src/vue/homeSizes.js'); const { smallOf } = await import('../src/vue/homeSmall.js')
  const empty = recentCatalogue({ recent: [], config: {} }, T)['recent-actions']
  assert.equal(hasNoData(empty), true); assert.equal(smallOf({ id: 'recent-actions', title: '最近操作', data: empty }, T).value, '还没有用过的设置')
  const some = recentCatalogue({ recent: ['controller'], config: { controller: 'enabled' } }, T)['recent-actions']
  assert.equal(hasNoData(some), false); assert.equal(smallOf({ id: 'recent-actions', title: '最近操作', data: some }, T).secondary, '重启后生效')
  const live = recentCatalogue({ session: { client_name: 'Pixel 9', bitrate: 56000 }, canRuntime: true, config: {} }, T)['live-bitrate']
  assert.deepEqual([smallOf({ id: 'live-bitrate', title: 'x', data: live }, T).value, smallOf({ id: 'live-bitrate', title: 'x', data: live }, T).secondary], ['56', 'Pixel 9'])
})

test('every size of the tile has a hero: nothing used yet is the tile\'s shape, a line and the way to the settings; a square with a setting is its shape, its name, when it applies and its control', async () => {
  const { smallOf } = await import('../src/vue/homeSmall.js')
  const empty = recentCatalogue({ recent: [], config: {} }, T)['recent-actions']
  const v = smallOf({ id: 'recent-actions', title: '最近操作', data: empty }, T)
  assert.deepEqual([v.empty, v.action.label, v.action.type, v.action.value], [true, '打开设置', 'open', 'settings'])
  const tile = src('../src/vue/tiles/TileRecent.vue')
  assert.ok(tile.includes('<header class="m-calm__head"><MIcon name="history" />') && tile.includes('<div class="m-empty-basic">'), 'the empty tile uses the same compact header and body as the other tiles')
  assert.ok(tile.includes('<MTileShape :icon="rows[0].icon" shape="clover" size="36px" />'))
  assert.ok(tile.includes('<small :title="rows[0].appliesText">{{ rows[0].appliesText }}</small>'), 'the full applicability text remains available when truncated')
  assert.ok(src('../src/css/tiles-recent.css').includes('.m-rc.is-l .m-rc__rows, .m-rc.is-xl .m-rc__rows { grid-auto-rows: minmax(48px, 1fr); }'))
})

test('the DualSense tuning tile at 中 holds one slider and at 大 three: what the box holds, nothing outside it (the tile sheet found two at 中 over the edge)', () => {
  assert.ok(src('../src/vue/tiles/TileLive.vue').includes("(d.value.sliders || []).slice(0, props.card.size === 'l' ? 3 : 1)"))
})
