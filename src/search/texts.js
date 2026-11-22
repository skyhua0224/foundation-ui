import { pinSpecForAction } from '../pins/registry.js'
import { RESET_KEYWORDS } from '../reset/texts.js'
// The words of the unified search, in the two languages of the products.
const ZH = {
  placeholder: '搜索设置、页面、操作…', open: '搜索', close: '关闭搜索', clear: '清除', back: '返回', shortcut: 'Ctrl K',
  types: { setting: '设置', page: '页面', action: '操作', client: '客户端', app: '应用', tile: '磁贴' },
  openSetting: '去设置', quickActions: '快捷操作', recentSearches: '最近搜索', recentSettings: '最近更改的设置', clearAll: '全部清除', remove: '移除',
  noResults: '没有找到“{q}”', didYouMean: '你是不是要找', noResultsHint: '试试英文名、配置项的键名，或拼音首字母', more: '还有 {n} 项',
  addToHome: '加入概览', pin: '固定到概览', pinned: '已固定', unpinHint: '点击取消固定', run: '执行', confirm: '确定', cancel: '取消', confirmTitle: '要执行“{title}”吗？', results: '{n} 个结果', noneYet: '输入设置、页面或操作的名称',
  actions: {
    restart: { title: '重启 Sunshine', keywords: 'restart reboot restart sunshine 重新启动 重启服务 ', confirm: '重启会中断正在进行的串流。' },
    userMode: { title: '以用户模式启动', keywords: 'user mode start restart 用户模式 ', confirm: 'Sunshine 会以当前用户的身份重新启动，正在进行的串流会中断。' },
    restartDriver: { title: '重启显卡驱动', keywords: 'restart graphics driver gpu driver 显卡 驱动 重置', confirm: '屏幕会闪烁几秒，正在进行的串流会中断。' },
    connect: { primary: '配对 连接 连接设备 新设备 添加设备 pin 二维码 扫码 手机 平板 电视 pair connect add device new qr scan phone tablet tv', title: '配对新设备', keywords: '配对 配对新设备 添加设备 连接 连接设备 新设备 pin 二维码 扫码 手机 平板 电视 下载 下载客户端 客户端 安装 moonlight v+ enhanced pair connect add device new device qr code scan phone tablet tv download client install' },
    download: { primary: '下载 下载客户端 客户端 安装 moonlight v+ enhanced download client install', title: '下载客户端', keywords: '下载 下载客户端 客户端 安装 手机 平板 电视 moonlight v+ enhanced 配对 连接 download client install apk store app pair connect add device' },
    pair: { title: '配对新客户端', keywords: 'pair pin pairing client 配对 二维码 pin码 添加设备' },
    exportDiag: { title: '导出诊断包', keywords: 'diagnostic diagnostics export bundle logs 诊断 日志 导出' },
    checkUpdate: { title: '检查更新', keywords: 'update upgrade version check 升级 新版本 版本' },
    logs: { title: '查看日志', keywords: 'log logs view 日志 记录' },
    feedback: { title: '反馈问题或建议', keywords: '反馈 意见 建议 报告问题 吐槽 联系开发者 bug feedback report suggestion contact developers' },
    doctor: { title: '开始体检', keywords: '体检 健康检查 检查 诊断 自检 问题 故障 排查 doctor health check diagnose troubleshoot' },
    addApp: { title: '添加应用', keywords: 'add application app 新建应用 游戏' },
    scanGames: { title: '扫描游戏库', keywords: 'scan games library steam epic gog import 扫描 游戏 导入 添加游戏' },
    stopApp: { title: '关闭正在运行的应用', keywords: 'close app force close stop running application 关闭应用 结束应用 强制关闭 关掉游戏 结束 应用 游戏', confirm: '正在运行的应用会被关闭，没保存的进度会丢失。' },
    resetSettings: { title: '恢复默认设置', keywords: RESET_KEYWORDS },
    resetDisplay: { title: '重置显示器记忆', keywords: 'reset display memory restore display device persistence 显示器 显示设备 恢复 记忆', confirm: 'Sunshine 会忘掉上一次串流前保存的显示器设置。Sunshine 一直想恢复显示器却恢复不了时再用。' },
    setupGuide: { title: '重新打开新手引导', keywords: 'guide setup wizard first run onboarding 新手引导 向导 首次设置' },
    quitHost: { title: '关闭 Sunshine', keywords: 'quit exit stop shutdown 退出 停止 关机 Sunshine', confirm: 'Sunshine 会立即停止，需要手动重新启动。正在进行的串流会中断。' },
    openDesktop: { title: '打开大屏', keywords: '大屏 大屏幕 沙发 电视 手柄 全屏 桌面界面 big screen couch tv gamepad controller fullscreen 10-foot foundation desktop' },
  },
}
const EN = {
  placeholder: 'Search settings, pages, actions…', open: 'Search', close: 'Close search', clear: 'Clear', back: 'Back', shortcut: 'Ctrl K',
  types: { setting: 'Settings', page: 'Pages', action: 'Actions', client: 'Clients', app: 'Applications', tile: 'Tiles' },
  openSetting: 'Open setting', quickActions: 'Quick actions', recentSearches: 'Recent searches', recentSettings: 'Recently changed settings', clearAll: 'Clear all', remove: 'Remove',
  noResults: 'Nothing found for “{q}”', didYouMean: 'Did you mean', noResultsHint: 'Try the English name, the configuration key or the pinyin initials', more: '{n} more',
  addToHome: 'Add to Overview', pin: 'Pin to Overview', pinned: 'Pinned', unpinHint: 'Click to unpin', run: 'Run', confirm: 'OK', cancel: 'Cancel', confirmTitle: 'Run “{title}”?', results: '{n} results', noneYet: 'Type the name of a setting, page or action',
  actions: {
    restart: { title: 'Restart Sunshine', keywords: 'restart reboot', confirm: 'Restarting ends the stream that is running.' },
    userMode: { title: 'Start in user mode', keywords: 'user mode start restart', confirm: 'Sunshine restarts as the current user; the stream that is running ends.' },
    restartDriver: { title: 'Restart the graphics driver', keywords: 'restart graphics driver gpu', confirm: 'The screen flickers for a few seconds and the stream that is running ends.' },
    connect: { primary: 'pair connect add device new pin qr scan phone tablet tv 配对 连接 新设备 添加设备 二维码 扫码 手机 平板 电视', title: 'Pair a new device', keywords: '配对 配对新设备 添加设备 连接 连接设备 新设备 pin 二维码 扫码 手机 平板 电视 下载 下载客户端 客户端 安装 moonlight v+ enhanced pair connect add device new device qr code scan phone tablet tv download client install' },
    download: { primary: 'download client install moonlight v+ enhanced 下载 客户端 安装', title: 'Download a client', keywords: 'download client install apk store app moonlight v+ enhanced pair connect add device phone tablet tv 下载 客户端 安装' },
    pair: { title: 'Pair a new client', keywords: 'pair pin pairing client add device' },
    exportDiag: { title: 'Export diagnostics bundle', keywords: 'diagnostic diagnostics export bundle logs' },
    checkUpdate: { title: 'Check for updates', keywords: 'update upgrade version check' },
    logs: { title: 'View the log', keywords: 'log logs view' },
    feedback: { title: 'Send feedback', keywords: 'feedback report problem bug suggestion idea contact developers 反馈 意见 建议' },
    doctor: { title: 'Start health check', keywords: 'health check doctor diagnose troubleshoot problems self test' },
    addApp: { title: 'Add an application', keywords: 'add application app new game' },
    scanGames: { title: 'Scan the game library', keywords: 'scan games library steam epic gog import add games' },
    stopApp: { title: 'Close the running application', keywords: 'close app force close stop running application game', confirm: 'The running application is closed; progress that is not saved is lost.' },
    resetSettings: { title: 'Restore default settings', keywords: RESET_KEYWORDS },
    resetDisplay: { title: 'Reset the display memory', keywords: 'reset display memory restore display device persistence', confirm: 'Sunshine forgets the display settings it saved before the last stream. Use it when Sunshine keeps trying to restore a display and cannot.' },
    setupGuide: { title: 'Reopen the first-run guide', keywords: 'guide setup wizard first run onboarding' },
    quitHost: { title: 'Quit Sunshine', keywords: 'quit exit stop shutdown', confirm: 'Sunshine stops at once and has to be started again by hand. The stream that is running ends.' },
    openDesktop: { title: 'Open Big Screen', keywords: 'big screen bigscreen couch tv gamepad controller fullscreen 10-foot foundation desktop 大屏 大屏幕 沙发 电视 手柄 全屏' },
  },
}
export const searchTexts = (locale = 'en') => (/^zh/i.test(String(locale)) ? ZH : EN)

/** The other language's action wording, so that English finds a Chinese interface's action and the other way round. */
export const altActionTexts = (locale = 'en') => (/^zh/i.test(String(locale)) ? EN : ZH)

/** Actions of the unified search: id, icon, tier (1 runs at once, 3 asks first). A product offers the ones it can run. */
export const ACTION_DEFS = Object.freeze([
  { id: 'restart', icon: 'restart_alt', tier: 3 },
  { id: 'userMode', icon: 'person', tier: 3 },
  { id: 'restartDriver', icon: 'memory', tier: 3 },
  // the two that lead the search for pairing and installing: they rank before everything else for their words and are the fixed quick actions of the empty view
  { id: 'connect', icon: 'person_add', tier: 1, lead: true },
  { id: 'download', icon: 'download', tier: 1, lead: true },
  { id: 'pair', icon: 'person_add', tier: 1 },
  { id: 'exportDiag', icon: 'download', tier: 1 },
  { id: 'checkUpdate', icon: 'refresh', tier: 1 },
  { id: 'logs', icon: 'terminal', tier: 1 },
  { id: 'doctor', icon: 'health_and_safety', tier: 1 },
  { id: 'feedback', icon: 'send', tier: 1 },
  { id: 'addApp', icon: 'add', tier: 1 },
  { id: 'scanGames', icon: 'sports_esports', tier: 1 },
  { id: 'stopApp', icon: 'stop_circle', tier: 3 },
  // opens 恢复默认设置 (the page asks before it resets anything)
  { id: 'resetSettings', icon: 'restart_alt', tier: 1 },
  { id: 'resetDisplay', icon: 'desktop_windows', tier: 3 },
  { id: 'setupGuide', icon: 'rocket_launch', tier: 1 },
  { id: 'quitHost', icon: 'power_settings_new', tier: 3 },
  { id: 'openDesktop', icon: 'tv', tier: 1 },
])

/** Docs of the actions a product can run: `handlers` = { restart: fn, pair: fn, ... }; only those with a handler are offered. */
export function actionDocs(locale, handlers = {}, place = '') {
  const T = searchTexts(locale), alt = altActionTexts(locale)
  return ACTION_DEFS.filter((a) => typeof handlers[a.id] === 'function').map((a) => ({
    id: `action:${a.id}`, type: 'action', title: T.actions[a.id].title, path: place, icon: a.icon,
    keywords: `${T.actions[a.id].keywords || ''} ${alt.actions[a.id].title} ${alt.actions[a.id].keywords || ''}`,
    alt: alt.actions[a.id].title, primary: `${T.actions[a.id].primary || ""} ${alt.actions[a.id].primary || ""}`, tier: a.tier, ...(a.lead ? { lead: true, quick: true } : {}), confirm: T.actions[a.id].confirm || '', run: handlers[a.id],
    // an action can be pinned to the overview as the tile that does it (the ones that confirm first keep asking on the tile)
    pin: pinSpecForAction(a.id, { title: T.actions[a.id].title, icon: a.icon }),
  }))
}
