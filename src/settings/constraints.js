// What the host accepts for the settings that take a number or a text, read from the host's own code, so a page can refuse a value the host would refuse.
//   range            src/config.cpp apply_config: int_between_f / double_between_f (a value outside is ignored by the host with a warning, and the default is used)
//   port             src/confighttp/configuration.cpp saveConfig: the base port is rejected outside 1029..65514 (apply_config would still take 1019: 1024 + PORT_HTTPS(-5);
//                    the top is 65535 - RTSP_SETUP_PORT(21))
//   text length      saveConfig: sunshine_name and adapter_name at most 256 characters
//   int              int_f: a number without a range of its own; text that is not a whole number is ignored by the host
// `empty` is always fine: the host uses the default of a key that has no value.

const INT_MAX = 2147483647
const range = (min, max, extra = {}) => ({ kind: 'int', min, max, ...extra })

export const CONSTRAINTS = Object.freeze({
  // ports
  port: range(1029, 65514, { source: 'saveConfig (apply_config floor 1019)' }),
  usb_forwarding_port: range(1024, 65535, { zero: true }), // 0 = automatic (main port + 7)
  dsu_server_port: range(1024, 65535),
  file_mapping_port: range(1024, 65535),
  // video
  hevc_mode: range(0, 3),
  av1_mode: range(0, 3),
  nvenc_preset: range(1, 7),
  nvenc_vbv_increase: range(0, 400),
  nvenc_lookahead_depth: range(0, 32),
  nvenc_target_quality: range(0, 63),
  amd_qvbr_quality: range(1, 51),
  amd_ltr_frames: range(0, 4),
  amd_slices_per_frame: range(0, 4),
  amd_hevc_gop_size: range(-1, 1000),
  amd_input_queue_size: range(1, 16),
  amd_av1_latency_mode: range(0, 3),
  minimum_fps_target: range(0, 1000),
  input_activity_boost_fps: range(0, 1000),
  input_activity_boost_window_ms: range(0, 5000),
  video_pacing_threshold: range(0, 16 * 1024 * 1024), // bytes; 0 = pacing off
  // network, pairing, streams
  sleep_mode: range(0, 2),
  pair_max_attempts: range(0, 50),
  client_fingerprint_rules_refresh_hours: range(1, 168),
  ping_timeout: range(-1, INT_MAX),
  lan_encryption_mode: range(0, 2),
  wan_encryption_mode: range(0, 2),
  fec_percentage: range(0, 255),
  fec_auto_max_percentage: range(0, 100),
  // web login sessions (the lifetimes confighttp/auth.cpp gives a session)
  session_idle_minutes: range(1, 1440),
  session_absolute_hours: range(1, 720),
  session_remember_idle_minutes: range(1, 525600),
  session_remember_days: range(1, 365),
  // logs
  max_log_size_mb: range(0, INT_MAX), // 0 keeps one log without rotation; the host clamps a negative value to 0
  // input
  key_repeat_frequency: { kind: 'number', min: 0, max: Number.MAX_VALUE },
  // whole numbers without a range of their own
  qp: { kind: 'int' }, min_threads: { kind: 'int' }, max_bitrate: { kind: 'int' }, back_button_timeout: { kind: 'int' }, key_repeat_delay: { kind: 'int' },
  // text
  sunshine_name: { kind: 'text', maxLength: 256 },
  adapter_name: { kind: 'text', maxLength: 256 },
})

const blank = (v) => v === undefined || v === null || v === ''

/** null when the host takes the value, else { code: 'number' | 'integer' | 'range' | 'length', min?, max?, zero?, maxLength? } */
export function validateSetting(key, value) {
  const c = CONSTRAINTS[key]
  if (!c || blank(value)) return null
  if (c.kind === 'text') return String(value).length > c.maxLength ? { code: 'length', maxLength: c.maxLength } : null
  const text = String(value).trim()
  const n = Number(text)
  if (text === '' || !Number.isFinite(n)) return { code: 'number' }
  if (c.kind === 'int' && !Number.isInteger(n)) return { code: 'integer', min: c.min, max: c.max, zero: c.zero }
  if (c.zero && n === 0) return null
  if ((c.min !== undefined && n < c.min) || (c.max !== undefined && n > c.max)) return { code: 'range', min: c.min, max: c.max, zero: c.zero, kind: c.kind }
  return null
}

const nice = (n) => (n >= INT_MAX ? '' : String(n))
/** the sentence for a problem (zh or en) */
export function constraintText(locale, problem) {
  if (!problem) return ''
  const zh = String(locale).startsWith('zh')
  const { code, min, max, zero, maxLength } = problem
  const span = max === undefined || max >= INT_MAX ? (zh ? `不小于 ${min}` : `at least ${min}`) : `${min}–${nice(max)}`
  if (code === 'length') return zh ? `最多 ${maxLength} 个字符` : `At most ${maxLength} characters`
  if (code === 'number') return zh ? '请输入数字' : 'Enter a number'
  if (code === 'integer') return zh ? (zero ? `请输入 0 或 ${span} 的整数` : `请输入整数（${span}）`) : (zero ? `Enter 0, or a whole number ${span}` : `Enter a whole number (${span})`)
  return zh ? (zero ? `须为 0，或 ${span}` : `须在 ${span} 之间`) : (zero ? `Must be 0, or ${span}` : `Must be ${span}`)
}
