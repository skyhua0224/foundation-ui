// Builds the model of MHomeDash from normalised host data. Both products pass the same input shape (see docs/home-dashboard.md), so the
// home differs between them only in where the data comes from. Nothing is invented: a field without data leaves its card out or empty.

import { EDIT_TEXTS, editTexts } from './homeEditTexts.js'
import { codecName, encoderName } from '../settings/model.js'
import { CATALOGUE_TEXTS, catalogueTexts } from './homeCatalogueTexts.js'
import { withStreaming, realSession } from './clientsLive.js'

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const GB = 1024 ** 3
const gb = (v) => (v / GB).toFixed(v / GB >= 10 ? 0 : 1)

export const DEFAULT_TEXTS = {
  overview: 'Overview', running: 'Running', streaming: 'Streaming', stopped: 'Stopped',
  uptime: 'Uptime', client: 'Client', paired: 'Paired', stop: 'End session', restart: 'Restart host',
  bitrate: 'Bitrate', bitrateTarget: 'Target bitrate', fps: 'Frame rate', cpu: 'CPU', gpu: 'GPU', peak: 'Peak', mbps: 'Mbps', fpsUnit: 'fps', percent: '%',
  encoder: 'Encoder', display: 'Display', memory: 'Memory', gamepad: 'Gamepad', mic: 'Microphone',
  used: 'Used', free: 'Free', other: 'Other apps', host: 'This host', total: 'Total',
  clients: 'Paired clients', sessions: 'Recent sessions', errors: 'Error log', apps: 'Applications',
  name: 'Name', status: 'Status', time: 'Time', level: 'Level', message: 'Message', app: 'Application', length: 'Length',
  enabled: 'Allowed', blocked: 'Blocked', streamingNow: 'Streaming', addClient: 'Pair a client', addApp: 'Add an application',
  emptyStart: 'Start streaming', emptyPair: 'Pair a device', emptyAddress: 'Set up remote access', emptyNews: 'Open announcements', noClients: 'No paired clients yet', latestClient: 'Latest: {name}', noSessions: 'No sessions in the log yet', noErrors: 'No errors in the log', target: 'Target', usb: 'USB', usbDevices: 'devices attached', usbNone: 'No devices attached', deviceNone: 'None', deviceOff: 'Not ready', p95: 'Latency P95', lastLatency: 'Latest latency', capture: 'Capture', sessionTime: 'Streaming for', vddActive: 'Active', vddIdle: 'Idle', vddMissing: 'Not installed', vddFollows: 'Follows', vddAuto: 'The size follows the client', vddPreset: 'preset maximum', devices: 'Devices', sponsorTitle: 'Sponsor', srcDisplay: 'Only where there is no Foundation Virtual Display', srcGamepadType: 'Applies to the next controller', gGroup_host: 'Host', gGroup_stream: 'Streaming', gGroup_perf: 'Performance', gGroup_device: 'Devices', gGroup_control: 'Controls', all: 'All', sizeSmall: 'Small', sizeMedium: 'Medium', sizeLarge: 'Large', dragOut: 'Drag onto the page, or click to add', gGroup_start: 'Getting started', gGroup_resources: 'Resources', defOn: 'On by default', defOff: 'Off by default', defOff: 'Off by default', defLive: 'On by default while streaming', defIdle: 'On by default while idle', defNew: 'On by default for a new setup', defNotNew: 'On by default after setup', addCard: 'Add card', catalogue: 'Cards', catalogueAll: 'All cards', unavailable: 'No data source here', dragHint: 'Drag to reorder', removeCard: 'Remove', moveCard: 'Move', picked: 'picked up', droppedAt: 'dropped at position', cancelled: 'move cancelled', skip: 'Skip', stepGo: 'Do it now', progress: 'of', phone: 'Phone', tablet: 'Tablet', computer: 'Computer', tv: 'TV', download: 'Download', recommended: 'Recommended', partner: 'Partner', star: 'Star', sponsorAction: 'Sponsor', stepDownloadGo: 'Download a client', stepPairGo: 'Pair a client', stepQualityGo: 'Show me how', stepConnectGo: 'Start a stream', stepGameGo: 'Add a game', vdd: 'Foundation Virtual Display', codecAuto: 'auto', codecOff: 'off', codecOn: 'on', codecHdr: 'on, HDR', budget: 'Frame budget used', latencyShort: 'Host latency', guideTitle: 'Get started', guideSub: 'Five steps to your first stream', guideContinue: 'Guided setup', guideDismiss: 'Hide', stepDownload: 'Download a client', stepDownloadSub: 'On your phone, tablet or another computer', stepPair: 'Add this computer and pair', stepPairSub: 'Enter the PIN the client shows', stepQuality: 'Set the first picture quality', stepQualitySub: 'In the client: 1080p, 60 fps, 20 Mbps', stepConnect: 'Connect to the desktop', stepConnectSub: 'Check picture, mouse and sound', stepGame: 'Add a game', stepGameSub: 'Scan or add one by hand', downloadTitle: 'Download clients', pWindows: 'Windows', pMacos: 'macOS', pLinux: 'Linux', pAndroid: 'Android', pIos: 'iOS / iPadOS', pHarmony: 'HarmonyOS', pTv: 'TV', recAndroid: 'Android / Android TV', recMac: 'macOS', recIos: 'iPhone, iPad, Apple TV', annTitle: 'Announcements', annOpen: 'Open', annDismiss: 'Dismiss', annAll: 'All announcements', annRead: 'Read', annNone: 'No announcements', noApps: 'No applications yet',
  hdrOn: 'HDR on', hdrOff: 'HDR off', refresh: 'Hz', onlyDuringStream: 'Shown while streaming', idleCaption: 'Last 3 minutes', streamCaption: 'Live',
  gpuName: 'Graphics card', loss: 'Packet loss', dropped: 'dropped frames', latency: 'Host latency', ms: 'ms', last60: '3 min', last10: '10 min',
  micOn: 'Streaming', micReady: 'Ready', micOff: 'Off', notReported: 'Not reported by this host',
}

export const TEXTS_ZH = {
  overview: '概览', running: '运行中', streaming: '串流中', stopped: '已停止',
  uptime: '已运行', client: '当前客户端', paired: '已配对', stop: '结束串流', restart: '重启主机',
  bitrate: '码率', bitrateTarget: '目标码率', fps: '帧率', cpu: 'CPU', gpu: 'GPU', peak: '峰值', mbps: 'Mbps', fpsUnit: 'fps', percent: '%',
  encoder: '编码器', display: '显示器', memory: '内存', gamepad: '手柄', mic: '麦克风',
  used: '已用', free: '可用', other: '其他程序', host: '本主机', total: '总计',
  clients: '已配对客户端', sessions: '最近会话', errors: '错误日志', apps: '应用',
  name: '名称', status: '状态', time: '时间', level: '级别', message: '内容', app: '应用', length: '时长',
  enabled: '允许连接', blocked: '已禁用', streamingNow: '串流中', addClient: '配对客户端', addApp: '添加新应用',
  emptyStart: '开始串流', emptyPair: '配对设备', emptyAddress: '设置公网访问', emptyNews: '查看公告', noClients: '还没有配对的客户端', latestClient: '最近：{name}', noSessions: '日志里还没有会话记录', noErrors: '日志里没有错误', sessionTime: '串流时长', vddActive: '已启用', vddIdle: '空闲', vddMissing: '未安装', vddFollows: '跟随', vddAuto: '分辨率跟随客户端', vddPreset: '预设上限', devices: '设备', sponsorTitle: '赞助', srcDisplay: '仅在没有基地虚拟显示器时显示', srcGamepadType: '下一次创建手柄时生效', gGroup_host: '主机', gGroup_stream: '串流', gGroup_perf: '性能', gGroup_device: '设备', gGroup_control: '控制', all: '全部', sizeSmall: '小', sizeMedium: '中', sizeLarge: '大', dragOut: '拖到页面上，或点一下添加', gGroup_start: '入门', gGroup_resources: '资源', defOn: '默认显示',  defOff: '默认不显示', defOff: '默认隐藏', defLive: '串流时默认显示', defIdle: '空闲时默认显示', defNew: '新设置时默认显示', defNotNew: '完成设置后默认显示', addCard: '添加卡片', catalogue: '卡片', catalogueAll: '全部卡片', unavailable: '此处没有数据来源', dragHint: '拖动以排序', removeCard: '移除', moveCard: '移动', picked: '已拿起', droppedAt: '已放到第', cancelled: '已取消移动', skip: '跳过', stepGo: '现在去做', progress: '/', phone: '手机', tablet: '平板', computer: '电脑', tv: '电视', download: '下载', recommended: '官方推荐', partner: '合作', star: 'Star', sponsorAction: '赞助', stepDownloadGo: '下载客户端', stepPairGo: '配对客户端', stepQualityGo: '看怎么设置', stepConnectGo: '开始串流', stepGameGo: '添加游戏', vdd: '基地虚拟显示器', codecAuto: '自动', codecOff: '关闭', codecOn: '开启', codecHdr: '开启，含 HDR', budget: '帧时间占用', latencyShort: '主机延迟', usb: 'USB', usbDevices: '台设备已连接', usbNone: '没有已连接的设备', deviceNone: '无', deviceOff: '未就绪', p95: '延迟 P95', lastLatency: '最近一次延迟', capture: '捕获方式', guideTitle: '开始使用', guideSub: '五步完成第一次串流', guideContinue: '开始设置向导', guideDismiss: '隐藏', stepDownload: '下载客户端', stepDownloadSub: '装在手机、平板或另一台电脑上', stepPair: '添加电脑并配对', stepPairSub: '输入客户端显示的 PIN', stepQuality: '设置首次画质', stepQualitySub: '在客户端里选 1080p、60 帧、20 Mbps', stepConnect: '连接桌面', stepConnectSub: '检查画面、鼠标和声音', stepGame: '添加游戏', stepGameSub: '扫描，或手动添加', downloadTitle: '下载客户端', pWindows: 'Windows', pMacos: 'macOS', pLinux: 'Linux', pAndroid: 'Android', pIos: 'iOS / iPadOS', pHarmony: '鸿蒙', pTv: '电视', recAndroid: 'Android / Android TV', recMac: 'macOS', recIos: 'iPhone、iPad、Apple TV', annTitle: '公告', annOpen: '查看', annDismiss: '忽略', annAll: '全部公告', annRead: '已读', annNone: '没有公告', noApps: '还没有应用',
  hdrOn: 'HDR 开', hdrOff: 'HDR 关', refresh: 'Hz', onlyDuringStream: '串流时显示', idleCaption: '最近 3 分钟', streamCaption: '实时',
  gpuName: '显卡', loss: '丢包率', dropped: '丢帧', latency: '主机延迟', ms: 'ms', last60: '3 分钟', last10: '10 分钟',
  micOn: '串流中', micReady: '已就绪', micOff: '关闭', notReported: '此主机未提供', target: '目标',
}

export const homeTexts = (locale = 'en') => {
  const edit = editTexts(locale)
  const cat = catalogueTexts(locale)
  if (/^zh/i.test(String(locale))) return { ...DEFAULT_TEXTS, ...EDIT_TEXTS.en, ...CATALOGUE_TEXTS.en, ...TEXTS_ZH, ...EDIT_TEXTS.zh, ...CATALOGUE_TEXTS.zh, ...edit, ...cat, __locale: locale }
  return { ...DEFAULT_TEXTS, ...EDIT_TEXTS.en, ...CATALOGUE_TEXTS.en, ...edit, ...cat, __locale: locale }
}

export function buildHomeModel(input, texts = {}) {
  const T = { ...DEFAULT_TEXTS, ...texts }
  const { host = {}, session: sessionIn = null, series = {}, sys = null, encoder: encoderId = '', display = null, pads = null, mic = null, clients: clientsIn = null, apps = null, logs = null, strip = null, recent = null, busy = false } = input
  const session = realSession(sessionIn, clientsIn)
  const clients = withStreaming(clientsIn, session) // who streams is read from the session the host runs, as the 当前在线 tile does
  const encoder = encoderName(encoderId) // a host reports its internal name (nvenc)
  const live = !!session
  // `measured_bitrate_kbps` (host: the bytes the stream really sent over a sliding window) is the bitrate when the host reports it; `bitrate` is the session's budget, which an older host reports alone
  const measuredKbps = num(session?.measured_bitrate_kbps)
  const bitrate = measuredKbps !== null ? measuredKbps / 1000 : num(session?.bitrate) !== null ? session.bitrate / 1000 : null

  const hero = {
    heading: T.host,
    icon: 'dns',
    statusLabel: live ? T.streaming : host.running === false ? T.stopped : T.running,
    statusTone: live ? 'live' : host.running === false ? 'off' : 'ok',
    // the session's running time while streaming (h:mm:ss), for a hero that shows it as its numeral
    clock: live && num(session.uptimeMs) !== null ? formatClock(session.uptimeMs) : '',
    title: host.name || 'Sunshine',
    // one hero for both products: at most three chips; version, platform, codec and microphone live in the cards and sheets that own them
    chips: [encoder && { label: encoder, icon: 'videocam' }, (session?.enable_hdr || display?.hdr) && { label: 'HDR', icon: 'hdr_on' }, host.update && { label: host.update, icon: 'update' }].filter(Boolean),
    pairs: live
      ? [{ label: T.client, value: `${session.client_name || '–'}${input.sessionCount > 1 ? ` +${input.sessionCount - 1}` : ''}` }, session.app_name ? { label: T.app, value: session.app_name } : { label: T.sessionTime, value: num(session.uptimeMs) !== null ? formatClock(session.uptimeMs) : '–' }]
      : [host.uptimeMs ? { label: T.uptime, value: formatDuration(host.uptimeMs) } : null, clients ? { label: T.paired, value: String(clients.length) } : null].filter(Boolean),
    action: input.canAct === false ? null : { icon: live ? 'stop' : 'restart_alt', kind: live ? 'stop' : 'restart', label: live ? T.stop : T.restart, busy },
  }

  const curves = []
  if (live) {
    const kb = (series.bitrate || []).map((v) => v / 1000)
    // `bitrate` of /api/runtime/sessions (`bitrate_kbps` of /api/perf/current) is the session's configured budget, not a measurement (host audit api-exposure-20261107, 5). With `measured_bitrate_kbps` the tile
    // is the real bitrate: a line, the lowest / mean / highest of what was sent. Without it (an older host) the tile says 目标码率 and draws no line, so the budget is not read as a measurement.
    const bitrateCurve = curve('bitrate', measuredKbps !== null ? T.bitrate : T.bitrateTarget, 'speed', kb, bitrate, T.mbps, session.client_name ? `${session.width}×${session.height}` : '', T.streamCaption, 1)
    if (measuredKbps === null) Object.assign(bitrateCurve, { points: [], peak: '', configured: true })
    // what the session asked for, next to what is measured (the hero's band says 码率 22.6 over 目标 113 Mbps)
    else if (num(session.bitrate) !== null) bitrateCurve.target = String(Math.round(session.bitrate / 1000))
    curves.push(bitrateCurve)
    const fpsNow = num(session.fpsMeasured) ?? num(session.fps)
    const fpsCurve = curve('fps', T.fps, 'videocam', series.fps || [], fpsNow, T.fpsUnit, session.fps ? `${T.target} ${session.fps} ${T.fpsUnit}` : '', T.streamCaption, 0)
    if (num(session.fps) !== null) fpsCurve.target = String(Math.round(session.fps))
    curves.push(fpsCurve)
  } else {
    if (sys && num(sys.cpu) !== null) curves.push(curve('cpu', T.cpu, 'memory', series.cpu || [], sys.cpu, '%', '', T.idleCaption, 0, 100))
    if (sys && num(sys.gpu) !== null) curves.push(curve('gpu', T.gpu, 'developer_board', series.gpu || [], sys.gpu, '%', sys.gpuName || '', T.idleCaption, 0, 100))
  }

  const info = []
  if (encoder || session?.codec) {
    const budget = live && num(session.latencyMs) !== null && num(session.fps) ? Math.min(1, session.latencyMs / (1000 / session.fps)) : null
    info.push({
      id: 'encoder', title: T.encoder, icon: 'videocam', value: encoder || codecName(session.codec), unit: '',
      sub: live ? [session.codec && codecName(session.codec), bitrate !== null ? `${bitrate.toFixed(bitrate >= 10 ? 0 : 1)} Mbps` : ''].filter(Boolean).join(' · ') : '',
      chips: live ? [] : codecChips(input.codecModes, T),
      ring: budget !== null ? { value: budget, label: `${Math.round(budget * 100)}%`, caption: T.budget } : null,
      spark: live && (series.latency || []).length > 1 ? series.latency : null,
    })
  }
  if ((session?.width && session?.height) || (display?.width && display?.height)) {
    const w = session?.width || display?.width
    const h = session?.height || display?.height
    const hz = session?.fps || display?.hz
    info.push({ id: 'display', title: T.display, icon: 'monitor', value: `${h}p`, unit: hz ? `${hz} ${T.refresh}` : '', sub: `${w}×${h}`, screen: { w, h, hdr: !!(session?.enable_hdr ?? display?.hdr) }, chips: [(session?.enable_hdr ?? display?.hdr) !== undefined && { label: display?.hdrText && !session ? display.hdrText : (session?.enable_hdr ?? display?.hdr) ? T.hdrOn : T.hdrOff, tone: (session?.enable_hdr ?? display?.hdr) ? 'ok' : '' }, display?.nits && !session && { label: `${Math.round(display.nits)} nits`, icon: 'light_mode' }, display?.vddText && { label: `${T.vdd}: ${display.vddText}`, icon: 'desktop_windows', tone: display.vddTone || '' }].filter(Boolean) })
  }
  if (sys && sys.memTotal) {
    const used = sys.memTotal - (sys.memAvail || 0)
    const pct = Math.round((used / sys.memTotal) * 100)
    const own = num(sys.memProcess)
    const frac = (v) => v / sys.memTotal
    const segs = own !== null && own < used ? [{ label: T.host, text: `${gb(own)} GB`, value: frac(own), tone: 'a' }, { label: T.other, text: `${gb(used - own)} GB`, value: frac(used - own), tone: 'b' }, { label: T.free, text: `${gb(sys.memAvail)} GB`, value: frac(sys.memAvail), tone: 'free' }] : [{ label: T.used, text: `${gb(used)} GB`, value: frac(used), tone: 'a' }, { label: T.free, text: `${gb(sys.memAvail)} GB`, value: frac(sys.memAvail), tone: 'free' }]
    info.push({ id: 'memory', title: T.memory, icon: 'storage', value: String(pct), unit: `% · ${gb(sys.memTotal)} GB`, bar: { segments: segs } })
  }
  if (pads || mic || (input.usb !== undefined && input.usb !== null)) {
    // three tiles in a row: the icon, one word of status, a green dot while the device is ready (no second line of text)
    const tiles = []
    if (pads) tiles.push({ icon: 'sports_esports', label: pads.title || T.gamepad, word: pads.word || pads.text || T.deviceOff, ready: pads.ready === true, to: 'gamepad' })
    if (mic) tiles.push({ icon: 'mic', label: T.mic, word: mic.word || mic.text, ready: mic.ready === true, to: 'microphone' })
    if (input.usb !== undefined && input.usb !== null) tiles.push({ icon: 'usb', label: T.usb, word: input.usb ? String(input.usb) : T.deviceNone, ready: input.usb > 0, to: 'usb' })
    info.push({ id: 'devices', title: [pads && T.gamepad, mic && T.mic, input.usb !== undefined && input.usb !== null && T.usb].filter(Boolean).join(' · '), icon: 'sports_esports', tiles })
  }

  const vddIn = input.vdd
  let vddCard = null
  if (vddIn && vddIn.state) {
    const w = session?.width || vddIn.width, h = session?.height || vddIn.height, hz = session?.fps || vddIn.hz
    const hdr = session ? !!session.enable_hdr : vddIn.hdr
    vddCard = {
      id: 'vdd', title: T.vdd, icon: 'desktop_windows', to: 'vdd', state: vddIn.state, tone: vddIn.tone || (vddIn.state === 'ready' ? 'ok' : vddIn.state === 'missing' ? 'warn' : ''),
      stateLabel: vddIn.text || (vddIn.state === 'ready' ? T.vddActive : vddIn.state === 'missing' ? T.vddMissing : T.vddIdle),
      value: w && h ? `${h}p` : '', unit: hz ? `${hz} ${T.refresh}` : '', sub: w && h ? `${w}×${h}${session ? '' : ` · ${T.vddPreset}`}` : vddIn.state === 'ready' ? T.vddAuto : '',
      chips: [hdr !== undefined && hdr !== null && { label: hdr ? T.hdrOn : T.hdrOff, tone: hdr ? 'ok' : '' }, (session?.client_name || vddIn.client) && { label: `${T.vddFollows}: ${session?.client_name || vddIn.client}`, icon: 'devices' }].filter(Boolean),
      screen: null, // no drawn display on this card: type and chips say it
    }
  }

  const tabs = []
  if (clients) tabs.push({
    id: 'clients', label: T.clients, count: clients.length,
    columns: [{ key: 'name', label: T.name, width: '1.6fr', avatar: true, strong: true }, { key: 'state', label: T.status, width: '1fr' }],
    rows: clients.map((c) => ({ id: c.uuid || c.name, uuid: c.uuid || '', icon: c.icon || 'devices', cells: { name: c.name || '–', state: c.streaming ? T.streamingNow : c.enabled === false ? T.blocked : T.enabled }, tones: { state: c.streaming ? 'ok' : c.enabled === false ? 'warn' : '' } })),
    empty: T.noClients,
  })
  if (recent) tabs.push({
    id: 'sessions', label: T.sessions, count: recent.length,
    columns: [{ key: 'time', label: T.time, width: '1.4fr', strong: true }, { key: 'text', label: T.status, width: '1fr' }, { key: 'length', label: T.length, width: '.8fr' }],
    rows: recent.map((r, i) => ({ id: `${r.time}-${i}`, icon: r.live ? 'cast_connected' : 'history', cells: { time: r.time, text: r.live ? T.streamingNow : T.stopped, length: r.length || '' }, tones: { text: r.live ? 'ok' : '' } })),
    empty: T.noSessions,
  })
  if (logs) tabs.push({
    id: 'errors', label: T.errors, count: (logs.errors || 0),
    columns: [{ key: 'time', label: T.time, width: '1.2fr' }, { key: 'level', label: T.level, width: '.6fr' }, { key: 'text', label: T.message, width: '3fr' }],
    rows: (logs.rows || []).map((r, i) => ({ id: `${r.time}-${i}`, icon: r.level === 'Warning' ? 'warning' : 'error', cells: { time: r.time, level: r.level, text: r.text }, tones: { level: r.level === 'Warning' ? 'warn' : 'err' } })),
    empty: T.noErrors,
  })

  return {
    hero, curves, strip, info, vdd: vddCard,
    table: tabs.length ? { title: T.clients, tabs, action: input.pairAction === false ? null : { icon: 'person_add', label: T.addClient } } : null,
    apps: apps ? { title: T.apps, addLabel: T.addApp, count: apps.length, items: apps.slice(0, 12).map((a) => ({ id: a.id ?? a.name, title: a.name, letter: String(a.name || '?').trim().charAt(0).toUpperCase(), cover: a.cover || '' })), empty: T.noApps } : null,
    details: buildDetails({ T, live, session, series, sys, info, curves, display, encoder }),
  }
}

function displayChips(display, T) {
  if (!display) return []
  return [
    display.hdrText && { label: display.hdrText, icon: 'hdr_on' },
    display.nits && { label: `${Math.round(display.nits)} nits`, icon: 'light_mode' },
    display.vddText && { label: `${T.vdd}: ${display.vddText}`, icon: 'desktop_windows' },
  ].filter(Boolean)
}

/** The codecs the host is set to advertise, from its settings (`hevc_mode`, `av1_mode`: 0 automatic, 1 off, 2 on, 3 on with HDR). H.264 is always there. */
export function codecChips(modes, T = DEFAULT_TEXTS) {
  if (!modes) return []
  const word = (m) => [T.codecAuto, T.codecOff, T.codecOn, T.codecHdr][Number(m)]
  const chips = [{ label: 'H.264', tone: 'ok' }]
  for (const [name, m] of [['HEVC', modes.hevc], ['AV1', modes.av1]]) {
    const w = word(m)
    if (w) chips.push({ label: `${name} · ${w}`, tone: Number(m) === 1 ? '' : 'ok' })
  }
  return chips
}

function curve(id, title, icon, points, value, unit, caption, captionFallback, decimals, max) {
  const pts = (points || []).filter((v) => Number.isFinite(v))
  const peak = pts.length ? Math.max(...pts) : null
  return {
    id, title, icon, points: pts, max,
    peak: peak !== null ? `${peak.toFixed(decimals)}` : '',
    value: value === null || value === undefined ? '' : Number(value).toFixed(decimals), unit,
    caption: caption || captionFallback || '',
  }
}

function buildDetails({ T, live, session, series, sys, info, curves, encoder }) {
  const out = {}
  const ranges = [{ value: 60, label: T.last60 }]
  for (const c of curves) out[c.id] = { title: c.title, sections: [{ type: 'chart', points: c.points, unit: c.unit === '%' ? '%' : c.unit, decimals: c.id === 'bitrate' ? 1 : 0, ranges, step: 3 }] }
  const memory = info.find((i) => i.id === 'memory')
  if (memory) out.memory = { title: memory.title, sections: [{ type: 'donut', title: memory.title, centre: `${memory.value}%`, caption: memory.unit.replace(/^%\s·\s/, ''), segments: memory.bar.segments }] }
  if (encoder || live) {
    const rows = [encoder && { icon: 'videocam', title: T.encoder, value: encoder }, session?.codec && { icon: 'movie', title: 'Codec', value: codecName(session.codec) }, num(session?.packet_loss) !== null && { icon: 'network_check', title: T.loss, value: `${session.packet_loss.toFixed(1)} %` }, num(session?.dropped_frames) !== null && { icon: 'warning', title: T.dropped, value: String(session.dropped_frames) }, num(session?.latencyMs) !== null && { icon: 'timer', title: T.latency, value: `${session.latencyMs.toFixed(1)} ${T.ms}` }, num(session?.latencyP95Ms) !== null && { icon: 'timer', title: T.p95, value: `${session.latencyP95Ms.toFixed(1)} ${T.ms}` }, num(session?.latencyLastMs) !== null && { icon: 'timer', title: T.lastLatency, value: `${session.latencyLastMs.toFixed(1)} ${T.ms}` }, session?.capture && { icon: 'screen_record', title: T.capture, value: String(session.capture) }].filter(Boolean)
    out.encoder = { title: T.encoder, sections: [{ type: 'rows', rows }] }
  }
  if (sys?.gpuName) out.hero = out.hero || undefined
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v))
}

/** "12:14" or "1:02:14" from milliseconds. */
export function formatClock(ms) {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), pad = (x) => String(x).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`
}

export function formatDuration(ms) {
  const m = Math.floor(ms / 60000)
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60)
  return d ? `${d}d ${h}h` : h ? `${h}h ${m % 60}m` : `${m % 60}m`
}

/**
 * Recent sessions from the host log. The host writes `CLIENT CONNECTED` and `CLIENT DISCONNECTED` lines (src/stream.cpp); pairing
 * them gives start and length. A start without an end is the session that is running. Returns newest first, at most `limit`.
 */
export function parseSessionLog(text, limit = 20) {
  if (typeof text !== 'string') return null
  const rows = []
  let open = null
  for (const line of text.split('\n')) {
    const m = /^\[(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)(?:\.\d+)?\]:\s*\w+:\s*CLIENT (CONNECTED|DISCONNECTED)/.exec(line)
    if (!m) continue
    const at = Date.parse(m[1].replace(' ', 'T'))
    if (m[2] === 'CONNECTED') { if (open) rows.push({ time: open.time, live: false, length: '' }); open = { time: m[1], at } }
    else if (open) { rows.push({ time: open.time, live: false, length: Number.isFinite(at - open.at) && at >= open.at ? formatLength(at - open.at) : '' }); open = null }
  }
  if (open) rows.push({ time: open.time, live: true, length: '' })
  return rows.reverse().slice(0, limit)
}
function formatLength(ms) {
  const s = Math.round(ms / 1000)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`
}

/** Error and warning lines of the host log, newest first. */
export function parseErrorLog(text, limit = 30) {
  if (typeof text !== 'string') return null
  const rows = []
  let errors = 0, warnings = 0
  for (const line of text.split('\n')) {
    const m = /^\[(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)(?:\.\d+)?\]:\s*(Error|Fatal|Warning):\s*(.*)$/.exec(line)
    if (!m) continue
    if (m[2] === 'Warning') warnings++; else errors++
    if (m[2] !== 'Warning') rows.push({ time: m[1].slice(5), level: m[2], text: m[3].slice(0, 200) })
  }
  return { errors, warnings, rows: rows.reverse().slice(0, limit) }
}


/** How many error lines the host log has lately; 0 while the log is not loaded (parseErrorLog answers null for a log that is not text). */
export const recentErrorCount = (text) => (parseErrorLog(text)?.rows.length) || 0

/** Names of the applications every install ships with (src_assets/windows/assets/apps.json); anything else was added by the person. */
export const BUILTIN_APPS = ['Desktop', 'Steam Big Picture', 'Xbox Game']

/** The "get started" steps with their real-data ticks. `data`: { paired: number|null, sessionSeen: boolean, apps: [{ name }]|null } */
export function buildStartSteps(T, data = {}) {
  const addedApp = Array.isArray(data.apps) ? data.apps.some((a) => !BUILTIN_APPS.includes(a?.name)) : false
  // a later step cannot be done while an earlier one is not: a paired client has a client app installed, a session means the client
  // was paired and set up
  const seen = data.sessionSeen === true
  const paired = seen || (data.paired ?? 0) > 0
  return [
    { id: 'download', title: T.stepDownload, sub: T.stepDownloadSub, auto: paired },
    { id: 'pair', title: T.stepPair, sub: T.stepPairSub, auto: paired },
    { id: 'quality', title: T.stepQuality, sub: T.stepQualitySub, auto: seen },
    { id: 'connect', title: T.stepConnect, sub: T.stepConnectSub, auto: seen },
    { id: 'game', title: T.stepGame, sub: T.stepGameSub, auto: addedApp },
  ]
}

/** Platforms of the download promo (ids are the ones of the Web UI downloads page) and the three recommended clients. */
export const guidePlatforms = (T) => [
  { id: 'windows', label: T.pWindows, icon: 'desktop_windows' }, { id: 'macos', label: T.pMacos, icon: 'laptop_mac' }, { id: 'linux', label: T.pLinux, icon: 'terminal' },
  { id: 'android', label: T.pAndroid, icon: 'android' }, { id: 'ios', label: T.pIos, icon: 'tablet_mac' }, { id: 'harmony', label: T.pHarmony, icon: 'mobile' }, { id: 'android-tv', label: T.pTv, icon: 'tv' },
]
export const guideRecommended = (T) => [
  { id: 'android', label: 'Moonlight V+', sub: T.recAndroid, icon: 'android' },
  { id: 'macos', label: 'Moonlight macOS Enhanced', sub: T.recMac, icon: 'laptop_mac' },
  { id: 'ios', label: 'VoidLink', sub: T.recIos, icon: 'tablet_mac' },
]
