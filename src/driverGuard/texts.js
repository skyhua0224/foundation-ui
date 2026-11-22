// Words of the graphics-driver notice, the safe mode and the encoder check (see model.js). One place for the Panel home, the Web UI home and the tray: the host
// sends the same sentences to the tray (src/gpu_driver_text.h in Foundation Sunshine; a test compares the two).
//
// Placeholders: {vendor} Intel | NVIDIA | AMD, {phase}, {outcome}, {version}, {module}, {minutes}.
const ZH = {
  vendors: { intel: 'Intel', nvidia: 'NVIDIA', amd: 'AMD' },
  phases: { startup: '启动', probe: '检测编码器', idle: '运行', streaming: '串流' },
  outcomes: { crash: '崩溃', hang: '无响应' },
  driverTitle: '上次{phase}时 {vendor} 显卡驱动{outcome}',
  driverBody: '问题出在驱动内部（版本 {version}，模块 {module}），不是 Sunshine 的问题。更新显卡驱动通常可以解决；已是最新版时，请联系 {vendor} 支持。',
  driverBodyNoVersion: '问题出在驱动内部（模块 {module}），不是 Sunshine 的问题。更新显卡驱动通常可以解决；已是最新版时，请联系 {vendor} 支持。',
  update: '更新驱动',
  assistant: '{vendor} 驱动与支持助理',
  support: '联系 {vendor} 支持',
  dismiss: '关闭',
  safeTitle: '已进入安全模式',
  safeBody: '连续多次启动失败，本次启动跳过了编码器检测和显示设置恢复，开始串流时才检测编码器。运行 {minutes} 分钟或串流结束后自动退出安全模式。',
  retry: '重试编码器检测',
  probing: '正在检测编码器',
}
const EN = {
  vendors: { intel: 'Intel', nvidia: 'NVIDIA', amd: 'AMD' },
  phases: { startup: 'at startup', probe: 'while checking encoders', idle: 'while running', streaming: 'during a stream' },
  outcomes: { crash: 'crashed', hang: 'stopped responding' },
  driverTitle: 'The {vendor} graphics driver {outcome} {phase}',
  driverBody: 'The failure was inside the driver (version {version}, module {module}), not in Sunshine. Updating the graphics driver usually fixes it; if it is already the latest version, contact {vendor} support.',
  driverBodyNoVersion: 'The failure was inside the driver (module {module}), not in Sunshine. Updating the graphics driver usually fixes it; if it is already the latest version, contact {vendor} support.',
  update: 'Update driver',
  assistant: '{vendor} Driver & Support Assistant',
  support: 'Contact {vendor} support',
  dismiss: 'Dismiss',
  safeTitle: 'Safe mode is on',
  safeBody: 'After repeated failed starts, this start skipped the encoder check and the display restore. Encoders are checked when a stream starts. Safe mode ends after {minutes} minutes of running or when a stream ends.',
  retry: 'Retry encoder check',
  probing: 'Checking encoders',
}

/** `zh*` gives the Chinese words, every other locale the English ones. */
export function driverGuardTexts(locale = 'zh') {
  return String(locale || '').toLowerCase().startsWith('zh') ? ZH : EN
}

/** `{name}` placeholders of one template. */
export function fill(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => (values[key] === undefined ? `{${key}}` : String(values[key])))
}

export { EN as driverGuardTextsEn, ZH as driverGuardTextsZh }
