// The tree of 显示与视频 (): seven places, each a list item with the sections of its detail page. This
// is data, not a template: it says where every setting of display, video, capture and encoding lives, once. The Web page, the
// control panel hub, the search index, the old-address redirects and the old→new mapping table are all read from it, and
// test/displaytree.test.js proves that every key of the former pages is in the tree exactly once.
//
//   place     the id of the place (a `sub` of the tab `display`); `page` its id in the lists of the products
//   sections  the parts of the page, in order; `keys` are the configuration keys the section is the HOME of (exactly once in
//             the tree); `prefixes` do the same for a family of keys (the vendor parameters of an encoder); `main` marks the
//             operations that must be reachable within two steps of 显示与视频 (the ★ of the brief); `live` are controls that
//             change the display itself (not a configuration key); `shortcuts` are rows that write a key whose home is
//             elsewhere (the same setting, never a second copy of it); `links` are rows that open another place.
//   windows   the place exists on Windows hosts only

/** The seven places in list order. 高级 is the last one and is drawn apart from the rest. */
export const DISPLAY_TREE = Object.freeze([
  Object.freeze({
    place: 'output', page: 'display-output', icon: 'monitor', labelKey: 'shell.display_output', windows: false,
    sections: Object.freeze([
      Object.freeze({ id: 'target', keys: ['output_name', 'capture_target', 'window_title'], main: ['output_name', 'capture_target'] }),
      Object.freeze({ id: 'mode', keys: ['variable_refresh_rate'], live: ['display_resolution', 'display_refresh', 'display_scale'], main: ['display_resolution', 'display_refresh', 'display_scale'] }),
      Object.freeze({ id: 'prep', keys: ['display_device_prep'], main: ['display_device_prep'] }),
      Object.freeze({ id: 'headless', keys: ['vdd_headless_create'], main: ['vdd_headless_create'] }),
      Object.freeze({ id: 'advanced', keys: [], expander: true }),
    ]),
  }),
  Object.freeze({
    place: 'modes', page: 'display-modes', icon: 'aspect_ratio', labelKey: 'shell.display_modes', windows: false,
    sections: Object.freeze([
      Object.freeze({ id: 'policy', keys: ['resolution_change', 'manual_resolution', 'refresh_rate_change', 'manual_refresh_rate', 'dynamic_resolution_follow_display'], main: ['resolution_change'] }),
      Object.freeze({ id: 'resolutions', keys: ['resolutions'], main: ['resolutions'] }),
      Object.freeze({ id: 'rates', keys: ['fps'], main: ['fps'] }),
    ]),
  }),
  Object.freeze({
    place: 'hdr', page: 'display-hdr', icon: 'hdr_on', labelKey: 'shell.display_hdr', windows: true,
    sections: Object.freeze([
      Object.freeze({ id: 'status', keys: ['codec_enable_hdr'], main: ['codec_enable_hdr'] }),
      Object.freeze({ id: 'system', keys: ['hdr_prep'], main: ['hdr_prep'] }),
      Object.freeze({ id: 'calibration', keys: [], live: ['hdr_calibrate_virtual', 'hdr_calibrate_physical'], main: ['hdr_calibrate_virtual', 'hdr_calibrate_physical'] }),
      Object.freeze({ id: 'advanced', keys: ['hdr_enhanced', 'vdd_vulkan_hdr_bridge', 'hdr_luminance_analysis'], expander: true }),
    ]),
  }),
  Object.freeze({
    place: 'quality', page: 'quality', icon: 'wand_stars', labelKey: 'config.hdr_enhanced', windows: true, components: true,
    sections: Object.freeze([
      Object.freeze({ id: 'nr', keys: [], live: ['dlss_nr', 'dlss_nr_strength'], main: ['dlss_nr'] }),
    ]),
  }),
  Object.freeze({
    place: 'encoders', page: 'display-encoders', icon: 'memory', labelKey: 'shell.display_encoders', windows: false,
    sections: Object.freeze([
      Object.freeze({ id: 'bitrate', keys: ['max_bitrate'], main: ['max_bitrate'] }),
      Object.freeze({ id: 'format', keys: ['codec_strategy', 'hevc_mode', 'av1_mode'], main: ['codec_strategy'] }),
      Object.freeze({ id: 'encoder', keys: ['encoder'], main: ['encoder'] }),
      Object.freeze({ id: 'effective', keys: [], readOnly: true }),
      Object.freeze({ id: 'advanced', keys: ['min_threads'], prefixes: ['nvenc_', 'qsv_', 'amd_', 'vt_', 'sw_', 'vaapi_'], except: ['nvenc_vdd_force_vsync'], expander: true }),
    ]),
  }),
  Object.freeze({
    place: 'virtual', page: 'vdd', icon: 'desktop_windows', labelKey: 'shell.virtual_display', windows: true,
    sections: Object.freeze([
      Object.freeze({ id: 'device', keys: ['vdd_keep_enabled', 'vdd_reuse'], live: ['vdd_driver', 'vdd_create', 'vdd_close'], shortcuts: ['vdd_headless_create'], main: ['vdd_keep_enabled', 'vdd_driver'] }),
      Object.freeze({ id: 'links', keys: [], links: [{ id: 'modes', to: 'modes' }, { id: 'calibration', to: 'hdr' }, { id: 'scaling', to: 'output' }] }),
    ]),
  }),
  Object.freeze({
    place: 'advanced', page: 'display-advanced', icon: 'tune', labelKey: 'shell.display_advanced', windows: false, last: true,
    sections: Object.freeze([
      Object.freeze({ id: 'capture', keys: ['capture', 'capture_compute_shader', 'wgc_disable_secure_desktop', 'minimum_fps_target', 'input_activity_boost', 'input_activity_boost_fps', 'input_activity_boost_window_ms', 'downscaling_quality'], live: ['wgc_mode'] }),
      Object.freeze({ id: 'gpu', keys: ['adapter_name'] }),
      Object.freeze({ id: 'compat', keys: [], links: [{ id: 'app_overrides', to: 'apps' }] }),
      Object.freeze({ id: 'sync', keys: ['nvenc_vdd_force_vsync', 'mat_live'] }),
      Object.freeze({ id: 'reset', keys: [], reset: true }),
    ]),
  }),
])

/** The place ids in list order (the ids a `sub` of the tab `display` can hold). */
export const DISPLAY_TREE_PLACES = Object.freeze(DISPLAY_TREE.map((p) => p.place))

/**
 * Every setting key of the former pages of 显示与视频 (the search index before the restructure, tab `display`), with the place
 * it was on: { oldPlace: [keys] }. `mat_live` was on 音频 and moves to 高级 / 同步与特殊. The mapping test reads this list.
 */
export const LEGACY_DISPLAY_KEYS = Object.freeze({
  modes: ['resolution_change', 'manual_resolution', 'refresh_rate_change', 'manual_refresh_rate', 'dynamic_resolution_follow_display', 'resolutions', 'fps', 'max_bitrate', 'variable_refresh_rate'],
  output: ['output_name', 'display_device_prep'],
  encoders: ['codec_strategy', 'codec_enable_hdr', 'hevc_mode', 'av1_mode', 'encoder',
    'nvenc_preset', 'nvenc_frame_budget_guard', 'nvenc_twopass', 'nvenc_spatial_aq', 'nvenc_rate_control', 'nvenc_target_quality', 'nvenc_vbv_increase', 'nvenc_realtime_hags', 'nvenc_split_encode',
    'nvenc_manage_driver_settings', 'nvenc_latency_over_power', 'nvenc_opengl_vulkan_on_dxgi', 'nvenc_cuda_array_input', 'nvenc_h264_cavlc',
    'qsv_preset', 'qsv_coder', 'qsv_slow_hevc',
    'amd_usage', 'amd_slices_per_frame', 'amd_avcodec_compat', 'amd_vpe', 'amd_rc', 'amd_enforce_hrd', 'amd_qvbr_quality', 'amd_quality', 'amd_preanalysis', 'amd_vbaq', 'amd_coder', 'amd_hevc_gop_size',
    'amd_high_motion_qb', 'amd_lowlatency_mode', 'amd_multi_hw_instance', 'amd_input_queue_size', 'amd_av1_latency_mode',
    'vt_coder', 'vt_software', 'vt_realtime', 'sw_preset', 'sw_tune', 'min_threads'],
  video: ['adapter_name', 'capture', 'minimum_fps_target', 'capture_target', 'window_title', 'wgc_disable_secure_desktop', 'capture_compute_shader', 'hdr_enhanced'],
  hdr: ['hdr_prep', 'hdr_luminance_analysis', 'vdd_vulkan_hdr_bridge'],
  virtual: ['vdd_keep_enabled', 'vdd_headless_create', 'vdd_reuse', 'nvenc_vdd_force_vsync'],
  audio: ['mat_live'],
})

/** The old places (`sub` of the tab `display`) and the place an address of each now opens. */
export const LEGACY_DISPLAY_PLACES = Object.freeze({ video: 'advanced' })

const matches = (section, key) => section.keys.includes(key) || (!(section.except || []).includes(key) && (section.prefixes || []).some((p) => key.startsWith(p)))

/** Every section that is the home of `key`: [{ place, section }]. A key of the former pages has exactly one. */
export function homesOf(key) {
  const out = []
  for (const p of DISPLAY_TREE) for (const s of p.sections) if (matches(s, key)) out.push({ place: p.place, section: s.id })
  return out
}

/** The home of a key: { place, section } or null. */
export const homeOf = (key) => homesOf(key)[0] || null

/** Old places of the keys: { key: oldPlace }. */
export const legacyPlaceOf = (key) => Object.entries(LEGACY_DISPLAY_KEYS).find(([, keys]) => keys.includes(key))?.[0] || ''

/** The old→new mapping, from code: [{ key, from, to: { place, section } | null }] in the order of the tree. */
export function displayMapping() {
  const rows = []
  for (const [from, keys] of Object.entries(LEGACY_DISPLAY_KEYS)) for (const key of keys) rows.push({ key, from, to: homeOf(key) })
  const order = (row) => { const i = DISPLAY_TREE.findIndex((p) => p.place === row.to?.place); return i < 0 ? 99 : i }
  return rows.sort((a, b) => order(a) - order(b))
}

/** The places a host shows: all of them on Windows, the others elsewhere (the tree flags the Windows-only ones). */
export const displayTreePlaces = (platform = 'windows') => DISPLAY_TREE.filter((p) => platform === 'windows' || !p.windows)
