// The three tiers of the settings model and what each setting is, per key. Pure data: both products read it to decide
// where a row goes (tier 1 on the page as the large control, tier 2 as an inline row, tier 3 behind 高级 of its category),
// which control edits it, what the host assumes when the key is unset and what a reset writes.
//
//   tier 1  common    the page's lead control: a large connected selector, cards with a preview, a slider or chips
//   tier 2  normal    a row with its control inline
//   tier 3  expert    behind 高级 of the category: explanation, default, effect and a reset; a risky one is confirmed
//
// control: switch | seg | cards | sheet (searchable picker for a long list) | slider | range | chips | field | path |
//          list | page (opens a page of its own) | custom
// def: what the host uses when the key is not in the file (null = automatic / empty). A switch default is a boolean.
// quiet: the value is the person's own (a name, a language, a list), never counted as "changed from the default"
// risk: '' | 'medium' | 'high' | 'critical'; the save confirmation (useConfig) shows a summary of the change.
// effect: id of the one-line effect text (`config.effect.<id>` in the locale files, English fallback).

export const TIERS = Object.freeze({ COMMON: 1, NORMAL: 2, EXPERT: 3 })

const S = (tier, def, extra = {}) => ({ tier, control: 'switch', def, ...extra })
const G = (tier, def, extra = {}) => ({ tier, control: 'seg', def, ...extra })
const P = (tier, def, extra = {}) => ({ tier, control: 'sheet', def, ...extra })
const N = (tier, def, min, max, step, unit, extra = {}) => ({ tier, control: 'slider', def, min, max, step, unit, ...extra })
const F = (tier, def, extra = {}) => ({ tier, control: 'field', def, ...extra })
const D = (tier, def, extra = {}) => ({ tier, control: 'path', def, ...extra })
// a slider over named steps (the value is the name of the step, in order from the lightest)
const X = (tier, def, steps, extra = {}) => ({ tier, control: 'slider', def, steps, ...extra })

export const SETTING_META = Object.freeze({
  // 常规
  locale: P(2, 'en', { quiet: true }),
  sunshine_name: F(2, null, { quiet: true }),
  min_log_level: P(3, 2),
  max_log_size_mb: F(3, 50), // MB; 0 keeps one log without rotation
  restore_log: S(3, false),
  fs_host_icon: F(3, null), // the icon token of the host for the specialised fullscreen client; empty lets the client choose
  clipboard_sync: S(3, true), // on in the host; the switch only force-disables it for every client
  sleep_mode: G(1, '0', { icons: true }),
  notify_pre_releases: S(2, false),
  system_tray: S(2, true),
  stop_on_last_video_session: S(2, false),
  launch_splash: S(2, true),
  global_prep_cmd: { tier: 3, control: 'list', def: [], risk: 'high' },
  // 输入
  controller: S(1, true),
  gamepad: { tier: 1, control: 'cards', def: 'auto' },
  usb_forwarding_enabled: S(2, false, { risk: 'medium' }),
  usb_forwarding_port: F(3, 0, { port: true }),
  ds4_back_as_touchpad_click: S(2, true),
  motion_as_ds4: S(2, true),
  touchpad_as_ds4: S(2, true),
  enable_dsu_server: S(3, false),
  dsu_server_port: F(3, 26760, { port: true }),
  back_button_timeout: N(3, -1, -50, 3000, 50, ' ms', { off: -1, offText: 'disabled' }),
  client_gamepad_override: S(3, true), // a client that declares its own gamepad type wins
  keyboard: S(2, true),
  key_repeat_delay: N(3, 500, 100, 1000, 50, ' ms'),
  key_repeat_frequency: N(3, 24.9, 1, 60, 0.1, ' Hz', { decimals: 1 }),
  always_send_scancodes: S(3, true),
  key_rightalt_to_key_win: S(3, false),
  mouse: S(2, true),
  high_resolution_scrolling: S(2, true),
  native_pen_touch: S(3, true),
  native_touchpad_optimization: S(3, true),
  capture_cursor: S(2, true),
  amf_draw_mouse_cursor: S(3, false),
  virtual_mouse: S(3, true, { risk: 'medium' }),
  // 音频/视频
  audio_sink: F(2, null),
  virtual_sink: F(2, null),
  keep_sink_default: S(2, false),
  install_steam_audio_drivers: S(2, true, { risk: 'medium' }),
  stream_audio: S(1, true),
  mat_live: S(3, false), // live MAT (Dolby) capture of the audio output: guarded and experimental, off by default
  stream_mic: S(1, true),
  max_bitrate: { tier: 1, control: 'chips', def: 0, min: 0, max: 500000, unit: ' Kbps' },
  output_name: { tier: 1, control: 'custom', def: null },
  vdd_keep_enabled: S(1, false),
  vdd_headless_create: S(2, false),
  vdd_reuse: S(2, false),
  variable_refresh_rate: S(2, false),
  minimum_fps_target: N(3, 0, 0, 240, 1, ' FPS', { off: 0, offText: 'auto' }),
  input_activity_boost: S(3, true), // raise the stream FPS for a short window after input
  input_activity_boost_fps: F(3, 60),
  input_activity_boost_window_ms: F(3, 150),
  downscaling_quality: G(3, 'balanced'),
  microphone_redirect_backend: G(2, 'auto'),
  display_device_prep: { tier: 2, control: 'custom', def: 'no_operation', risk: 'high' },
  resolution_change: G(2, 'automatic'),
  manual_resolution: F(2, null),
  refresh_rate_change: G(2, 'automatic'),
  manual_refresh_rate: F(2, null),
  hdr_prep: G(1, 'automatic'),
  dynamic_resolution_follow_display: S(3, true),
  hdr_luminance_analysis: G(3, 'auto'),
  nvenc_vdd_force_vsync: S(3, false),
  vdd_vulkan_hdr_bridge: S(3, true),
  resolutions: { tier: 2, control: 'list', def: [], quiet: true },
  fps: { tier: 1, control: 'chips', def: [], quiet: true },
  // 网络
  mdns_broadcast: S(2, true),
  upnp: S(2, false, { risk: 'high' }),
  address_family: G(3, 'ipv4'),
  bind_address: P(3, null, { risk: 'medium' }),
  external_endpoints: { tier: 2, control: 'custom', def: null, quiet: true },
  port: F(2, 47989, { port: true }),
  fec_auto: S(2, false),
  fec_percentage: N(3, 20, 0, 100, 1, ' %'),
  fec_auto_max_percentage: N(3, 50, 0, 100, 1, ' %'),
  origin_web_ui_allowed: G(2, 'lan', { risk: 'critical' }),
  lan_encryption_mode: G(3, '0'),
  wan_encryption_mode: G(2, '1', { risk: 'critical' }),
  pair_max_attempts: N(3, 10, 0, 50, 1, '', { risk: 'high' }),
  ping_timeout: N(3, 10000, 1000, 60000, 500, ' ms'),
  close_verify_safe: S(3, false, { risk: 'medium' }),
  client_fingerprint_remote_rules: S(3, true),
  client_fingerprint_rules_url: F(3, null),
  client_fingerprint_rules_refresh_hours: F(3, 24),
  client_fingerprint_rules_certificate: F(3, null),
  network_external_check: S(3, true), // the host stores enabled/disabled
  network_external_endpoint: F(3, null),
  network_bypass_proxy: S(3, true),
  stun_servers: F(3, null), // one host or host:port per line; empty uses the built-in list, none turns them off
  // 配置文件
  file_apps: D(3, 'apps.json'),
  credentials_file: D(3, 'sunshine_state.json', { risk: 'high' }),
  file_state: D(3, 'sunshine_state.json', { risk: 'high' }),
  log_path: D(3, 'sunshine.log'),
  pkey: D(3, null, { risk: 'high' }),
  cert: D(3, null, { risk: 'high' }),
  codec_strategy: { tier: 1, control: 'cards', def: 'auto' },
  codec_enable_hdr: S(1, false),
  hdr_enhanced: { tier: 2, control: 'page', def: null },
  adapter_name: P(2, null),
  capture: P(3, ''),
  encoder: { tier: 1, control: 'cards', def: '' },
  hevc_mode: G(3, 0),
  av1_mode: G(3, 0),
  capture_target: G(3, 'display'),
  window_title: F(3, null),
  wgc_disable_secure_desktop: S(3, false, { risk: 'medium' }),
  capture_compute_shader: G(3, 'auto'),
  // 编码器
  nvenc_preset: G(2, 1, { steps: [1, 2, 3, 4, 5, 6, 7], prefix: 'P' }),
  nvenc_frame_budget_guard: S(3, true),
  nvenc_twopass: G(3, 'quarter_res'),
  nvenc_spatial_aq: S(3, false),
  nvenc_rate_control: G(3, 'cbr'),
  nvenc_target_quality: N(3, 0, 0, 63, 1, '', { off: 0, offText: 'auto' }),
  nvenc_vbv_increase: N(3, 0, 0, 400, 1, ' %'),
  nvenc_realtime_hags: S(3, true, { risk: 'medium' }),
  nvenc_split_encode: G(3, 'driver_decides'),
  nvenc_manage_driver_settings: S(3, true, { risk: 'medium' }),
  nvenc_latency_over_power: S(3, true),
  nvenc_opengl_vulkan_on_dxgi: S(3, true),
  nvenc_cuda_array_input: S(3, false),
  nvenc_h264_cavlc: S(3, false),
  qsv_preset: P(2, 'medium', { steps: ['veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'slowest'] }),
  qsv_coder: G(3, 'auto'),
  qsv_slow_hevc: S(3, false),
  amd_usage: P(3, null),
  amd_slices_per_frame: N(3, 0, 0, 4, 1, ''), // the host takes 0..4 (src/config.cpp)
  amd_avcodec_compat: S(3, false),
  amd_rc: P(3, null),
  amd_enforce_hrd: S(3, false),
  amd_vpe: S(3, false), // the AMD video processing engine: Windows, an experimental switch of the AMD encoder
  amd_qvbr_quality: N(3, 23, 1, 51, 1, ''),
  amd_quality: P(3, null),
  amd_preanalysis: S(3, false),
  amd_vbaq: S(3, false),
  amd_coder: G(3, 'auto'),
  amd_hevc_gop_size: N(3, -1, -1, 600, 1, '', { off: -1, offText: 'auto' }),
  amd_high_motion_qb: S(3, false),
  amd_lowlatency_mode: S(3, false),
  amd_multi_hw_instance: S(3, false),
  // the host takes 1..16 and leaves the key out for automatic: the lowest position clears the value (offWrite) instead of writing 0, which the host refuses
  amd_input_queue_size: N(3, 0, 0, 16, 1, '', { off: 0, offText: 'auto', offWrite: '' }),
  amd_av1_latency_mode: P(3, null),
  vt_coder: G(3, 'auto'),
  vt_software: G(3, 'auto'),
  vt_realtime: S(3, true),
  sw_preset: P(2, 'superfast', { steps: ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'] }),
  sw_tune: P(3, 'zerolatency'),
  min_threads: N(3, 2, 1, 64, 1, ''),
  vaapi_strict_rc_buffer: S(3, false), // strict rate-control buffer handling of the Linux VAAPI encoder; enable only when the driver misbehaves
})

/** Keys of the host configuration that have a control in the original Web UI but no tier of their own are an error. */
export const metaOf = (key) => SETTING_META[key] || null
export const tierOf = (key) => SETTING_META[key]?.tier || 0
export const isExpert = (key) => tierOf(key) === 3
export const keysOfTier = (tier) => Object.keys(SETTING_META).filter((k) => SETTING_META[k].tier === tier)

// Settings of the control panel's own pages (面板设置 and the native pages), by the key the panel stores them under.
export const PANEL_META = Object.freeze({})

/** A stored value as text, so 'enabled', true and 'true' compare equal. */
export const normalizeValue = (v) => {
  if (v === true || v === 'true' || v === 'enabled' || v === 'on') return 'true'
  if (v === false || v === 'false' || v === 'disabled' || v === 'off') return 'false'
  return v === undefined || v === null ? '' : String(v)
}

/** Does the stored value differ from the default? An unset key (or an empty one) is the default. */
export function isChanged(key, stored, def) {
  const meta = SETTING_META[key]
  if (!meta || meta.quiet || ['list', 'page', 'custom'].includes(meta.control)) return false
  if (stored === undefined || stored === null || stored === '') return false
  return normalizeValue(stored) !== normalizeValue(def !== undefined ? def : meta.def)
}
