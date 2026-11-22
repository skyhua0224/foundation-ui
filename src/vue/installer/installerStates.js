// Every state of the installer as a ready InstallerView snapshot, for the gallery and the tests (the scripted run of bridge.js, createMockBridge, goes through the same states in time).
// staticBridge() is a bridge that holds one snapshot: it answers the component toggles (so the components page can be tried) and ignores every other action.
import { COMPONENT_IDS, PROGRESS_GROUPS, emptyView, groupState } from './bridge.js'

const STEPS = {
  prepare: [['worker', 'running'], ['engine', 'running'], ['wizard', 'running'], ['prepare', 'running']],
  files: [['worker', 'running'], ['engine', 'running'], ['prepare', 'done'], ['files', 'done'], ['permissions', 'running']],
  drivers: [['prepare', 'done'], ['files', 'done'], ['path', 'done'], ['permissions', 'done'], ['vdd', 'done'], ['gamepad', 'running']],
  network: [['prepare', 'done'], ['files', 'done'], ['path', 'done'], ['permissions', 'done'], ['vdd', 'done'], ['gamepad', 'done'], ['usbip', 'done'], ['vmouse', 'done'], ['firewall', 'done'], ['service', 'running']],
  all: [['prepare', 'done'], ['files', 'done'], ['path', 'done'], ['permissions', 'done'], ['vdd', 'done'], ['gamepad', 'done'], ['usbip', 'done'], ['vmouse', 'done'], ['firewall', 'done'], ['service', 'done'], ['autostart', 'done']],
}

/** a view with the given engine events reduced into its progress (groups, current group, last step), as the host does */
export function viewWith(patch = {}, events = []) {
  const v = { ...emptyView(), installDir: dir(), ...patch }
  v.components = { ...emptyView().components, ...(patch.components || {}) }
  v.progress = { groups: [], current: 0, steps: {}, lastStep: null, finished: false }
  for (const [phase, state] of events) { v.progress.steps[phase] = state; v.progress.lastStep = phase }
  if (patch.finished) v.progress.finished = true
  v.progress.groups = PROGRESS_GROUPS.map((g, i) => ({ id: g.id, state: groupState(v.progress, i) }))
  const last = v.progress.lastStep ? PROGRESS_GROUPS.findIndex((g) => g.steps.includes(v.progress.lastStep)) : 0
  v.progress.current = Math.max(0, last)
  v.allSelected = COMPONENT_IDS.every((id) => v.components[id])
  v.busy = v.page === 'uac' || v.page === 'installing'
  return v
}

const GB = 2 ** 30
/** the install-location part of a snapshot: a fresh install on the default folder unless `over` says otherwise */
const dir = (over = {}) => ({ path: 'C:\\Program Files\\Sunshine', editable: true, freeBytes: 238 * GB, neededBytes: 1.2 * GB, maxLength: 85, error: null, warning: null, safePath: null, pickedPath: null, note: null, confirm: false, confirmSeconds: 5, ...over })
/** a folder that only has a warning, with its safe place */
const risky = (over = {}) => dir({ path: 'D:\\Games\\Foundation Sunshine', freeBytes: 412 * GB, pickedPath: 'D:\\Games', warning: 'parent', safePath: 'D:\\Foundation Sunshine', ...over })
const maint = (over = {}) => ({ installedVersion: '2026.1101.0', packageVersion: '2026.1109.0', downgrade: false, same: false, hasUninstaller: true, ...over })
const installed = { usbip: false }
const here = dir({ path: 'D:\\Programs\\Foundation Sunshine', editable: false, freeBytes: 311 * GB })

/** [id, group, label, snapshot] in the order of a person's path through the installer */
export const INSTALLER_STATES = Object.freeze([
  ['welcome', 'welcome', '欢迎', () => viewWith({ page: 'welcome' })],
  ['welcome-upgrade', 'welcome', '欢迎 · 检测到旧版', () => viewWith({ page: 'welcome', upgrade: true, installDir: here })],
  ['welcome-cancelled', 'welcome', '欢迎 · 已取消授权', () => viewWith({ page: 'welcome', uacCancelled: true })],
  ['welcome-dir-picked', 'welcome', '欢迎 · 选了文件夹(自动接上产品文件夹)', () => viewWith({ page: 'welcome', installDir: dir({ path: 'E:\\Tools\\Foundation Sunshine', freeBytes: 412 * GB, pickedPath: 'E:\\Tools' }) })],
  ['welcome-dir-custom', 'welcome', '欢迎 · 手输的安装位置', () => viewWith({ page: 'welcome', installDir: dir({ path: 'D:\\Games\\安装\\Foundation Sunshine', freeBytes: 412 * GB }) })],
  ['welcome-dir-redirected', 'welcome', '欢迎 · 所选文件夹里已有文件', () => viewWith({ page: 'welcome', installDir: dir({ path: 'E:\\Backup\\Foundation Sunshine', freeBytes: 412 * GB, pickedPath: 'E:\\Backup', note: 'redirected' }) })],
  ['welcome-dir-not-empty', 'welcome', '欢迎 · 文件夹不是空的', () => viewWith({ page: 'welcome', installDir: dir({ path: 'D:\\Games', freeBytes: 412 * GB, error: 'not-empty', pickedPath: 'D:\\Games' }) })],
  ['welcome-dir-root', 'welcome', '欢迎 · 磁盘根目录', () => viewWith({ page: 'welcome', installDir: dir({ path: 'D:\\', freeBytes: 412 * GB, error: 'root' }) })],
  ['welcome-dir-fs', 'welcome', '欢迎 · 磁盘格式不对', () => viewWith({ page: 'welcome', installDir: dir({ path: 'F:\\Sunshine', freeBytes: 58 * GB, error: 'fs' }) })],
  ['welcome-dir-no-space', 'welcome', '欢迎 · 空间不足', () => viewWith({ page: 'welcome', installDir: dir({ path: 'E:\\Sunshine', freeBytes: 0.4 * GB, error: 'no-space' }) })],
  ['welcome-dir-warning-parent', 'welcome', '欢迎 · 提醒：上级文件夹可被改动', () => viewWith({ page: 'welcome', installDir: risky() })],
  ['welcome-dir-warning-user', 'welcome', '欢迎 · 提醒：用户文件夹', () => viewWith({ page: 'welcome', installDir: risky({ path: 'C:\\Users\\Alice\\Foundation Sunshine', pickedPath: null, freeBytes: 238 * GB, warning: 'user', safePath: 'C:\\Program Files\\Sunshine' }) })],
  ['welcome-dir-confirm', 'welcome', '欢迎 · 确认问题(5 秒倒计时)', () => viewWith({ page: 'welcome', installDir: risky({ confirm: true }) })],
  ['maintenance', 'maintenance', '维护 · 更新', () => viewWith({ page: 'maintenance', upgrade: true, maintenance: maint(), components: installed, installDir: here })],
  ['maintenance-same', 'maintenance', '维护 · 同版本', () => viewWith({ page: 'maintenance', upgrade: true, maintenance: maint({ installedVersion: '2026.1109.0', same: true }), components: installed, installDir: here })],
  ['maintenance-downgrade', 'maintenance', '维护 · 降级', () => viewWith({ page: 'maintenance', upgrade: true, maintenance: maint({ installedVersion: '2026.1110.0', downgrade: true }), components: installed, installDir: here })],
  ['components', 'components', '选择组件', () => viewWith({ page: 'components' })],
  ['components-maintenance', 'components', '选择组件 · 维护(已勾选当前组件)', () => viewWith({ page: 'components', upgrade: true, maintenance: maint(), components: { ...installed, desktopicon: false } })],
  ['uac', 'uac', '等待授权', () => viewWith({ page: 'uac', busy: true })],
  ['installing-prepare', 'installing', '安装中 · 检查电脑', () => viewWith({ page: 'installing' }, STEPS.prepare)],
  ['installing-files', 'installing', '安装中 · 放入程序', () => viewWith({ page: 'installing' }, STEPS.files)],
  ['installing-drivers', 'installing', '安装中 · 安装驱动', () => viewWith({ page: 'installing' }, STEPS.drivers)],
  ['installing-network', 'installing', '安装中 · 网络与服务', () => viewWith({ page: 'installing' }, STEPS.network)],
  ['done', 'done', '完成', () => viewWith({ page: 'done', finished: true }, STEPS.all)],
  ['done-opening', 'done', '完成 · 正在打开', () => viewWith({ page: 'done', finished: true, opening: true }, STEPS.all)],
  ['done-panel-failed', 'done', '完成 · 管理界面未打开', () => viewWith({ page: 'done', finished: true, panelFailed: true }, STEPS.all)],
  ['done-restart', 'done', '完成 · Windows 提示重启', () => viewWith({ page: 'done', finished: true, restart: 'optional', rebootReasons: ['vdd'] }, STEPS.all)],
  ['done-upgrade', 'done', '完成 · 升级(指引已完成)', () => viewWith({ page: 'done', finished: true, upgrade: true, guidePending: false }, STEPS.all)],
  ['failed-driver', 'failed', '失败 · 驱动', () => viewWith({ page: 'failed', failure: 'driver', exitCode: 3 }, [...STEPS.drivers.slice(0, 5), ['gamepad', 'failed']])],
  ['failed-service', 'failed', '失败 · 服务', () => viewWith({ page: 'failed', failure: 'service', exitCode: 4 }, [...STEPS.network.slice(0, 9), ['service', 'failed']])],
  ['failed-generic', 'failed', '失败 · 安装引擎', () => viewWith({ page: 'failed', failure: 'generic', exitCode: 1, finished: true }, STEPS.files)],
])

export const stateIds = () => INSTALLER_STATES.map((s) => s[0])
export function snapshotOf(id) {
  const s = INSTALLER_STATES.find((x) => x[0] === id)
  if (!s) throw new Error(`unknown installer state ${id}`)
  return s[3]()
}

/** a bridge on one fixed snapshot; toggles and select-all work on it, the rest is only recorded in `sent` */
export function staticBridge(initial, { locale } = {}) {
  let v = { ...initial, ...(locale ? { locale } : {}) }
  const listeners = new Set()
  const sent = []
  const push = () => { v = { ...v, seq: v.seq + 1, allSelected: COMPONENT_IDS.every((id) => v.components[id]) }; for (const fn of listeners) fn(v) }
  return {
    kind: 'mock',
    sent,
    async view() { return v },
    /** put the bridge on another snapshot (the gallery's state switcher): the page slides to it like a host change */
    set(next) { v = { ...next, ...(locale ? { locale } : {}), seq: v.seq + 1 }; for (const fn of listeners) fn(v) },
    subscribe(fn) { listeners.add(fn); fn(v); return () => listeners.delete(fn) },
    async send(a) {
      sent.push(a)
      if (v.page !== 'components') return
      if (a.type === 'toggle-component') { v = { ...v, components: { ...v.components, [a.id]: !v.components[a.id] } }; push() }
      if (a.type === 'select-all') { const all = COMPONENT_IDS.every((id) => v.components[id]); v = { ...v, components: Object.fromEntries(COMPONENT_IDS.map((id) => [id, !all])) }; push() }
    },
  }
}
