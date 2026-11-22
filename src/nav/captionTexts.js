// Text of the version in the caption bar, the update line, and the global back (button and chip): Chinese and English, every other language falls back to English.
const EN = {
  test: 'Beta', unknown: 'unknown', copyHint: 'Click to copy the version and build for a bug report', copied: 'Copied', copiedNote: 'Version and build copied', copyFailed: 'Could not copy',
  updateAvailable: 'Update available', updateTip: 'Update available: {version}. Open Software update', open: 'Software update',
  more: 'More', back: 'Back', backTo: 'Back: {page}', backNowhere: 'Nothing to go back to', chipBack: 'Back to {page}', here: 'previous page',
  channel: 'Channel', commit: 'Commit', branch: 'Branch', built: 'Built', package: 'Package', os: 'System', dirty: 'uncommitted changes',
  channels: { stable: 'Stable', beta: 'Beta', dev: 'Development', local: 'Local build' }, packages: { installer: 'Installer', portable: 'Portable' },
  backVariant: 'Global back', backVariantA: 'A · button in the title bar', backVariantB: 'B · chip at the top of the page', backVariantC: 'C · both',
}
const ZH = {
  test: '测试版', unknown: '还没读到', copyHint: '点击复制版本和构建信息，用于反馈问题', copied: '已复制', copiedNote: '已复制版本和构建信息', copyFailed: '无法复制',
  updateAvailable: '有更新可用', updateTip: '有更新可用：{version}，点击打开软件更新', open: '软件更新',
  more: '更多', back: '返回', backTo: '返回：{page}', backNowhere: '没有可返回的页面', chipBack: '返回{page}', here: '上一页',
  channel: '渠道', commit: '提交', branch: '分支', built: '构建时间', package: '安装包', os: '系统', dirty: '有未提交改动',
  channels: { stable: '正式版', beta: '测试版', dev: '开发版', local: '本地构建' }, packages: { installer: '安装版', portable: '便携版' },
  backVariant: '全局返回', backVariantA: 'A · 标题栏返回按钮', backVariantB: 'B · 页面顶部返回提示', backVariantC: 'C · 两者都有',
}
export function captionTexts(locale = 'en', overrides = null) {
  const zh = String(locale || '').toLowerCase().startsWith('zh')
  return { ...(zh ? ZH : EN), ...(overrides || {}) }
}
export const fill = (text, values) => String(text).replace(/\{(\w+)\}/g, (_, k) => (values && values[k] != null ? values[k] : ''))
