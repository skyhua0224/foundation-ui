// The second line of every row of a list pane (and of the settings hub of a narrow window), as Pixel Settings has it: the LIVE STATE of the row where it has one that
// matters ("端口 47989 · UPnP 关", "30 台已配对"), otherwise the two to four most important things inside ("语言、主机名称、睡眠模式"), so a person finds an option
// without opening every page. One line, one source of truth for the control panel and the Web UI. Pure: no DOM, no Vue.
//
//   rowLines({ locale, config, clients, apps, components, ds, mic, usb })  ->  { [rowId]: text }   every row of the products has an entry
//   rowLine(id, sources, locale)  one row; `live` first, the contents line when the source is missing, never blank
//   rowKeywords(id)               the contents words of both languages, for the search index
//
// Sources, all optional (a missing one only means that row shows its contents):
//   config      the host's /api/config answer            clients   array of paired clients (named_certs) or null     apps  array or count or null
//   components  rows of the component status ({ id, state }) or null                                                  ds    { state } of the DualSense channel
//   rtss        { installed } of RivaTuner Statistics Server, an optional third-party component: unless installed there is no `rtss` row and the 系统 line does not name it
//               (no such source: the row stays, as before)
//   mic         the host's microphone status (as read from /api/microphone/status)                                   usb   { ready, attached_devices } of the USB/IP transport
//   audio       the playback devices of the host (GET /api/audio/devices `render`), to show the chosen device by its name: the setting holds an id, which is never shown
// Row ids: `config:<tab>` and `password` (the settings), `clients`, `apps`, `downloads`, `gamepad`, `microphone`, `usb`, `vdd`, `quality`, `components`, `diagnostics`,
// `toolbox`, `session`, `rtss`, `service`, `panel`, `help`, `assistant`, and `rail:<id>` for the categories of the settings hub.
import { microphoneState } from '../status/model.js'
import { audioDeviceName } from './audioDevice.js'
import { encoderName } from './model.js'
import { VDD_PREP, vddModeOf, vddOn } from './virtualDisplay.js'

const ZH = {
  content: {
    'config:general': '语言、主机名称、睡眠模式',
    'config:files': '应用文件、凭据、日志、证书',
    'config:input': '手柄、键盘、鼠标与触控、USB 转发',
    keyboard: '键盘输入、扫描码、按键重复',
    mouse: '鼠标输入、滚动、触控笔与触摸、虚拟鼠标',
    'config:network': '端口、UPnP、mDNS、加密',
    'config:appearance': '主题、磨砂与动效、概览、托盘图标',
    'appearance-theme': '壁纸、配色、明暗、图标',
    'appearance-frost': '模糊、压暗、渐隐、动画',
    'appearance-home': '磁贴密度、智能磁贴、时钟',
    'appearance-tray': '右键、单击双击、快捷面板',
    password: '用户名和密码',
    clients: '配对、权限、设备名称',
    apps: '添加、编辑、封面',
    downloads: '各平台的客户端安装包',
    gamepad: '手柄类型、触觉反馈、扳机、灯条',
    microphone: '麦克风后端、设备、延迟',
    usb: '转发开关、端口、本机设备',
    'display-output': '输出显示器、显示模式、显示器配置、无头模式',
    'display-modes': '分辨率策略、支持的分辨率与刷新率',
    'display-encoders': '码率上限、视频格式、编码器',
    'display-advanced': '捕获、显卡、兼容性、同步',
    'display-hdr': 'HDR 状态、系统 HDR、校准',
    'audio-output': '输出设备、虚拟声卡、音频串流',
    vdd: '设备、常驻、无头',
    quality: 'DLSS 降噪、组件',
    components: 'Foundation Virtual Display、USB/IP、ViGEmBus、虚拟麦克风、Vulkan HDR、DLSS NR、RTX HDR',
    diagnostics: '日志、错误、导出诊断包、AI 诊断、重启与重置',
    network: '公网 IPv4/IPv6、NAT 类型、UPnP、防火墙',
    toolbox: '手柄测试、触控笔、延迟测试网页',
    'latency-clock': '拍下两块屏幕，读数之差就是延迟',
    'test-tools': '画面测试图、帧率与卡顿、音画同步、声道、键盘鼠标触控、防休眠',
    'stream-timer': '串流时长与定时提醒',
    session: '码率、主机延迟、编码管线',
    rtss: '帧率限制、OSD、串流监控、HWiNFO',
    service: '运行状态、启动方式、启动与停止',
    panel: '个性化、语言、更新通道、同步',
    help: '版本、引导、反馈',
    assistant: '对话、模型、助手设置',
    'rail:config': '常规、配置文件、网络',
    'rail:input': '手柄、键盘、鼠标与触控、USB 转发',
    'rail:display': '显示器、分辨率与刷新率、HDR、画质增强、编码与码率、基地虚拟显示器、高级',
    'rail:audio': '音频输出、麦克风',
    'rail:system': '组件状态、Sunshine 服务、网络概览、诊断与日志、工具箱、延迟时钟、测试工具、计时器、RTSS',
  },
  audioOn: '音频串流 开', audioOff: '音频串流 关', audioDevice: '所选设备', vddMode: { physical: '使用物理显示器', ondemand: '按需创建基地虚拟显示器', persistent: '基地虚拟显示器常驻' }, auto: '自动选择', paired: '{n} 台已配对', streaming: '{n} 台串流中', apps: '{n} 个应用', port: '端口 {n}', upnp: 'UPnP {v}', on: '开', off: '关',
  allOk: '{n} 个组件全部正常', needsWork: '{n} 项需要处理',
  dsReady: '已就绪', dsActive: '正在使用', dsProblem: '需要处理',
  mic: { waiting: '等待使用', active: '正在使用', idle: '空闲', streaming: '串流中', capturing: '采集中', starting: '启动中', stopping: '停止中', faulted: '有故障', missing: '未安装', disabled: '已关闭' },
  micBackend: { vb_cable: 'VB-CABLE', usbip: 'USB/IP', usbip_experimental: 'USB/IP' },
  usbConnected: '{n} 台已连接', usbNone: '没有设备连接',
  prep: { no_operation: '不更改', ensure_active: '激活此显示器', ensure_primary: '设为主显示器', ensure_only_display: '仅使用此显示器', ensure_secondary: '扩展显示器' },
  output: { physical: '物理显示器', virtual: '基地虚拟显示器' }, follow: '跟随客户端', fixed: '保持当前值', fixedValue: '自定义', capture: { ddx: 'DDA', wgc: 'WGC', amd: 'AMD', vdd: 'VDD' },
}
const EN = {
  content: {
    'config:general': 'Language, host name, sleep mode',
    'config:files': 'App file, credentials, log, certificate',
    'config:input': 'Gamepad, keyboard, mouse and touch, USB forwarding',
    keyboard: 'Keyboard input, scancodes, key repeat',
    mouse: 'Mouse input, scrolling, pen and touch, virtual mouse',
    'config:network': 'Port, UPnP, mDNS, encryption',
    'config:appearance': 'Theme, frost and motion, overview, tray icon',
    'appearance-theme': 'Wallpaper, colours, dark mode',
    'appearance-frost': 'Blur, tint, fade, animations',
    'appearance-home': 'Tile density, smart tiles, clock',
    'appearance-tray': 'Right-click, click, quick panel',
    password: 'User name and password',
    clients: 'Pairing, permissions, device names',
    apps: 'Add, edit, covers',
    downloads: 'Client installers for every platform',
    gamepad: 'Pad type, haptics, triggers, light bar',
    microphone: 'Microphone backend, device, latency',
    usb: 'Local devices, remote devices, forwarding',
    'display-output': 'Output display, display mode, display configuration, headless',
    'display-modes': 'Resolution policy, supported resolutions and refresh rates',
    'display-encoders': 'Bitrate cap, video format, encoder',
    'display-advanced': 'Capture, graphics card, compatibility, sync',
    'display-hdr': 'HDR status, system HDR, calibration',
    'audio-output': 'Output device, virtual sound card, audio streaming',
    vdd: 'Device, always on, headless',
    quality: 'DLSS noise reduction, components',
    components: 'Foundation Virtual Display, USB/IP, ViGEmBus, virtual microphone, Vulkan HDR, DLSS NR, RTX HDR',
    diagnostics: 'Logs, errors, export a diagnostic package, AI diagnosis, restart and reset',
    network: 'Public IPv4/IPv6, NAT type, UPnP, firewall',
    toolbox: 'Gamepad test, stylus probe, the latency test page',
    'latency-clock': 'Photograph both screens: the difference of the readings is the latency',
    'test-tools': 'Test patterns, frame rate and judder, A/V sync, channels, keyboard mouse and touch, keep awake',
    'stream-timer': 'How long the stream has run, and a timer',
    session: 'Bitrate, host latency, encode pipeline',
    rtss: 'Frame-rate limit, OSD, stream monitoring, HWiNFO',
    service: 'State, startup type, start and stop',
    panel: 'Appearance, language, update channel, sync',
    help: 'Version, guide, feedback',
    assistant: 'Chat, model, assistant settings',
    'rail:config': 'General, config files, network',
    'rail:input': 'Gamepad, keyboard, mouse and touch, USB forwarding',
    'rail:display': 'Display, resolution & refresh rate, HDR, picture enhancement, encoding & bitrate, Foundation Virtual Display, advanced',
    'rail:audio': 'Audio output, microphone',
    'rail:system': 'Components, Sunshine service, network overview, diagnostics and logs, toolbox, latency clock, test tools, timer, RTSS',
  },
  audioOn: 'Audio streaming on', audioOff: 'Audio streaming off', audioDevice: 'Selected device', vddMode: { physical: 'Physical display', ondemand: 'Foundation Virtual Display on demand', persistent: 'Foundation Virtual Display stays' }, auto: 'Automatic', paired: '{n} paired', streaming: '{n} streaming', apps: '{n} apps', port: 'Port {n}', upnp: 'UPnP {v}', on: 'on', off: 'off',
  allOk: '{n} components working', needsWork: '{n} need attention',
  dsReady: 'Ready', dsActive: 'In use', dsProblem: 'Needs attention',
  mic: { waiting: 'Waiting for use', active: 'In use', idle: 'Idle', streaming: 'Streaming', capturing: 'Capturing', starting: 'Starting', stopping: 'Stopping', faulted: 'Fault', missing: 'Not installed', disabled: 'Off' },
  micBackend: { vb_cable: 'VB-CABLE', usbip: 'USB/IP', usbip_experimental: 'USB/IP' },
  usbConnected: '{n} connected', usbNone: 'No device connected',
  prep: { no_operation: 'No change', ensure_active: 'Activate this display', ensure_primary: 'Set as main display', ensure_only_display: 'Use only this display', ensure_secondary: 'Extend displays' },
  output: { physical: 'Physical display', virtual: 'Foundation Virtual Display' }, follow: 'Follow client', fixed: 'Keep current', fixedValue: 'Custom', capture: { ddx: 'DDA', wgc: 'WGC', amd: 'AMD', vdd: 'VDD' },
}
export const rowTexts = (locale) => (String(locale || '').toLowerCase().startsWith('zh') ? ZH : EN)
export const ROW_IDS = Object.freeze(Object.keys(ZH.content))
// Retired names of the one page, so a search for either old row still lands on it.
const ROW_ALIASES = {
  // the words of every setting of a 个性化 page, so a search for one of them lands on the page that holds it (both languages, and the names the team uses)
  'appearance-theme': '个性化 主题 背景 壁纸 纯色 图片 取色 配色 配色风格 基础颜色 明暗 浅色 深色 纯黑 图标样式 界面 卡片圆角 文字大小 列表栏 Personalise theme background wallpaper picture colour color style light dark black icon style corners text size list pane',
  'appearance-frost': '磨砂 模糊 压暗 渐隐 向下渐隐 动画 动效 减少动效 完整 跟随系统 概览模糊 其他页面 恢复默认 frost frosted blur tint dim fade animation animations motion reduced',
  'appearance-home': '主页 概览 概览布局 磁贴 磁贴密度 智能磁贴 全屏磁贴 时钟 时钟模式 时钟样式 时钟位置 时钟大小 显示秒 本主机卡片 封面取色 overview home tiles density smart tiles dock clock seconds hero host card art',
  'appearance-tray': '托盘 托盘图标 系统托盘 右键 右键菜单 单击 双击 快捷面板 快捷砖 滑块 原生菜单 系统菜单 tray icon right-click click double-click quick panel tiles sliders native menu',
  diagnostics: '诊断 日志与排错 故障诊断 日志与诊断 Diagnostics troubleshooting Logs and troubleshooting' }

const fill = (text, values) => String(text).replace(/\{(\w+)\}/g, (_, k) => values[k])
const str = (v) => (v === undefined || v === null ? '' : String(v).trim())
const list = (v, ...keys) => { if (Array.isArray(v)) return v; for (const k of keys) if (Array.isArray(v?.[k])) return v[k]; return null }
// hevc_mode / av1_mode: 0 automatic, 1 off, 2 on, 3 on with HDR (a codec is advertised unless the mode is 1)
const codec = (v) => str(v) !== '' && str(v) !== '1'

/** The live state of each row that has one (real data only); a row without a source has no entry. */
export function liveLines({ locale, config, clients, apps, components, ds, mic, usb, audio } = {}) {
  const T = rowTexts(locale)
  const out = {}
  const cfg = config && typeof config === 'object' ? config : null
  if (cfg) {
    const port = Number(cfg.port)
    if (str(cfg.port) && port > 0) out['config:network'] = [fill(T.port, { n: port }), cfg.upnp === undefined || cfg.upnp === '' ? '' : fill(T.upnp, { v: vddOn(cfg.upnp) ? T.on : T.off })].filter(Boolean).join(' · ')
    const encoder = encoderName(cfg.active_encoder)
    if (encoder) out['display-encoders'] = [encoder, ['H.264', codec(cfg.hevc_mode) ? 'HEVC' : '', codec(cfg.av1_mode) ? 'AV1' : ''].filter(Boolean).join('/')].join(' · ')
    const prep = VDD_PREP.includes(cfg.display_device_prep) ? cfg.display_device_prep : 'no_operation'
    const manual = (rule, value) => (cfg[rule] === 'manual' && str(cfg[value]) ? str(cfg[value]) : '')
    const resolution = manual('resolution_change', 'manual_resolution').replace(/x/i, '×')
    const refresh = manual('refresh_rate_change', 'manual_refresh_rate')
    const shown = vddModeOf(cfg) === 'physical' ? (str(cfg.output_name) ? T.output.physical : T.auto) : T.output.virtual
    out['display-output'] = [shown, T.prep[prep]].filter(Boolean).join(' · ')
    out.vdd = T.vddMode[vddModeOf(cfg)]
    out['audio-output'] = [cfg.stream_audio === undefined || cfg.stream_audio === '' || vddOn(cfg.stream_audio) ? T.audioOn : T.audioOff, audioDeviceName(str(cfg.audio_sink), audio, T.audioDevice)].filter(Boolean).join(' · ')
    const rule = (name) => (cfg[name] === 'no_operation' ? T.fixed : cfg[name] === 'manual' ? T.fixedValue : T.follow)
    out['display-modes'] = [cfg.resolution_change === undefined && cfg.refresh_rate_change === undefined ? '' : rule('resolution_change'), resolution, refresh ? `${refresh.replace(/\s*hz$/i, '')}Hz` : ''].filter(Boolean).join(' · ')
    if (!out['display-modes']) delete out['display-modes']
    const capture = str(cfg.capture)
    out['display-advanced'] = [capture ? T.capture[capture] || capture : T.auto, str(cfg.adapter_name) ? str(cfg.adapter_name).split(/[\\/]/).pop() : ''].filter(Boolean).join(' · ')
    const bitrate = Number(cfg.max_bitrate)
    if (out['display-encoders'] && bitrate > 0) out['display-encoders'] += ` · ${Math.round(bitrate / 100) / 10} Mbps`
  }
  const people = list(clients, 'named_certs', 'clients')
  if (people) {
    const streaming = people.filter((c) => c?.streaming && c?.enabled !== false).length
    out.clients = [fill(T.paired, { n: people.length }), streaming ? fill(T.streaming, { n: streaming }) : ''].filter(Boolean).join(' · ')
  }
  const appCount = typeof apps === 'number' ? apps : list(apps, 'apps')?.length
  if (typeof appCount === 'number') out.apps = fill(T.apps, { n: appCount })
  const rows = Array.isArray(components) ? components.filter((r) => r && r.state && r.state !== 'unknown') : []
  if (rows.length) {
    const bad = rows.filter((r) => ['warn', 'error', 'missing'].includes(r.state)).length
    out.components = bad ? fill(T.needsWork, { n: bad }) : fill(T.allOk, { n: rows.length })
  }
  if (ds && ds.state) out.gamepad = ['DualSense', ['ready'].includes(ds.state) ? T.dsReady : ds.state === 'active' ? T.dsActive : T.dsProblem].join(' · ')
  if (mic && typeof mic === 'object' && mic.configured_backend) {
    const state = T.mic[microphoneState(mic)]
    const backend = T.micBackend[mic.active_backend || mic.configured_backend] || ''
    if (state) out.microphone = [backend, state].filter(Boolean).join(' · ')
  }
  const attached = Array.isArray(usb?.attached_devices) ? usb.attached_devices.length : null
  if (usb && usb.ready !== undefined && attached !== null) out.usb = attached ? fill(T.usbConnected, { n: attached }) : T.usbNone
  return out
}

/** The contents line of a row (the two to four most important things inside). */
export const contentLine = (id, locale, withoutRtss = false) => {
  const text = rowTexts(locale).content[id] || ''
  return withoutRtss && id === 'rail:system' ? text.replace(/(?:、|, )RTSS$/, '') : text
}
// RivaTuner Statistics Server is not installed (a source that says so, or that has not said yet)
const rtssAbsent = (sources) => !!sources && !!sources.rtss && sources.rtss.installed !== true

/** One row's second line: the live state, else the contents; never blank for a known row. */
export const rowLine = (id, sources = {}, locale = 'en') => (id === 'rtss' && rtssAbsent(sources) ? '' : liveLines({ ...sources, locale })[id] || contentLine(id, locale, rtssAbsent(sources)))

/** Every row's second line (live first, contents otherwise). */
export function rowLines({ locale, ...sources } = {}) {
  const live = liveLines({ locale, ...sources })
  const absent = rtssAbsent(sources)
  return Object.fromEntries(ROW_IDS.filter((id) => !(absent && id === 'rtss')).map((id) => [id, live[id] || contentLine(id, locale, absent)]))
}

/** The contents words of a row in both languages: the search index finds a row by what is inside it. */
export const rowKeywords = (id) => [ZH.content[id], EN.content[id], ROW_ALIASES[id]].filter(Boolean).join(' ')
