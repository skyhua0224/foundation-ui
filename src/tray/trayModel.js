import { trayTexts } from './trayTexts.js'
import { BITRATE_SLIDER_MAX_PROGRESS, bitrateFromProgress, bitrateKbps, bitrateSliderProgress, bitrateText, bitrateSegmentMarks } from '../settings/bitrate.js'

// The tray menu, as data: today's items (src-tauri/src/tray/menu.rs of the Panel) laid out three ways. A layout is a model { variant, kind, root | order, pages }; a component draws a model for a state,
// and the Panel's popup window (docs/context-menu-window.md) takes the same model across the window. No function lives in a model: an item is its id, and the id is what the host runs.
//
// Row types: item (one id), page (a drill-in to another page), divider, header (V1), card (V2), strip (V3), tiles (V3), seg (V3), actions (restart | quit), support (the quiet support line at the foot of 帮助).
// `when` hides a row until the state asks for it: 'rtss' (RTSS installed), 'dev' (beta/debug build), 'disconnected' (the service is down), 'notification' (the core has one to show).

/** Every item id of menu.rs, in the order the native menu builds them (the containers - interfaces, display, tools, settings, advanced, help, language - are pages, listed apart). */
export const TRAY_ITEM_IDS = Object.freeze([
  'tray_status', 'recover_service', 'tray_notification_action',
  'open_main_panel', 'connect_device', 'download_client', 'open_desktop', 'auto_start',
  'open_sunshine',
  'vdd_settings', 'vdd_create', 'vdd_close', 'vdd_toggle_keep_enabled', 'vdd_toggle_headless_create', 'reset_display',
  'show_toolbar', 'host_performance', 'rtss_control', 'web_stream', 'log_console', 'debug_page',
  'lang_zh', 'lang_en', 'lang_ja',
  'prevent_sleep', 'restart_user_mode', 'import_config', 'export_config', 'reset_config', 'clear_cache',
  'check_update', 'about', 'feedback', 'star_project', 'visit_project_sunshine', 'visit_project_moonlight',
  'visit_site', 'visit_bilibili', 'star_github', 'sponsor_qiin', 'sponsor_yundi339', 'sponsor_skyhua', 'sponsor_wechat', 'sponsor_github',
  'restart', 'shutdown',
])
export const TRAY_CONTAINER_IDS = Object.freeze(['interfaces', 'display', 'tools', 'settings', 'advanced', 'help', 'language'])

/** icon and Chinese label of each item (the Panel's ZH_STRINGS); `short` is the label of a tile or a split button. */
export const ITEMS = Object.freeze({
  tray_status: { icon: 'sensors', label: '状态' },
  recover_service: { icon: 'restart_alt', label: '重新启动 Sunshine 服务' },
  tray_notification_action: { icon: 'notifications', label: '通知' },
  open_main_panel: { icon: 'dashboard', label: '打开主面板', short: '主面板' },
  connect_device: { icon: 'qr_code_2', label: '配对新设备', short: '配对' },
  download_client: { icon: 'download', label: '下载客户端', short: '客户端' },
  open_desktop: { icon: 'tv', label: '大屏模式', short: '大屏' },
  auto_start: { icon: 'power_settings_new', label: '开机自动运行 Sunshine', short: '开机自启' },
  open_sunshine: { icon: 'public', label: 'Web 管理界面', short: 'Web 管理' },
  vdd_settings: { icon: 'tune', label: '基地虚拟显示器设置', short: '显示器设置' },
  vdd_create: { icon: 'add_circle', label: '创建基地虚拟显示器' },
  vdd_close: { icon: 'cancel', label: '关闭基地虚拟显示器' },
  vdd_toggle_keep_enabled: { icon: 'layers', label: '串流结束后保留', short: '串流后保留' },
  vdd_toggle_headless_create: { icon: 'visibility_off', label: '无头模式自动创建', short: '无头模式' },
  reset_display: { icon: 'refresh', label: '重置显示' },
  show_toolbar: { icon: 'pets', label: '显示桌宠', short: '桌宠' },
  host_performance: { icon: 'speed', label: '主机性能', short: '主机性能' },
  rtss_control: { icon: 'monitor_heart', label: 'RTSS 控制', short: 'RTSS' },
  web_stream: { icon: 'cast', label: 'Web 串流服务', short: 'Web 串流' },
  log_console: { icon: 'terminal', label: '日志控制台', short: '日志' },
  debug_page: { icon: 'bug_report', label: '调试页面', short: '调试' },
  lang_zh: { icon: 'language', label: '中文' },
  lang_en: { icon: 'language', label: 'English' },
  lang_ja: { icon: 'language', label: '日本語' },
  prevent_sleep: { icon: 'bedtime', label: '阻止系统休眠', short: '阻止休眠' },
  restart_user_mode: { icon: 'person', label: '以用户模式运行 Sunshine', short: '用户模式' },
  import_config: { icon: 'upload_file', label: '导入配置', short: '导入' },
  export_config: { icon: 'download', label: '导出配置', short: '导出' },
  reset_config: { icon: 'history', label: '重置配置', short: '重置', danger: true },
  clear_cache: { icon: 'cleaning_services', label: '清理缓存', short: '清缓存' },
  check_update: { icon: 'update', label: '检查更新', short: '更新' },
  about: { icon: 'info', label: '关于 Sunshine', short: '关于' },
  feedback: { icon: 'feedback', label: '反馈问题…', short: '反馈' },
  star_project: { icon: 'star', label: '项目主页', short: '项目主页' },
  visit_project_sunshine: { icon: 'code', label: 'Sunshine 源代码', short: 'Sunshine 源码' },
  visit_project_moonlight: { icon: 'code', label: 'Moonlight 源代码', short: 'Moonlight 源码' },
  // the support line at the foot of 帮助 (SUPPORT_ROW): the website, the Bilibili channel, a star on GitHub, and the sponsor options (the 赞助 chip opens the chooser, it is not an id)
  visit_site: { icon: 'public', label: '官网', short: '官网' },
  visit_bilibili: { icon: 'play_circle', label: 'B 站', short: 'B 站' },
  star_github: { icon: 'star', label: '在 GitHub 点 Star', short: '点 Star' },
  sponsor_qiin: { icon: 'favorite', label: 'qiin2333' },
  sponsor_yundi339: { icon: 'favorite', label: 'Yundi339' },
  sponsor_skyhua: { icon: 'favorite', label: 'skyhua0224' },
  sponsor_wechat: { icon: 'favorite', label: '微信赞赏 / WeChat' },
  sponsor_github: { icon: 'favorite', label: 'GitHub Sponsors' },
  restart: { icon: 'restart_alt', label: '重启 Sunshine', short: '重启' },
  shutdown: { icon: 'power_settings_new', label: '退出 Sunshine', short: '退出', danger: true },
})

/**
 * The support line, the last row of every 帮助 page: small chips in the card's neutral tone, quiet by design (no brand colour, badge, counter or motion; nothing opens by itself). `chips` run one id each;
 * 赞助 is not an id: it opens a chooser of sponsor options (`sponsors`, the same people in the same order as the sponsor lists of the products - a test compares them), including the official website.
 */
export const SUPPORT_ROW = Object.freeze({ chips: Object.freeze(['visit_site', 'visit_bilibili', 'star_github']), sponsors: Object.freeze(['sponsor_qiin', 'sponsor_yundi339', 'sponsor_skyhua', 'sponsor_wechat', 'sponsor_github']) })

/** The pages the native submenus become (title, icon of the entry that opens it). */
export const PAGES = Object.freeze({
  display: { title: '显示器', icon: 'monitor' },
  tools: { title: '工具', icon: 'build' },
  settings: { title: '设置', icon: 'settings' },
  language: { title: '语言', icon: 'language' },
  advanced: { title: '高级', icon: 'more_horiz' },
  help: { title: '帮助', icon: 'help' },
  quick: { title: '快捷', icon: 'grid_view' },
})

/** The sliders of the quick page (ChromeOS quick-settings style): icon, label, live value; a change is applied when the slider is released. The host answers each from `state.sliders`. */
export const SLIDERS = Object.freeze({
  resolution: { icon: 'aspect_ratio' },
  refresh: { icon: 'slow_motion_video' },
  dpi: { icon: 'format_size' },
  bitrate: { icon: 'network_check' },
})
export const SLIDER_KEYS = Object.freeze(Object.keys(SLIDERS))

/**
 * The tiles of the quick page: a 2-wide grid of pills (ChromeOS quick settings). The icon part acts (a toggle flips, an action runs); a toggle may also drill into the page that holds its siblings (`drill`).
 * `kind`: action (runs one id), toggle (a switch with a state, shown as 开 / 关), update (an action that is lit when the state has a new version). `when` hides a tile the host cannot offer (RTSS not installed).
 * Every tile is an item of the native menu (src-tauri/src/tray/menu.rs), so nothing here is invented: the order of the first seven is the first level of V1 and of the old native menu.
 */
export const TILES = Object.freeze({
  open_main_panel: { kind: 'action' },
  open_desktop: { kind: 'action' },
  connect_device: { kind: 'action' },
  download_client: { kind: 'action' },
  vdd: { kind: 'toggle', on: 'vdd_close', off: 'vdd_create', icon: 'monitor', drill: 'display' },
  auto_start: { kind: 'toggle', drill: 'settings' },
  check_update: { kind: 'update' },
  // optional: from the deeper menus of V1 (工具 / 设置 / 显示器); shown by the person
  open_sunshine: { kind: 'action' },
  show_toolbar: { kind: 'toggle' },
  host_performance: { kind: 'action' },
  rtss_control: { kind: 'action', when: 'rtss' },
  log_console: { kind: 'action' },
  prevent_sleep: { kind: 'toggle', drill: 'settings' },
  restart_user_mode: { kind: 'toggle', drill: 'settings' },
  vdd_toggle_keep_enabled: { kind: 'toggle', drill: 'display' },
  vdd_toggle_headless_create: { kind: 'toggle', drill: 'display' },
  reset_display: { kind: 'action' },
})
export const TILE_IDS = Object.freeze(Object.keys(TILES))
/** What the quick page shows until the person edits it: the first level of V1 (主面板, 大屏, 配对, 客户端, 基地显示器, 开机自启, 更新). */
export const DEFAULT_TILES = Object.freeze(['open_main_panel', 'open_desktop', 'connect_device', 'download_client', 'vdd', 'auto_start', 'check_update'])
/** The sliders every menu shows until the person chooses (V1, V2 and V3 read the same list, `layout.sliders`): the bitrate cap and the scale. */
export const DEFAULT_SLIDERS = Object.freeze(['bitrate', 'dpi'])

/**
 * The cells of the later pages of the quick panel (显示器, 工具, 设置, 帮助): the same pills as the first page. Every one is an item of the native menu; a cell is not a quick-page tile (it is not in
 * TILES, so the person's layout and the host's stored record know nothing of it). `kind`: action (runs one id), toggle (开 / 关), update, choice (one of a group's radio items). `when` hides it from a host that cannot offer it.
 */
export const CELLS = Object.freeze({
  vdd_settings: { kind: 'action' },
  web_stream: { kind: 'action', when: 'dev' },
  debug_page: { kind: 'action', when: 'dev' },
  about: { kind: 'action' },
  feedback: { kind: 'action' },
  import_config: { kind: 'action' },
  export_config: { kind: 'action' },
  reset_config: { kind: 'action' },
  clear_cache: { kind: 'action' },
  star_project: { kind: 'action' },
  visit_project_sunshine: { kind: 'action' },
  visit_project_moonlight: { kind: 'action' },
  lang_zh: { kind: 'choice' },
  lang_en: { kind: 'choice' },
  lang_ja: { kind: 'choice' },
})
/**
 * A group is a pill that opens its choices in place, under itself, instead of a menu list: 语言 (the three languages, one is on), 配置 (import, export, reset, clear the cache), 项目 (the three project pages).
 * The pill is as wide as the grid; the choices appear below it and the card's height follows. One group is open at a time.
 */
export const GROUPS = Object.freeze({
  language: { icon: 'language', ids: Object.freeze(['lang_zh', 'lang_en', 'lang_ja']), choice: true },
  config: { icon: 'folder_managed', ids: Object.freeze(['import_config', 'export_config', 'reset_config', 'clear_cache']) },
  project: { icon: 'star', ids: Object.freeze(['star_project', 'visit_project_sunshine', 'visit_project_moonlight', 'feedback']) },
})

const item = (id, extra = {}) => ({ t: 'item', id, ...extra })
const page = (to, extra = {}) => ({ t: 'page', to, ...extra })
const divider = { t: 'divider' }

const displayRows = [
  item('vdd_settings'), divider,
  item('vdd_create'), item('vdd_close'), item('vdd_toggle_keep_enabled', { check: true }), item('vdd_toggle_headless_create', { check: true }), item('reset_display'),
]
const toolsRows = (withInterfaces) => [
  ...(withInterfaces ? [item('open_sunshine'), divider] : []),
  item('show_toolbar'), item('host_performance'), item('rtss_control', { when: 'rtss' }), item('web_stream', { when: 'dev' }), divider, item('log_console'), item('debug_page', { when: 'dev' }),
]
const languageRows = [item('lang_zh', { check: 'radio' }), item('lang_en', { check: 'radio' }), item('lang_ja', { check: 'radio' })]
const advancedRows = [item('reset_config'), item('clear_cache')]
const helpRows = (withUpdate) => [
  ...(withUpdate ? [item('check_update'), divider] : []),
  item('about'), item('feedback'), divider, item('star_project'), item('visit_project_sunshine'), item('visit_project_moonlight'),
  // the quiet support line is the last thing on the page (never on the first page of V3, never above the operational rows)
  divider, { t: 'support' },
]

/** V1 「UU 式紧凑列表」: a small header, the primary rows, the rest behind three page rows (工具 / 设置 / 帮助) that slide to a second page inside the card. */
export const V1 = Object.freeze({
  variant: 'v1', kind: 'stack', root: 'root', dense: true,
  pages: {
    root: { rows: [
      { t: 'header' },
      item('tray_notification_action', { when: 'notification' }), item('recover_service', { when: 'disconnected' }),
      // the sliders of state.layout (the same list as V2 and V3), right under the header
      { t: 'sliders', source: 'layout' },
      item('open_main_panel'), item('open_desktop'), item('connect_device'), item('download_client'),
      page('display', { text: 'vdd' }), item('auto_start', { check: true }), item('check_update', { badge: 'update' }),
      divider,
      page('tools', { more: true }), page('settings', { more: true }), page('help', { more: true }),
      divider,
      { t: 'actions', ids: ['restart', 'shutdown'] },
    ] },
    display: { title: '显示器', rows: displayRows },
    tools: { title: '工具', rows: toolsRows(true) },
    settings: { title: '设置', rows: [page('language', { text: 'locale' }), item('prevent_sleep', { check: true }), item('restart_user_mode', { check: true }), divider, item('import_config'), item('export_config'), page('advanced')] },
    language: { title: '语言', rows: languageRows },
    advanced: { title: '高级', rows: advancedRows },
    help: { title: '帮助', rows: helpRows(false) },
  },
})

/** V2 「状态卡 + 列表」: a card with the state of the host (streams, Foundation Virtual Display, update), the primary actions, then four-plus-one page entries that drill in with a shared-axis slide. */
export const V2 = Object.freeze({
  variant: 'v2', kind: 'stack', root: 'root',
  pages: {
    root: { rows: [
      { t: 'card' },
      // the sliders of state.layout (the same list as V1 and V3), under the status card
      { t: 'sliders', source: 'layout' },
      item('open_main_panel'), item('connect_device'), item('open_desktop'), item('auto_start', { check: true }),
      divider,
      page('display'), page('tools'), page('settings'), page('language', { text: 'locale', inline: true }), page('help'),
      divider,
      { t: 'actions', ids: ['restart', 'shutdown'] },
    ] },
    display: { title: '显示器', rows: [{ t: 'vddcard' }, ...displayRows] },
    tools: { title: '工具', rows: toolsRows(true) },
    settings: { title: '设置', rows: [item('prevent_sleep', { check: true }), item('restart_user_mode', { check: true }), divider, item('import_config'), item('export_config'), page('advanced')] },
    language: { title: '语言', rows: languageRows },
    advanced: { title: '高级', rows: advancedRows },
    help: { title: '帮助', rows: [item('download_client'), divider, ...helpRows(false)] },
  },
})

/**
 * V3 「快捷面板」: the first page is the first level of V1 as a grid of pills (what the person picks and orders, `tiles`), then the sliders the person picks (`sliders`, the bitrate cap and the scale by default,
 * the same list V1 and V2 show); the rest is a swipe or a dot away. Three pages, each as full as the card (the card is as high as the tallest, see MTrayMenu): 快捷, 显示 (the display, its own sliders, what
 * is drawn on screen: 桌宠, 主机性能, RTSS) and 设置与帮助 (settings, the tools that are not on screen, help and the support line).
 */
export const V3 = Object.freeze({
  variant: 'v3', kind: 'pager', order: ['quick', 'display', 'settings'], edit: 'quick',
  pages: {
    quick: { title: '快捷', rows: [
      { t: 'strip' },
      // icon part acts, an optional chevron opens the page of the tile's settings; which tiles, in which order: state.layout (MTrayLayoutEditor), else DEFAULT_TILES
      { t: 'tiles', source: 'layout' },
      // the sliders of state.layout, else DEFAULT_SLIDERS: value shown live, applied on release
      { t: 'sliders', source: 'layout' },
    ] },
    // the later pages are the first page's language: pills in a two-wide grid, a pill that holds several choices opens them in place (a `group`), the state strip where there is a state to show
    display: { title: '显示与工具', rows: [
      { t: 'grid', cells: ['vdd', 'vdd_toggle_keep_enabled', 'vdd_toggle_headless_create', 'reset_display', 'vdd_settings'] },
      // the display's own sliders: the page of the display carries what the quick page's tiles only point to (the quick page's choice of sliders is the person's and may not have them)
      { t: 'sliders', keys: ['resolution', 'refresh'] },
      { t: 'grid', cells: ['show_toolbar', 'host_performance', 'rtss_control', 'web_stream'] },
    ] },
    settings: { title: '设置与帮助', rows: [
      // one grid, so that one group is open at a time on the page: settings, the Web page, the log and the debug page, help
      { t: 'grid', cells: [{ group: 'language' }, 'auto_start', 'prevent_sleep', 'restart_user_mode', { group: 'config' }, 'log_console', 'debug_page', 'open_sunshine', 'download_client', 'about', 'check_update', { group: 'project' }] },
      // the quiet support line is the last thing on the page (never on the first page of V3, never above the operational rows)
      { t: 'support' },
    ] },
  },
  footer: { ids: ['restart', 'shutdown'] },
})

export const VARIANTS = Object.freeze({ v1: V1, v2: V2, v3: V3 })

// ---- density: standard for a mouse, touch for a finger ----

export const TRAY_DENSITIES = Object.freeze(['auto', 'standard', 'touch'])
/**
 * The density the menu opens in: the person's choice (`state.density`, 'auto' unless set) and what the host knows about the press that opened it (`state.touch`: { source: 'touch' | 'pen' | 'mouse' |
 * 'touchpad' | 'keyboard' | 'unknown', slate, capable }; src-tauri/src/tray/input_source.rs, which has the same rule and a test of it). A finger or a pen is touch; with the press unknown, slate posture is touch; a
 * digitizer alone is not (most 2-in-1 laptops are used with a mouse). Decided once, when the menu opens; the first pointer of the page can correct an 'auto' guess (MTrayMenu).
 */
export function openingDensity(pref, touch) {
  if (pref === 'touch' || pref === 'standard') return pref
  const t = touch || {}
  if (t.source === 'touch' || t.source === 'pen') return 'touch'
  if (t.source === 'mouse' || t.source === 'touchpad' || t.source === 'keyboard') return 'standard'
  return t.slate ? 'touch' : 'standard'
}

/** The ids a row carries. */
export function rowIds(row) {
  switch (row.t) {
    case 'item': return [row.id]
    case 'actions': case 'buttons': case 'seg': return row.ids
    case 'header': return ['tray_status']
    case 'card': return ['tray_status', 'recover_service', 'tray_notification_action', 'check_update', 'vdd_settings']
    case 'strip': return ['tray_status', 'tray_notification_action', 'recover_service']
    case 'tiles': return TILE_IDS.flatMap((id) => tileItemIds(id))
    case 'grid': return row.cells.flatMap((c) => (c.group ? GROUPS[c.group].ids : tileItemIds(c)))
    case 'support': return [...SUPPORT_ROW.chips, ...SUPPORT_ROW.sponsors]
    case 'vddcard': case 'sliders': return []
    default: return []
  }
}

/** Every item id a model reaches, with the page that holds it first. */
export function modelIds(model) {
  const where = new Map()
  const add = (id, p) => { if (!where.has(id)) where.set(id, p) }
  for (const [name, pg] of Object.entries(model.pages)) {
    for (const row of pg.rows) for (const id of rowIds(row)) add(id, name)
  }
  for (const id of model.footer?.ids || []) add(id, 'footer')
  return where
}
/** Every page a model has, reached by a `page` row or (in a pager) by its order. */
export function modelPages(model) {
  const reached = new Set([model.root || model.order[0]])
  for (const pg of Object.values(model.pages)) for (const row of pg.rows) if (row.t === 'page') reached.add(row.to)
  for (const name of model.order || []) reached.add(name)
  return reached
}

// ---- state ----

/** The state of the gallery: host running, two sessions, Foundation Virtual Display on 2560×1440@120, an update, DS5 connected. */
export const MOCK_BUSY = Object.freeze({
  connection: 'connected', host: 'streaming', rtss: true, dev: true,
  sessions: [{ name: 'iPad Pro', app: 'Steam Big Picture', bitrate: 48.2, fps: 120 }, { name: 'Steam Deck', app: '桌面', bitrate: 24.6, fps: 60 }],
  vdd: { active: true, cooldown: false, name: '基地虚拟显示器', mode: '2560×1440@120', short: '1440p@120' },
  toggles: { auto_start: true, prevent_sleep: false, vdd_toggle_keep_enabled: true, vdd_toggle_headless_create: false, restart_user_mode: false, show_toolbar: false },
  locale: 'zh', update: { version: '2026.1109.2', current: '2026.1108.4' }, ds5: true, notification: null,
  // what the sliders can change: the display that is streamed (here the virtual one), its modes, its scale, the bitrate cap (0 = 自动)
  sliders: {
    target: { kind: 'stream', name: 'DELL U2723QE', mode: '2560×1440@120' },
    resolution: { options: ['1280x720', '1920x1080', '2560x1440', '3840x2160'], value: '2560x1440' },
    refresh: { options: [60, 90, 120, 144], value: 120 },
    dpi: { value: 150, options: [100, 125, 150, 175, 200, 225, 250, 300] },
    bitrate: { kbps: 80000 },
  },
})
export const MOCK_IDLE = Object.freeze({
  ...MOCK_BUSY, host: 'idle', sessions: [], vdd: { active: false, cooldown: false, name: '基地虚拟显示器', mode: '', short: '' }, update: null, ds5: false,
  // nothing is streamed and no virtual display exists: the desktop is the primary display, its modes and its scale; the bitrate cap needs no display
  sliders: {
    target: { kind: 'desktop', name: 'DELL U2723QE', mode: '2560×1440@144' },
    resolution: { options: ['1920x1080', '2560x1440', '3840x2160'], value: '2560x1440' },
    refresh: { options: [60, 144], value: 144 },
    dpi: { value: 150, options: [100, 125, 150, 175, 200, 225, 250, 300] },
    bitrate: { kbps: 0 },
  },
})
/** idle, but the virtual display exists: the sliders change it */
export const MOCK_VDD = Object.freeze({
  ...MOCK_IDLE, vdd: { active: true, cooldown: false, name: '基地虚拟显示器', mode: '1920×1080@60', short: '1080p@60' },
  // the virtual display is a phone-sized one: the mode sliders change it, and Windows lets it scale only up to 200 % without a sign-out, so the host sends no step above it
  sliders: { ...MOCK_BUSY.sliders, target: { kind: 'vdd', name: '', mode: '1920×1080@60' }, resolution: { options: ['1280x720', '1920x1080', '2560x1440', '3840x2160'], value: '1920x1080' }, refresh: { options: [60, 120], value: 60 }, dpi: { value: 150, options: [100, 125, 150, 175, 200] }, bitrate: { kbps: 0 } },
})

/** the service is down and the core has a notification (the two rows menu.rs adds only then) */
export const MOCK_DOWN = Object.freeze({ ...MOCK_IDLE, connection: 'disconnected', notification: '完成配对: iPad Pro' })

export function stateOf(name) { return name === 'idle' ? MOCK_IDLE : name === 'down' ? MOCK_DOWN : name === 'vdd' ? MOCK_VDD : MOCK_BUSY }

/** the words of a state's language */
export const tx = (state) => trayTexts(state?.locale)
/** An item's label: the host's (the same words as its native menu, in the person's language) else the Chinese label of the design. */
export const labelOf = (id, state) => state?.labels?.[id] || ITEMS[id]?.label || id
/** The label of a tile or a split button: the short one of the state's language, else the full label. */
export const shortOf = (id, state) => tx(state).short?.[id] || ITEMS[id]?.short || labelOf(id, state)
/** The title of a page; the quick panel (`variant` 'v3') has three pages of its own, 显示 and 设置与帮助, that take the names of the old 显示器 and 设置 drill targets. */
export const pageTitle = (page, state, variant = '') => (variant === 'v3' && tx(state).pagesV3?.[page]) || tx(state).pages[page] || PAGES[page]?.title || page
export const vddName = (state) => state?.vdd?.name || tx(state).vddName

export function statusWord(state) {
  const t = tx(state)
  if (state.connection === 'disconnected') return t.disconnected
  if (state.connection === 'connecting') return t.connecting
  return t.host[state.host] || t.host.idle
}
export function statusText(state) { return `Sunshine · ${statusWord(state)}` }
export function streamsText(state) {
  const t = tx(state)
  const n = state.sessions.length
  if (!n) return t.noStreams
  const total = state.sessions.reduce((a, s) => a + (Number(s.bitrate) || 0), 0)
  return t.streams(n, total.toFixed(1))
}
export function vddText(state) { const t = tx(state); return state.vdd.active ? t.vddOn(state.vdd.mode) : t.vddOff }

export function isChecked(id, state) {
  if (id === 'vdd') return state.vdd.active
  if (id === 'check_update') return !!state.update
  if (id.startsWith('lang_')) return state.locale === id.slice(5)
  return !!state.toggles[id]
}
/** menu.rs's enabled flags: the core's items need a connection; create / close follow the display's state. */
export function isEnabled(id, state) {
  const core = state.connection === 'connected'
  switch (id) {
    case 'tray_status': return false
    case 'tray_notification_action': return !!state.notification
    case 'recover_service': return state.connection === 'disconnected'
    case 'open_sunshine': case 'import_config': case 'export_config': case 'reset_config': return core
    case 'vdd_create': return core && !state.vdd.active && !state.vdd.cooldown
    case 'vdd_close': return core && state.vdd.active && !state.vdd.cooldown && !state.toggles.vdd_toggle_keep_enabled
    case 'vdd_toggle_keep_enabled': case 'vdd_toggle_headless_create': case 'reset_display': case 'clear_cache': case 'restart': return core
    default: return true
  }
}
export function isVisible(row, state) {
  if (row.t === 'sliders') return sliderRowShown(row, state)
  switch (row.when) {
    case 'rtss': return !!state.rtss
    case 'dev': return !!state.dev
    case 'disconnected': return state.connection === 'disconnected'
    case 'notification': return !!state.notification
    case 'update': return !!state.update
    default: return true
  }
}
export function textOf(row, state) {
  if (row.text === 'vdd') return vddText(state)
  if (row.text === 'locale') return { zh: '中文', en: 'English', ja: '日本語' }[state.locale] || ''
  return ''
}

// ---- sliders ----

/**
 * A stepped slider (a list of modes, the scale steps the display allows) marks its stops: Material 3 sliders with discrete values show tick marks at the stops (m3.material.io/components/sliders, "Discrete"). The fraction of each
 * stop along the track; none for a continuous slider (the bitrate cap) and none above 16 stops, where the marks would run into one line.
 */
export const MAX_TICKS = 16
export const tickMarks = (n) => (n >= 2 && n <= MAX_TICKS ? Array.from({ length: n }, (_, i) => i / (n - 1)) : [])
const pixels = (r) => { const [w, h] = String(r).split('x').map(Number); return (w || 0) * (h || 0) }
const modeText = (r) => String(r).replace('x', '×')
/** the options plus the value the display has now (a mode the list lacks is still the one in use), ascending */
function withCurrent(options, value, order) {
  const list = Array.isArray(options) ? options.slice() : []
  if (value !== undefined && value !== null && value !== '' && !list.includes(value)) list.push(value)
  return Array.from(new Set(list)).sort(order)
}

/**
 * One slider of the quick page for a state, or null when the host gave it nothing (no target display, no modes): { key, icon, label, min, max, step, pos, text, textAt(pos), valueAt(pos) }.
 * A slider over a list (resolution, refresh) is a slider over the list's positions, so it snaps to the modes the display really has; the scale is the list of steps the host reads from Windows for the target display (`state.sliders.dpi.options`; a phone-sized display stops at 200 %, a step beyond needs a sign-out); the bitrate cap
 * is 0-300 Mbps in steps of 5 (shared rules: src/settings/bitrate.js), 0 = 自动 (the client decides). `valueAt(pos)` is what the host is asked to set.
 */
export function sliderView(key, state) {
  const sl = state?.sliders?.[key]
  if (!sl || !SLIDERS[key]) return null
  const t = tx(state).sliders
  const base = { key, icon: SLIDERS[key].icon, label: t[key] }
  if (key === 'resolution') {
    const list = withCurrent(sl.options, sl.value, (a, b) => pixels(a) - pixels(b))
    if (list.length < 1 || !sl.value) return null
    return { ...base, min: 0, max: list.length - 1, step: 1, pos: list.indexOf(sl.value), ticks: tickMarks(list.length), text: modeText(sl.value), textAt: (p) => modeText(list[p]), valueAt: (p) => list[p] }
  }
  if (key === 'refresh') {
    const list = withCurrent((sl.options || []).map(Number), Number(sl.value), (a, b) => a - b)
    if (list.length < 1 || !Number(sl.value)) return null
    const at = (p) => `${list[p]} Hz`
    return { ...base, min: 0, max: list.length - 1, step: 1, pos: list.indexOf(Number(sl.value)), ticks: tickMarks(list.length), text: `${Number(sl.value)} Hz`, textAt: at, valueAt: (p) => list[p] }
  }
  if (key === 'dpi') {
    // the steps Windows lets the target display take now without signing out (the host reads them from the system at every state): a slider over their positions, so it can only rest on a step
    // that can be applied. A phone-sized display stops at 200 %.
    const v = Number(sl.value)
    const list = withCurrent((sl.options || []).map(Number), v, (a, b) => a - b)
    if (!v || !(sl.options || []).length) return null
    return { ...base, min: 0, max: list.length - 1, step: 1, pos: list.indexOf(v), ticks: tickMarks(list.length), text: `${v}%`, textAt: (p) => `${list[p]}%`, valueAt: (p) => list[p] }
  }
  // bitrate: kbps from the host (a number or a numeric string); the position is whole Mbps rounded to the step
  const pos = bitrateSliderProgress(sl.kbps)
  const textAt = (p) => { const kbps = bitrateFromProgress(p); return p === 0 ? t.auto : `${Math.round(kbps / 100) / 10} Mbps` }
  return { ...base, ticks: bitrateSegmentMarks, min: 0, max: BITRATE_SLIDER_MAX_PROGRESS, step: 1, pos, text: bitrateText(bitrateKbps(sl.kbps), t.auto), textAt, valueAt: (p) => bitrateFromProgress(p), offText: t.auto }
}
/** The sliders a row asks for that the state can draw, in the row's order: the row's own `keys`, or (source: 'layout') the ones the person chose. */
export const sliderKeysOf = (row, state) => (row.source === 'layout' ? layoutOf(state).sliders : row.keys || [])
export const sliderViews = (row, state) => sliderKeysOf(row, state).map((k) => sliderView(k, state)).filter(Boolean)
/** whether the row draws anything: a slider the state can draw, or (for the display sliders) the line that says why there is none. A row with nothing to say is not in the page at all, so it takes no room and no row is left empty. */
export const sliderRowShown = (row, state) => needsDisplay(row, state) || sliderViews(row, state).length > 0
/**
 * whether any slider the row asks for changes the mode of a display (resolution, refresh rate): the line above them says which display. The scale follows the same display but is offered whenever the host
 * can read its steps, and the bitrate cap is the host's, so neither needs a target line of its own.
 */
export const needsDisplay = (row, state) => sliderKeysOf(row, state).some((k) => k === 'resolution' || k === 'refresh')
/** The line above the sliders: which display they change, or why the mode sliders are not there. `row`, when given, says whether the scale is among them (its note is only said then). */
export function sliderTargetText(state, row) {
  const t = tx(state).sliders
  const target = state?.sliders?.target
  if (!target) return { none: true, text: t.none, hint: t.noneHint }
  return { none: false, text: t.target(target.name || tx(state).vddName), hint: target.mode || '' }
}


// ---- the quick page's layout: which tiles and sliders, in which order ----

/** the item ids a tile runs */
export const tileItemIds = (id) => { const x = TILES[id]; return x?.on ? [x.on, x.off] : [id] }
const defOf = (id) => TILES[id] || CELLS[id]
const uniqueKnown = (list, known) => Array.from(new Set(list)).filter((x) => known.includes(x))
/** A layout from whatever was stored: `tiles` / `sliders` are the ids shown, in order; anything that is not a list (never edited) takes the default; unknown and repeated ids are dropped. [] is a real choice (nothing shown). */
export function normalizeLayout(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  return {
    tiles: Array.isArray(r.tiles) ? uniqueKnown(r.tiles, TILE_IDS) : DEFAULT_TILES.slice(),
    sliders: Array.isArray(r.sliders) ? uniqueKnown(r.sliders, SLIDER_KEYS) : DEFAULT_SLIDERS.slice(),
  }
}
export const layoutOf = (state) => normalizeLayout(state?.layout)
/** the record to store: a list equal to the default is stored as null, so a later change of the default reaches a person who never changed it */
export function layoutRecord(layout) {
  const l = normalizeLayout(layout)
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])
  return { tiles: same(l.tiles, DEFAULT_TILES) ? null : l.tiles, sliders: same(l.sliders, DEFAULT_SLIDERS) ? null : l.sliders }
}
export const isDefaultLayout = (layout) => { const r = layoutRecord(layout); return r.tiles === null && r.sliders === null }
/** a tile the host can offer now (RTSS only when installed) */
export const tileAvailable = (id, state) => TILES[id] && isVisible({ when: TILES[id].when }, state)

/** `list` with `id` moved to index `to` (clamped); the same list when nothing moves */
export function moveItem(list, id, to) {
  const from = list.indexOf(id)
  if (from < 0) return list
  const at = Math.max(0, Math.min(list.length - 1, to))
  if (at === from) return list
  const next = list.slice()
  next.splice(from, 1); next.splice(at, 0, id)
  return next
}
export const hideItem = (list, id) => list.filter((x) => x !== id)
/** shown at the end of the list (known ids only) */
export const showItem = (list, id) => (list.includes(id) ? list : [...list, id])

/** One tile for a state: { id, act (the item id a press runs), icon, label, text (sub-label), on, lit, locked, disabled, drill, fresh } */
export function tileView(id, state) {
  const def = defOf(id)
  if (!def) return null
  const t = tx(state)
  const toggle = def.kind === 'toggle'
  const choice = def.kind === 'choice'
  const on = id === 'vdd' ? !!state.vdd?.active : def.kind === 'update' ? !!state.update : toggle || choice ? isChecked(id, state) : false
  const act = def.on ? (on ? def.on : def.off) : id
  let text = ''
  if (id === 'vdd') text = on ? state.vdd.short || state.vdd.mode || t.on : t.off
  else if (def.kind === 'update') text = state.update?.version || t.upToDate
  else if (toggle) text = on ? t.on : t.offShort
  const enabled = isEnabled(act, state)
  return {
    id, act, kind: def.kind, icon: def.icon || ITEMS[id]?.icon || 'info', label: id === 'vdd' ? t.vddTile : shortOf(id, state), name: id === 'vdd' ? vddName(state) : labelOf(id, state),
    text, on, locked: on && !enabled && toggle, disabled: !on && !enabled, drill: def.drill || '', fresh: def.kind === 'update' && on, danger: !!ITEMS[id]?.danger,
  }
}

/**
 * The cells of a `grid` row (the later pages of V3) for a state, in the row's order: a pill per item the host can offer, a `group` pill where the row names a group. Every pill is a tileView; a drill chevron makes
 * no sense on a page that is already the page of the settings, so there is none. `wide` marks what takes the whole row: a group, and a single pill left alone in its row (the grid is two wide, so the cell before a
 * group, or the last one, would leave a hole). A group's `items` are its choices (the ones the host can offer).
 */
export function gridCells(row, state) {
  const t = tx(state)
  const out = []
  let col = 0
  for (const c of row.cells) {
    if (c.group) {
      const g = GROUPS[c.group]
      const items = g.ids.map((id) => tileView(id, state)).filter((x, i) => x && isVisible({ when: defOf(g.ids[i]).when }, state))
      if (!items.length) continue
      if (col === 1) out[out.length - 1].wide = true
      const text = g.choice ? (items.find((x) => x.on)?.label || '') : ''
      out.push({ key: `group:${c.group}`, group: c.group, icon: g.icon, label: t.groups[c.group], text, items, choice: !!g.choice, wide: true })
      col = 0
      continue
    }
    if (!defOf(c) || !isVisible({ when: defOf(c).when }, state)) continue
    const v = { ...tileView(c, state), drill: '', key: c, wide: false }
    out.push(v)
    col = 1 - col
  }
  if (col === 1) out[out.length - 1].wide = true
  return out
}
/** The tiles of the quick page for a state: the layout's, in order, minus what the host cannot offer now. */
export const tileViews = (state) => layoutOf(state).tiles.filter((id) => tileAvailable(id, state)).map((id) => tileView(id, state))
/** The tiles that are not shown and could be (the host can offer them), in catalog order. */
export const hiddenTiles = (state) => { const shown = layoutOf(state).tiles; return TILE_IDS.filter((id) => !shown.includes(id) && tileAvailable(id, state)) }
export const hiddenSliders = (state) => { const shown = layoutOf(state).sliders; return SLIDER_KEYS.filter((k) => !shown.includes(k)) }

// ---- navigation ----

/** The page state of a menu (plain methods on `this`, so a reactive() wrapper makes it observable). A stack (V1, V2) drills in and backs out; a pager (V3) goes to any page by index. */
export function createNav(model, start) {
  const nav = {
    model,
    trail: model.kind === 'stack' ? [model.root] : [],
    index: 0,
    direction: 1, // +1 forward (the new page enters from the end), -1 back
    get current() { return this.model.kind === 'stack' ? this.trail[this.trail.length - 1] : this.model.order[this.index] },
    get canBack() { return this.model.kind === 'stack' && this.trail.length > 1 },
    get depth() { return this.model.kind === 'stack' ? this.trail.length - 1 : 0 },
    open(id) {
      if (this.model.kind === 'pager') return this.go(this.model.order.indexOf(id))
      if (!this.model.pages[id]) return false
      this.direction = 1; this.trail.push(id); return true
    },
    back() {
      if (!this.canBack) return false
      this.direction = -1; this.trail.pop(); return true
    },
    go(i) {
      if (this.model.kind !== 'pager' || i < 0 || i >= this.model.order.length || i === this.index) return false
      this.direction = i > this.index ? 1 : -1; this.index = i; return true
    },
    reset() { this.direction = -1; if (this.model.kind === 'stack') this.trail = [this.model.root]; else this.index = 0 },
  }
  if (start && start !== nav.current) {
    if (model.kind === 'pager') nav.index = Math.max(0, model.order.indexOf(start))
    else if (model.pages[start]) nav.trail.push(start)
  }
  return nav
}
