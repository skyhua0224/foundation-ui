// More cards of the home catalogue. Every one has a real source (a field of the running session, a key of the host configuration, the appearance
// the window already keeps, a fixed link or route) and is `null` when that source is not there: nothing is invented. The list and the sources are
// in docs/home-tiles.md.
import { MASCOT } from '../about/mascot.js'
import { realSession } from './clientsLive.js'
import { platformName } from '../settings/model.js'

// id -> [group, default visibility, span, class, kind]
export const MORE_META = {
  pair: ['stream', 'paired', 4, 'hero', 'widget'],
  'stream-resolution': ['stream', 'off', 2, 'card', 'widget'], 'stream-client': ['stream', 'off', 2, 'card', 'widget'], 'stream-fps': ['stream', 'off', 2, 'card', 'widget'], 'stream-bitrate': ['stream', 'off', 2, 'card', 'widget'],
  'stream-mic': ['stream', 'off', 2, 'card', 'widget'], 'stream-vdd': ['stream', 'off', 2, 'card', 'widget'], 'act-stop': ['stream', 'off', 2, 'strip', 'widget'],
  'host-ports': ['host', 'off', 2, 'card', 'widget'], 'host-name': ['host', 'off', 2, 'card', 'widget'], 'host-encryption': ['host', 'off', 2, 'card', 'widget'], 'host-adapter': ['host', 'off', 2, 'card', 'widget'],
  'ctl-controller': ['control', 'off', 4, 'card', 'widget'], 'ctl-keyboard': ['control', 'off', 4, 'card', 'widget'], 'ctl-mouse': ['control', 'off', 4, 'card', 'widget'], 'ctl-cursor': ['control', 'off', 4, 'card', 'widget'], 'ctl-audio': ['control', 'off', 4, 'card', 'widget'],
  'pers-theme': ['personal', 'off', 4, 'card', 'widget'], 'pers-wallpaper': ['personal', 'off', 4, 'card', 'widget'], 'pers-colour': ['personal', 'off', 4, 'card', 'widget'],
  vivi: ['personal', 'off', 2, 'card', 'widget'], tip: ['personal', 'off', 4, 'card', 'widget'],
  'act-settings': ['resources', 'off', 2, 'strip', 'widget'], 'act-diagnostics': ['resources', 'off', 2, 'strip', 'widget'], 'act-clients': ['resources', 'off', 2, 'strip', 'widget'], 'act-apps': ['resources', 'off', 2, 'strip', 'widget'], 'act-downloads': ['start', 'off', 2, 'strip', 'widget'],
}
const INFO = { s: [2, 1], m: [4, 1] }
const ACT = { s: [2, 1], m: [4, 1] }
/** Cards whose default size is not the smallest they offer. */
export const DEFAULT_SIZES = { pair: 'm' }
export const MORE_SIZES = {
  pair: { s: [2, 1], m: [4, 1], l: [4, 2] },
  'stream-resolution': INFO, 'stream-client': INFO, 'stream-fps': INFO, 'stream-bitrate': INFO, 'stream-mic': INFO, 'stream-vdd': INFO, 'act-stop': ACT,
  'host-ports': INFO, 'host-name': INFO, 'host-encryption': INFO, 'host-adapter': INFO,
  'ctl-controller': { m: [4, 1] }, 'ctl-keyboard': { m: [4, 1] }, 'ctl-mouse': { m: [4, 1] }, 'ctl-cursor': { m: [4, 1] }, 'ctl-audio': { m: [4, 1] },
  'pers-theme': { m: [4, 1] }, 'pers-wallpaper': { m: [4, 1], l: [8, 1] }, 'pers-colour': { m: [4, 1] },
  vivi: { s: [2, 1], m: [4, 1] }, tip: { m: [4, 1] },
  'act-settings': ACT, 'act-diagnostics': ACT, 'act-clients': ACT, 'act-apps': ACT, 'act-downloads': ACT,
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
/** A host switch as the settings pages write it: 'enabled' and 'disabled', or true and false; `def` is what it is when the key is not set. */
export const SWITCHES = Object.freeze({
  controller: { on: 'enabled', off: 'disabled', def: true }, keyboard: { on: 'enabled', off: 'disabled', def: true }, mouse: { on: 'enabled', off: 'disabled', def: true },
  capture_cursor: { on: true, off: false, def: true }, stream_audio: { on: true, off: false, def: true }, upnp: { on: 'enabled', off: 'disabled', def: false },
})
export const isOn = (key, value) => {
  const def = SWITCHES[key]?.def ?? false
  if (value === undefined || value === null || value === '') return def
  return value === true || /^(true|enabled|on|yes|1)$/i.test(String(value))
}
const TIPS = 8 // how many tips the texts carry (tip0 ... tip7)

/** { [id]: data | null } for the cards above. x is the same input as buildCatalogue; `now` is a timestamp (the tip of the day follows the date). */
/** The address a host sees for a client that streams through a router or a bridge is the router's: the first or the last address of a private /24 (192.168.1.1). It is not the client, so no tile names it as the client's. */
export const viaGateway = (address) => {
  const m = /^(10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.(?:\d{1,3}\.)?(\d{1,3})\.(\d{1,3})$/.exec(String(address || '').trim())
  return !!m && (m[3] === '1' || m[3] === '254')
}

export function moreCatalogue(x, T, now = Date.now()) {
  const d = {}
  const s = realSession(x.session, x.clients)
  const c = x.config || null
  const rows = (id, icon, big, list) => ({ type: 'rows', icon, title: T[`c_${id}`], big, rows: list })
  const state = (on) => (on ? T.on : T.off)

  // pairing: the PIN is typed on the card, the QR code opens the pairing sheet; the latest client is the last of the host's list (the order it was paired in)
  const list = x.clients || null
  const latest = list && list.length ? list[list.length - 1] : null
  d.pair = list ? { type: 'pair', icon: 'person_add', title: T.c_pair, count: list.length, latest: latest ? { name: latest.name || '–', icon: latest.icon || 'devices' } : null, canPin: x.canAct !== false, qr: x.pairQr || null } : null
  d['stream-resolution'] = s && num(s.width) && num(s.height) ? rows('stream-resolution', 'aspect_ratio', `${s.width}×${s.height}`, [{ icon: 'slow_motion_video', title: T.target, value: num(s.fps) ? `${s.fps} ${T.fpsUnit || 'fps'}` : '' }].filter((r) => r.value)) : null
  d['stream-client'] = s && (s.client_name || s.client_address) ? { ...rows('stream-client', 'devices', '', [{ icon: 'cast_connected', title: s.client_name || (viaGateway(s.client_address) ? '' : s.client_address), value: s.client_name && !viaGateway(s.client_address) ? s.client_address || '' : '', tone: 'ok' }]), clientIcon: (x.clients || []).find((c) => c.name === s.client_name)?.icon || '' } : null
  // 帧率: the measured rate is the number and the recent history of the rate is the curve behind it (a rate has no natural full, so no ring); the target is the dashed line
  const fpsHistory = (x.series?.fps?.length ? x.series.fps : x.history?.samples?.fps || []).filter((v) => typeof v === 'number' && Number.isFinite(v))
  d['stream-fps'] = s && num(s.fps) ? { ...rows('stream-fps', 'slow_motion_video', num(s.fpsMeasured) !== null ? String(Math.round(s.fpsMeasured)) : '', [{ icon: 'check_circle', title: T.target, value: String(s.fps) }, ...(num(s.fpsMeasured) !== null ? [{ icon: 'speed', title: T.measured, value: String(Math.round(s.fpsMeasured)) }] : [])]), value: num(s.fpsMeasured) !== null ? String(Math.round(s.fpsMeasured)) : '', unit: T.fpsUnit || 'fps', caption: `${T.target} ${s.fps} ${T.fpsUnit || 'fps'}`, points: fpsHistory, target: s.fps } : null
  const cap = c && num(Number(c.max_bitrate)) ? Number(c.max_bitrate) : null
  const kbps = num(s?.measured_bitrate_kbps) ?? num(s?.bitrate) // the measured bitrate when the host reports it, else the budget (titled 目标码率)
  d['stream-bitrate'] = s && kbps !== null ? { ...rows('stream-bitrate', 'speed', `${(kbps / 1000).toFixed(1)} ${T.mbps}`, [{ icon: 'vertical_align_top', title: T.capLabel, value: cap ? `${cap / 1000} ${T.mbps}` : T.auto }]), points: num(s.measured_bitrate_kbps) !== null ? (x.history?.samples?.bitrate || []).map((v) => v / 1000) : [], unit: T.mbps, ...(num(s.measured_bitrate_kbps) !== null ? { title: T['c_stream-bitrate_measured'] } : {}) } : null
  d['stream-mic'] = s && s.enable_mic !== undefined ? { type: 'chips', icon: 'mic', title: T['c_stream-mic'], big: s.enable_mic ? T.on : T.off, tone: s.enable_mic ? 'ok' : '', chips: [] } : null
  d['stream-vdd'] = s && s.use_vdd !== undefined ? { type: 'chips', icon: 'desktop_windows', title: T['c_stream-vdd'], big: s.use_vdd ? T.on : T.off, tone: s.use_vdd ? 'ok' : '', chips: [] } : null
  d['act-stop'] = s && x.canAct !== false ? { type: 'action', icon: 'stop', title: T['c_act-stop'], label: T.stopAction, act: 'hero', client: s.client_name || '', uptimeMs: num(s.uptimeMs) } : null

  d['host-ports'] = c ? rows('host-ports', 'lan', String(c.port || 47989), [{ icon: 'router', title: 'UPnP', value: state(isOn('upnp', c.upnp)) }]) : null
  d['host-name'] = c && c.sunshine_name ? rows('host-name', 'dns', c.sunshine_name, [c.platform && { icon: 'computer', title: T.platform, value: platformName(c.platform) }].filter(Boolean)) : null
  const enc = (v, def) => ({ 0: T.encOff, 1: T.encOptional, 2: T.encRequired })[Number(v ?? def)] || T.encOff
  d['host-encryption'] = c ? rows('host-encryption', 'lock', '', [{ icon: 'lan', title: T.lan, value: enc(c.lan_encryption_mode, 0) }, { icon: 'public', title: T.wan, value: enc(c.wan_encryption_mode, 1) }]) : null
  d['host-adapter'] = c ? rows('host-adapter', 'memory', '', [{ icon: 'memory', title: T.gpuAdapter, value: c.adapter_name || T.auto }, { icon: 'tv', title: T.output, value: c.output_name || T.auto }]) : null

  const sw = (id, key, icon) => {
    if (!c || x.saveSetting === false || !(key in SWITCHES)) return null
    const m = SWITCHES[key]
    return { type: 'control', icon, title: T[`c_${id}`], key, kind: 'chips', value: String(isOn(key, c[key]) ? m.on : m.off), options: [{ value: String(m.on), label: T.on }, { value: String(m.off), label: T.off }] }
  }
  d['ctl-controller'] = sw('ctl-controller', 'controller', 'sports_esports')
  d['ctl-keyboard'] = sw('ctl-keyboard', 'keyboard', 'keyboard')
  d['ctl-mouse'] = sw('ctl-mouse', 'mouse', 'mouse')
  d['ctl-cursor'] = sw('ctl-cursor', 'capture_cursor', 'visibility')
  d['ctl-audio'] = sw('ctl-audio', 'stream_audio', 'volume_up')

  // the window's own appearance (foundation-ui): the card changes it directly
  d['pers-theme'] = { type: 'appearance', which: 'mode', icon: 'contrast', title: T['c_pers-theme'], options: [{ value: 'system', label: T.themeSystem }, { value: 'light', label: T.themeLight }, { value: 'dark', label: T.themeDark }] }
  d['pers-wallpaper'] = { type: 'appearance', which: 'source', icon: 'wallpaper', title: T['c_pers-wallpaper'], options: [{ value: 'auto', label: T.srcAuto }, { value: 'vivi1', label: T.srcVivi1 }, { value: 'vivi2', label: T.srcVivi2 }, { value: 'gradient', label: T.srcGradient }] }
  d['pers-colour'] = { type: 'appearance', which: 'preset', icon: 'palette', title: T['c_pers-colour'] }
  const hour = new Date(now).getHours()
  d.vivi = { type: 'vivi', icon: 'favorite', title: T.c_vivi, text: hour < 5 ? T.viviNight : hour < 11 ? T.viviMorning : hour < 18 ? T.viviDay : T.viviEvening, image: MASCOT[256] }
  const day = Math.floor(now / 86400000) % TIPS
  d.tip = T[`tip${day}`] ? { type: 'tip', icon: 'lightbulb', title: T.c_tip, text: T[`tip${day}`] } : null

  const action = (id, icon, act, value, label, more = {}) => ({ type: 'action', icon, title: T[`c_${id}`], label, act, value, ...more })
  d['act-settings'] = action('act-settings', 'tune', 'open', 'settings', T.openAction)
  d['act-diagnostics'] = action('act-diagnostics', 'bug_report', 'open', 'diagnostics', T.openAction)
  d['act-clients'] = action('act-clients', 'devices', 'open', 'clients', T.openAction, { count: list ? list.length : null, devices: (list || []).map((c) => ({ icon: c.icon || 'devices', tone: s && s.client_name === c.name ? 'ok' : '' })) })
  d['act-apps'] = action('act-apps', 'apps', 'open', 'apps', T.openAction, { count: x.apps ? x.apps.length : null })
  d['act-downloads'] = action('act-downloads', 'download', 'open', 'downloads', T.openAction)
  return d
}
