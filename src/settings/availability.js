// Why a setting cannot be used right now: one model for the search, the settings pages and anything else that lists settings. The descriptor of a setting says it (a state and a reason code); every surface
// writes the same reason, in the person's language, and nobody writes a special case of its own.
//
//   state    'available' (nothing to say) | 'unavailable' (this build, this device or this connection cannot do it) | 'locked' (another setting has to be on first)
//   code     the reason, one of REASONS
//   reason   the sentence for the person (computed for a locale)
//   blockedBy  for a locked setting: { id, title, route, params }, the setting that unlocks it (a surface offers the way to it)
//
// A reason says what is missing, never "not open yet": 需要客户端支持, 需要 DualSense, 蓝牙由客户端决定, 需先开启 X. A key the host build does not wire yet says which part of the host does not do it.

export const AVAILABILITY = Object.freeze({ AVAILABLE: 'available', UNAVAILABLE: 'unavailable', LOCKED: 'locked' })

/** Reason codes: the icon of the row and the sentence in zh and en. `{name}` is the setting that has to be on (locked). */
export const REASONS = Object.freeze({
  client: { icon: 'devices', zh: '需要客户端支持', en: 'Needs client support' },
  device: { icon: 'sports_esports', zh: '需要 DualSense 手柄', en: 'Needs a DualSense controller' },
  transport: { icon: 'usb', zh: '蓝牙由客户端决定，主机只走 USB', en: 'Bluetooth is up to the client; the host is USB only' },
  platform: { icon: 'desktop_access_disabled', zh: '这个系统没有原生 DualSense 通道', en: 'This system has no native DualSense path' },
  'haptics-shaping': { icon: 'mobile_vibrate', zh: '主机的原生通道不做触觉整形', en: 'The host’s native path does not shape haptics' },
  'haptics-switch': { icon: 'mobile_vibrate', zh: '分配原生手柄时选定，不能实时切换', en: 'Chosen when the controller is allocated; no live switch' },
  'feedback-merge': { icon: 'tune', zh: '主机的原生通道不合并、保持或限速反馈', en: 'The host’s native path does not merge, hold or rate-cap feedback' },
  'trigger-scale': { icon: 'touch_app', zh: '扳机强度由游戏决定，主机不缩放', en: 'The game sets trigger strength; the host does not scale it' },
  slope: { icon: 'touch_app', zh: '手柄没有斜坡扳机类型', en: 'The controller has no slope trigger type' },
  pointer: { icon: 'mouse', zh: '需要主机的指针注入', en: 'Needs a pointer injector on the host' },
  mic: { icon: 'mic_off', zh: '主机上的 DualSense 麦克风没有采集源', en: 'The host’s DualSense microphone has no capture source' },
  preamp: { icon: 'speaker', zh: '输出数据传不了扬声器前级设置', en: 'The output report has no speaker preamp field' },
  'control-channel': { icon: 'settings_ethernet', zh: '需要 ALK-DS5T/1 的调参通道', en: 'Needs an ALK-DS5T/1 tuning channel' },
  unwired: { icon: 'link_off', zh: '主机的这个版本没有接入这一项', en: 'This host build does not wire it' },
  setting: { icon: 'lock', zh: '需先开启「{name}」', en: 'Turn on “{name}” first' },
})

const isZh = (locale) => /^zh/i.test(String(locale))
const fill = (text, vars = {}) => String(text).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')

/** The sentence of a reason code for a locale (an unknown code is the generic one: nothing is invented). */
export function reasonText(code, locale = 'en', vars = {}) {
  const r = REASONS[code] || REASONS.unwired
  return fill(isZh(locale) ? r.zh : r.en, vars)
}

/** The reason code of a DualSense tuning key the host reports as unavailable: the host's own code when it sends one, else read from the key (the ranges mirror the host's reasons, ds5/tuning_profile.cpp wire_reason). */
export function ds5ReasonCode(d, { nativePath = true } = {}) {
  if (d.reason_code && REASONS[d.reason_code]) return d.reason_code
  const id = Number(d.id)
  if (id === 10) return 'transport'
  if (id === 31) return 'slope'
  if (id === 105) return 'client'
  if (!nativePath) return 'platform'
  if (id >= 4 && id <= 12) return 'haptics-shaping'
  if (id >= 19 && id <= 23) return 'feedback-merge'
  if (id >= 24 && id <= 34) return 'trigger-scale'
  if (id >= 74 && id <= 80) return 'pointer'
  if (id >= 35 && id <= 73) return 'client'
  if (id === 96) return 'mic'
  if (id === 97) return 'preamp'
  if (id === 98 || id === 100) return 'transport'
  if (id === 101) return 'client'
  if (id >= 102 && id <= 104) return 'control-channel'
  if (id === 2) return 'haptics-switch'
  if (d.authority === 'client' || d.authority === 'shared_client') return 'client'
  if (d.authority === 'device') return 'device'
  return 'unwired'
}

/**
 * The availability of one DualSense tuning key (a descriptor of /api/dualsense/tuning): null when it is usable, else { state, code, reason }. `status` and `implemented` are the host's;
 * `requires` ({ key, title, route?, params? } of the setting that has to be on, with `on` = whether it is) makes the key locked while that setting is off.
 */
export function ds5Availability(d, { locale = 'en', nativePath = true, requires = null } = {}) {
  if (d.status === 'unavailable' || d.implemented === false) {
    const code = ds5ReasonCode(d, { nativePath })
    return { state: AVAILABILITY.UNAVAILABLE, code, reason: reasonText(code, locale), icon: REASONS[code]?.icon || 'info' }
  }
  return lockedBy(requires, locale)
}

/** A setting that needs another one on: null when that one is on (or none is needed), else the locked availability with the way to it. */
export function lockedBy(requires, locale = 'en') {
  if (!requires || requires.on !== false) return null
  return {
    state: AVAILABILITY.LOCKED, code: 'setting', reason: reasonText('setting', locale, { name: requires.title }), icon: REASONS.setting.icon,
    blockedBy: { id: requires.id || `setting:${requires.key}`, title: requires.title, route: requires.route || 'config', params: requires.params || {} },
  }
}

/** Whether a doc or entry cannot be used now (it is shown with its reason, after the usable ones). */
export const isUnavailable = (x) => !!x?.availability && x.availability.state !== AVAILABILITY.AVAILABLE
