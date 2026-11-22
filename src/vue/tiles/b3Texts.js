import { textTable } from '../../locale/texts/index.js'
// The words of the B3 tile designs: actions, switches, settings, personalisation and the info tiles. Only what the catalogue's texts do not have already.
const zh = {
  apps: '{n} 个应用', paired: '{n} 台已配对', unpaired: '未配对', noApps: '还没有应用', errors24: '24 小时 {n} 个错误', noErrors: '无错误',
  ready: '{a}/{b} 就绪', current: '已最新', updateTo: '有新版本 {v}', on: '开', off: '关', restartNote: '重启后生效', liveNote: '对正在进行的串流生效', clientNote: '由客户端决定 · 重启后生效', padNote: '新建的手柄生效', fps: 'fps', addFps: '添加帧率', add: '添加',
  errorsUnit: '个错误', last24: '过去 24 小时', warnings: '警告 {n}', noWarnings: '无警告', linesUnit: '条', levelErr: '错误 {n}', levelWarn: '警告 {n}', noLines: '无新日志', noWallpaper: '未使用壁纸',
}
const en = {
  apps: '{n} apps', paired: '{n} paired', unpaired: 'Not paired', noApps: 'No apps yet', errors24: '{n} errors in 24 h', noErrors: 'No errors',
  ready: '{a}/{b} ready', current: 'Up to date', updateTo: 'Update {v}', on: 'On', off: 'Off', restartNote: 'After a restart', liveNote: 'Applies to the running stream', clientNote: 'Set by the client · after a restart', padNote: 'Applies to new controllers', fps: 'fps', addFps: 'Add a frame rate', add: 'Add',
  errorsUnit: 'errors', last24: 'Last 24 hours', warnings: '{n} warnings', noWarnings: 'No warnings', linesUnit: 'lines', levelErr: '{n} errors', levelWarn: '{n} warnings', noLines: 'No new lines', noWallpaper: 'No wallpaper',
}
/** The texts for the locale of the catalogue's texts (`T.__locale`); `fill` puts the values into `{n}`. */
export const b3Texts = (T = {}) => textTable('b3', T.__locale || 'en', en, zh)
export const fill = (s, v = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ''))
