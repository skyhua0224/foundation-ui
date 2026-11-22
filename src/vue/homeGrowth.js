// Tiles added to the catalogue for the larger windows (card tiles-catalog-growth-1116). Every one has a real source (a key of the host configuration, the reachability
// report) and is `null` while that source is not there: nothing is invented. The sources are listed in docs/home-tiles.md.
//  ports-check    GET /api/network/reachability `ports`: per port its role, whether the host listens, and what the firewall says (reachView().portRows).
//  file-maps      the configuration key `file_mappings` (base64 of a JSON list: name, path, mode, clients = client uuids) and `file_mapping_port`; the names come from the paired client list.
//  encode-budget  the configuration key `active_nvenc_frame_budget` (the host's own estimate of the encode time of the running or last session against the frame time).
//  web-access     the configuration key `origin_web_ui_allowed` (pc, lan or wan), saved through the one saving path; a change that locks the person out or opens the page to the internet is confirmed first.
import { reachView } from '../settings/reachability.js'

export const GROWTH_META = {
  'ports-check': ['host', 'off', 2, 'card', 'widget'],
  'file-maps': ['host', 'off', 2, 'card', 'widget'],
  'encode-budget': ['stream', 'off', 2, 'card', 'widget'],
  'web-access': ['control', 'off', 2, 'card', 'widget'],
}
export const GROWTH_SIZES = {
  'ports-check': { s: [2, 1], m: [4, 1], l: [4, 2] },
  'file-maps': { s: [2, 1], m: [4, 1], l: [4, 2] },
  'encode-budget': { s: [2, 1], m: [4, 1], l: [4, 2] },
  'web-access': { s: [2, 1], m: [4, 1] },
}

const num = (v) => { const n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) ? n : null }

/** The list of file mappings the host keeps in `file_mappings` ('base64:' + JSON). [] when the key is not set or cannot be read. */
export function parseFileMappings(raw) {
  if (typeof raw !== 'string' || !raw) return []
  try {
    const text = raw.startsWith('base64:') ? (typeof atob === 'function' ? decodeURIComponent(escape(atob(raw.slice(7)))) : Buffer.from(raw.slice(7), 'base64').toString('utf8')) : raw
    const list = JSON.parse(text)
    return Array.isArray(list) ? list.filter((m) => m && typeof m === 'object') : []
  } catch { return [] }
}
/** The last two segments of a path: the folder's own name, never the whole path of the person's disk. */
export const shortPath = (p) => String(p || '').replace(/[\\/]+$/, '').split(/[\\/]+/).filter(Boolean).slice(-2).join('/')

/**
 * The ports of the report as a count: how many are reachable (listening, or opened by the host when a session starts, and the firewall says allowed).
 * A port whose firewall state the host could not read (`unknown`) is counted on its own (`unknown`): it is not known to be reachable, so it is not in `ok`, and it is not blocked either.
 */
export function portsSummary(rows) {
  const live = (r) => r.state === 'listening' || r.state === 'on-session'
  const ok = (r) => r.firewall === 'allowed' && live(r)
  const unknown = (r) => r.firewall === 'unknown' && live(r)
  const tcp = rows.filter((r) => r.proto === 'TCP'), udp = rows.filter((r) => r.proto === 'UDP')
  return { total: rows.length, ok: rows.filter(ok).length, unknown: rows.filter(unknown).length, blocked: rows.filter((r) => r.firewall === 'blocked').length, closed: rows.filter((r) => r.state === 'closed').length, tcpUp: tcp.filter((r) => r.state === 'listening').length, tcp: tcp.length, udpReady: udp.filter(ok).length, udp: udp.length, rows: rows.map((r) => ({ ...r, ok: ok(r), unknownFw: unknown(r) })) }
}

/** The names of the paired clients a mapping is open to: `ids` are client uuids (the host's `clients` list of a mapping), `paired` the paired client list. Each client counts once (by uuid, two clients with the same name are two entries); a uuid that is not paired any more counts as one unnamed client. */
export function mappingClients(ids, paired) {
  const list = [...new Set((Array.isArray(ids) ? ids : []).filter((v) => typeof v === 'string' && v).map((v) => v.toLowerCase()))]
  const byId = new Map((Array.isArray(paired) ? paired : []).filter((c) => c && c.uuid).map((c) => [String(c.uuid).toLowerCase(), c.name ? String(c.name) : '']))
  const names = []
  let unnamed = 0
  for (const id of list) { const n = byId.get(id); if (n) names.push(n); else unnamed += 1 }
  return { total: list.length, names, unnamed }
}

const WEB_OPTIONS = ['pc', 'lan', 'wan']

export function growthCatalogue(x, T) {
  const d = { 'ports-check': null, 'file-maps': null, 'encode-budget': null, 'web-access': null }
  const locale = T.__locale || 'en'
  const c = x.config || null

  const view = x.reach ? reachView(x.reach, locale) : null
  if (view && view.portRows.length) d['ports-check'] = { type: 'ports-check', icon: 'lan', title: T['c_ports-check'], ...portsSummary(view.portRows) }

  if (c && typeof c.file_mappings === 'string') {
    const list = parseFileMappings(c.file_mappings)
    d['file-maps'] = { type: 'file-maps', icon: 'folder_shared', title: T['c_file-maps'], count: list.length, port: num(c.file_mapping_port), rows: list.map((m) => ({ id: String(m.id || m.name || ''), name: String(m.name || shortPath(m.path) || '–'), path: shortPath(m.path), mode: String(m.mode || ''), clients: Array.isArray(m.clients) ? m.clients.length : 0, who: mappingClients(m.clients, x.clients) })) }
  }

  const b = c?.active_nvenc_frame_budget
  if (b && num(b.budget_ms) > 0 && num(b.estimated_ms) !== null) {
    const preset = num(b.configured_preset), eff = num(b.effective_preset)
    d['encode-budget'] = { type: 'encode-budget', icon: 'memory', title: T['c_encode-budget'], budgetMs: num(b.budget_ms), estimatedMs: num(b.estimated_ms), ratio: Math.min(1.2, num(b.estimated_ms) / num(b.budget_ms)), clamped: b.clamped === true || b.clamped === 'true', preset, effective: eff, engines: num(b.num_engines), width: num(b.width), height: num(b.height), fps: num(b.fps) }
  }

  if (c && x.saveSetting !== false && typeof c.origin_web_ui_allowed === 'string' && WEB_OPTIONS.includes(c.origin_web_ui_allowed)) {
    d['web-access'] = { type: 'web-access', icon: 'shield', title: T['c_web-access'], key: 'origin_web_ui_allowed', value: c.origin_web_ui_allowed, options: WEB_OPTIONS.map((v) => ({ value: v, label: T[`wa_${v}`], icon: { pc: 'computer', lan: 'lan', wan: 'public' }[v] })), confirm: { pc: { title: T.waConfirmPcTitle, body: T.waConfirmPc }, wan: { title: T.waConfirmWanTitle, body: T.waConfirmWan }, cancel: T.cancel, change: T.waChange } }
  }
  return d
}

export const GROWTH_TEXTS = Object.freeze({
  en: {
    'c_ports-check': 'Ports', 's_ports-check': 'The host\'s own port check', pcUp: 'Listening', pcSession: 'Open in a session', pcBlocked: 'Blocked by the firewall', pcUnknown: 'Firewall state unknown', pcUnknownShort: 'state unknown', pcClosed: 'Not listening', pcAll: 'All reachable', pcOf: 'of', pcTcp: 'TCP', pcUdp: 'UDP', pcFirewall: 'Firewall',
    'c_file-maps': 'File mappings', 's_file-maps': 'Folders the host shares with clients', fmCount: 'shared', fmNone: 'No folder shared', fmRead: 'Read only', fmWrite: 'Read and write', fmAll: 'All clients', fmClients: 'clients', fmPort: 'Port', fmMore: '{n} more', fmSep: ', ',
    'c_encode-budget': 'Encode budget', 's_encode-budget': 'The host\'s estimate of the encode time against the frame time', ebFrame: 'Frame', ebPreset: 'Preset', ebEngines: 'Engines', ebLowered: 'Lowered to hold the frame rate', ebStream: 'Stream',
    'c_web-access': 'Web page access', 's_web-access': 'Who can open the host\'s web page', wa_pc: 'This PC', wa_lan: 'Home network', wa_wan: 'Internet',
    waConfirmPcTitle: 'Only this PC?', waConfirmPc: 'Other devices, including this one if you are not at the host, can no longer open the web page.', waConfirmWanTitle: 'Open it to the internet?', waConfirmWan: 'Anyone who can reach the host can try to sign in. Use a strong password.', waChange: 'Change', cancel: 'Cancel',
  },
  zh: {
    'c_ports-check': '端口', 's_ports-check': '主机自己的端口自检', pcUp: '正在监听', pcSession: '串流时开启', pcBlocked: '被防火墙拦住', pcUnknown: '防火墙状态未知', pcUnknownShort: '状态未知', pcClosed: '没有监听', pcAll: '全部可达', pcOf: '/', pcTcp: 'TCP', pcUdp: 'UDP', pcFirewall: '防火墙',
    'c_file-maps': '文件映射', 's_file-maps': '主机共享给客户端的文件夹', fmCount: '个共享', fmNone: '没有共享的文件夹', fmRead: '只读', fmWrite: '可读写', fmAll: '所有客户端', fmClients: '台客户端', fmPort: '端口', fmMore: '还有 {n} 个', fmSep: '、',
    'c_encode-budget': '编码预算', 's_encode-budget': '主机估算的编码时间与帧时间', ebFrame: '帧时间', ebPreset: '预设', ebEngines: '编码引擎', ebLowered: '已自动降档以守住帧率', ebStream: '串流',
    'c_web-access': '网页访问范围', 's_web-access': '谁能打开主机的网页', wa_pc: '仅本机', wa_lan: '局域网', wa_wan: '公网',
    waConfirmPcTitle: '只允许本机？', waConfirmPc: '其他设备都打不开网页了，不在主机前的话，这台也一样。', waConfirmWanTitle: '向公网开放？', waConfirmWan: '任何能连到主机的人都可以尝试登录，请使用强密码。', waChange: '更改', cancel: '取消',
  },
})
