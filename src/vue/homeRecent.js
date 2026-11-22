// 最近操作 and the live controls of a running stream. Nothing here is invented: a tile is `null` while its source is not there.
//  recent-actions  the settings the person last used (src/settings/recent.js), each with the control the pin of that setting has (pins/registry.js: a switch, a few values, a slider) and, under
//                  its name, when a change applies (settings/applies.js, from the host audit). A setting with no such control, a risky one, or one whose value the host does not give, is a
//                  row that opens the setting's own page. The size says how many rows: 方形 one, 中 two, 大 four, 特大 eight in two columns, each with its whole control.
//  live-bitrate    the per-client bitrate command of the host (GET /api/runtime/bitrate?bitrate=&clientname=, localhost only). The host takes 1 to 800000 Kbps, then limits the value to the
//                  bitrate ceiling (max_bitrate, the value the host started with; 0 is no ceiling) and the session's bandwidth budget (stream.cpp change_dynamic_param_for_client). The reply
//                  repeats the number that was sent, so the control says the limit and does not claim the result. The control and the note say the same thing: with a ceiling the ceiling is the
//                  top, without one the slider reaches the 800 Mbps the host takes (the note lbUncapped says it), in 1 Mbps steps the keyboard and the mouse share.
//  live-audio      the host audio of the running client (POST /api/runtime/audio {clientname, enabled}, localhost only): one switch, the whole tile, that applies to the running stream
//  live-ds5        the DualSense tuning that acts on a running controller (POST /api/dualsense/tuning, schema ALK-DS5T/1): the common sliders the host applies, one per line.
import { getSearchIndex, settingsDataVersion } from '../settings/provider.js'
import { realSession } from './clientsLive.js'
import { labelOf } from '../settings/provider.js'
import { pinSpecForSetting } from '../pins/registry.js'
import { appliesOf, appliesText } from '../settings/applies.js'
import { DS5_CARDS } from '../settings/dualsense.js'
import { localizedKeyLabel } from '../settings/dualsenseLabels.js'

export const RECENT_META = {
  'recent-actions': ['control', 'off', 4, 'card', 'widget'],
  'live-bitrate': ['stream', 'off', 4, 'card', 'widget'],
  'live-audio': ['stream', 'off', 4, 'card', 'widget'],
  'live-ds5': ['control', 'off', 4, 'card', 'widget'],
}
export const RECENT_SIZES = {
  'recent-actions': { s: [2, 1], m: [4, 1], l: [4, 2], xl: [8, 2] },
  'live-bitrate': { m: [4, 1] },
  'live-audio': { s: [2, 1] },
  'live-ds5': { m: [4, 1], l: [4, 2] },
}
export const DEFAULT_RECENT_SIZES = { 'recent-actions': 'm', 'live-bitrate': 'm', 'live-audio': 's', 'live-ds5': 'm' }
/** How many rows each size shows. */
export const RECENT_ROWS = Object.freeze({ s: 1, m: 2, l: 4, xl: 8 })
/** The sizes that draw a row's whole control (a slider, a choice); the smaller ones draw the value and the way to the setting's page. */
export const FULL_CONTROL_SIZES = Object.freeze(['l', 'xl'])

let keyed = null
let keyedVersion = -1
/** The entries of the index by key, rebuilt when the product supplies new data. */
const byKey = () => { if (keyedVersion !== settingsDataVersion() || !keyed) { keyed = new Map(getSearchIndex().map((e) => [e.id, e])); keyedVersion = settingsDataVersion() } return keyed }
const truthy = (v) => v === true || /^(true|enabled|on|yes|1)$/i.test(String(v))

/** One row: the setting `key`, from the host's configuration. null when the key is not a setting of the index. */
export function recentRow(key, { config = null, platform = '', locale = 'en' } = {}) {
  const entry = byKey().get(key)
  if (!entry) return null
  const title = labelOf(locale, entry.title)
  const path = (entry.path || []).map((p) => labelOf(locale, p)).join(' › ')
  const spec = pinSpecForSetting(key, { title, icon: entry.icon, locale })
  const raw = config && key in config && config[key] !== '' && config[key] !== null ? config[key] : undefined
  const base = { key, title, path, options: spec?.options, icon: entry.icon || 'tune', applies: appliesOf(key, platform), appliesText: appliesText(key, platform, locale), valueText: raw === undefined ? '' : String(raw) }
  // the page's own control is drawn only where the value is known and the change is safe; otherwise the row opens the page
  if (!spec || spec.type === 'link' || spec.risk || (spec.control === 'switch' && raw === undefined && !config)) return { ...base, control: 'jump' }
  if (spec.control === 'switch') {
    const on = raw === undefined ? truthy(spec.def) : truthy(raw)
    return { ...base, control: 'switch', on, onValue: spec.on, offValue: spec.off }
  }
  if (spec.control === 'seg') return { ...base, control: 'seg', value: String(raw === undefined ? spec.def : raw), options: spec.options }
  const scale = spec.scale || 1
  const n = Number(raw)
  return { ...base, control: 'slider', value: Number.isFinite(n) ? n / scale : spec.def / scale, min: spec.min, max: spec.max, step: spec.step, unit: spec.unit, scale, zeroText: spec.zeroText }
}

/** The rows of the recent keys that are settings of the index (the newest first). */
export const recentRows = (keys, ctx) => (keys || []).map((k) => recentRow(k, ctx)).filter(Boolean)

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** The DualSense sliders the tile offers: common, wired by this host, in the order of the cards of the gamepad page. */
export function ds5Sliders(keys, locale = 'en') {
  const order = DS5_CARDS.flatMap((c) => c.keys)
  const list = (keys || []).filter((k) => k.implemented && k.tier === 'common' && k.control === 'slider' && num(k.min) !== null && num(k.max) > num(k.min) && num(k.value) !== null)
  return list.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)).slice(0, 3).map((k) => ({ key: k.key, label: localizedKeyLabel(k, locale), value: k.value, min: k.min, max: k.max, step: num(k.step) > 0 ? k.step : 0.01, default: k.default, note: k.note || '' }))
}

/** { id: data | null } for the three cards. x: { recent, config, session, canRuntime, ds5Keys }, T: the texts with __locale. */
export function recentCatalogue(x, T) {
  const locale = T.__locale || 'en'
  const platform = x.config?.platform || ''
  const d = { 'recent-actions': null, 'live-bitrate': null, 'live-audio': null, 'live-ds5': null }
  if (x.recent) d['recent-actions'] = { type: 'recent', icon: 'history', title: T['c_recent-actions'], empty: T.rcNone, rows: recentRows(x.recent, { config: x.config, platform, locale }) }
  const s = realSession(x.session, x.clients)
  if (s && s.client_name && x.canRuntime) {
    const cap = num(Number(x.config?.max_bitrate)) > 0 ? Number(x.config.max_bitrate) : 0
    const now = num(s.bitrate)
    d['live-bitrate'] = { type: 'live-bitrate', icon: 'speed', title: T['c_live-bitrate'], client: s.client_name, now: now === null ? null : Math.round(now / 1000), min: 1, max: cap ? Math.round(cap / 1000) : 800, cap: cap ? Math.round(cap / 1000) : 0, note: cap ? T.lbCapped.replace('{cap}', String(Math.round(cap / 1000))) : T.lbUncapped }
  }
  // the host audio of the running client: the field is there on a host that can switch it (a host without it leaves the tile out), the switch is the whole tile and acts on the stream that runs
  if (s && s.client_name && x.canRuntime && typeof s.host_audio === 'boolean') {
    d['live-audio'] = { type: 'control', icon: 'volume_up', title: T['c_live-audio'], key: 'host_audio', kind: 'chips', runtime: true, client: s.client_name, value: String(s.host_audio), options: [{ value: 'true', label: T.on }, { value: 'false', label: T.off }] }
  }
  const sliders = ds5Sliders(x.ds5Keys, locale)
  if (sliders.length && x.canRuntime !== false) d['live-ds5'] = { type: 'live-ds5', icon: 'sports_esports', title: T['c_live-ds5'], sliders, applies: T.dsLive, more: T.dsMore }
  return d
}

export const RECENT_TEXTS = Object.freeze({
  en: {
    'c_recent-actions': 'Recent actions', 's_recent-actions': 'The settings you used last', rcNone: 'No setting used yet', rcOpen: 'Open the setting', rcOpenSettings: 'Open settings',
    saveFailed: 'This setting was not saved', 'c_live-bitrate': 'Stream bitrate', 's_live-bitrate': 'The command of the host for a running client', lbNow: 'Now', lbSet: 'Set', lbCapped: 'Host limit: {cap} Mbps', lbUncapped: 'No host limit', lbApplies: 'Applies to the running stream', lbSent: 'Bitrate request sent to {client}', lbFailed: 'The host did not take the bitrate request', dsFailed: 'The host did not take the tuning',
    'c_live-audio': 'Host audio', 's_live-audio': 'Play the stream\'s audio on the host as well', 'c_live-ds5': 'DualSense tuning', 's_live-ds5': 'The common tuning of the host', dsLive: 'Applies while the controller is in use', dsMore: 'All tuning',
    rIdleActions: 'The settings you used last', rLiveBitrate: 'The bitrate of the running stream', rLiveDs5: 'DualSense tuning while a controller is in use', rLiveAudio: 'Host audio of the running stream',
  },
  zh: {
    'c_recent-actions': '最近操作', 's_recent-actions': '你最近用过的设置', rcNone: '还没有用过的设置', rcOpen: '打开设置', rcOpenSettings: '打开设置',
    saveFailed: '这项设置没有保存', 'c_live-bitrate': '本次目标码率', 's_live-bitrate': '主机对运行中客户端的码率命令', lbNow: '当前', lbSet: '设为', lbCapped: '主机上限 {cap} Mbps', lbUncapped: '主机不设上限', lbApplies: '对正在进行的串流生效', lbSent: '已向 {client} 发出码率请求', lbFailed: '主机没有接受码率请求', dsFailed: '主机没有接受这项调校',
    'c_live-audio': '主机播放音频', 's_live-audio': '主机同时播放串流的声音', 'c_live-ds5': 'DualSense 调校', 's_live-ds5': '主机的常用调校', dsLive: '手柄使用中实时生效', dsMore: '全部调校',
    rIdleActions: '你最近用过的设置', rLiveBitrate: '正在进行的串流的码率', rLiveDs5: '使用手柄时的 DualSense 调校', rLiveAudio: '正在进行的串流的主机音频',
  },
})
