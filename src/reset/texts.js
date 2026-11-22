import { canonicalLocale } from '../locale/texts/resolve.js'

// The words of 恢复默认设置: the page, its three confirmations and the answers. One set for the Web UI and the control panel (Chinese and English; other languages read English).
// The lists name what is reset and what stays, because that is what a person decides on; the confirm button counts down before it can be pressed (RESET_SECONDS).
const EN = {
  title: 'Restore default settings',
  hostTitle: 'Host settings',
  hostRow: 'Restore default settings',
  hostRowText: 'Streaming, display, audio, input and network settings go back to the defaults. Paired devices and apps stay',
  restoreRow: 'Restore the last backup',
  restoreRowText: 'Backed up {time}',
  noBackup: 'No backup yet',
  backupsFailed: 'Could not read the backups. Click to try again',
  backupsWait: 'Available when the host is back',
  panelTitle: 'Panel',
  panelRow: 'Restore default Panel preferences',
  panelRowText: 'Appearance, overview layout, tray, start-up and notification options go back to the defaults. Host settings and the language stay',
  host: {
    title: 'Restore default settings?',
    resetsLabel: 'Resets',
    resets: 'all host settings, such as streaming, display, audio, input and network.',
    keepsLabel: 'Stays',
    keeps: 'paired devices, the application list, the sign-in account, the language, the service port and the privacy choices.',
    clearApps: 'Also clear the application list',
    clearAppsText: 'The list goes back to what a new install has',
    backup: 'The current settings are backed up first. “Restore the last backup” puts them back.',
    restarts: 'The host restarts and the stream that is running ends.',
    streaming: 'A stream is running now.',
    confirm: 'Restore defaults',
  },
  restore: {
    title: 'Restore the last backup?',
    body: 'The settings from {time} replace the current ones. The current settings are backed up first, so this can be undone the same way.',
    apps: 'The application list goes back to that time as well.',
    restarts: 'The host restarts and the stream that is running ends.',
    confirm: 'Restore the backup',
  },
  panel: {
    title: 'Restore default Panel preferences?',
    resetsLabel: 'Resets',
    resets: 'theme and appearance, overview layout, tray, start-up and notification options.',
    keepsLabel: 'Stays',
    keeps: 'host settings, the language, paired devices, the privacy choices and the AI assistant connection.',
    restarts: 'The Panel loads again.',
    confirm: 'Restore defaults',
  },
  cancel: 'Cancel',
  seconds: '{label} ({n} s)',
  doneHost: 'Default settings are back. The host is restarting.',
  doneRestore: 'The backup is back. The host is restarting.',
  donePanel: 'Panel preferences are back to the defaults.',
  failed: 'The settings were not changed.',
  errors: {
    busy: 'The host is still working on the last request.',
    no_backup: 'There is no backup to restore.',
    unreachable: 'The host did not answer, so the result is not confirmed. Reconnect and check the settings.',
    defaults_missing: 'The default application list is missing from this install.',
    panel_failed: 'The panel preferences were not fully restored. Try again.',
  },
  retry: 'Try again',
}
const ZH = {
  title: '恢复默认设置',
  hostTitle: '主机设置',
  hostRow: '恢复默认设置',
  hostRowText: '串流、显示、音频、输入、网络等设置回到默认值，配对设备和应用保留',
  restoreRow: '恢复上一次备份',
  restoreRowText: '备份于 {time}',
  noBackup: '还没有备份',
  backupsFailed: '无法读取备份，点击重试',
  backupsWait: '主机重启后可恢复',
  panelTitle: '面板',
  panelRow: '恢复面板默认偏好',
  panelRowText: '外观、概览布局、托盘、启动和通知选项回到默认值，主机设置和语言不变',
  host: {
    title: '恢复默认设置？',
    resetsLabel: '会重置',
    resets: '串流、显示、音频、输入、网络等全部主机设置。',
    keepsLabel: '会保留',
    keeps: '已配对的设备、应用列表、登录账号、界面语言、服务端口和隐私选项。',
    clearApps: '同时清除应用列表',
    clearAppsText: '应用列表回到全新安装时的样子',
    backup: '重置前会先备份当前设置，用“恢复上一次备份”可以还原。',
    restarts: '主机会重启，正在进行的串流会中断。',
    streaming: '现在有串流正在进行。',
    confirm: '恢复默认',
  },
  restore: {
    title: '恢复上一次备份？',
    body: '用 {time} 的设置替换当前设置。当前设置会先备份，之后同样可以还原。',
    apps: '应用列表也会回到那时的样子。',
    restarts: '主机会重启，正在进行的串流会中断。',
    confirm: '恢复备份',
  },
  panel: {
    title: '恢复面板默认偏好？',
    resetsLabel: '会重置',
    resets: '主题与外观、概览布局、托盘、启动和通知选项。',
    keepsLabel: '不会改变',
    keeps: '主机设置、语言、已配对的设备、隐私选项和米塔 AI 的连接设置。',
    restarts: '面板会重新载入。',
    confirm: '恢复默认',
  },
  cancel: '取消',
  seconds: '{label}（{n} 秒）',
  doneHost: '已恢复默认设置，主机正在重启。',
  doneRestore: '已恢复备份，主机正在重启。',
  donePanel: '面板偏好已恢复默认。',
  failed: '设置没有改变。',
  errors: {
    busy: '主机还在处理上一个请求。',
    no_backup: '没有可恢复的备份。',
    unreachable: '主机没有响应，结果未确认。重新连接后请检查设置。',
    defaults_missing: '这个安装缺少默认的应用列表。',
    panel_failed: '面板偏好没有完全恢复，请重试。',
  },
  retry: '重试',
}

const deep = (a, b) => { const o = { ...a }; for (const k of Object.keys(b || {})) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) ? deep(a[k] || {}, b[k]) : b[k]; return o }
export const resetTexts = (locale = 'en') => {
  const code = canonicalLocale(locale)
  return code === 'zh' || code === 'zh_TW' ? deep(EN, ZH) : EN
}

/** The words of the search: what a person types when they want this (both languages find it, whatever the interface language is). */
export const RESET_KEYWORDS = [
  'reset restore defaults default settings factory factory reset restore defaults reinitialize initialize start over clear settings reset all settings undo backup restore backup panel preferences',
  '恢复默认 恢复默认设置 重置 重置设置 初始化 恢复出厂 出厂设置 还原 还原设置 清除设置 默认值 默认设置 备份 恢复备份 偏好',
].join(' ')
