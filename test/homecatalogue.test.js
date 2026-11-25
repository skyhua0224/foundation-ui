import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { normalizeReport } from '../src/settings/reachability.js'
import { CATALOGUE_IDS, CATALOGUE_SIZES, LINKS, buildCatalogue, buildCatalogueDetails, catalogueMeta } from '../src/vue/homeCatalogue.js'
import { CATALOGUE_TEXTS } from '../src/vue/homeCatalogueTexts.js'
import { CARD_META, DEFAULT_ORDER, buildCards, defaultVisible } from '../src/vue/homeCards.js'
import { homeTexts } from '../src/vue/homeModel.js'
import { createHistory } from '../src/vue/homeHistory.js'
import { sizesOf, largestOf } from '../src/vue/homeSizes.js'
import { rangeOf } from '../src/vue/homeRanges.js'
import { registerFakeArt } from './fakeArt.js'
registerFakeArt()

const XL_VIEWS = ['hero', 'clients-paired', 'covers', 'errors', 'recent-actions', 'announcements', 'net']

const T = homeTexts('en')
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) } }

test('the catalogue has thirty or more cards, each with a group, sizes and texts in both languages, hidden until added', () => {
  assert.ok(DEFAULT_ORDER.length >= 30, `${DEFAULT_ORDER.length} cards`)
  assert.ok(CATALOGUE_IDS.length >= 30 - 17, `${CATALOGUE_IDS.length} new cards`)
  const meta = catalogueMeta()
  for (const id of CATALOGUE_IDS) {
    assert.ok(CARD_META[id] && DEFAULT_ORDER.includes(id), id)
    assert.equal(defaultVisible(meta[id].def, { live: true }), id === 'pair', `${id} starts ${id === 'pair' ? 'shown' : 'hidden'}`)
    for (const lang of ['en', 'zh']) { assert.ok(CATALOGUE_TEXTS[lang][meta[id].title], `${lang} ${meta[id].title}`) }
    // the range the tile declares (homeRanges.js), from its minimum to its maximum, and its strip; 特大 only for the tiles with a 特大 view of their own
    const r = rangeOf(id, meta[id]); const ladder = ['s', 'm', 'l', 'xl']
    const want = [...(r.min ? ladder.slice(ladder.indexOf(r.min), ladder.indexOf(r.max) + 1) : []), ...(r.strip ? ['strip'] : [])]
    assert.deepEqual(Object.keys(sizesOf(id, meta[id]).sizes), want, `${id} offers its range`)
    if (want.includes('xl')) assert.ok(XL_VIEWS.includes(id), `${id}: 特大 without a view of its own`)
    for (const [span, rows] of Object.values(sizesOf(id, meta[id]).sizes)) assert.ok(span >= 2 && span <= 8 && rows >= 1 && rows <= 2)
  }
  assert.deepEqual(Object.keys(CATALOGUE_TEXTS.en).sort(), Object.keys(CATALOGUE_TEXTS.zh).sort())
})

test('without data only the cards that need none are available: nothing is invented', () => {
  const { data } = buildCatalogue({ now: Date.parse('2026-11-02T12:00:00'), history: createHistory(memory(), 'a') }, T)
  const have = CATALOGUE_IDS.filter((id) => data[id])
  assert.deepEqual(have.sort(), ['act-add-app', 'act-apps', 'act-clients', 'act-community', 'act-diagnostics', 'act-docs', 'act-downloads', 'act-export-diag', 'act-logs', 'act-pair', 'act-pair-qr', 'act-restart', 'act-scan-games', 'act-settings', 'act-star', 'act-stream-check', 'act-update', 'last-session', 'pers-colour', 'pers-theme', 'pers-wallpaper', 'recent-games', 'session-heat', 'tip', 'vivi'])
  assert.equal(data['session-heat'].days.length, 30)
  assert.equal(data['last-session'].rows.length, 0)
  assert.equal(data.latency, null); assert.equal(data.loss, null); assert.equal(data['ctl-encoder'], null); assert.equal(data.errors, null)
})

test('with a running session and the host data every card with a source has its data', () => {
  const history = createHistory(memory(), 'b')
  for (let i = 0; i < 5; i++) { history.sample('latency', 4 + i); history.sample('cpu', 20 + i); history.sample('gpu', 30 + i); history.sample('mem', 40 + i); history.sample('loss', 0.1 * i); history.sample('dropped', i) }
  const log = ['[2026-11-02 11:10:00.000]: Error: Failed', '[2026-11-02 09:00:00.000]: Info: CLIENT CONNECTED', '[2026-11-02 09:40:00.000]: Info: CLIENT DISCONNECTED'].join('\n')
  const x = {
    now: Date.parse('2026-11-02T12:00:00'), history, logText: log,
    recent: ['controller', 'max_bitrate'], canRuntime: true, canOpenDesktop: true, ds5Keys: [{ id: 3, key: 'ds5.haptics.hd.gain', label: 'Haptics HD gain', control: 'slider', tier: 'common', implemented: true, min: 0, max: 2, step: 0.01, value: 1, default: 1 }],
    session: { client_name: 'Pixel 9', host_audio: false, client_address: '203.0.113.5', app_name: 'Elden Ring', width: 2560, height: 1440, fps: 120, fpsMeasured: 118, bitrate: 56000, enable_mic: true, use_vdd: false, latencyMs: 5, latencyP95Ms: 7, packet_loss: 0.4, dropped_frames: 3, uptimeMs: 2520000, enable_hdr: true, frameRates: { enabled: true, ready: true, source_kind: 'vdd_published', source: { fps: 119 }, capture: { fps: 118 }, submitted: { fps: 118 }, encoded: { fps: 117 }, repeated: { fps: 0.2 } }, perfCapture: 'wgc' },
    sys: { memTotal: 32e9, memAvail: 12e9 }, config: { capture: '', fec_percentage: '10', audio_sink: 'Speakers', encoder: 'nvenc', max_bitrate: 50000, fps: '[60,90,120]', platform: 'windows', sunshine_name: 'Tower-PC', port: 47989, upnp: 'enabled', controller: 'disabled', stream_audio: 'false', file_mappings: 'base64:' + Buffer.from(JSON.stringify([{ id: 'a', name: 'Saves', path: 'C:/Users/x/Saves', mode: 'read', clients: [] }])).toString('base64'), file_mapping_port: '48020', active_nvenc_frame_budget: { budget_ms: 8.3, estimated_ms: 4.7, configured_preset: 4, effective_preset: 4, num_engines: 2, width: 3840, height: 2160, fps: 120 }, origin_web_ui_allowed: 'lan' },
    mic: { configured_backend: 'auto', active_backend: '', component_available: true, state: 'idle', underruns: 0, dropped_frames: 0, submit_errors: 0 },
    clients: [{ name: 'Pixel 9', streaming: true }, { name: 'iPad', enabled: false }], apps: [{ name: 'Elden Ring', cover: 'c.png' }],
    reach: normalizeReport(JSON.parse(fs.readFileSync(new URL('./fixtures/reachability-public-verified.json', import.meta.url), 'utf8'))),
    sysinfo: JSON.parse(fs.readFileSync(new URL('./fixtures/system-info.json', import.meta.url), 'utf8')),
    vddStore: { mode: 'physical' }, temps: { cpu: 55, gpu: 64 }, codecModes: { hevc: 0, av1: 1 }, pads: { title: 'Gamepad', text: 'Ready' }, usb: 1, host: { version: '2026.1101', update: '2026.1102' }, logs: { rows: [{ time: '11-02 11:10:00', level: 'Error', text: 'Failed' }] }, announcements: [{ id: 'a', title: 'News' }],
  }
  const { data } = buildCatalogue(x, T)
  for (const id of CATALOGUE_IDS) assert.ok(data[id], `${id} has data`)
  assert.deepEqual(data.reach.rows.map((r) => [r.title, r.tone]), [['Internet · Verified', 'ok'], ['Mesh network · Likely', '']])
  assert.equal(buildCatalogue({ ...x, reach: null }, T).data.reach, null, 'a host without the check has no tile data')
  assert.equal(data.latency.value, '5.0'); assert.equal(data.latency.points.length, 5); assert.equal(data['session-time'].centre, '42:00')
  assert.equal(data.budget.centre, '60'); assert.equal(data.budget.zones.length, 3)
  assert.equal(data['current-app'].cover, 'c.png'); assert.equal(data['clients-online'].count, 1); assert.equal(data['clients-paired'].count, 2)
  assert.equal(data.errors.total, 1); assert.equal(data['session-heat'].days.at(-1).value, 40)
  assert.equal(data['ctl-encoder'].value, 'nvenc'); assert.ok(data['ctl-encoder'].options.some((o) => o.value === 'quicksync'))
  assert.equal(data['ctl-bitrate'].value, '50000'); assert.equal(data['ctl-bitrate'].options[0].label, 'Automatic')
  assert.deepEqual(data['ctl-fps'].value, ['60', '90', '120']); assert.equal(data['ctl-fps'].type, 'fps')
  assert.equal(data.temperature.centre, '64'); assert.equal(data.temperature.caption, 'CPU 55 °C · GPU 64 °C')
  assert.equal(data.load.series.length, 2); assert.deepEqual(data['act-docs'].value, LINKS.docs)
  // the cards reach the catalogue list, marked available, and the ones without data marked unavailable
  const cards = buildCards({ hero: null, curves: [], strip: null, info: [], vdd: null, table: null, apps: null }, { texts: T, catalogue: data })
  assert.ok(cards.find((c) => c.id === 'latency').available && cards.find((c) => c.id === 'latency').kind === 'curve')
  assert.equal(cards.find((c) => c.id === 'covers').kind, 'widget')
  const none = buildCards({ hero: null, curves: [], strip: null, info: [], vdd: null, table: null, apps: null }, { texts: T, catalogue: {} })
  assert.equal(none.find((c) => c.id === 'latency').available, false)
})

test('the packet loss card is absent when the host does not report it (adaptive bitrate off)', () => {
  const { data } = buildCatalogue({ session: { latencyMs: 4, packet_loss: null, dropped_frames: 0 } }, T)
  assert.equal(data.loss, null); assert.ok(data.dropped)
})

test('a docs card opens the Chinese documentation for Chinese interfaces', () => {
  assert.equal(buildCatalogue({}, homeTexts('zh-CN')).data['act-docs'].value, LINKS.docsCn)
  assert.equal(buildCatalogue({}, homeTexts('en')).data['act-docs'].value, LINKS.docs)
})

test('use case sheets: session detail, network, performance, logs and clients, only with data', () => {
  const history = createHistory(memory(), 'd')
  for (let i = 0; i < 6; i++) { history.sample('loss', 0.1 * i); history.sample('dropped', i < 3 ? 0 : i); history.sample('cpu', 20 + i); history.sample('gpu', 30 + i); history.sample('mem', 40 + i); history.sample('latency', 5) }
  const t0 = Date.parse('2026-11-02T10:00:00')
  history.observe({ client_name: 'Pixel 9', app_name: 'A', bitrate: 40000 }, t0); history.observe(null, t0 + 40 * 60000)
  const x = { now: Date.parse('2026-11-02T12:00:00'), history, series: { bitrate: [40000, 42000, 44000], fps: [118, 120, 119], latency: [4, 5, 6] }, session: { fps: 120, latencyMs: 5, uptimeMs: 125000 }, config: { max_bitrate: 50000 }, logText: '[2026-11-02 11:10:00.000]: Error: x', clients: [{ name: 'Pixel 9' }, { name: 'iPad' }] }
  const d = buildCatalogueDetails(x, T)
  const types = (id) => d[id].sections.map((s) => s.type)
  assert.deepEqual(types('bitrate'), ['ring', 'chartx', 'chartx', 'chartx', 'events'])
  assert.deepEqual(d.bitrate.ranges.map((r) => r.value), [20, 100, 0])
  const bit = d.bitrate.sections[1]
  assert.equal(bit.series[0].values[0], 40); assert.ok(bit.band.lo < 42 && bit.band.hi > 42); assert.equal(bit.threshold.value, 50)
  assert.equal(d.bitrate.sections[3].threshold.value, 1000 / 120)
  assert.deepEqual(d.bitrate.sections[4].samples, [0, 0, 0, 3, 4, 5])
  assert.equal(d.fps, d.bitrate)
  assert.deepEqual(types('loss'), ['chartx', 'chartx', 'note'])
  assert.equal(d.load.sections[0].series.length, 2); assert.ok(d['memory-trend']); assert.equal(d.errors.sections[0].series[0].values.reduce((a, b) => a + b, 0), 1)
  const rows = d['clients-paired'].sections[1].rows
  assert.equal(rows.find((r) => r.name === 'Pixel 9').share, 1); assert.equal(rows.find((r) => r.name === 'iPad').text, '–'); assert.equal(rows[0].spark.length, 14); assert.equal(rows[0].spark.at(-1), 40)
  // nothing without data
  assert.deepEqual(Object.keys(buildCatalogueDetails({ now: x.now }, T)), ['session-heat'])
})

test('the added cards: each value comes from its source and a switch is written the way the settings page writes it', () => {
  const x = {
    now: Date.parse('2026-11-02T12:00:00'),
    session: { client_name: 'Pixel 9', client_address: '192.168.1.5', width: 2560, height: 1440, fps: 120, fpsMeasured: 118.4, bitrate: 56000, enable_mic: true, use_vdd: false },
    config: { max_bitrate: 50000, sunshine_name: 'Tower-PC', port: 47990, upnp: 'enabled', controller: 'disabled', keyboard: 'enabled', capture_cursor: 'false', stream_audio: true, lan_encryption_mode: '2', platform: 'windows' },
  }
  const { data } = buildCatalogue(x, T)
  assert.equal(data['stream-resolution'].big, '2560×1440')
  assert.equal(data['stream-client'].rows[0].title, 'Pixel 9'); assert.equal(data['stream-client'].rows[0].value, '192.168.1.5')
  assert.equal(data['stream-fps'].big, '118'); assert.deepEqual(data['stream-fps'].rows.map((r) => r.value), ['120', '118'])
  assert.equal(data['stream-bitrate'].big, '56.0 Mbps'); assert.equal(data['stream-bitrate'].rows[0].value, '50 Mbps')
  assert.equal(data['stream-mic'].big, 'On'); assert.equal(data['stream-vdd'].big, 'Off')
  assert.equal(data['act-stop'].act, 'hero')
  assert.equal(data['host-ports'].big, '47990'); assert.equal(data['host-ports'].rows[0].value, 'On')
  assert.equal(data['host-name'].big, 'Tower-PC')
  assert.equal(data['host-encryption'].rows[0].value, 'Required'); assert.equal(data['host-encryption'].rows[1].value, 'Optional') // WAN is optional when unset
  // 'enabled' / 'disabled' keys, true / false keys, and a key that is not set falls back to the host default
  assert.deepEqual([data['ctl-controller'].value, data['ctl-controller'].options.map((o) => o.value)], ['disabled', ['enabled', 'disabled']])
  assert.equal(data['ctl-keyboard'].value, 'enabled'); assert.equal(data['ctl-mouse'].value, 'enabled') // default on
  assert.equal(data['ctl-cursor'].value, 'false'); assert.equal(data['ctl-audio'].value, 'true')
  assert.deepEqual(data['ctl-audio'].options.map((o) => o.value), ['true', 'false'])
  // no session, no card of the session; no config, no card of the host
  const none = buildCatalogue({ now: x.now }, T).data
  for (const id of ['stream-resolution', 'stream-client', 'stream-fps', 'stream-bitrate', 'stream-mic', 'stream-vdd', 'act-stop', 'host-ports', 'host-name', 'host-encryption', 'host-adapter', 'ctl-controller', 'ctl-keyboard', 'ctl-mouse', 'ctl-cursor', 'ctl-audio']) assert.equal(none[id], null, id)
  // the tip of the day follows the date and the greeting follows the hour
  assert.notEqual(buildCatalogue({ now: Date.parse('2026-11-02T12:00:00') }, T).data.tip.text, buildCatalogue({ now: Date.parse('2026-11-03T12:00:00') }, T).data.tip.text)
  assert.notEqual(buildCatalogue({ now: Date.parse('2026-11-02T03:00:00') }, T).data.vivi.text, buildCatalogue({ now: Date.parse('2026-11-02T14:00:00') }, T).data.vivi.text)
})

test('the catalogue has at least 60 cards besides the defaults and every one has a name in both languages', () => {
  assert.ok(CATALOGUE_IDS.length >= 60, String(CATALOGUE_IDS.length))
  for (const locale of ['en', 'zh']) { const TT = homeTexts(locale); for (const id of CATALOGUE_IDS) { assert.ok(TT[`c_${id}`], `${locale} c_${id}`) } }
})

test('the tile that opens the guide is named for it: 连接引导, not 检查连接 (the name and the action match), and the other languages do not keep the old name', async () => {
  const { readFileSync, readdirSync } = await import('node:fs')
  const texts = readFileSync(new URL('../src/vue/homeCatalogueTexts.js', import.meta.url), 'utf8')
  assert.ok(texts.includes("'c_act-stream-check': '连接引导'") && texts.includes("'c_act-stream-check': 'Connection guide'"))
  assert.ok(texts.includes("quickCheck: '连接引导'") && !texts.includes('检查连接'))
  const catalogue = readFileSync(new URL('../src/vue/homeCatalogue.js', import.meta.url), 'utf8')
  assert.match(catalogue, /action\('act-stream-check', 'fact_check', 'guide-go', \{ id: 'connect' \}/)
  for (const dir of readdirSync(new URL('../src/locale/texts/', import.meta.url))) {
    let file = ''
    try { file = readFileSync(new URL(`../src/locale/texts/${dir}/homeCatalogue.js`, import.meta.url), 'utf8') } catch { continue }
    assert.ok(!/"(c_act-stream-check|quickCheck)"/.test(file), `${dir} keeps the old name of the tile`)
  }
})
