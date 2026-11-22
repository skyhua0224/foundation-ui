import test from 'node:test'
import assert from 'node:assert/strict'
import { boxOf, sizePx, sizesOf, unitPx } from '../src/vue/homeSizes.js'
import { smallOf, shortHardware, shortTitle } from '../src/vue/homeSmall.js'
import { CARD_META } from '../src/vue/homeCards.js'

// every card has a small view: the box of S is the same for all (2 x 1), and the generic small view reads a title and a value from any kind of card
test('the dock and the 方形 size are one square: the same box for every card that offers it, and a square in pixels at every density', () => {
  for (const id of Object.keys(CARD_META)) {
    const meta = { ...CARD_META[id], data: { type: 'rows', rows: [] } }
    if (!sizesOf(id, meta).sizes.s) continue
    const box = boxOf(id, meta, 's', 0, 8)
    assert.equal(box.span, 2, id); assert.equal(box.rows, 1, id)
    assert.deepEqual(sizesOf(id, meta).sizes.s, [2, 1])
  }
  for (const d of ['smaller', 'standard', 'larger']) for (const w of [328, 700, 1280, 2400]) { const u = unitPx(w, d); const [x, y] = sizePx('s', u); assert.equal(x, y, `${d} ${w}`) }
  assert.equal(sizePx('s', 176)[0], 176)
})

test('the generic small view has an icon, a name and a value for every kind of card the overview draws', () => {
  const T = {}
  const cards = [
    { id: 'hero', kind: 'hero', title: '本主机', data: { icon: 'dns', title: 'Skyward', statusLabel: '运行中', statusTone: 'ok' } },
    { id: 'journey', kind: 'journey', title: '连接新设备', data: {} },
    { id: 'guide', kind: 'guide', title: '开始使用', data: { steps: [{ done: true }, { done: false }] } },
    { id: 'download', kind: 'download', title: '下载客户端', data: {} },
    { id: 'apps', kind: 'apps', title: '应用', data: { count: 4 } },
    { id: 'vdd', kind: 'vdd', title: '虚拟显示器', data: { state: 'ready' } },
    { id: 'x', kind: 'widget', title: '内存', data: { type: 'rows', big: '39%', rows: [] } },
    { id: 'y', kind: 'widget', title: '手柄', data: { type: 'control', options: [{ value: 'a', label: 'DualSense' }], value: 'a' } },
  ]
  for (const c of cards) { const v = smallOf(c, T); assert.ok(v.title || v.value, c.id); assert.ok(v.icon, c.id); assert.equal(typeof v.value, 'string', c.id) }
  assert.equal(smallOf(cards[2], T).value, '1/2')
})

test('a tile says something about its value: second line, trend, progress, chip, or an empty state with its action', () => {
  const hero = smallOf({ id: 'hero', kind: 'hero', title: '本主机', data: { icon: 'dns', title: 'Skyward', statusLabel: '运行中', statusTone: 'ok', pairs: [{ label: '已运行', value: '3h 12m' }, { label: '已配对', value: '2' }] } }, {})
  assert.deepEqual([hero.value, hero.title, hero.secondary], ['运行中', '本主机', 'Skyward · 已运行 3h 12m'])
  const vdd = smallOf({ id: 'vdd', kind: 'vdd', title: '虚拟显示器', data: { state: 'ready', stateLabel: '已启用', value: '2160p', unit: '240 Hz', sub: '3840×2160', chips: [{ label: 'HDR 开', tone: 'ok' }], tone: 'ok' } }, {})
  assert.deepEqual([vdd.value, vdd.unit, vdd.secondary], ['2160p', undefined, '已启用 · 3840×2160'])
  assert.deepEqual(vdd.pills, [{ label: '240 Hz' }, { label: 'HDR 开', tone: 'ok' }]); assert.equal(vdd.display, undefined)
  const cpu = smallOf({ id: 'cpu', kind: 'curve', title: 'CPU', data: { value: '35', unit: '%', caption: 'Ryzen 9', points: [1, 5, 3, 8] } }, {})
  assert.deepEqual(cpu.spark, [1, 5, 3, 8]); assert.equal(cpu.secondary, 'Ryzen 9')
  const mem = smallOf({ id: 'memory', kind: 'info', title: '内存', data: { value: '40', unit: '% · 32 GB', bar: { segments: [{ value: 0.25, tone: 'a' }, { value: 0.15, tone: 'b' }, { value: 0.6, tone: 'free' }] } } }, {})
  assert.ok(Math.abs(mem.progress - 0.4) < 1e-9)
  const apps = smallOf({ id: 'apps', kind: 'apps', title: '应用', data: { count: 0, items: [], empty: '还没有应用', addLabel: '添加新应用' } }, {})
  assert.deepEqual([apps.empty, apps.value, apps.action.type], [true, '还没有应用', 'add-app'])
  const apps2 = smallOf({ id: 'apps', kind: 'apps', title: '应用', data: { count: 4, items: [{ title: '桌面' }, { title: 'Steam Big Picture' }, { title: 'Forza' }, { title: 'Elden Ring' }] } }, {})
  assert.deepEqual([apps2.value, apps2.secondary], ['4', '桌面 · Steam Big Picture · Forza +1'])
  assert.equal(apps2.covers.length, 3); assert.equal(apps2.more, 1)
  const pair = smallOf({ id: 'pair', kind: 'widget', title: '配对客户端', data: { type: 'pair', count: 5, latest: { name: 'Pixel 9', icon: 'smartphone' } } }, {})
  assert.equal(pair.avatars.length, 3); assert.equal(pair.more, 2)
  assert.equal(smallOf({ id: 'hero', kind: 'hero', title: '本主机', data: { statusLabel: '运行中' } }, {}).state, 'ok', 'the state is a dot beside the word, not a drawn circle')
  assert.equal(smallOf({ id: 'hero', kind: 'hero', title: '本主机', data: { statusLabel: '运行中' } }, {}).pulse, undefined)
  assert.equal(smallOf({ id: 'pair', kind: 'widget', title: '配对客户端', data: { type: 'pair', count: 2, latest: { name: 'ali' } } }, { latestClient: '最近：{name}' }).secondary, '最近：ali')
})

test('a processor or a graphics card has a short name that is whole in a small tile', () => {
  const cases = [
    ['13th Gen Intel(R) Core(TM) i7-13700K', 'i7-13700K'],
    ['AMD Ryzen 7 7800X3D 8-Core Processor', 'Ryzen 7 7800X3D'],
    ['Intel(R) Core(TM) Ultra 7 265K', 'Core Ultra 7 265K'],
    ['NVIDIA GeForce RTX 4070', 'RTX 4070'],
    ['AMD Radeon RX 7800 XT', 'RX 7800 XT'],
    ['Intel(R) Arc(TM) A770 Graphics', 'Arc A770'],
    ['Apple M2 Pro', 'M2 Pro'],
    ['Ryzen 9', 'Ryzen 9'],
    ['', ''],
  ]
  for (const [raw, short] of cases) assert.equal(shortHardware(raw), short, raw)
})

test('a long Latin title of a small tile loses the maker\'s name', () => {
  assert.equal(shortTitle('Foundation Virtual Display'), 'Virtual Display'); assert.equal(shortTitle('Foundation'), 'Foundation'); assert.equal(shortTitle('Frame rate'), 'Frame rate'); assert.equal(shortTitle('基地虚拟显示器驱动程序'), '基地虚拟显示器驱动程序')
})
