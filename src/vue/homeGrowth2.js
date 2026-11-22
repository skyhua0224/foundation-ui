// Tiles of the second round of the catalogue growth (card tiles-catalog-growth-1116, batch 2). A tile is `null` while its source is not there: nothing is invented.
//  link-margin     the default network adapter of the host (GET /api/system/info `nics`: `link_speed_mbps`) against the session's bitrate budget (`bitrate`; the measured rate moves every second and says nothing about what the link can take) and the FEC share (configuration key `fec_percentage`).
//  frame-supply    GET /api/perf/current `frame_rates` of the running session: source, capture, submitted, encoded and repeated frames per second, and `source_kind`. The input is `session.frameRates` (the product passes the object as it is).
//  mic-health      GET /api/microphone/status (the panel's `get_virtual_microphone_status`) as `x.mic`, and the configuration key `microphone_redirect_backend`, saved through the one saving path.
//  capture-method  the configuration key `capture` ('' auto, ddx, wgc, amd, vdd; Windows only), saved through the one saving path, and the `capture` of the running session.
import { realSession } from './clientsLive.js'
import { microphoneState } from '../status/model.js'

export const GROWTH2_META = {
  'link-margin': ['stream', 'off', 2, 'card', 'widget'],
  'frame-supply': ['stream', 'off', 2, 'card', 'widget'],
  'mic-health': ['device', 'off', 2, 'card', 'widget'],
  'capture-method': ['control', 'off', 2, 'card', 'widget'],
}
export const GROWTH2_SIZES = {
  'link-margin': { s: [2, 1], m: [4, 1], l: [4, 2] },
  'frame-supply': { s: [2, 1], m: [4, 1], l: [4, 2] },
  'mic-health': { s: [2, 1], m: [4, 1], l: [4, 2] },
  'capture-method': { s: [2, 1], m: [4, 1], l: [4, 2] },
}

const num = (v) => { const n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) ? n : null }
const r1 = (v) => Math.round(v * 10) / 10

/** The adapter the stream leaves the host by: up, with a known link speed, the default route first; a mesh or virtual adapter is not a way to a client's screen. */
export function streamNic(nics) {
  const list = (Array.isArray(nics) ? nics : []).filter((n) => n && n.up && num(n.link_speed_mbps) > 0 && n.type !== 'mesh' && n.type !== 'virtual')
  return list.sort((a, b) => Number(b.is_default_route) - Number(a.is_default_route) || (a.type === 'ethernet' ? 0 : 1) - (b.type === 'ethernet' ? 0 : 1))[0] || null
}

/** Mbps of the stream on the wire: the bitrate plus the FEC parity (a share of the data). */
export function linkUse(kbps, fecPct) {
  const stream = kbps / 1000
  const fec = fecPct ? stream * (fecPct / 100) : 0
  return { stream, fec, used: stream + fec }
}

export const FRAME_STAGES = ['source', 'capture', 'submitted', 'encoded']
/** The frame stages of a session in the order a frame goes through them, only those the host reports; `lost` marks a stage that delivers clearly fewer frames than the one before it. */
export function frameStages(fr) {
  if (!fr || fr.enabled === false || fr.ready === false) return null
  const out = []
  for (const k of FRAME_STAGES) { const v = num(fr[k]?.fps); if (v !== null) out.push({ key: k, fps: v, lost: false, drop: 0 }) }
  if (out.length < 2) return null
  for (let i = 1; i < out.length; i++) out[i].lost = out[i - 1].fps > 0 && out[i].fps < out[i - 1].fps * 0.9 && out[i - 1].fps - out[i].fps >= 2
  for (let i = 1; i < out.length; i++) out[i].drop = out[i].lost ? out[i - 1].fps - out[i].fps : 0
  return out
}

export const MIC_BACKENDS = ['auto', 'vb_cable', 'usbip_experimental', 'disabled']
export const CAPTURE_VALUES = ['', 'ddx', 'wgc', 'vdd']

export function growth2Catalogue(x, T) {
  const d = { 'link-margin': null, 'frame-supply': null, 'mic-health': null, 'capture-method': null }
  const c = x.config || null
  const s = x.session ? realSession(x.session, x.clients) : null

  // 链路余量
  const nic = x.sysinfo ? streamNic(x.sysinfo.nics) : null
  // the budget of the session (its bitrate), not the measured rate: a headroom for deciding about the bitrate must not move with every second of the picture
  const kbps = s ? num(s.bitrate) : null
  if (nic && kbps !== null && kbps > 0) {
    const fecPct = c ? num(c.fec_percentage) : null
    const u = linkUse(kbps, fecPct)
    const speed = num(nic.link_speed_mbps)
    d['link-margin'] = { type: 'link-margin', icon: 'network_check', title: T['c_link-margin'], nic: { name: nic.name, kind: nic.type, speed, signal: nic.wifi && Number.isFinite(nic.wifi.signal) ? nic.wifi.signal : null }, stream: u.stream, fec: u.fec, fecPct, used: u.used, free: Math.max(0, speed - u.used), ratio: Math.min(1, u.used / speed) }
  }

  // 帧率来源
  const stages = s ? frameStages(s.frameRates) : null
  if (stages) d['frame-supply'] = { type: 'frame-supply', icon: 'slow_motion_video', title: T['c_frame-supply'], stages, target: num(s.fps), repeated: num(s.frameRates.repeated?.fps), kind: typeof s.frameRates.source_kind === 'string' ? s.frameRates.source_kind : '', encoded: stages.find((st) => st.key === 'encoded')?.fps ?? null }

  // 麦克风
  const m = x.mic && typeof x.mic === 'object' ? x.mic : null
  if (m && m.configured_backend) {
    // the path the person chose: the configuration key (it answers a save at once; the status route follows on its next read)
    const chosen = c && typeof c.microphone_redirect_backend === 'string' && MIC_BACKENDS.includes(c.microphone_redirect_backend) ? c.microphone_redirect_backend : m.configured_backend
    const state = microphoneState(m) // what the process does now; a saved choice changes the control, the state follows when the host has applied it
    const saveOk = x.saveSetting !== false && c !== null
    d['mic-health'] = { type: 'mic-health', icon: 'mic', title: T['c_mic-health'], state, backend: chosen, active: m.active_backend || '', key: 'microphone_redirect_backend', canSave: saveOk, options: MIC_BACKENDS.map((v) => ({ value: v, label: T[`mb_${v}`], disabled: v === 'usbip_experimental' && m.component_available === false })), counters: { underruns: num(m.underruns) ?? 0, dropped: num(m.dropped_frames) ?? 0, errors: num(m.submit_errors) ?? 0 }, fallback: m.fallback_reason || '', error: m.error_code || '' }
  }

  // 捕获方式
  if (c && c.platform === 'windows' && x.saveSetting !== false && typeof c.capture === 'string') {
    const gpus = x.sysinfo?.gpus || []
    const amd = gpus.some((g) => g.is_streaming_adapter && g.vendor === 'amd')
    const values = amd ? [...CAPTURE_VALUES, 'amd'] : CAPTURE_VALUES
    d['capture-method'] = { type: 'capture-method', icon: 'screen_record', title: T['c_capture-method'], key: 'capture', value: values.includes(c.capture) ? c.capture : c.capture, options: values.map((v) => ({ value: v, label: T[`cm_${v || 'auto'}`], full: T[`cmf_${v || 'auto'}`], icon: { '': 'tune', ddx: 'desktop_windows', wgc: 'layers', amd: 'memory', vdd: 'monitor' }[v] })), live: s && typeof s.perfCapture === 'string' ? s.perfCapture : '' }
  }
  return d
}

export const GROWTH2_TEXTS = Object.freeze({
  en: {
    'c_link-margin': 'Link headroom', lmFree: 'free', lmStream: 'Stream', lmFec: 'FEC', lmAdapter: 'Adapter', lmSpeed: 'Link', lmSignal: 'Signal', lmTarget: 'target', lmGbps: 'Gbps', lmMbps: 'Mbps',
    'c_frame-supply': 'Frame supply', fsSource: 'Source', fsCapture: 'Capture', fsSubmitted: 'Encoder in', fsEncoded: 'Sent', fsSourceS: 'Source', fsCaptureS: 'Capture', fsSubmittedS: 'Encode', fsEncodedS: 'Sent', fsRepeated: 'Repeated', fsTarget: 'Target', fsLost: 'Frames lost here', fsKind_vdd_published: 'Virtual display feed', fsFps: 'fps',
    'c_mic-health': 'Microphone', mhState_waiting: 'Waiting', mhState_idle: 'Waiting', mhState_active: 'In use', mhState_streaming: 'In use', mhState_capturing: 'In use', mhState_starting: 'Starting', mhState_stopping: 'Stopping', mhState_faulted: 'Fault', mhState_missing: 'Component missing', mhState_disabled: 'Off', mhState_unknown: 'Unknown', mhState_unsupported: 'Not supported',
    mhUnderruns: 'Gaps', mhDropped: 'Dropped', mhErrors: 'Errors', mhBackend: 'Path', mhFallback: 'Fell back', mb_auto: 'Auto', mb_vb_cable: 'VB-CABLE', mb_usbip_experimental: 'USB/IP', mb_disabled: 'Off',
    'c_capture-method': 'Capture method', cm_auto: 'Auto', cm_ddx: 'DDA', cm_wgc: 'WGC', cm_amd: 'AMD', cm_vdd: 'VDD', cmf_auto: 'Tries DDA, then WGC', cmf_ddx: 'Desktop Duplication API', cmf_wgc: 'Windows Graphics Capture', cmf_amd: 'AMD Display Capture', cmf_vdd: 'Direct from the virtual display', cmSession: 'This session', cmNext: 'After a restart',
  },
  zh: {
    'c_link-margin': '链路余量', lmFree: '余量', lmStream: '串流', lmFec: '纠错', lmAdapter: '网卡', lmSpeed: '速率', lmSignal: '信号', lmTarget: '目标', lmGbps: 'Gbps', lmMbps: 'Mbps',
    'c_frame-supply': '帧率来源', fsSource: '画面更新', fsCapture: '捕获', fsSubmitted: '送编码', fsEncoded: '发出', fsSourceS: '画面', fsCaptureS: '捕获', fsSubmittedS: '送编', fsEncodedS: '发出', fsRepeated: '重复帧', fsTarget: '目标', fsLost: '帧在这里丢失', fsKind_vdd_published: '虚拟显示器直送', fsFps: 'fps',
    'c_mic-health': '麦克风', mhState_waiting: '待命', mhState_idle: '待命', mhState_active: '使用中', mhState_streaming: '使用中', mhState_capturing: '使用中', mhState_starting: '启动中', mhState_stopping: '停止中', mhState_faulted: '故障', mhState_missing: '缺组件', mhState_disabled: '已关闭', mhState_unknown: '未知', mhState_unsupported: '不支持',
    mhUnderruns: '断流', mhDropped: '丢帧', mhErrors: '错误', mhBackend: '通道', mhFallback: '已回退', mb_auto: '自动', mb_vb_cable: 'VB-CABLE', mb_usbip_experimental: 'USB/IP', mb_disabled: '关闭',
    'c_capture-method': '捕获方式', cm_auto: '自动', cm_ddx: 'DDA', cm_wgc: 'WGC', cm_amd: 'AMD', cm_vdd: 'VDD', cmf_auto: '先试 DDA，再试 WGC', cmf_ddx: '桌面复制 API', cmf_wgc: 'Windows 图形捕获', cmf_amd: 'AMD 显示捕获', cmf_vdd: '直接取虚拟显示器画面', cmSession: '本次串流', cmNext: '重启后生效',
  },
})
