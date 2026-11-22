import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ICONS } from '../src/icons/icons.js'
import { CELLS, GROUPS, SUPPORT_ROW, gridCells, ITEMS, labelOf, pageTitle, shortOf, statusText, streamsText, vddText, MOCK_BUSY, MOCK_IDLE, MOCK_VDD, PAGES, SLIDER_KEYS, sliderView, sliderViews, sliderTargetText, stateOf, DEFAULT_SLIDERS, DEFAULT_TILES, TILES, TILE_IDS, hiddenSliders, hiddenTiles, hideItem, isDefaultLayout, layoutOf, layoutRecord, moveItem, normalizeLayout, showItem, tileView, tileViews, tickMarks, needsDisplay, sliderKeysOf, sliderRowShown, openingDensity, TRAY_DENSITIES, TRAY_CONTAINER_IDS, TRAY_ITEM_IDS, V1, V2, V3, VARIANTS, createNav, isChecked, isEnabled, isVisible, modelIds, modelPages, rowIds } from '../src/tray/trayModel.js'

// The tray menu designs (docs/tray-menu.md): three layouts of today's menu. TRAY_ITEM_IDS is every id built by src-tauri/src/tray/menu.rs of the Panel; each layout must reach all of them.
const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const MENU_RS_IDS = [
  'tray_status', 'recover_service', 'tray_notification_action', 'open_main_panel', 'connect_device', 'download_client', 'open_desktop', 'auto_start', 'open_sunshine',
  'vdd_settings', 'vdd_create', 'vdd_close', 'vdd_toggle_keep_enabled', 'vdd_toggle_headless_create', 'reset_display', 'show_toolbar', 'host_performance', 'rtss_control', 'web_stream',
  'log_console', 'debug_page', 'lang_zh', 'lang_en', 'lang_ja', 'prevent_sleep', 'restart_user_mode', 'import_config', 'export_config', 'reset_config', 'clear_cache', 'check_update', 'about',
  'feedback', 'star_project', 'visit_project_sunshine', 'visit_project_moonlight', 'visit_site', 'visit_bilibili', 'star_github', 'sponsor_qiin', 'sponsor_yundi339', 'sponsor_skyhua', 'sponsor_wechat', 'sponsor_github', 'restart', 'shutdown',
]

test('the id list is the menu.rs list', () => {
  assert.deepEqual([...TRAY_ITEM_IDS].sort(), [...MENU_RS_IDS].sort())
  assert.equal(TRAY_ITEM_IDS.length, 46)
  assert.deepEqual([...TRAY_CONTAINER_IDS].sort(), ['advanced', 'display', 'help', 'interfaces', 'language', 'settings', 'tools'])
})

for (const [name, model] of Object.entries(VARIANTS)) {
  test(`${name}: every item id of menu.rs is in the model, on a page that can be reached`, () => {
    const where = modelIds(model)
    for (const id of MENU_RS_IDS) assert.ok(where.has(id), `${name} lacks ${id}`)
    const reachable = modelPages(model)
    for (const [id, pg] of where) if (pg !== 'footer') assert.ok(reachable.has(pg), `${name}: ${id} sits on ${pg}, which no row opens`)
  })

  test(`${name}: no id outside the list, every id has an icon and a label, every icon is drawn`, () => {
    for (const id of modelIds(model).keys()) assert.ok(TRAY_ITEM_IDS.includes(id), `${name}: ${id} is not a menu.rs id`)
    for (const id of TRAY_ITEM_IDS) assert.ok(ITEMS[id]?.label && ICONS[ITEMS[id].icon], `${id}: label and icon`)
    for (const p of Object.values(PAGES)) assert.ok(ICONS[p.icon], p.icon)
  })

  test(`${name}: the model is data (survives JSON), and its page rows point to pages that exist`, () => {
    assert.equal(JSON.stringify(JSON.parse(JSON.stringify(model))), JSON.stringify(model))
    for (const pg of Object.values(model.pages)) for (const row of pg.rows) if (row.t === 'page') assert.ok(model.pages[row.to], `${name}: ${row.to}`)
  })
}

test('the rows a state hides: RTSS, dev pages, the notification and the recover row appear only when the state asks', () => {
  const rows = V1.pages.tools.rows.filter((r) => r.when)
  assert.deepEqual(rows.map((r) => r.when).sort(), ['dev', 'dev', 'rtss'])
  assert.ok(V1.pages.root.rows.some((r) => r.when === 'notification') && V1.pages.root.rows.some((r) => r.when === 'disconnected'))
  assert.ok(V2.pages.root.rows[0].t === 'card' && rowIds(V2.pages.root.rows[0]).includes('recover_service'))
})

test('V1 keeps 6-8 primary rows on the first page and the rest behind page rows with a back row', () => {
  const prim = V1.pages.root.rows.filter((r) => (r.t === 'item' || r.t === 'page') && !r.more && !r.when)
  assert.ok(prim.length >= 6 && prim.length <= 8, `${prim.length} primary rows`)
  assert.deepEqual(V1.pages.root.rows.filter((r) => r.more).map((r) => r.to), ['tools', 'settings', 'help'])
  const nav = createNav(V1)
  assert.equal(nav.canBack, false)
  assert.ok(nav.open('tools') && nav.canBack && nav.current === 'tools' && nav.direction === 1)
  assert.ok(nav.back() && nav.current === 'root' && nav.direction === -1)
  assert.equal(nav.back(), false, 'the root has no back')
})

test('a stack drills in and out: settings > advanced > back > back; an unknown page opens nothing', () => {
  for (const model of [V1, V2]) {
    const nav = createNav(model)
    assert.equal(nav.open('nope'), false)
    assert.ok(nav.open('settings')); assert.ok(nav.open('advanced'))
    assert.deepEqual(nav.trail, ['root', 'settings', 'advanced']); assert.equal(nav.depth, 2)
    nav.back(); assert.equal(nav.current, 'settings'); nav.back(); assert.equal(nav.current, 'root')
    nav.open('display'); nav.reset(); assert.deepEqual(nav.trail, ['root'])
  }
})

test('V2 has the display, tools, settings and language drill-ins on its first page', () => {
  const to = V2.pages.root.rows.filter((r) => r.t === 'page').map((r) => r.to)
  for (const p of ['display', 'tools', 'settings', 'language']) assert.ok(to.includes(p), p)
  assert.equal(createNav(V2, 'display').current, 'display')
})

test('V3 pages by index and by name, never out of range; the dots are the order', () => {
  const nav = createNav(V3)
  assert.deepEqual(V3.order, ['quick', 'display', 'settings'], 'three pages: 快捷, 显示与工具, 设置与帮助')
  assert.equal(nav.current, 'quick'); assert.equal(nav.canBack, false)
  assert.ok(nav.go(1)); assert.equal(nav.current, 'display'); assert.equal(nav.direction, 1)
  assert.equal(nav.go(1), false, 'same page'); assert.equal(nav.go(9), false); assert.equal(nav.go(-1), false)
  assert.ok(nav.open('settings')); assert.equal(nav.index, 2)
  assert.ok(nav.go(0)); assert.equal(nav.direction, -1)
  assert.equal(createNav(V3, 'settings').current, 'settings'); assert.equal(createNav(V3, 'tools').current, 'quick', 'a page the quick panel no longer has opens the first one')
})

test('the state: toggles, language, and menu.rs\'s enabled flags', () => {
  assert.equal(isChecked('auto_start', MOCK_BUSY), true)
  assert.equal(isChecked('prevent_sleep', MOCK_BUSY), false)
  assert.equal(isChecked('lang_zh', MOCK_BUSY), true); assert.equal(isChecked('lang_en', MOCK_BUSY), false)
  assert.equal(isEnabled('vdd_create', MOCK_BUSY), false, 'created already'); assert.equal(isEnabled('vdd_create', MOCK_IDLE), true)
  assert.equal(isEnabled('vdd_close', MOCK_BUSY), false, 'kept after streaming: it cannot be closed')
  assert.equal(isEnabled('import_config', { ...MOCK_BUSY, connection: 'disconnected' }), false)
  assert.equal(isEnabled('recover_service', MOCK_BUSY), false)
  assert.equal(isEnabled('tray_status', MOCK_BUSY), false)
})

test('the components: one `act(id)` out, no function or host call inside; V3 swipes and the pager keeps hidden pages inert', () => {
  const menu = src('../src/vue/MTrayMenu.vue'), row = src('../src/vue/MTrayRow.vue')
  assert.match(menu, /emit\('act', id\)/); assert.match(row, /emit\('act', id\)/)
  assert.doesNotMatch(menu + row, /invoke\(|fetch\(|window\.__TAURI/)
  assert.match(menu, /:inert="name !== nav\.current/)
  assert.match(menu, /@pointermove="onMove"/); assert.match(src('../src/tray/trayPointer.js'), /setPointerCapture/); assert.match(src('../src/css/tray.css'), /\.m-tray \{ touch-action: none; \}/)
  assert.match(menu, /m-tray-fwd/); assert.match(src('../src/css/tray.css'), /m-tray-fwd-enter-from \{ opacity: 0; transform: translateX\(30px\)/)
  assert.match(src('../src/css/tray.css'), /prefers-reduced-motion/)
})

test('every id a card or a strip claims is drawn by the row component (the model cannot promise a row the component lacks)', () => {
  const row = src('../src/vue/MTrayRow.vue')
  for (const t of ['card', 'strip']) for (const id of rowIds({ t }).filter((x) => x !== 'tray_status')) assert.ok(row.includes(`'${id}'`), `${t}: MTrayRow does not draw ${id}`)
  for (const t of ['header']) assert.match(row, /statusWord\(s\)/)
})

// ---- the second round: real wiring, words, radii, preferences ----
import { CLICK_ACTIONS, MENU_VARIANTS, TRAY_PREFS_DEFAULT, actionOf, normalizePrefs, singleClickWaits } from '../src/tray/trayPrefs.js'
import { TRAY_TEXTS, trayTexts } from '../src/tray/trayTexts.js'

test('the tray never names the display the old way: 基地虚拟显示器 / Foundation Virtual Display', () => {
  const all = src('../src/tray/trayModel.js') + src('../src/tray/trayTexts.js') + src('../src/vue/MTrayRow.vue') + src('../src/vue/MTrayMenu.vue')
  assert.doesNotMatch(all, /杂鱼|Zako/)
  assert.equal(trayTexts('zh').vddName, '基地虚拟显示器'); assert.equal(trayTexts('en').vddName, 'Foundation Virtual Display')
  assert.match(ITEMS.vdd_settings.label, /^基地虚拟显示器/); assert.match(ITEMS.vdd_create.label, /基地虚拟显示器/)
})

test('the three languages have the same keys, and an unknown locale is English', () => {
  const keys = (o) => Object.keys(o).sort().join()
  assert.equal(keys(TRAY_TEXTS.zh.pages), keys(TRAY_TEXTS.en.pages)); assert.equal(keys(TRAY_TEXTS.en.pages), keys(TRAY_TEXTS.ja.pages))
  assert.equal(keys(TRAY_TEXTS.en.host), keys(TRAY_TEXTS.ja.host)); assert.equal(keys(TRAY_TEXTS.en.host), keys(TRAY_TEXTS.zh.host))
  const top = (l) => Object.keys(TRAY_TEXTS[l]).filter((k) => k !== 'short').sort().join()
  assert.equal(top('zh'), top('en')); assert.equal(top('en'), top('ja'))
  assert.equal(keys(TRAY_TEXTS.en.short), keys(TRAY_TEXTS.ja.short))
  assert.equal(trayTexts('nl'), TRAY_TEXTS.en)
})

test('words follow the state: the host\'s labels win, the short labels and statuses follow the language', () => {
  const en = { ...MOCK_BUSY, locale: 'en', labels: { open_main_panel: 'Open Main Panel' } }
  assert.equal(labelOf('open_main_panel', en), 'Open Main Panel'); assert.equal(labelOf('about', en), ITEMS.about.label, 'no host label: the design\'s')
  assert.equal(shortOf('open_main_panel', en), 'Panel'); assert.equal(shortOf('open_main_panel', MOCK_BUSY), '主面板')
  assert.equal(pageTitle('tools', en), 'Tools'); assert.equal(pageTitle('tools', { ...en, locale: 'ja' }), 'ツール')
  assert.equal(statusText(en), 'Sunshine · Streaming'); assert.equal(streamsText(en), '2 streams · 72.8 Mbps')
  assert.equal(streamsText({ ...en, sessions: [] }), 'No streams'); assert.equal(vddText({ ...en, vdd: { active: false } }), 'Not created')
  assert.equal(statusText({ ...MOCK_BUSY, connection: 'disconnected' }), 'Sunshine · 未连接')
})

test('radii follow one rule: the card has one radius, things in its padding r1 = r0 - padding, things in theirs r2 = r1 - padding; no literal large radius on a tray part', () => {
  const css = src('../src/css/tray.css')
  assert.match(css, /--tray-r1: calc\(var\(--tray-r0\) - var\(--tray-pad\)\)/); assert.match(css, /--tray-r2: calc\(var\(--tray-r1\) - var\(--tray-pad\)\)/)
  assert.match(css, /\.m-tray--v3 \{[^}]*--tray-r0: 36px/, 'V3: 36 - 8 = 28 = half of a 56 px tile')
  const tray = css.split('/* the settings of the tray icon')[0]
  const literal = [...tray.matchAll(/([^{}]+)\{[^}]*?border-radius: (\d+)px/g)].filter(([, sel, px]) => /\.m-tray__(card|tile|strip|vdd|row|streams|zako|update|line|logo)\b/.test(sel) && Number(px) > 14)
  assert.deepEqual(literal.map((m) => `${m[1].trim()} ${m[2]}`), [], 'cards, tiles and rows take their radius from the variables')
  for (const sel of ['.m-tray__card', '.m-tray__tile', '.m-tray__zako', '.m-tray__streams li', '.m-tray__update', '.m-tray__line', '.m-tray__vdd', '.m-tray__row', '.m-tray--v3 .m-tray__strip']) {
    const i = css.indexOf(`${sel} {`); assert.ok(i >= 0, sel); assert.match(css.slice(i, css.indexOf('}', i)), /border-radius: (var\(--tray-(r1|r2|pill)\)|inherit)/, sel)
  }
})

test('V3 is a ChromeOS-style quick panel: 2-wide pill tiles with icon, label and sub-label, dots under the pages', () => {
  const css = src('../src/css/tray.css'), row = src('../src/vue/MTrayRow.vue') + src('../src/vue/MTrayTile.vue'), menu = src('../src/vue/MTrayMenu.vue')
  assert.match(css, /\.m-tray--v3 \{[^}]*--tray-w: 360px/); assert.match(css, /\.m-tray__tiles \{[^}]*repeat\(2,/); assert.doesNotMatch(css, /m-tray__buttons|m-tray__abtn/, 'the four action buttons are tiles now')
  assert.match(css, /\.m-tray__tile\.is-on \{[^}]*primary-container/)
  for (const c of ['m-tray__tile-chip', 'm-tray__tile-label', 'm-tray__tile-state']) assert.ok(row.includes(c), c)
  assert.ok(menu.indexOf('m-tray__dots') > menu.indexOf('m-tray__viewport'))
  assert.deepEqual(V3.pages.quick.rows.map((r) => r.t), ['strip', 'tiles', 'sliders'])
})

test('the popup page: one open per token, one window size per page change (before a card grows, after one has shrunk, never a timer or a frame), a press outside and Escape cancel, the item goes out as act(token, id)', () => {
  const pop = src('../src/vue/MTrayPopup.vue'), menu = src('../src/vue/MTrayMenu.vue')
  assert.match(pop, /:sized="onSize"/); assert.match(pop, /reported\.w === size\.w && reported\.h === size\.h/); assert.doesNotMatch(pop, /setTimeout|shrinkTimer/)
  assert.match(menu, /if \(next > boxH\) await Promise\.race\(\[announce\(next\), pause\(150\)\]\)/, 'a card that grows waits for its window')
  assert.match(pop, /props\.transport\.act\(token, id\)/); assert.match(pop, /props\.transport\.cancel\(token\)/)
  assert.match(pop, /event\.key === 'Escape'/); assert.match(pop, /closest\?\.\('\.m-tray'\)/)
  assert.doesNotMatch(pop, /invoke\(|window\.__TAURI/)
  assert.match(src('../src/popup.js'), /MTrayPopup/)
})

test('the keyboard: Up / Down / Home / End move along the buttons, Escape goes back then closes, Left / Right page the pager', () => {
  const menu = src('../src/vue/MTrayMenu.vue')
  for (const k of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'ArrowRight', 'ArrowLeft', 'Escape']) assert.ok(menu.includes(`'${k}'`), k)
  assert.match(menu, /emit\('close'\)/)
})

test('the preferences: defaults, normalisation, the action of each gesture, the single click waits only beside a double-click action', () => {
  assert.deepEqual(TRAY_PREFS_DEFAULT, { right: 'v1', click: 'panel', double: 'none', forceNative: false, tiles: null, sliders: null, density: 'auto' })
  assert.deepEqual(normalizePrefs(null), TRAY_PREFS_DEFAULT); assert.deepEqual(normalizePrefs({ right: 'v9', click: 'x', double: 3, forceNative: 'yes' }), TRAY_PREFS_DEFAULT)
  assert.deepEqual(normalizePrefs({ right: 'v3', click: 'v2', double: 'panel', forceNative: true }), { right: 'v3', click: 'v2', double: 'panel', forceNative: true, tiles: null, sliders: null, density: 'auto' })
  assert.equal(actionOf({}, 'right'), 'v1'); assert.equal(actionOf({}, 'click'), 'panel'); assert.equal(actionOf({}, 'double'), 'none')
  assert.equal(actionOf({ right: 'none' }, 'right'), 'v1', 'a right click is always one of the menus')
  assert.deepEqual(MENU_VARIANTS, ['v1', 'v2', 'v3']); assert.deepEqual(CLICK_ACTIONS, ['panel', 'v1', 'v2', 'v3', 'none'])
  assert.equal(singleClickWaits({}), false); assert.equal(singleClickWaits({ double: 'panel' }), true); assert.equal(singleClickWaits({ click: 'none', double: 'panel' }), false)
})

test('the settings component shows every choice with a preview, in three languages, and edits only through v-model', () => {
  const set = src('../src/vue/MTraySettings.vue')
  assert.match(set, /emit\('update:modelValue'/); assert.match(set, /MTrayThumb/)
  for (const l of ['zh', 'en', 'ja']) assert.match(set, new RegExp(`\\n  ${l}: \\{`))
  assert.doesNotMatch(set, /invoke\(|window\.__TAURI/)
  const thumb = src('../src/vue/MTrayThumb.vue')
  for (const k of ['panel', 'none', 'v1', 'v2', 'v3']) assert.ok(thumb.includes(`'${k}'`), k)
})

// ---- the content round (2026-11-09): the first page by real use, and the sliders ----
import { bitrateFromProgress, bitrateSegmentMarks } from '../src/settings/bitrate.js'

test('V3 first page: status strip, the tiles of the person\'s layout, the sliders of the person\'s layout; the first level of V1 is the default', () => {
  const rows = V3.pages.quick.rows
  assert.deepEqual(rows.map((r) => r.t), ['strip', 'tiles', 'sliders'])
  assert.ok(rows.every((r) => r.t === 'strip' || r.source === 'layout'))
  // the default tiles are the first level of V1 (主面板, 大屏, 配对, 客户端, 基地显示器, 开机自启, 更新), in V1's order
  const v1 = V1.pages.root.rows.filter((r) => r.t === 'item' || r.t === 'page').map((r) => (r.t === 'page' ? (r.to === 'display' ? 'vdd' : null) : r.id)).filter((id) => DEFAULT_TILES.includes(id))
  assert.deepEqual(v1, ['open_main_panel', 'open_desktop', 'connect_device', 'download_client', 'vdd', 'auto_start', 'check_update'])
  assert.deepEqual([...DEFAULT_TILES], v1); assert.deepEqual([...DEFAULT_SLIDERS], ['bitrate', 'dpi'])
  // the two conditional rows of V1 stay on the status strip, as lines
  assert.deepEqual(rowIds(rows[0]), ['tray_status', 'tray_notification_action', 'recover_service'])
  // every tile is an item of menu.rs (nothing invented), and everything stays reachable by default
  for (const id of TILE_IDS) for (const x of rowIds({ t: 'tiles' })) assert.ok(TRAY_ITEM_IDS.includes(x), x)
  const where = modelIds(V3)
  for (const id of ['auto_start', 'prevent_sleep', 'restart_user_mode']) assert.equal(where.get(id), 'quick' === where.get(id) ? 'quick' : 'settings', id)
  assert.equal(where.get('download_client'), 'quick'); assert.equal(where.get('open_sunshine'), 'quick')
  assert.equal(V3.pages.settings.rows.flatMap(rowIds).includes('open_sunshine'), true, 'the Web page stays on a page (设置与帮助) even when its tile is hidden')
  assert.equal(V3.edit, 'quick')
})

test('the tiles: a toggle shows 开 / 关 and flips, an action has no sub-label, the update tile is always there and lit with the version when there is one', () => {
  const v = (id, st = MOCK_BUSY) => tileView(id, st)
  assert.deepEqual(tileViews(MOCK_BUSY).map((x) => x.id), [...DEFAULT_TILES])
  assert.deepEqual(tileViews(MOCK_IDLE).map((x) => x.id), [...DEFAULT_TILES], 'no update does not remove the tile')
  assert.deepEqual([v('open_main_panel').kind, v('open_main_panel').text, v('open_main_panel').on], ['action', '', false])
  assert.deepEqual([v('auto_start').kind, v('auto_start').on, v('auto_start').text, v('auto_start').drill], ['toggle', true, '开', 'settings'])
  assert.deepEqual([v('prevent_sleep').on, v('prevent_sleep').text], [false, '关'])
  assert.deepEqual([v('vdd').act, v('vdd').on, v('vdd').text, v('vdd').drill, v('vdd').locked], ['vdd_close', true, '1440p@120', 'display', true], 'created and kept after streaming: it cannot be closed from here')
  assert.deepEqual([v('vdd', MOCK_IDLE).act, v('vdd', MOCK_IDLE).on, v('vdd', MOCK_IDLE).text], ['vdd_create', false, '已关闭'])
  assert.deepEqual([v('check_update').on, v('check_update').fresh, v('check_update').text], [true, true, '2026.1109.2'])
  assert.deepEqual([v('check_update', MOCK_IDLE).on, v('check_update', MOCK_IDLE).fresh, v('check_update', MOCK_IDLE).text], [false, false, '已是最新版'])
  assert.equal(v('open_sunshine', { ...MOCK_BUSY, connection: 'disconnected' }).disabled, true, 'the core\'s items need a connection')
  assert.equal(v('nope'), null)
  const row = src('../src/vue/MTrayRow.vue')
  assert.doesNotMatch(row, /<button v-if="s\.update" class="m-tray__chip is-act"/, 'the strip no longer repeats the update')
})

test('the optional tiles are items of the deeper menus of V1 (工具, 设置, 显示器); RTSS only where it is installed', () => {
  const optional = TILE_IDS.filter((id) => !DEFAULT_TILES.includes(id))
  const v1 = new Set(); for (const pg of Object.values(V1.pages)) for (const r of pg.rows) for (const id of rowIds(r)) v1.add(id)
  for (const id of optional) assert.ok(v1.has(id), `${id} is in V1`)
  assert.ok(!hiddenTiles({ ...MOCK_BUSY, rtss: false }).includes('rtss_control')); assert.ok(hiddenTiles(MOCK_BUSY).includes('rtss_control'))
  assert.deepEqual(hiddenTiles(MOCK_BUSY).filter((id) => !optional.includes(id)), [])
  assert.deepEqual(tileViews({ ...MOCK_BUSY, rtss: false, layout: { tiles: ['rtss_control', 'prevent_sleep'] } }).map((x) => x.id), ['prevent_sleep'])
  assert.deepEqual(hiddenSliders(MOCK_BUSY), ['resolution', 'refresh'])
})

test('the layout: default until edited, unknown and repeated ids dropped, [] is a real choice, a list equal to the default is stored as null', () => {
  assert.deepEqual(normalizeLayout(undefined), { tiles: [...DEFAULT_TILES], sliders: ['bitrate', 'dpi'] })
  assert.deepEqual(normalizeLayout({ tiles: ['auto_start', 'auto_start', 'x', 'vdd'], sliders: ['bitrate', 'dpi', 'nope'] }), { tiles: ['auto_start', 'vdd'], sliders: ['bitrate', 'dpi'] })
  assert.deepEqual(normalizeLayout({ tiles: [], sliders: [] }), { tiles: [], sliders: [] })
  assert.deepEqual(normalizeLayout({ tiles: 'x', sliders: null }), { tiles: [...DEFAULT_TILES], sliders: ['bitrate', 'dpi'] })
  assert.deepEqual(layoutRecord(null), { tiles: null, sliders: null }); assert.equal(isDefaultLayout(undefined), true)
  assert.deepEqual(layoutRecord({ tiles: [...DEFAULT_TILES], sliders: ['dpi', 'bitrate'] }), { tiles: null, sliders: ['dpi', 'bitrate'] })
  assert.deepEqual(layoutRecord({ sliders: ['bitrate', 'dpi'] }), { tiles: null, sliders: null }, 'the new default is stored as null')
  assert.deepEqual(layoutOf({ layout: { tiles: null, sliders: ['dpi'] } }).sliders, ['dpi'], 'a list saved before the default changed is kept as it is')
  assert.equal(isDefaultLayout({ tiles: ['vdd'] }), false)
  assert.deepEqual(layoutOf({ layout: { tiles: ['vdd'] } }).sliders, ['bitrate', 'dpi'])
  assert.deepEqual(normalizePrefs({ tiles: ['vdd', 'zzz'], sliders: 7 }), { ...TRAY_PREFS_DEFAULT, tiles: ['vdd'], sliders: null })
})

test('reordering: move clamps and keeps the rest, hide and show are idempotent, show appends', () => {
  const l = ['a', 'b', 'c', 'd']
  assert.deepEqual(moveItem(l, 'a', 2), ['b', 'c', 'a', 'd']); assert.deepEqual(moveItem(l, 'd', -5), ['d', 'a', 'b', 'c']); assert.deepEqual(moveItem(l, 'b', 99), ['a', 'c', 'd', 'b'])
  assert.equal(moveItem(l, 'b', 1), l, 'nothing moves: the same list'); assert.equal(moveItem(l, 'z', 0), l)
  assert.deepEqual(hideItem(l, 'b'), ['a', 'c', 'd']); assert.deepEqual(showItem(l, 'e'), [...l, 'e']); assert.equal(showItem(l, 'a'), l)
})

test('the editor: a handle that moves with the keyboard (Space, arrows, Alt + arrows, Escape) and the pointer, a hide button and an add chip for every item, no host call; the menu has a pencil on the quick page only', () => {
  const ed = src('../src/vue/MTrayLayoutEditor.vue'), menu = src('../src/vue/MTrayMenu.vue'), row = src('../src/vue/MTrayRow.vue'), css = src('../src/css/tray.css')
  for (const k of ["' '", "'Enter'", "'ArrowUp'", "'ArrowDown'", "'Escape'", "'Home'", "'End'", 'ev.altKey']) assert.ok(ed.includes(k), k)
  assert.match(ed, /aria-pressed/); assert.match(ed, /aria-roledescription/); assert.match(ed, /aria-live="polite"/); assert.match(ed, /@pointerdown\.prevent="startDrag/)
  assert.match(ed, /<button class="m-trayed__btn"/); assert.match(ed, /<button v-for="id in hiddenOf\(g\)"/)
  assert.doesNotMatch(ed, /invoke\(|fetch\(|window\.__TAURI/)
  assert.match(menu, /v-if="canEdit"/); assert.match(menu, /props\.model\.edit/); assert.match(menu, /\[\{ t: 'editor' \}\]/); assert.match(menu, /editing\.value && k === 'Escape'/)
  assert.match(row, /row\.t === 'editor'/); assert.match(menu, /emit\('layout', record\)/)
  assert.match(css, /\.m-trayed__handle \{[^}]*touch-action: none/)
  assert.ok(VARIANTS.v1.edit === undefined && VARIANTS.v2.edit === undefined, 'V1 and V2 are not changed')
})

test('the editor and the settings page: three languages with the same keys; the settings page carries the editor and reports the layout apart from the record', () => {
  const keys = (l) => Object.keys(TRAY_TEXTS[l].edit).sort().join()
  assert.equal(keys('zh'), keys('en')); assert.equal(keys('en'), keys('ja'))
  assert.equal(TRAY_TEXTS.zh.edit.done, '完成'); assert.equal(TRAY_TEXTS.en.edit.reset, 'Reset to default')
  const set = src('../src/vue/MTraySettings.vue')
  assert.match(set, /MTrayLayoutEditor/); assert.match(set, /emit\('layout', \$event\)/); assert.match(set, /'update:modelValue', 'layout'/)
})

test('sliders: a list slider snaps to the modes of the display (and keeps the mode in use), ascending', () => {
  const r = sliderView('resolution', { ...MOCK_BUSY, sliders: { resolution: { options: ['3840x2160', '1280x720', '2560x1440'], value: '1920x1080' } } })
  assert.deepEqual([r.min, r.max, r.step, r.pos], [0, 3, 1, 1])
  assert.deepEqual([0, 1, 2, 3].map((p) => r.valueAt(p)), ['1280x720', '1920x1080', '2560x1440', '3840x2160'], 'ascending by pixels; the mode in use is in the list')
  assert.equal(r.text, '1920×1080'); assert.equal(r.textAt(3), '3840×2160')
  const f = sliderView('refresh', MOCK_BUSY)
  assert.deepEqual([f.max, f.pos, f.text, f.valueAt(0), f.textAt(3)], [3, 2, '120 Hz', 60, '144 Hz'])
  assert.equal(sliderView('resolution', { ...MOCK_BUSY, sliders: { resolution: { options: [], value: '' } } }), null, 'no mode, no slider')
})

test('sliders: the scale offers the steps the host sends, the ones Windows lets the display take without a sign-out; the bitrate cap uses the shared 0..33 segmented scale, 0 = 自动', () => {
  const d = sliderView('dpi', MOCK_BUSY)
  assert.deepEqual([d.min, d.max, d.step, d.pos, d.text, d.valueAt(4), d.textAt(7)], [0, 7, 1, 2, '150%', 200, '300%'], 'a slider over the positions of the host\'s list (there is no 275)')
  // a phone-sized stream display: Windows stops at 200 %, so does the slider
  const phone = sliderView('dpi', MOCK_VDD)
  assert.deepEqual([phone.max, phone.valueAt(phone.max), phone.textAt(phone.max)], [4, 200, '200%'])
  assert.equal(sliderView('dpi', { ...MOCK_BUSY, sliders: { dpi: { value: 150 } } }), null, 'no steps from the host: no slider (a step Windows cannot apply is never offered)')
  assert.equal(sliderView('dpi', { ...MOCK_BUSY, sliders: { dpi: { value: 150, options: [] } } }), null)
  const odd = sliderView('dpi', { ...MOCK_BUSY, sliders: { dpi: { value: 137, options: [100, 125, 150] } } })
  assert.deepEqual([odd.text, odd.textAt(odd.pos)], ['137%', '137%'], 'a scale off the list is still the one in use: shown as it is and on the slider')
  const b = sliderView('bitrate', MOCK_BUSY)
  assert.deepEqual([b.min, b.max, b.step, b.pos, b.text], [0, 33, 1, 23, '80 Mbps'])
  assert.equal(b.valueAt(65), bitrateFromProgress(65)); assert.equal(b.valueAt(0), 0)
  const auto = sliderView('bitrate', MOCK_IDLE)
  assert.deepEqual([auto.pos, auto.text, auto.textAt(0)], [0, '自动', '自动']); assert.equal(sliderView('bitrate', { ...MOCK_IDLE, sliders: { bitrate: { kbps: '65432' } } }).text, '65.4 Mbps')
  assert.equal(sliderView('bitrate', { ...MOCK_IDLE, locale: 'en' }).textAt(0), 'Auto')
})

test('sliders: the scale and the bitrate cap are the desktop\'s and the host\'s and need no target display; the mode sliders need one, and the line says which', () => {
  const all = { t: 'sliders', keys: SLIDER_KEYS }
  assert.deepEqual(sliderViews(all, MOCK_IDLE).map((v) => v.key), ['resolution', 'refresh', 'dpi', 'bitrate'], 'idle: the target is the primary display (or the virtual one), the scale follows the same display')
  assert.deepEqual(sliderViews(all, MOCK_BUSY).map((v) => v.key), ['resolution', 'refresh', 'dpi', 'bitrate'])
  assert.deepEqual(sliderViews(all, MOCK_VDD).map((v) => v.key), ['resolution', 'refresh', 'dpi', 'bitrate'], 'the virtual display is the target of the modes; the scale is that display\'s too')
  const noTarget = { ...MOCK_IDLE, sliders: { target: null, resolution: null, refresh: null, dpi: { value: 125, options: [100, 125, 150] }, bitrate: { kbps: 0 } } }
  assert.deepEqual(sliderViews(all, noTarget).map((v) => v.key), ['dpi', 'bitrate'], 'Windows lists no display: the modes are gone, the scale and the cap stay')
  const mine = V3.pages.quick.rows[2]
  assert.deepEqual(sliderViews(mine, MOCK_BUSY).map((v) => v.key), ['bitrate', 'dpi'], 'by default the bitrate cap and the scale')
  assert.deepEqual(sliderViews(mine, { ...MOCK_BUSY, layout: { sliders: ['bitrate', 'refresh'] } }).map((v) => v.key), ['bitrate', 'refresh'], 'the person\'s order')
  assert.deepEqual(sliderViews(mine, MOCK_IDLE).map((v) => v.key), ['bitrate', 'dpi'], 'idle with no stream and no virtual display: both are there')
  assert.deepEqual(sliderViews(mine, MOCK_VDD).map((v) => v.key), ['bitrate', 'dpi'], 'the virtual display exists, nothing streams: both are there')
  assert.equal(needsDisplay(mine, MOCK_BUSY), false, 'the default pair (cap and scale) has no line about a display'); assert.equal(sliderRowShown(mine, MOCK_IDLE), true)
  assert.equal(needsDisplay({ source: 'layout' }, { layout: { sliders: ['bitrate', 'dpi'] } }), false); assert.equal(needsDisplay({ source: 'layout' }, { layout: { sliders: ['dpi', 'refresh'] } }), true, 'a mode slider names its display')
  assert.equal(sliderRowShown(mine, { ...MOCK_IDLE, sliders: { target: null, resolution: null, refresh: null, dpi: null, bitrate: null } }), false, 'a host that gives neither: no row')
  assert.deepEqual(sliderKeysOf({ source: 'layout' }, { layout: { sliders: [] } }), [])
  assert.equal(sliderTargetText(noTarget).none, true); assert.match(sliderTargetText(noTarget).text, /没有可调整的显示器/); assert.equal(sliderTargetText(noTarget).hint, '', 'no filler under it')
  assert.equal(sliderTargetText(MOCK_IDLE).text, '调整 DELL U2723QE'); assert.equal(sliderTargetText(MOCK_IDLE).hint, '2560×1440@144', 'idle: the primary display')
  assert.equal(sliderTargetText(MOCK_BUSY).text, '调整 DELL U2723QE'); assert.equal(sliderTargetText(MOCK_BUSY).hint, '2560×1440@120')
  assert.equal(sliderTargetText(MOCK_VDD).text, '调整 基地虚拟显示器'); assert.equal(sliderTargetText(MOCK_VDD).hint, '1920×1080@60', 'the scale is the display\'s own: no main-display-only note')
  assert.equal(sliderTargetText(MOCK_VDD, { source: 'layout' }).hint, '1920×1080@60'); assert.equal(sliderTargetText(MOCK_VDD, { keys: ['resolution', 'refresh'] }).hint, '1920×1080@60'); assert.equal(sliderTargetText({ ...MOCK_VDD, locale: 'en' }).text, 'Changing Foundation Virtual Display', 'no name from the host: the virtual display\'s')
  assert.equal(stateOf('vdd'), MOCK_VDD)
  assert.equal(sliderView('resolution', { ...MOCK_BUSY, sliders: undefined }), null, 'an old host that sends no sliders: none drawn')
})

test('the slider component is the product\'s slider item (size m, an icon at each end): applies on release, shows a busy state and the failure inline, and a slider drag is not a swipe; no host call inside', () => {
  const sl = src('../src/vue/MTraySliders.vue'), menu = src('../src/vue/MTrayMenu.vue'), css = src('../src/css/tray.css'), pop = src('../src/vue/MTrayPopup.vue')
  assert.match(sl, /<MSliderItem/); assert.match(sl, /size="m"/); assert.match(sl, /:off-text="v\.offText"/, 'the lowest position of the cap is named in its empty track'); assert.match(sl, /:icon-start="ENDS\[v\.key\]\[0\]" :icon-end="ENDS\[v\.key\]\[1\]"/)
  assert.doesNotMatch(sl, /type="range"|m-tray__sl-input|m-tray__sl-fill/, 'no pill of its own any more')
  assert.match(sl, /@commit="\(pos\) => commit\(v, pos\)"/, 'the shared slider commits a press on release and a key 450 ms after the last one')
  assert.match(sl, /t\.value\.applying/); assert.match(sl, /role="alert"/); assert.match(sl, /:disabled="!!busy\[v\.key\]"/); assert.match(sl, /:readout-text="textOf\(v\)"/)
  assert.doesNotMatch(sl, /invoke\(|fetch\(|window\.__TAURI/)
  assert.doesNotMatch(sl, /@update:model-value="[^"]*apply/, 'moving the slider only changes the value on screen')
  assert.match(src('../src/tray/trayPointer.js'), /e\.target\.closest\?\.\('\.m-tray__sl, \.m-trayed'\)/)
  assert.match(pop, /props\.transport\.set \? props\.transport\.set\(token, key, value\)/)
  assert.match(css, /\.m-tray__sl \{[^}]*border-radius: var\(--tray-pill\)/, 'the slider sits on a pill of the shape rules'); assert.match(css, /\.m-tray__sl-err \{[^}]*error/)
  assert.match(css, /\.m-tray--v3 \{[^}]*--tray-w: 360px/)
})

test('the sliders are written in three languages with the same keys', () => {
  const keys = (l) => Object.keys(TRAY_TEXTS[l].sliders).sort().join()
  assert.equal(keys('zh'), keys('en')); assert.equal(keys('en'), keys('ja'))
  assert.equal(TRAY_TEXTS.zh.sliders.resolution, '分辨率'); assert.equal(TRAY_TEXTS.zh.sliders.dpi, '缩放'); assert.equal(TRAY_TEXTS.zh.sliders.refresh, '刷新率')
  assert.equal(TRAY_TEXTS.zh.sliders.failed('x'), '没有应用:x')
  for (const k of SLIDER_KEYS) assert.ok(ICONS[SLIDERS_ICON(k)], k)
})
function SLIDERS_ICON(k) { return { resolution: 'aspect_ratio', refresh: 'slow_motion_video', dpi: 'format_size', bitrate: 'network_check' }[k] }


test('stepped or continuous: resolution, refresh and the scale snap to their stops; the bitrate cap exposes its segment marks', () => {
  const res = sliderView('resolution', MOCK_BUSY), hz = sliderView('refresh', MOCK_BUSY), dpi = sliderView('dpi', MOCK_BUSY), br = sliderView('bitrate', MOCK_BUSY)
  assert.deepEqual([res.ticks.length, hz.ticks.length, dpi.ticks.length, br.ticks.length], [4, 4, 8, bitrateSegmentMarks.length])
  assert.deepEqual(dpi.ticks.slice(0, 3), [0, 1 / 7, 2 / 7]); assert.equal(dpi.ticks[7], 1)
  assert.equal(res.step, 1); assert.equal(hz.step, 1); assert.equal(dpi.step, 1); assert.equal(br.step, 1)
  assert.deepEqual(tickMarks(1), []); assert.deepEqual(tickMarks(17), [], 'too many stops would run into one line'); assert.equal(tickMarks(16).length, 16)
  // the stops are the shared slider's: it draws one per step up to 24, so the stepped sliders show theirs and the bitrate cap (33 steps) none
  const sl = src('../src/vue/MTraySliders.vue')
  assert.match(sl, /:min="v\.min" :max="v\.max" :step="v\.step"/)
})

// A quick tile label has room for six full-width characters (about 96 px at 16 px): the Japanese labels that run longer were clipped to "デスクトッ…" (2026-11-09), and so was the editor title
test("the Japanese tray tile labels and the editor title fit their boxes (six full-width characters)", async () => {
  const { TRAY_TEXTS } = await import("../src/tray/trayTexts.js")
  const ja = TRAY_TEXTS.ja
  // width in full-width characters: a half-width one is about 0.55 of it
  const width = (text) => [...text].reduce((w, c) => w + (c.charCodeAt(0) < 0x300 ? 0.55 : 1), 0)
  for (const [id, label] of Object.entries(ja.short)) assert.ok(width(label) <= 6, id + ": " + label)
  assert.ok([...ja.edit.title].length <= 6, ja.edit.title)
  assert.equal(ja.short.show_toolbar, "デスクペット")
})


// ---- the sliders in all three menus (2026-11-10) ----
test('V1, V2 and V3 draw the same sliders row from the same list (layout.sliders): V1 under the header, V2 under the status card, V3 after the tiles', () => {
  const row = { t: 'sliders', source: 'layout' }
  assert.deepEqual(V1.pages.root.rows.filter((r) => r.t === 'sliders'), [row]); assert.deepEqual(V2.pages.root.rows.filter((r) => r.t === 'sliders'), [row]); assert.deepEqual(V3.pages.quick.rows.filter((r) => r.t === 'sliders'), [row])
  const at = (m, t) => m.pages[m.root || m.order[0]].rows.findIndex((r) => r.t === t)
  assert.ok(at(V1, 'sliders') > at(V1, 'header') && at(V1, 'sliders') < V1.pages.root.rows.findIndex((r) => r.t === 'item' && r.id === 'open_main_panel'), 'V1: right under the header')
  assert.equal(at(V2, 'sliders'), at(V2, 'card') + 1, 'V2: right under the status card')
  for (const m of [V1, V2, V3]) for (const state of [MOCK_BUSY, MOCK_IDLE, MOCK_VDD]) assert.deepEqual(sliderViews(row, state).map((v) => v.key), sliderViews(row, state).map((v) => v.key))
  // one list: the person's choice reaches every menu
  const mine = { ...MOCK_BUSY, layout: { sliders: ['refresh', 'bitrate'] } }
  assert.deepEqual(sliderViews(row, mine).map((v) => v.key), ['refresh', 'bitrate'])
  // a row with nothing to say is not in the page at all (no empty row, nothing to jump); the scale with no display still says why
  const none = { ...MOCK_IDLE, layout: { sliders: ['dpi'] } }
  assert.equal(isVisible(row, none), true); assert.equal(isVisible(row, { ...MOCK_IDLE, sliders: { target: null } , layout: { sliders: ['bitrate'] } }), false)
  assert.equal(isVisible(row, { ...MOCK_BUSY, layout: { sliders: [] } }), false, '[] is a real choice: no sliders')
})

test('the bitrate cap takes effect while a stream runs, so the slider says nothing about the next stream; a failure shows the host\'s words', () => {
  const sl = src('../src/vue/MTraySliders.vue'), css = src('../src/css/tray.css')
  assert.doesNotMatch(sl, /bitrateNote|m-tray__sl-note|streaming/); assert.doesNotMatch(css, /m-tray__sl-note/)
  for (const l of ['zh', 'en', 'ja']) assert.equal(TRAY_TEXTS[l].sliders.bitrateNote, undefined, l)
  assert.match(sl, /t\.value\.failed\(String\(e\?\.message/); assert.match(sl, /role="alert"/)
})

test('the settings page has a 滑块 choice (all three menus) and the tiles choice (quick panel), each an editor of one list that keeps the other list as the page has it', () => {
  const set = src('../src/vue/MTraySettings.vue'), ed = src('../src/vue/MTrayLayoutEditor.vue')
  assert.match(set, /only="sliders"/); assert.match(set, /only="tiles"/)
  for (const l of ['zh', 'en', 'ja']) assert.match(set, new RegExp(`${l}: \\{[\\s\\S]*?sliders: '[^']+', slidersHint`))
  assert.match(ed, /\[props\.only\]: work\[props\.only\]/)
  assert.match(src('../src/tray/trayModel.js'), /DEFAULT_SLIDERS = Object\.freeze\(\['bitrate', 'dpi'\]\)/)
})

test('page changes move the card with transforms only: no height transition, no clip-path, a surface moved out of a fixed clip, a scaled shade, one native resize', () => {
  const css = src('../src/css/tray.css'), menu = src('../src/vue/MTrayMenu.vue')
  assert.doesNotMatch(css, /transition: height/); assert.doesNotMatch(css, /clip-path/); assert.doesNotMatch(css, /filter: drop-shadow/)
  assert.match(css, /\.m-tray__clip \{[^}]*overflow: hidden/); assert.match(css, /\.m-tray__shade, \.m-tray__surface, \.m-tray__chrome \{ will-change: transform; \}/, 'the moving layers are kept')
  assert.match(menu, /style\.transform = value/); assert.match(menu, /scaleY\(\$\{/); assert.match(menu, /transform var\(--m-spring-default-spatial-duration\) var\(--m-spring-default-spatial\)/)
  assert.doesNotMatch(css, /--tray-(shift|sy|cut|ride|page|drag)/, 'no custom property changes per page change: it would restyle the whole card')
  assert.doesNotMatch(css, /\.m-tray \{[^}]*overflow: hidden/)
  assert.doesNotMatch(css, /\.m-tray__dot\.is-on \{ width/, 'the dots never change their layout')
  assert.match(css, /\.m-tray-row-move/); assert.match(menu, /<TransitionGroup name="m-tray-row">/)
  assert.match(menu, /class="m-tray__clip"/); assert.match(menu, /class="m-tray__shade"/)
})

test('the pager follows a finger: pointer events of every type, a rubber band at the ends, a flick turns the page, the click after a drag is swallowed, sliders are exempt', () => {
  const menu = src('../src/vue/MTrayMenu.vue'), css = src('../src/css/tray.css'), ptr = src('../src/tray/trayPointer.js')
  assert.match(menu, /@pointermove="onMove"/); assert.match(ptr, /const band = /); assert.match(ptr, /const FLICK = /); assert.match(ptr, /onClickCapture/); assert.match(ptr, /\.m-tray__sl, \.m-trayed/)
  assert.match(css, /\.m-tray__track \{[^}]*display: flex/); assert.match(css, /\.m-tray__track\.is-drag \{ transition: none; \}/); assert.match(menu, /useTrayPointer/)
})


// ---- touch (2026-11-10) ----
test('touch density: the choice wins, then the press that opened the menu, then slate posture; a digitizer alone is not enough (the same rule as input_source.rs)', () => {
  const f = (source, slate = false, capable = false) => ({ source, slate, capable })
  assert.deepEqual([...TRAY_DENSITIES], ['auto', 'standard', 'touch'])
  assert.equal(openingDensity('touch', f('mouse')), 'touch'); assert.equal(openingDensity('standard', f('touch', true, true)), 'standard')
  assert.equal(openingDensity('auto', f('touch')), 'touch'); assert.equal(openingDensity('auto', f('pen')), 'touch')
  assert.equal(openingDensity('auto', f('mouse', true, true)), 'standard'); assert.equal(openingDensity('auto', f('touchpad')), 'standard')
  assert.equal(openingDensity('auto', f('unknown', true)), 'touch'); assert.equal(openingDensity('auto', f('unknown', false, true)), 'standard')
  assert.equal(openingDensity(undefined, undefined), 'standard'); assert.equal(openingDensity('auto', null), 'standard')
})

test('touch: the menu decides its density once, the first pointer corrects only an auto guess after the press, and a press is shown on the frame it happens', () => {
  const menu = src('../src/vue/MTrayMenu.vue'), ptr = src('../src/tray/trayPointer.js'), css = src('../src/css/tray.css')
  assert.match(menu, /const touch = ref\(openingDensity\(densityPref, props\.state\?\.touch\) === 'touch'\)/); assert.match(menu, /let corrected = densityPref !== 'auto'/); assert.match(menu, /provide\('trayTouch', touch\)/)
  assert.match(ptr, /requestAnimationFrame\(\(\) => c\.densityFix\(next\)\)/, 'after the click of that press, not under the finger')
  assert.match(ptr, /pressEl\.setAttribute\('data-pressed', ''\)/); assert.match(css, /\[data-pressed\]:not\(:disabled\)::before \{ opacity: 0\.1 !important; transition: none !important; \}/)
  assert.match(css, /\.m-tray \{ touch-action: none; \}/); assert.match(css, /@keyframes m-tray-rip/)
  assert.ok(css.includes("[data-input='touch'] [class*='m-tray__']:hover::before") && /m-trayed__'\]:hover::before \{ opacity: 0 !important; \}/.test(css), 'a finger leaves nothing lit')
  for (const k of ['.m-tray.is-touch .m-tray__tile { height: 64px; }', '.m-tray.is-touch { --tray-row: 56px; }', '.m-tray.is-touch .m-tray__ibtn { min-width: 48px; height: 48px;']) assert.ok(css.includes(k), k)
})

test('touch: a move of more than 10 px is no press, a tap is a press, the hold, the edge back and the swipe down are a finger\'s and not a mouse\'s', () => {
  const ptr = src('../src/tray/trayPointer.js')
  assert.match(ptr, /const MOVE_SLOP = 10/); assert.match(ptr, /g\.touchy && !g\.moved && dist > MOVE_SLOP/); assert.match(ptr, /d\.touchy && d\.moved/)
  assert.match(ptr, /HOLD_MS = 600/); assert.match(ptr, /if \(touchy && tile && isPager\.value && canEdit\.value && !editing\.value\) startHold/)
  assert.match(ptr, /g\.touchy && !g\.edge && closable\.value/); assert.match(ptr, /edge: touchy && !isPager\.value && nav\.canBack/)
  assert.match(ptr, /CLOSE_PX = 56, CLOSE_FLICK = 0\.5/); assert.match(ptr, /navigator\.vibrate/)
  assert.match(ptr, /e\.pointerType === 'mouse' && e\.button !== 0/); assert.match(ptr, /Math\.abs\(dx\) > 48 && Math\.abs\(dx\) > Math\.abs\(dy\) \* 1\.5/, 'a mouse keeps the original swipe: 48 px on release')
})

test('the shared slider: a finger does not move the value on the press (tap jumps, horizontal drags, vertical is left alone), a bigger bubble that says the readout, pan-y', () => {
  const sl = src('../src/vue/MSlider.vue'), css = src('../src/css/expressive.css'), item = src('../src/vue/MSliderItem.vue')
  assert.match(sl, /touchy\.value = event\.pointerType === 'touch' \|\| event\.pointerType === 'pen'/); assert.match(sl, /const SLOP = 6/); assert.match(sl, /emit\('commit', setAt\(index, p\.v\)\)/, 'a tap commits the value it set, not the model that has not caught up yet')
  assert.match(sl, /begin\(event\)\n\}/, 'a mouse begins at once'); assert.match(item, /:bubble-text="readoutText"/)
  assert.match(css, /\.m-slider \{[^}]*touch-action: pan-y/); assert.match(css, /\.m-slider--touch \.m-slider__bubble \{[^}]*bottom: calc\(100% \+ 18px\)/)
})

test('the settings page has the density choice (自动 / 标准 / 触控) in three languages and the record keeps it', () => {
  const set = src('../src/vue/MTraySettings.vue')
  assert.match(set, /set\('density', k\)/); for (const l of ['zh', 'en', 'ja']) assert.match(set, new RegExp(`${l}: \\{[\\s\\S]*?density: '[^']+', densityHint`))
  assert.equal(normalizePrefs({ density: 'touch' }).density, 'touch'); assert.equal(normalizePrefs({ density: 'huge' }).density, 'auto'); assert.equal(normalizePrefs({ right: 'v3' }).density, 'auto', 'a record saved before this has none')
})

test('touch density writes what a tooltip would say: the footer buttons and the display settings button have text', () => {
  assert.match(src('../src/vue/MTrayMenu.vue'), /v-if="touch" class="m-tray__ibtn-t"/); assert.match(src('../src/vue/MTrayRow.vue'), /v-if="touch" class="m-tray__ibtn-t">\{\{ t\.display \}\}/)
})

test('a page taller than the window the host can give scrolls inside the card (the host sends maxHeight; V1 and V2 with two sliders are taller than a 125 % display)', () => {
  const menu = src('../src/vue/MTrayMenu.vue'), pop = src('../src/vue/MTrayPopup.vue'), css = src('../src/css/tray.css')
  assert.match(menu, /resize\(box\)/); assert.match(menu, /'is-scroll': scrolls/); assert.match(pop, /maxHeight\.value = Number\(msg\.maxHeight\) \|\| 0/); assert.match(pop, /:max-height="maxHeight"/)
  assert.match(css, /\.m-tray__viewport\.is-scroll \{[^}]*overflow-y: auto/)
})


// ---- the later pages of the quick panel are the first page's pills (2026-11-11) ----
const pageIds = (name) => V3.pages[name].rows.flatMap(rowIds)

test('V3 later pages: pills in a grid, no menu rows; every function of the old menu lists is still there, on one of the three pages', () => {
  for (const name of ['display', 'settings']) {
    const kinds = new Set(V3.pages[name].rows.map((r) => r.t))
    for (const bad of ['item', 'page', 'seg', 'divider']) assert.equal(kinds.has(bad), false, `${name} has no ${bad} rows`)
    assert.ok(V3.pages[name].rows.some((r) => r.t === 'grid'), `${name} has a grid`)
  }
  // the item ids the five pages had (V3 until the three-page round), by the page they are on now: 显示器 and 工具 are 显示与工具 (the tools that are no setting and not help), 设置 and 帮助 are 设置与帮助
  const NOW = {
    display: ['vdd_settings', 'vdd_create', 'vdd_close', 'vdd_toggle_keep_enabled', 'vdd_toggle_headless_create', 'reset_display', 'show_toolbar', 'host_performance', 'rtss_control', 'web_stream'],
    settings: ['open_sunshine', 'log_console', 'debug_page', 'lang_zh', 'lang_en', 'lang_ja', 'auto_start', 'prevent_sleep', 'restart_user_mode', 'import_config', 'export_config', 'reset_config', 'clear_cache',
      'download_client', 'check_update', 'about', 'star_project', 'visit_project_sunshine', 'visit_project_moonlight', ...SUPPORT_ROW.chips, ...SUPPORT_ROW.sponsors],
  }
  for (const [name, ids] of Object.entries(NOW)) for (const id of ids) assert.ok(pageIds(name).includes(id), `${id} is on ${name}`)
  assert.ok(V3.pages.settings.rows.some((r) => r.t === 'support'), 'the support line is still the last row of the help part'); assert.equal(V3.pages.settings.rows.at(-1).t, 'support')
  for (const id of Object.values(NOW).flat()) assert.ok(TRAY_ITEM_IDS.includes(id), `${id} is an item of menu.rs`)
  // a cell is not a quick-page tile: the person's layout and the host's record know nothing of it
  for (const id of Object.keys(CELLS)) assert.equal(TILE_IDS.includes(id), false, id)
})

test('gridCells: a pill per item the host can offer, a group where the row names one, nothing is left alone in a row, no drill chevrons', () => {
  const settings = V3.pages.settings.rows[0], tools = V3.pages.display.rows[2], display = V3.pages.display.rows[0]
  const keys = (row, st) => gridCells(row, st).map((c) => c.key)
  const wide = (row, st) => gridCells(row, st).map((c) => c.wide)
  assert.equal(V3.pages.settings.rows.filter((r) => r.t === 'grid').length, 1, 'one grid on 设置与帮助: one group is open at a time on the page')
  assert.deepEqual(keys(settings, MOCK_BUSY), ['group:language', 'auto_start', 'prevent_sleep', 'restart_user_mode', 'group:config', 'log_console', 'debug_page', 'open_sunshine', 'download_client', 'about', 'check_update', 'group:project'])
  // the two toggles pair, the third is alone before a group and takes the row; a group always does
  assert.deepEqual(wide(settings, MOCK_BUSY), [true, false, false, true, true, false, false, false, false, false, false, true])
  const release = { ...MOCK_BUSY, rtss: false, dev: false }
  assert.deepEqual(keys(settings, release).slice(5, 10), ['log_console', 'open_sunshine', 'download_client', 'about', 'check_update'], 'the debug page only where the host has it')
  assert.deepEqual(wide(settings, release).slice(5, 10), [false, false, false, false, true], 'the odd pill before a group takes the row')
  assert.deepEqual(keys(tools, release), ['show_toolbar', 'host_performance'], 'RTSS and the Web stream page only where the host has them')
  assert.deepEqual(keys(tools, MOCK_BUSY), ['show_toolbar', 'host_performance', 'rtss_control', 'web_stream'])
  assert.deepEqual(wide(tools, release), [false, false])
  assert.deepEqual(wide(tools, { ...MOCK_BUSY, rtss: true, dev: false }), [false, false, true], 'an odd last pill takes the row')
  assert.deepEqual(keys(display, MOCK_BUSY), ['vdd', 'vdd_toggle_keep_enabled', 'vdd_toggle_headless_create', 'reset_display', 'vdd_settings'])
  for (const row of [settings, tools, display]) for (const c of gridCells(row, MOCK_BUSY)) { if (!c.group) assert.equal(c.drill, '', `${c.key}: a page of settings has no chevron to itself`) }
})

test('groups: language is a choice that shows the current one, 配置 and 项目 hold their items; the words exist in three languages', () => {
  const settings = V3.pages.settings.rows[0]
  const [lang, , , , config] = gridCells(settings, MOCK_BUSY)
  assert.deepEqual([lang.choice, lang.text, lang.items.map((x) => x.id), lang.items.map((x) => x.on)], [true, 'zh' === MOCK_BUSY.locale ? '中文' : '', ['lang_zh', 'lang_en', 'lang_ja'], [true, false, false]])
  assert.equal(gridCells(settings, { ...MOCK_BUSY, locale: 'en' })[0].items.find((x) => x.on).id, 'lang_en')
  assert.deepEqual([config.choice, config.items.map((x) => x.id), config.items.find((x) => x.id === 'reset_config').danger], [false, ['import_config', 'export_config', 'reset_config', 'clear_cache'], true])
  assert.deepEqual(Object.keys(GROUPS), ['language', 'config', 'project'])
  for (const l of ['zh', 'en', 'ja', 'de']) for (const g of Object.keys(GROUPS)) assert.ok(TRAY_TEXTS[l]?.groups?.[g] || trayTexts(l).groups[g], `${l} ${g}`)
  assert.equal(trayTexts('zh').groups.config, '配置'); assert.equal(trayTexts('en').groups.project, 'Project')
  // a toggle cell is lit like the first page's, an action has no sub-label
  const auto = gridCells(settings, MOCK_BUSY).find((c) => c.key === 'auto_start'); assert.deepEqual([auto.on, auto.text, auto.kind], [true, '开', 'toggle'])
})

test('the grid and its group sheets are drawn by one tile component, shared with the first page, with the touch and pointer rules of its pills', () => {
  const row = src('../src/vue/MTrayRow.vue'), tile = src('../src/vue/MTrayTile.vue'), css = src('../src/css/tray.css'), pointer = src('../src/tray/trayPointer.js')
  assert.match(row, /<MTrayTile v-for="x in tiles"/); assert.match(row, /<MTrayTile :tile="c"/); assert.match(tile, /aria-expanded/); assert.match(row, /role="radiogroup"/)
  assert.match(css, /\.m-tray__sheet \{[^}]*grid-template-columns/); assert.match(css, /\.m-tray-sheet-enter-active/)
  // the sheet's buttons are pills of the shared press rules (state layer, ripple); the whole group pill is a tile-main
  assert.match(pointer, /\.m-tray__btn, \.m-tray__tile-main/)
  assert.doesNotMatch(row + tile, /invoke\(|fetch\(|window\.__TAURI/)
})

test('the slider track is visible on the tile surface and the lowest position of the cap is named in it (自动)', () => {
  const css = src('../src/css/expressive.css'), item = src('../src/vue/MSliderItem.vue')
  // the tint is the shared slider's own track now (every slider of the product has it), the tray only sits it on a tile
  assert.match(css, /--s-bg: color-mix\(in srgb, var\(--md-sys-color-on-surface\) \d+%, transparent\)/)
  assert.doesNotMatch(src('../src/css/tray.css'), /\.m-tray__sl \.m-slider \{ --s-bg/)
  assert.match(item, /offText: \{ type: String/); assert.match(item, /:off-text="offText"/)
  assert.equal(sliderView('bitrate', MOCK_IDLE).offText, '自动'); assert.equal(sliderView('bitrate', { ...MOCK_IDLE, locale: 'en' }).offText, 'Auto'); assert.equal(sliderView('dpi', MOCK_IDLE).offText, undefined)
})

test('a page is measured rounded up and a page that scrolls scrolls to its own end', () => {
  const menu = src('../src/vue/MTrayMenu.vue'), css = src('../src/css/tray.css')
  assert.match(menu, /Math\.ceil\(el\.getBoundingClientRect\(\)\.height/); assert.match(menu, /: heightOf\(el\)/, 'a stack takes the height of the page that is on')
  assert.match(css, /\.m-tray__viewport\.is-scroll \.m-tray__track > \.m-tray__page\[inert\] \{ max-height: 100%; overflow: hidden; \}/)
})

test('the scale limit is said in every language, with the highest step in it, and the primary-display note is gone', () => {
  for (const [lang, texts] of Object.entries(TRAY_TEXTS)) {
    assert.equal(typeof texts.sliders.dpiMax, 'function', lang)
    assert.ok(texts.sliders.dpiMax(200).includes('200'), `${lang}: ${texts.sliders.dpiMax(200)}`)
    assert.equal(texts.sliders.dpiPrimaryOnly, undefined, `${lang}: the scale is the target display's own, there is no main-display-only note`)
  }
  const line = sliderTargetText({ ...MOCK_VDD, sliders: { ...MOCK_VDD.sliders, target: { kind: 'vdd', name: '', mode: '1920×1080@60' } } }, { source: 'layout' })
  assert.equal(line.hint, '1920×1080@60')
})

test('a drill into another page never fades through an empty card: the page that comes in starts at once and the one that goes is whole while it does (the per-frame gate is tools/pageswitch.mjs)', () => {
  const css = src('../src/css/tray.css')
  const enter = css.match(/\.m-tray-fwd-enter-active, \.m-tray-bck-enter-active \{([^}]*)\}/)[1]
  const leave = css.match(/\.m-tray-fwd-leave-active, \.m-tray-bck-leave-active \{([^}]*)\}/)[1]
  assert.match(enter, /opacity 120ms linear;/, 'no delay on the way in')
  assert.doesNotMatch(enter, /opacity [0-9]+ms linear [0-9]+ms/)
  assert.match(leave, /opacity 90ms linear 60ms/, 'the page that goes stays whole for 60 ms, so the two overlap')
})

test('the card of a pager keeps one size: the height of its tallest page, so a page change never resizes the card or the host\'s window (the per-frame record is tools in the round\'s evidence)', () => {
  const menu = src('../src/vue/MTrayMenu.vue')
  const measure = menu.slice(menu.indexOf('function measure()'), menu.indexOf('watch(() => nav.current, () => { if (viewport.value) viewport.value.scrollTop = 0 })'))
  assert.match(measure, /isPager\.value \? Math\.max\(\.\.\.Array\.from\(viewport\.value\.querySelectorAll\('\[data-page\]'\), closedOf\)\)/, 'a pager measures every page, with nothing opened on it')
  assert.match(menu, /const naturalOf = \(el\) => Math\.max\(heightOf\(el\), el\.scrollHeight \|\| 0\)/, 'a clamped page reports its content height, so the scroll case does not flip')
})

test('the display page carries the display\'s own sliders (resolution, refresh rate) under its pills', () => {
  const rows = V3.pages.display.rows
  assert.deepEqual(rows.map((r) => r.t), ['grid', 'sliders', 'grid'], 'the display pills, its sliders, the tools')
  assert.deepEqual(rows[1].keys, ['resolution', 'refresh'])
  assert.deepEqual(sliderViews(rows[1], MOCK_BUSY).map((v) => v.key), ['resolution', 'refresh'])
  assert.equal(needsDisplay(rows[1], MOCK_BUSY), true, 'the line above them says which display they change')
})


// ---- five pages became three (2026-11-13): every page as full as the card ----
test('the quick panel has three pages, named for what is on them, in three languages; the old names of the drill targets still lead somewhere', () => {
  assert.deepEqual(V3.order, ['quick', 'display', 'settings'])
  assert.equal(V3.pages.display.title, '显示与工具'); assert.equal(V3.pages.settings.title, '设置与帮助')
  const en = { ...MOCK_BUSY, locale: 'en' }, ja = { ...MOCK_BUSY, locale: 'ja' }
  assert.deepEqual(['quick', 'display', 'settings'].map((p) => pageTitle(p, MOCK_BUSY, 'v3')), ['快捷', '显示与工具', '设置与帮助'])
  assert.deepEqual(['display', 'settings'].map((p) => pageTitle(p, en, 'v3')), ['Display & tools', 'Settings & help'])
  assert.deepEqual(['display', 'settings'].map((p) => pageTitle(p, ja, 'v3')), ['ディスプレイとツール', '設定とヘルプ'])
  // V1 and V2 keep the names of the native submenus
  assert.equal(pageTitle('display', MOCK_BUSY), '显示器'); assert.equal(pageTitle('tools', MOCK_BUSY), '工具'); assert.equal(pageTitle('help', MOCK_BUSY), '帮助')
  // the tiles of the quick page drill into display and settings; both are pages of the pager
  const drills = new Set(Object.values(TILES).map((d) => d.drill).filter(Boolean))
  for (const d of drills) assert.ok(V3.order.includes(d), `a tile drills into ${d}`)
})

test('what is opened in place on a page (a group\'s choices, the sponsors) is not part of the card\'s size: the page scrolls inside the card while it is open, the card and the host\'s window keep their size', () => {
  const menu = src('../src/vue/MTrayMenu.vue'), row = src('../src/vue/MTrayRow.vue')
  assert.match(menu, /const closedOf = /); assert.match(menu, /\.m-tray__sheet:not\(\.m-tray-sheet-leave-active\)/, 'a sheet that is leaving is out of the layout already'); assert.match(menu, /\.m-tray__supchips--sponsors/)
  assert.match(menu, /scrolls\.value = natural > cap \|\| \(isPager\.value && naturalOf\(el\) > box\)/)
  assert.match(row, /function reveal\(id\)/, 'the choices that came out are brought into view'); assert.match(row, /nearestScrollTop/)
})
