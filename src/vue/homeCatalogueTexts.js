import { textTable } from '../locale/texts/index.js'
// Texts of the cards of the extended home catalogue. c_<id> is the card's name, s_<id> says where its data comes from.
import { MORE_TEXTS } from './homeCatalogueTextsMore.js'
import { RECENT_TEXTS } from './homeRecent.js'
import { GROWTH_TEXTS } from './homeGrowth.js'
import { GROWTH2_TEXTS } from './homeGrowth2.js'

const BASE = Object.freeze({
  en: {
    gGroup_all: 'All', on: 'On', off: 'Off', pairGetQr: 'Get QR code', 'c_ctl-vdd': 'Foundation Virtual Display',
    c_latency: 'Host latency', c_loss: 'Packet loss', s_loss: 'Only with adaptive bitrate on', c_dropped: 'Dropped frames', 
    'c_session-time': 'Streaming for', 'c_current-app': 'Now playing', c_budget: 'Frame budget', frameTime: 'Frame time', stageCapture: 'Capture', stageConvert: 'Convert', stageQueue: 'Queue', stageEncode: 'Encode', stageSend: 'Send', s_budget: 'Host latency against the frame time',
    'c_last-session': 'Last session', 'c_session-heat': 'Streaming history', 's_session-heat': 'Minutes per day', 'c_recent-games': 'Recently played', 
    'c_clients-paired': 'Paired clients', 'c_clients-online': 'Online now', 's_clients-online': 'Paired clients that are streaming', c_covers: 'Library', 
    c_codecs: 'Codecs', c_hdr: 'HDR', 'c_audio-out': 'Audio', 'c_gamepad-status': 'Gamepad', 
    c_reach: 'Remote access', reachEmpty: 'Not checked',
    'c_usb-devices': 'USB devices', c_errors: 'Errors', s_errors: 'Last 24 hours', c_logs: 'Log', c_update: 'Version', c_announcements: 'News', news_announce: 'Announcements', news_update: 'Updates', news_guide: 'Guides', 
    'c_act-export-diag': 'Export diagnostics', 'c_act-update': 'Check for updates', 'c_act-logs': 'View the log', 'c_act-pair-qr': 'Pair with a QR code', 'c_act-stream-check': 'Connection guide', c_quick: 'Quick actions', checkAction: 'Check', qrAction: 'Show', startAction: 'Start', quickCheck: 'Connection guide', quickLogs: 'Log', quickUpdate: 'Updates', quickRestart: 'Restart',
    'c_act-pair': 'Pair a client', 'c_act-add-app': 'Add an application', 'c_act-scan-games': 'Scan the game library', 'c_act-restart': 'Restart the host', 's_act-restart': 'Restarts the streaming service', 'c_act-docs': 'Documentation', 'c_act-community': 'Community', 'c_act-star': 'Star on GitHub', 'c_act-open-desktop': 'Open Big Screen', openDesktopFailed: 'Could not open the big screen',
    'c_ctl-encoder': 'Encoder', 'c_ctl-fps': 'Frame rates', addFps: 'Add', addText: 'Add', 'c_ctl-bitrate': 'Bitrate cap', 'c_memory-trend': 'Memory over time', c_load: 'CPU and GPU', c_temperature: 'Temperature', s_temperature: 'Needs HWiNFO (control panel only)', restartNote: 'Applies after the host restarts', clientNote: 'Set by the client · after a restart', band: 'average ±15 %', range1: '1 min', range5: '5 min', rangeSession: 'This session', cap: 'cap', noDrops: 'No dropped frames', noDownlink: 'The host reports no traffic from the client, so only the stream towards it is drawn.', sessionDetail: 'This session', perClient: 'Per client (this interface\'s record)',
    loss_off: 'Not reported: adaptive bitrate is off', nowNone: 'Nothing is running', lastNone: 'No finished session yet', historyNone: 'No sessions yet', recentNone: 'Nothing played yet', onlineNone: 'Nobody is streaming', logNone: 'No errors in the log', annNone: 'No announcements', coversNone: 'No applications yet',
    audioDevice: 'Selected device', average: 'average', peak: 'peak', minutes: 'min', hours: 'h', days30: '30 days', today: 'Today', loadCpu: 'CPU', loadGpu: 'GPU', errorsLabel: 'Errors', warningsLabel: 'Warnings', unlimited: 'Unlimited', auto: 'Automatic', channels: 'Channels', device: 'Device', version: 'Version', updateReady: 'Update available', upToDate: 'Up to date', client: 'Client', bitrateAvg: 'Bitrate', fpsAvg: 'Frame rate', p95: 'Latency P95', length: 'Length', when: 'Started', plural: 'sessions',
    openDocs: 'Open', pairAction: 'Pair', addAction: 'Add', scanAction: 'Scan', restartAction: 'Restart', starAction: 'Star', joinAction: 'Join', usbNone: 'No devices attached', usbCount: 'attached',
  },
  zh: {
    gGroup_all: '全部', on: '开', off: '关', pairGetQr: '获取二维码', 'c_ctl-vdd': '基地虚拟显示器',
    c_latency: '主机延迟', c_loss: '丢包率', s_loss: '仅在开启自适应码率时有', c_dropped: '丢帧', 
    'c_session-time': '串流时长', 'c_current-app': '正在玩', c_budget: '帧时间占用', frameTime: '帧时间', stageCapture: '捕获', stageConvert: '转换', stageQueue: '排队', stageEncode: '编码', stageSend: '发送', s_budget: '主机延迟与帧时间之比',
    'c_last-session': '上次串流', 'c_session-heat': '串流历史', 's_session-heat': '每天的分钟数', 'c_recent-games': '最近玩过', 
    'c_clients-paired': '已配对客户端', 'c_clients-online': '当前在线', 's_clients-online': '正在串流的已配对客户端', c_covers: '游戏库', 
    c_codecs: '编解码', c_hdr: 'HDR', 'c_audio-out': '音频', 'c_gamepad-status': '手柄', 
    c_reach: '远程访问', reachEmpty: '尚未检测',
    'c_usb-devices': 'USB 设备', c_errors: '错误', s_errors: '最近 24 小时', c_logs: '日志', c_update: '版本', c_announcements: '资讯', news_announce: '公告', news_update: '更新', news_guide: '教程', 
    'c_act-export-diag': '导出诊断包', 'c_act-update': '检查更新', 'c_act-logs': '查看日志', 'c_act-pair-qr': '二维码配对', 'c_act-stream-check': '连接引导', c_quick: '快捷操作', checkAction: '检查', qrAction: '显示', startAction: '开始', quickCheck: '连接引导', quickLogs: '日志', quickUpdate: '检查更新', quickRestart: '重启',
    'c_act-pair': '配对客户端', 'c_act-add-app': '添加应用', 'c_act-scan-games': '扫描游戏库', 'c_act-restart': '重启主机', 's_act-restart': '重启串流服务', 'c_act-docs': '文档', 'c_act-community': '社区', 'c_act-star': '在 GitHub 点 Star', 'c_act-open-desktop': '打开大屏', openDesktopFailed: '无法打开大屏',
    'c_ctl-encoder': '编码器', 'c_ctl-fps': '帧率预设', addFps: '添加', addText: '添加', 'c_ctl-bitrate': '码率上限', 'c_memory-trend': '内存变化', c_load: 'CPU 与 GPU', c_temperature: '温度', s_temperature: '需要 HWiNFO（仅控制面板）', restartNote: '重启主机后生效', clientNote: '由客户端决定 · 重启后生效', band: '平均值 ±15 %', range1: '1 分钟', range5: '5 分钟', rangeSession: '本次会话', cap: '上限', noDrops: '没有丢帧', noDownlink: '主机不报告客户端方向的流量，所以只画向客户端的流。', sessionDetail: '当前会话', perClient: '各客户端（此界面的记录）',
    loss_off: '未上报：自适应码率未开启', nowNone: '没有正在运行的内容', lastNone: '还没有结束的会话', historyNone: '还没有会话', recentNone: '还没有玩过', onlineNone: '没有人在串流', logNone: '日志里没有错误', annNone: '没有公告', coversNone: '还没有应用',
    audioDevice: '所选设备', average: '平均', peak: '峰值', minutes: '分钟', hours: '小时', days30: '30 天', today: '今天', loadCpu: 'CPU', loadGpu: 'GPU', errorsLabel: '错误', warningsLabel: '警告', unlimited: '不限', auto: '自动', channels: '声道', device: '设备', version: '版本', updateReady: '有可用更新', upToDate: '已是最新', client: '客户端', bitrateAvg: '码率', fpsAvg: '帧率', p95: '延迟 P95', length: '时长', when: '开始', plural: '次会话',
    openDocs: '打开', pairAction: '配对', addAction: '添加', scanAction: '扫描', restartAction: '重启', starAction: 'Star', joinAction: '加入', usbNone: '没有已连接的设备', usbCount: '台已连接',
  },
})

export const CATALOGUE_TEXTS = Object.freeze({ en: { ...BASE.en, ...MORE_TEXTS.en, ...RECENT_TEXTS.en, ...GROWTH_TEXTS.en, ...GROWTH2_TEXTS.en }, zh: { ...BASE.zh, ...MORE_TEXTS.zh, ...RECENT_TEXTS.zh, ...GROWTH_TEXTS.zh, ...GROWTH2_TEXTS.zh } })

export const catalogueTexts = (locale = 'en') => textTable('homeCatalogue', locale, CATALOGUE_TEXTS.en, CATALOGUE_TEXTS.zh)
