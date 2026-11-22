// The extended card catalogue of the home: cards built on the chart set from data the products already have, plus history this interface keeps
// itself (homeHistory.js). `buildCatalogue(x, T)` returns { meta, data }: meta is what CARD_META needs, data[id] is the card's data or null
// when there is no source here (the card then shows as unavailable in the catalogue and cannot be added). Nothing is invented.
import { codecChips, formatClock } from './homeModel.js'
import { reachView } from '../settings/reachability.js'
import { audioDeviceName } from '../settings/audioDevice.js'
import { bitrateChips, bitrateKbps } from '../settings/bitrate.js'
import { encoderName, codecName as encoderCodec } from '../settings/model.js'
import { errorsByHour, heatDays, logDays, recentApps } from './homeHistory.js'
import { DEFAULT_SIZES, MORE_META, MORE_SIZES, moreCatalogue } from './homeCatalogueMore.js'
import { SYSTEM_META, SYSTEM_SIZES, systemCatalogue } from './homeSystemTiles.js'
import { DEFAULT_RECENT_SIZES, RECENT_META, RECENT_SIZES, recentCatalogue } from './homeRecent.js'
import { onlineClients, realSession } from './clientsLive.js'
import { GROWTH_META, GROWTH_SIZES, growthCatalogue } from './homeGrowth.js'
import { GROWTH2_META, GROWTH2_SIZES, growth2Catalogue } from './homeGrowth2.js'

export const LINKS = Object.freeze({
  star: 'https://github.com/AlkaidLab/foundation-sunshine',
  docs: 'https://www.alkaidlab.com/docs/', docsCn: 'https://www.alkaidlab.cn/docs/',
  community: 'https://qm.qq.com/q/AfMQoyKrkc',
})

const E = 'hero' // the height class of curve cards; the others use 'card'
// id -> [group, default visibility, span, class, kind]; every one of them starts hidden except where the person is likely to want it
const META = {
  latency: ['stream', 'off', 2, E, 'curve'], loss: ['stream', 'off', 2, E, 'curve'], dropped: ['stream', 'off', 2, E, 'curve'], 'session-time': ['stream', 'off', 2, 'card', 'widget'],
  'current-app': ['stream', 'off', 2, 'card', 'widget'], budget: ['stream', 'off', 2, 'card', 'widget'], 'last-session': ['stream', 'off', 2, 'card', 'widget'], 'session-heat': ['stream', 'off', 4, 'card', 'widget'],
  'recent-games': ['stream', 'off', 2, 'card', 'widget'], 'clients-paired': ['device', 'off', 2, 'card', 'widget'], 'clients-online': ['device', 'off', 2, 'card', 'widget'], covers: ['resources', 'off', 4, 'card', 'widget'],
  codecs: ['host', 'off', 2, 'card', 'widget'], hdr: ['host', 'off', 2, 'card', 'widget'], 'audio-out': ['device', 'off', 2, 'card', 'widget'], 'gamepad-status': ['device', 'off', 2, 'card', 'widget'], 'usb-devices': ['device', 'off', 2, 'card', 'widget'],
  errors: ['host', 'off', 4, 'card', 'widget'], logs: ['host', 'off', 4, 'card', 'widget'], update: ['host', 'off', 2, 'card', 'widget'], reach: ['host', 'off', 2, 'card', 'widget'], announcements: ['resources', 'off', 2, 'card', 'widget'],
  'act-export-diag': ['resources', 'off', 2, 'strip', 'widget'], 'act-update': ['resources', 'off', 2, 'strip', 'widget'], 'act-logs': ['resources', 'off', 2, 'strip', 'widget'], 'act-pair-qr': ['resources', 'off', 2, 'strip', 'widget'], 'act-stream-check': ['resources', 'off', 2, 'strip', 'widget'],
  'act-pair': ['resources', 'off', 2, 'strip', 'widget'], 'act-add-app': ['resources', 'off', 2, 'strip', 'widget'], 'act-scan-games': ['resources', 'off', 2, 'strip', 'widget'], 'act-restart': ['resources', 'off', 2, 'strip', 'widget'], 'act-docs': ['resources', 'off', 2, 'strip', 'widget'], 'act-community': ['resources', 'off', 2, 'strip', 'widget'], 'act-open-desktop': ['resources', 'off', 2, 'strip', 'widget'], 'act-star': ['resources', 'off', 2, 'strip', 'widget'],
  temperature: ['perf', 'off', 2, 'card', 'widget'], 'ctl-vdd': ['control', 'off', 4, 'card', 'widget'], 'ctl-encoder': ['control', 'off', 4, 'card', 'widget'], 'ctl-bitrate': ['control', 'off', 4, 'card', 'widget'], 'ctl-fps': ['control', 'off', 4, 'card', 'widget'], 'memory-trend': ['perf', 'off', 2, E, 'curve'], load: ['perf', 'off', 4, 'card', 'widget'],
}
Object.assign(META, MORE_META, SYSTEM_META, RECENT_META, GROWTH_META, GROWTH2_META)
Object.assign(DEFAULT_SIZES, DEFAULT_RECENT_SIZES)
export const CATALOGUE_IDS = Object.freeze(Object.keys(META))
// the sizes a card offers (see homeSizes.js); a card of the strip class has one
// the data of the 资讯 tile: tabs for the kinds that are present (公告, 更新, 教程), the newest first
const NEWS_KINDS = ['announce', 'update', 'guide']
const newsTile = (list, T) => {
  const items = list.map((a) => ({ id: a.id, title: a.title || a.text || '', category: a.category || 'announce', banner: a.banner || '', date: a.date || '', read: !!a.read, hasText: !!a.hasText, url: a.url || '' }))
  const present = NEWS_KINDS.filter((k) => items.some((i) => i.category === k))
  // the tile never leaves the smart page (homeSmart.js): with nothing unread it is `quiet`, a hero with the state beside the newest posts that were read
  const unread = items.filter((i) => !i.read).length
  const status = !items.length ? T.annNone : unread ? `${unread} ${T.newsUnread || ''}`.trim() : T.newsAllRead || T.annRead
  return { type: 'news', icon: 'newspaper', title: T.c_announcements, empty: T.annNone, quiet: unread === 0, unread, status, action: items.length ? '' : T.emptyNews || '', tabs: present.map((k) => ({ id: k, label: T[`news_${k}`] || k })), items }
}

export const CATALOGUE_SIZES = Object.freeze({
  ...MORE_SIZES,
  ...SYSTEM_SIZES,
  ...RECENT_SIZES,
  ...GROWTH_SIZES,
  ...GROWTH2_SIZES,
  latency: { s: [2, 1], m: [4, 1] }, loss: { s: [2, 1], m: [4, 1] }, dropped: { s: [2, 1], m: [4, 1] }, 'memory-trend': { s: [2, 1], m: [4, 1] },
  'session-time': { s: [2, 1], m: [4, 1] }, budget: { s: [2, 1], m: [4, 1] }, 'current-app': { s: [2, 1], m: [4, 1], l: [4, 2] }, 'last-session': { s: [2, 1], m: [4, 1] }, 'recent-games': { s: [2, 1], m: [4, 1] },
  'session-heat': { s: [2, 1], m: [4, 1], l: [8, 1] }, 'clients-paired': { s: [2, 1], m: [4, 1], l: [4, 2] }, 'clients-online': { s: [2, 1], m: [4, 1] }, covers: { m: [4, 1], l: [8, 1] },
  codecs: { s: [2, 1], m: [4, 1] }, hdr: { s: [2, 1], m: [4, 1] }, 'audio-out': { s: [2, 1], m: [4, 1] }, 'gamepad-status': { s: [2, 1], m: [4, 1] }, 'usb-devices': { s: [2, 1], m: [4, 1] },
  temperature: { s: [2, 1], m: [4, 1] }, errors: { m: [4, 1], l: [8, 2] }, logs: { m: [4, 1] }, update: { s: [2, 1], m: [4, 1] }, reach: { s: [2, 1], m: [4, 1] }, announcements: { s: [2, 1], m: [4, 1], l: [4, 2] },
  'act-export-diag': { s: [2, 1], m: [4, 1] }, 'act-update': { s: [2, 1], m: [4, 1] }, 'act-logs': { s: [2, 1], m: [4, 1] }, 'act-pair-qr': { s: [2, 1], m: [4, 1] }, 'act-stream-check': { s: [2, 1], m: [4, 1] },
  'act-pair': { s: [2, 1], m: [4, 1] }, 'act-add-app': { s: [2, 1], m: [4, 1] }, 'act-scan-games': { s: [2, 1], m: [4, 1] }, 'act-restart': { s: [2, 1], m: [4, 1] }, 'act-docs': { s: [2, 1], m: [4, 1] }, 'act-community': { s: [2, 1], m: [4, 1] }, 'act-star': { s: [2, 1], m: [4, 1] }, 'act-open-desktop': { s: [2, 1], m: [4, 1] },
  'ctl-vdd': { m: [4, 2], l: [8, 2] }, 'ctl-encoder': { m: [4, 1], l: [8, 1] }, 'ctl-bitrate': { m: [4, 1], l: [8, 1] }, 'ctl-fps': { m: [4, 1], l: [8, 1] }, load: { m: [4, 1], l: [4, 2] },
})

/** Meta of the catalogue cards for CARD_META: { id: { group, span, cls, def, size, sizes, title, source } }. */
export function catalogueMeta() {
  return Object.fromEntries(Object.entries(META).map(([id, [group, def, span, cls]]) => [id, { group, span, cls, def, sizes: CATALOGUE_SIZES[id], size: DEFAULT_SIZES[id] || (CATALOGUE_SIZES[id].s ? 's' : 'm'), title: `c_${id}`, source: `s_${id}` }]))
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const fmtMin = (m, T) => (m >= 90 ? `${(m / 60).toFixed(1)} ${T.hours}` : `${Math.round(m)} ${T.minutes}`)
const when = (at) => { const d = new Date(at); return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const peakOf = (pts, d = 0) => (pts.length ? Math.max(...pts).toFixed(d) : '')
const ENCODERS = { windows: [['', 'auto'], ['nvenc', 'NVENC'], ['quicksync', 'Quick Sync'], ['amdvce', 'AMF'], ['software', 'Software']], macos: [['', 'auto'], ['videotoolbox', 'VideoToolbox'], ['software', 'Software']], linux: [['', 'auto'], ['nvenc', 'NVENC'], ['vaapi', 'VA-API'], ['software', 'Software']] }
const CAPS_MBPS = [0, 20, 50, 100, 150] // the ceiling's chips; 0 = automatic (the client decides), the host's default

/**
 * x: { session, history (createHistory), series, sys, config, clients, apps, logText, logs, display, pads, mic, usb, host, codecModes, announcements, canAct, now }.
 * Returns { data: { [id]: data | null } }.
 */
export function buildCatalogue(x, T) {
  const now = x.now ?? Date.now()
  const h = x.history?.samples || {}
  const s = realSession(x.session, x.clients)
  const coverOf = (name) => (x.apps || []).find((a) => a.name === name)?.cover || ''
  const curve = (id, icon, points, value, unit, caption, decimals = 0, max) => ({ id, title: T[`c_${id}`], icon, points, max, peak: peakOf(points, decimals), value: value === null || value === undefined ? '' : Number(value).toFixed(decimals), unit, caption })
  const d = {}

  const lat = ((x.series?.latency?.length ? x.series.latency : h.latency) || []).slice(-60)
  d.latency = s && (num(s.latencyMs) !== null || lat.length > 1) ? curve('latency', 'timer', lat, num(s.latencyMs), T.ms, num(s.latencyP95Ms) !== null ? `${T.p95} ${s.latencyP95Ms.toFixed(1)} ${T.ms}` : '', 1) : null
  d.loss = s && num(s.packet_loss) !== null ? curve('loss', 'network_check', h.loss || [], s.packet_loss, '%', '', 1) : null
  d.dropped = s && num(s.dropped_frames) !== null ? curve('dropped', 'warning', h.dropped || [], s.dropped_frames, '', '', 0) : null
  d['memory-trend'] = x.sys && num(x.sys.memTotal) && (h.mem || []).length > 1 ? curve('memory-trend', 'storage', h.mem.slice(-60), x.sys.memTotal ? ((x.sys.memTotal - (x.sys.memAvail || 0)) / x.sys.memTotal) * 100 : null, '%', T.last60 || '', 0, 100) : null

  d['session-time'] = s && num(s.uptimeMs) !== null ? { type: 'ring', icon: 'timer', title: T['c_session-time'], value: (s.uptimeMs % 3600000) / 3600000, centre: formatClock(s.uptimeMs), caption: s.client_name || '' } : null
  d['current-app'] = s ? { type: 'now', icon: 'sports_esports', title: T['c_current-app'], name: s.app_name || T.nowNone, cover: coverOf(s.app_name), rows: [s.client_name && { icon: 'devices', title: T.client, value: s.client_name }, s.width && { icon: 'monitor', title: '', value: `${s.width}×${s.height}${s.fps ? ` · ${s.fps} ${T.fpsUnit || 'fps'}` : ''}` }, num(s.bitrate) !== null && { icon: 'speed', title: '', value: `${((num(s.measured_bitrate_kbps) ?? s.bitrate) / 1000).toFixed(1)} ${T.mbps}` }, s.codec && { icon: 'movie', title: '', value: encoderCodec(s.codec) }, num(s.uptimeMs) !== null && { icon: 'timer', title: '', value: formatClock(s.uptimeMs) }].filter(Boolean) } : null
  // the host latency is the pipeline's total when the host sends the stages (pipeTotalMs, the same field family as latencyMs); the stages are the averages of each part of it, in the order a frame goes through them
  const latNow = s ? (num(s.latencyMs) ?? num(s.pipeTotalMs)) : null
  const budget = s && latNow !== null && num(s.fps) ? Math.min(1, latNow / (1000 / s.fps)) : null
  const STAGES = [['pipeCaptureToConvertMs', 'stageCapture'], ['pipeConvertMs', 'stageConvert'], ['pipeEncodeQueueMs', 'stageQueue'], ['pipeEncodeMs', 'stageEncode'], ['pipePacketToBroadcastMs', 'stageSend']]
  const stages = s ? STAGES.map(([k, t], i) => (num(s[k]) !== null && s[k] >= 0 ? { key: k, i, title: T[t], ms: s[k], value: `${s[k] < 10 ? s[k].toFixed(2).replace(/0$/, '') : s[k].toFixed(1)}` } : null)).filter(Boolean) : []
  d.budget = budget !== null ? { type: 'gauge', icon: 'speed', title: T.c_budget, value: budget, centre: `${Math.round(budget * 100)}`, unit: '%', zones: [{ to: 0.5, tone: 'ok' }, { to: 0.8, tone: 'warn' }, { to: 1, tone: 'err' }], spark: lat.length > 1 ? lat : null, caption: T.budget, frameMs: 1000 / s.fps, stages, facts: [{ title: T.c_latency, value: `${Number(latNow).toFixed(1)} ${T.ms || 'ms'}` }, { title: T.frameTime, value: `${(1000 / s.fps).toFixed(1)} ${T.ms || 'ms'}` }] } : null

  const last = x.history?.last?.() || null
  d['last-session'] = { type: 'rows', icon: 'history', title: T['c_last-session'], empty: T.lastNone, cover: last ? coverOf(last.app) : '', rows: last ? [{ icon: 'sports_esports', title: last.app || last.client || '–', value: when(last.start) }, { icon: 'schedule', title: T.length, value: fmtMin(last.ms / 60000, T) }, { icon: 'speed', title: T.bitrateAvg, value: `${last.bitrate} ${T.mbps}` }, { icon: 'videocam', title: T.fpsAvg, value: `${last.fps} ${T.fpsUnit}` }, { icon: 'timer', title: T.p95, value: `${last.p95} ${T.ms}` }, { icon: 'warning', title: T.dropped, value: String(last.dropped) }] : [] }
  const days = heatDays(x.history?.days, now, 30, logDays(x.logText))
  const total = days.reduce((a, b) => a + b.value, 0)
  d['session-heat'] = { type: 'heat', icon: 'schedule', title: T['c_session-heat'], days, total: total ? fmtMin(total, T) : '', caption: T.days30, empty: T.historyNone }
  d['recent-games'] = { type: 'apps', icon: 'sports_esports', title: T['c_recent-games'], empty: T.recentNone, items: recentApps(x.history?.sessions || [], 6).map((r) => ({ name: r.app, cover: coverOf(r.app), sub: when(r.at) })) }

  const clients = x.clients || null
  // per device, from the sessions this interface keeps (x.history): when it streamed last and for how long in all; the 特大 tile lists them
  const perClient = new Map()
  for (const r of x.history?.sessions || []) { const e = perClient.get(r.client) || { last: 0, ms: 0 }; e.last = Math.max(e.last, r.start || 0); e.ms += r.ms || 0; perClient.set(r.client, e) }
  d['clients-paired'] = clients ? { type: 'clients', icon: 'devices', title: T['c_clients-paired'], count: clients.length, items: clients.slice(0, 8).map((c) => { const e = perClient.get(c.name); return { name: c.name || '–', icon: c.icon || 'devices', tone: c.streaming ? 'ok' : c.enabled === false ? 'warn' : '', state: c.streaming ? T.streamingNow : c.enabled === false ? T.blocked : T.enabled, last: e?.last ? when(e.last) : T.neverStreamed, time: e?.ms ? fmtMin(e.ms / 60000, T) : '–' } }), labels: { last: T.lastSeen, time: T.streamedFor }, empty: T.noClients } : null
  const online = onlineClients(clients, s) // the session the host runs says who streams (the client list has no such flag)
  d['clients-online'] = online ? { type: 'clients', icon: 'cast_connected', title: T['c_clients-online'], count: online.length, items: online.map((c) => ({ name: c.name || '–', icon: c.icon || 'devices', tone: 'ok' })), empty: T.onlineNone } : null
  d.covers = x.apps ? { type: 'covers', icon: 'apps', title: T.c_covers, count: x.apps.length, items: x.apps.slice(0, 16).map((a) => ({ name: a.name, cover: a.cover || '' })), empty: T.coversNone } : null

  d.codecs = x.codecModes ? { type: 'chips', icon: 'movie', title: T.c_codecs, chips: codecChips(x.codecModes, T) } : null
  const hdr = s ? !!s.enable_hdr : x.display?.hdr
  d.hdr = hdr === undefined || hdr === null ? null : { type: 'chips', icon: 'hdr_on', title: T.c_hdr, big: hdr ? T.hdrOn : T.hdrOff, tone: hdr ? 'ok' : '', chips: [!s && x.display?.hdrText && { label: x.display.hdrText }, x.display?.nits && { label: `${Math.round(x.display.nits)} nits`, icon: 'light_mode' }].filter(Boolean) }
  d['audio-out'] = x.config && typeof x.config.audio_sink === 'string' ? { type: 'rows', icon: 'volume_up', title: T['c_audio-out'], rows: [{ icon: 'speaker', title: T.device, value: audioDeviceName(x.config.audio_sink, x.audio, T.audioDevice) || T.auto }] } : null
  d['gamepad-status'] = x.pads ? { type: 'rows', icon: 'sports_esports', title: T['c_gamepad-status'], rows: [{ icon: 'sports_esports', title: x.pads.title || T.gamepad, value: x.pads.text, tone: x.pads.tone }] } : null
  d['usb-devices'] = typeof x.usb === 'number' ? { type: 'rows', icon: 'usb', title: T['c_usb-devices'], big: String(x.usb), rows: [{ icon: 'usb', title: x.usb ? T.usbCount : T.usbNone, value: '' }] } : null

  const eh = errorsByHour(x.logText, now, 24)
  // the newest lines of the log beside the bars (大: three, 特大: eight), the same lines the 日志 tile shows
  const errLines = (x.logs?.rows || []).slice(0, 8).map((r) => ({ icon: r.level === 'Warning' ? 'warning' : 'error', title: r.text, sub: r.time, tone: r.level === 'Warning' ? 'warn' : 'err' }))
  d.errors = eh ? { lines: errLines, type: 'bars', icon: 'error', title: T.c_errors, labels: eh.labels, series: [{ id: 'e', label: T.errorsLabel, values: eh.errors, color: 'var(--md-sys-color-error)' }, { id: 'w', label: T.warningsLabel, values: eh.warnings, color: 'var(--md-sys-color-warning)' }], total: eh.total, empty: T.logNone } : null
  d.logs = x.logs ? { type: 'lines', icon: 'description', title: T.c_logs, empty: T.logNone, rows: (x.logs.rows || []).slice(0, 8).map((r) => ({ icon: r.level === 'Warning' ? 'warning' : 'error', title: r.text, sub: r.time, tone: r.level === 'Warning' ? 'warn' : 'err' })) } : null
  // the remote access card: the host's own verdict per path (x.reach is the normalized reachability report, null where the host has no such check)
  d.reach = x.reach ? { type: 'lines', icon: 'public', title: T.c_reach, empty: T.reachEmpty, rows: reachView(x.reach, T.__locale || 'en').paths.map((p) => ({ icon: p.icon, title: `${p.title} · ${p.word}`, sub: p.address || p.evidence[0] || '', tone: p.tone === 'ok' ? 'ok' : p.tone === 'error' ? 'err' : '' })) } : null
  d.update = x.host && (x.host.version || x.host.update) ? { type: 'rows', icon: 'update', title: T.c_update, big: x.host.version || '', rows: [{ icon: x.host.update ? 'update' : 'check_circle', title: x.host.update ? T.updateReady : T.upToDate, value: x.host.update || '', tone: x.host.update ? 'warn' : 'ok' }] } : null
  // 资讯: the announcements as posts (banner, kind, date) in tabs by kind. The tile is always there where the host gives the list (an array, however short; no list, no tile: nothing is invented): with none, or none unread, it is the quiet state
  d.announcements = Array.isArray(x.announcements) ? newsTile(x.announcements, T) : null

  const action = (id, icon, act, value, label, more = {}) => ({ type: 'action', icon, title: T[`c_${id}`], label, act, value, ...more })
  // the live fact of an action tile: the count it adds to, the version it checks, the errors its log holds
  d['act-pair'] = x.canAct === false ? null : action('act-pair', 'person_add', 'table-action', undefined, T.pairAction, { count: x.clients ? x.clients.length : null })
  d['act-add-app'] = action('act-add-app', 'add', 'open', 'apps', T.addAction)
  d['act-scan-games'] = action('act-scan-games', 'sports_esports', 'scan-games', undefined, T.scanAction)
  d['act-restart'] = x.canAct === false ? null : action('act-restart', 'restart_alt', 'hero', undefined, T.restartAction)
  d['act-export-diag'] = action('act-export-diag', 'download', 'open', 'diagnostics', T.openAction)
  d['act-update'] = action('act-update', 'refresh', 'detail-external', undefined, T.checkAction, { version: x.host?.version || '', update: x.host?.update || '' })
  d['act-logs'] = action('act-logs', 'terminal', 'open', 'diagnostics', T.openAction, { errors: eh ? eh.total : null })
  d['act-pair-qr'] = x.canAct === false ? null : action('act-pair-qr', 'qr_code_2', 'pair-qr', undefined, T.qrAction)
  d['act-stream-check'] = action('act-stream-check', 'fact_check', 'guide-go', { id: 'connect' }, T.startAction)
  d.quick = { type: 'quick', icon: 'bolt', title: T.c_quick, items: [
    { id: 'check', icon: 'fact_check', label: T.quickCheck, act: 'guide-go', value: { id: 'connect' } },
    { id: 'logs', icon: 'terminal', label: T.quickLogs, act: 'open', value: 'diagnostics' },
    { id: 'update', icon: 'refresh', label: T.quickUpdate, act: 'detail-external' },
    ...(x.canAct === false ? [] : [{ id: 'restart', icon: 'restart_alt', label: T.quickRestart, act: 'hero' }]),
  ] }
  d['act-docs'] = action('act-docs', 'menu_book', 'link', /^zh/i.test(String(T.__locale || '')) ? LINKS.docsCn : LINKS.docs, T.openDocs, { lang: /^zh/i.test(String(T.__locale || '')) ? '中文' : 'EN' })
  d['act-community'] = action('act-community', 'groups', 'link', LINKS.community, T.joinAction)
  d['act-star'] = action('act-star', 'star', 'link', LINKS.star, T.starAction)
  // the big screen (Foundation Desktop) opens on the machine the control panel runs on: a product that cannot open it (the Web UI in a browser on another machine) has no tile, not a disabled one
  d['act-open-desktop'] = x.canOpenDesktop === true ? action('act-open-desktop', 'tv', 'open-desktop', undefined, T.openAction) : null

  const platform = x.config?.platform === 'macos' ? 'macos' : x.config?.platform === 'linux' ? 'linux' : 'windows'
  d['ctl-vdd'] = x.vddStore ? { type: 'vdd', icon: 'desktop_windows', title: T['c_ctl-vdd'], store: x.vddStore, locale: String(T.__locale || 'en') } : null
  d['ctl-encoder'] = x.config && x.saveSetting !== false ? { type: 'control', icon: 'memory', title: T['c_ctl-encoder'], key: 'encoder', kind: 'chips', note: T.restartNote, value: String(x.config.encoder ?? ''), options: ENCODERS[platform].map(([value, label]) => ({ value, label: label === 'auto' ? T.auto : label })) } : null
  // an unset key is the host's default, 0 (自动): the tile is there on a host that never wrote it, and a stored value that is none of the chips gets a chip of its own
  d['ctl-bitrate'] = x.config && x.saveSetting !== false ? { type: 'control', icon: 'speed', title: T['c_ctl-bitrate'], key: 'max_bitrate', kind: 'chips', note: T.clientNote, value: String(bitrateKbps(x.config.max_bitrate)), options: bitrateChips(x.config.max_bitrate, T.auto, CAPS_MBPS).map((c) => ({ value: String(c.value), label: c.value ? `${Math.round(c.value / 100) / 10} ${T.mbps}` : T.auto })) } : null
  d['ctl-fps'] = x.config && x.config.fps !== undefined && x.saveSetting !== false ? { type: 'fps', icon: 'slow_motion_video', title: T['c_ctl-fps'], addLabel: T.addFps, addText: T.addText, value: String(x.config.fps ?? '').replace(/[\[\]\s]/g, '').split(',').filter(Boolean) } : null
  const tc = num(x.temps?.cpu), tg = num(x.temps?.gpu), top = tg !== null ? tg : tc
  d.temperature = top !== null ? { type: 'gauge', icon: 'memory', title: T.c_temperature, value: Math.min(1, top / 100), centre: String(Math.round(top)), unit: '°C', zones: [{ to: 0.7, tone: 'ok' }, { to: 0.85, tone: 'warn' }, { to: 1, tone: 'err' }], caption: [tc !== null && `${T.loadCpu} ${Math.round(tc)} °C`, tg !== null && `${T.loadGpu} ${Math.round(tg)} °C`].filter(Boolean).join(' · ') } : null
  d.load = (h.cpu || []).length > 1 || (h.gpu || []).length > 1 ? { type: 'chart', icon: 'memory', title: T.c_load, series: [{ id: 'cpu', label: T.loadCpu, values: (h.cpu || []).slice(-60) }, ...((h.gpu || []).length > 1 ? [{ id: 'gpu', label: T.loadGpu, values: h.gpu.slice(-60) }] : [])], chart: 'line', unit: ' %', max: 100 } : null
  Object.assign(d, moreCatalogue(x, T, now), systemCatalogue(x, T), recentCatalogue(x, T), growthCatalogue(x, T), growth2Catalogue(x, T))
  // 设置 at 中: the encoder and the bitrate cap the host streams with
  if (d['act-settings'] && x.config) d['act-settings'].facts = [encoderName(x.config.encoder) || T.auto, d['ctl-bitrate']?.options?.find((o) => o.value === String(bitrateKbps(x.config.max_bitrate)))?.label].filter(Boolean).join(' · ')
  return { data: d }
}

const DAY = 86400000
const dkey = (at) => { const d = new Date(at); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

/**
 * Detail sheets of the use cases, from the same input as buildCatalogue: { [card id]: { title, sections } }. Sections are the types of the
 * home's detail sheet; `chartx` draws with MChartX, `events` with MEventStrip, `heat` with MHeatStrip, `table` rows with an inline bar and a sparkline.
 * Only what has data is there: a section without samples is left out.
 */
export function buildCatalogueDetails(x, T) {
  const now = x.now ?? Date.now()
  const h = x.history?.samples || {}
  const s = realSession(x.session, x.clients)
  const out = {}
  const step = x.sampleSec || 3
  const ranges = [{ value: Math.round(60 / step), label: T.range1 }, { value: Math.round(300 / step), label: T.range5 }, { value: 0, label: T.rangeSession }]
  const line = (id, label, values, extra = {}) => (values.length > 1 ? { type: 'chartx', chart: 'line', series: [{ id, label, values }], step, height: 120, ...extra } : null)
  const bitrate = (x.series?.bitrate?.length ? x.series.bitrate : h.bitrate || []).map((v) => v / 1000)
  const avg = bitrate.length ? bitrate.reduce((a, b) => a + b, 0) / bitrate.length : null
  const cap = num(x.config?.max_bitrate) ? x.config.max_bitrate / 1000 : null
  const fps = x.series?.fps?.length ? x.series.fps : h.fps || []
  const lat = (x.series?.latency?.length ? x.series.latency : h.latency) || []
  const dropped = h.dropped || []
  const session = [
    bitrate.length > 1 && { type: 'chartx', title: `${T.bitrate} (${T.mbps})`, chart: 'area', series: [{ id: 'b', label: T.bitrate, values: bitrate }], step, height: 140, unit: ` ${T.mbps}`, decimals: 1, band: avg ? { lo: avg * 0.85, hi: avg * 1.15, label: T.band } : null, threshold: cap ? { value: cap, label: `${T.cap} ${cap}` } : null },
    fps.length > 1 && line('f', T.fps, fps, { title: `${T.fps} (${T.fpsUnit})`, unit: ` ${T.fpsUnit}` }),
    lat.length > 1 && line('l', T.latency, lat, { title: `${T.latency} (${T.ms})`, unit: ` ${T.ms}`, decimals: 1, threshold: s?.fps ? { value: 1000 / s.fps, label: T.budget } : null }),
    dropped.length > 1 && { type: 'events', title: T.dropped, samples: dropped, empty: T.noDrops },
  ].filter(Boolean)
  if (s && num(s.uptimeMs) !== null) session.unshift({ type: 'ring', seconds: Math.floor(s.uptimeMs / 1000), period: 3600, label: formatClock(s.uptimeMs) })
  if (s && session.length) { out.bitrate = { title: T.sessionDetail, ranges, sections: session }; out.fps = out.bitrate }
  if (s && (h.loss || []).length > 1) out.loss = { title: T.c_loss, ranges, sections: [bitrate.length > 1 && { type: 'chartx', title: `${T.bitrate} (${T.mbps})`, chart: 'area', series: [{ id: 'b', label: T.bitrate, values: bitrate }], step, height: 110, unit: ` ${T.mbps}`, decimals: 1 }, { type: 'chartx', title: `${T.loss} (%)`, chart: 'bar', series: [{ id: 'l', label: T.loss, values: h.loss, color: 'var(--md-sys-color-error)' }], step, height: 70, unit: ' %', decimals: 1 }, { type: 'note', text: T.noDownlink }].filter(Boolean) }
  if ((h.cpu || []).length > 1 || (h.gpu || []).length > 1) out.load = { title: T.c_load, ranges, sections: [{ type: 'chartx', chart: 'line', series: [{ id: 'cpu', label: T.loadCpu, values: h.cpu || [] }, ...((h.gpu || []).length > 1 ? [{ id: 'gpu', label: T.loadGpu, values: h.gpu }] : [])], step, height: 200, unit: ' %', max: 100 }] }
  if ((h.mem || []).length > 1) out['memory-trend'] = { title: T['c_memory-trend'], ranges, sections: [{ type: 'chartx', chart: 'area', series: [{ id: 'm', label: T.memory, values: h.mem }], step, height: 180, unit: ' %', max: 100 }] }
  const eh = errorsByHour(x.logText, now, 24)
  if (eh) out.errors = { title: T.c_errors, sections: [{ type: 'chartx', chart: 'stackbar', series: [{ id: 'e', label: T.errorsLabel, values: eh.errors, color: 'var(--md-sys-color-error)' }, { id: 'w', label: T.warningsLabel, values: eh.warnings, color: 'var(--md-sys-color-warning)' }], labels: eh.labels, height: 200, floor: 4 }] }
  // clients: 30 days of play time and, per client, its share and the last 14 days from the sessions this interface has seen
  const sessions = x.history?.sessions || []
  const heat = heatDays(x.history?.days, now, 30, logDays(x.logText))
  if (x.clients) {
    const per = new Map()
    for (const r of sessions) { const e = per.get(r.client) || { minutes: 0, days: {} }; e.minutes += r.ms / 60000; const k = dkey(r.start); e.days[k] = (e.days[k] || 0) + r.ms / 60000; per.set(r.client, e) }
    const total = [...per.values()].reduce((a, b) => a + b.minutes, 0)
    const rows = x.clients.map((c) => { const e = per.get(c.name); return { id: c.name, name: c.name, share: e && total ? e.minutes / total : 0, text: e ? fmtMin(e.minutes, T) : '–', spark: Array.from({ length: 14 }, (_, i) => (e?.days[dkey(now - (13 - i) * DAY)] || 0)) } })
    out['clients-paired'] = { title: T['c_clients-paired'], sections: [{ type: 'heat', title: `${T['c_session-heat']} · ${T.days30}`, days: heat, empty: T.historyNone }, { type: 'clientrows', title: T.perClient, rows, empty: T.noClients }] }
  }
  out['session-heat'] = { title: T['c_session-heat'], sections: [{ type: 'heat', title: T.days30, days: heat, empty: T.historyNone }] }
  return out
}

/**
 * The control cards of the home strip as shared tier-1 chip sets (`MChipSet`, the control the settings use for short choices): the gamepad type group
 * and the microphone switch are no longer controls of the home's own. Choosing emits the same action the strip had (`group`, `switch`), so each
 * product keeps the route that applies the change at once.
 */
export const stripControl = (strip) => ({ type: 'strip-control', icon: strip.icon, title: strip.label, value: String(strip.value ?? ''), busy: !!strip.busy, note: String(strip.note || ''), options: strip.options.map((o) => ({ value: String(o.value), label: o.label })), act: 'group' })
export const switchControl = (sw, T) => ({ type: 'strip-control', icon: sw.id === 'mic' ? 'mic' : 'toggle_on', title: sw.label, sub: sw.sub, value: sw.value ? 'on' : 'off', busy: !!sw.busy || !!sw.disabled, options: [{ value: 'on', label: T.on || 'On' }, { value: 'off', label: T.off || 'Off' }], act: 'switch', id: sw.id })
