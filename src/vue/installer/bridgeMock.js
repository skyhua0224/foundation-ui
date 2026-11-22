// The scripted mock host of the installer bridge (bridge.js): the same transitions as the native shell
// (tools/installer_shell_ui.inc), with the worker as a timer that emits the engine phases. For the dev server, the
// gallery and tests; inside the installer host the Tauri transport is used instead.
import { COMPONENT_IDS, PROGRESS_GROUPS, emptyView, groupState, validAction } from './bridge.js'

/**
 * Mock scenarios. Each sets the starting state and how the scripted run ends.
 * @typedef {'fresh'|'upgrade'|'upgrade-guide-done'|'maintenance-same'|'maintenance-downgrade'|'uac-cancel'
 *   |'needs-reboot'|'fail-driver'|'fail-service'|'fail-generic'|'panel-fails'} MockScenario
 */
export const MOCK_SCENARIOS = Object.freeze(['fresh', 'upgrade', 'upgrade-guide-done', 'maintenance-same', 'maintenance-downgrade',
  'uac-cancel', 'needs-reboot', 'fail-driver', 'fail-service', 'fail-generic', 'panel-fails'])

/**
 * A scripted host. Same transitions as the native shell; the worker is a timer that emits the engine phases.
 * @param {{scenario?: MockScenario, locale?: 'zh'|'en', speed?: number, page?: InstallerPage,
 *          onAction?: (a: InstallerAction) => void, timers?: {set: Function, clear: Function}, now?: () => number}} [opts]
 *   speed: multiplies the scripted delays (0 = synchronous steps for tests); page: jump straight to a page (gallery);
 *   now: the clock the question about a folder warning counts its seconds with (milliseconds; tests move it)
 * @returns {InstallerBridge & {state: () => InstallerView, step: () => boolean}}
 */
export function createMockBridge(opts = {}) {
  const scenario = opts.scenario || 'fresh'
  const speed = opts.speed ?? 1
  const timers = opts.timers || { set: (f, ms) => setTimeout(f, ms), clear: (t) => clearTimeout(t) }
  const now = opts.now || (() => Date.now())
  const listeners = new Set()
  const v = emptyView()
  v.locale = opts.locale || 'zh'
  v.runId = 'mock-' + Math.random().toString(16).slice(2, 8)
  const maint = scenario.startsWith('maintenance') || scenario.startsWith('upgrade')
  if (maint) {
    v.upgrade = true
    v.page = 'maintenance'
    v.maintenance = {
      installedVersion: scenario === 'maintenance-downgrade' ? '2026.1110.0' : scenario === 'maintenance-same' ? '2026.1109.0' : '2026.1101.0',
      packageVersion: '2026.1109.0',
      downgrade: scenario === 'maintenance-downgrade',
      same: scenario === 'maintenance-same',
      hasUninstaller: true,
    }
    v.components.usbip = false
    v.guidePending = scenario !== 'upgrade-guide-done' && scenario !== 'maintenance-same'
  }
  const GB = 2 ** 30
  const DEFAULT_DIR = 'C:\\Program Files\\Sunshine'
  const PRODUCT = 'Foundation Sunshine'
  v.installDir = maint
    ? { ...v.installDir, path: 'D:\\Programs\\Foundation Sunshine', editable: false, freeBytes: 311 * GB, neededBytes: 1.2 * GB, maxLength: 85 }
    : { ...v.installDir, path: DEFAULT_DIR, editable: true, freeBytes: 238 * GB, neededBytes: 1.2 * GB, maxLength: 85 }

  // The rules of the host in miniature (tools/installer_dir.h), enough for the dev page, the gallery and the tests: a few made-up places stand for the cases (D:\Games has files and
  // has a parent that others can replace, F: is FAT32, E: is nearly full, C:\Users is a user folder).
  const norm = (text) => String(text).replace(/\//g, '\\').replace(/(?<=.{3})\\+$/, '')
  const verdictOf = (raw) => {
    const p = norm(raw)
    const out = { error: null, warning: null, freeBytes: null }
    if (p.toLowerCase() === DEFAULT_DIR.toLowerCase()) return { ...out, freeBytes: 238 * GB }
    if (!/^[A-Za-z]:\\/.test(p)) return { ...out, error: 'invalid' }
    if (/^[A-Za-z]:\\?$/.test(p)) return { ...out, error: 'root', freeBytes: 412 * GB }
    if (/[!%^&;,='`{}$]/.test(p)) return { ...out, error: 'chars' }
    const drive = p[0].toUpperCase()
    out.freeBytes = drive === 'F' ? 58 * GB : drive === 'E' ? 0.4 * GB : drive === 'C' ? 238 * GB : 412 * GB
    if (drive === 'F') out.error = 'fs'
    else if (/^[A-Za-z]:\\Windows(\\|$)/i.test(p)) out.error = 'system'
    else if (/OneDrive|Dropbox/i.test(p)) out.error = 'synced'
    else if (p.length > 85) out.error = 'too-long'
    else if (/^[A-Za-z]:\\Games$/i.test(p) || /\\Docs$/i.test(p)) out.error = 'not-empty'
    else if (drive === 'E') out.error = 'no-space'
    else if (/^C:\\Users(\\|$)/i.test(p)) out.warning = 'user'
    else if (/^[A-Za-z]:\\Games\\/i.test(p)) out.warning = 'parent'
    return out
  }
  // a pick gets the product's folder name added, as the host does (installer_dir.h from_pick); the default folder and a folder with that name are taken as they are
  const resolvePick = (picked) => {
    const p = norm(picked)
    if (p.toLowerCase() === DEFAULT_DIR.toLowerCase() || p.split('\\').pop().toLowerCase() === PRODUCT.toLowerCase()) return { path: p, pickedPath: null, note: null }
    return { path: p.endsWith('\\') ? p + PRODUCT : `${p}\\${PRODUCT}`, pickedPath: p, note: /^[A-Za-z]:\\Games$/i.test(p) ? 'redirected' : null }
  }
  const safeOf = (path) => (path[0].toUpperCase() === 'C' ? DEFAULT_DIR : `${path[0].toUpperCase()}:\\${PRODUCT}`)
  // another folder: what was confirmed and an open question are void
  let confirmed = ''
  let askedAt = 0  // when the question about a warning opened (the host takes "install anyway" only after confirmSeconds)
  const setDir = (path, pickedPath = null, note = null) => {
    const r = verdictOf(path)
    confirmed = ''
    askedAt = 0
    v.installDir = { ...v.installDir, path, pickedPath, note: r.error ? null : note, error: r.error, warning: r.error ? null : r.warning, freeBytes: r.freeBytes,
      safePath: !r.error && r.warning ? safeOf(path) : null, confirm: false }
    emit()
  }
  // what the folder picker answers, one after another (a real host opens the system picker and checks the folder it returns)
  const picks = ['D:\\Games', 'D:\\', 'F:\\Tools', 'C:\\Users\\Alice\\Documents', 'D:\\Backup\\Foundation Sunshine', DEFAULT_DIR]
  let pick = 0
  let script = []
  let timer = null

  const emit = () => {
    v.seq += 1
    v.allSelected = COMPONENT_IDS.every((id) => v.components[id])
    v.busy = v.page === 'uac' || v.page === 'installing'
    v.progress.groups = PROGRESS_GROUPS.map((g, i) => ({ id: g.id, state: groupState(v.progress, i) }))
    const lg = v.progress.lastStep ? PROGRESS_GROUPS.findIndex((x) => x.steps.includes(v.progress.lastStep)) : 0
    v.progress.current = Math.max(0, lg)
    const snap = structuredClone(v)
    for (const fn of listeners) fn(snap)
    return snap
  }
  const go = (page) => { v.page = page; emit() }
  const ORDER = PROGRESS_GROUPS.flatMap((g) => g.steps)
  const planOf = (out) => ORDER.filter((id) => out.some(([phase]) => phase === id))

  const phases = () => {
    const out = [['worker', 'running'], ['engine', 'running'], ['prepare', 'running'], ['prepare', 'done'], ['files', 'running', 0],
      ['files', 'running', 0.35], ['files', 'running', 0.8], ['files', 'done'], ['path', 'done'], ['config', 'done'], ['permissions', 'done']]
    for (const d of ['vdd', 'gamepad', 'usbip', 'vmouse']) {
      if (!v.components[d]) continue
      out.push([d, 'running'])
      if (scenario === 'fail-driver' && d === 'gamepad') { out.push([d, 'failed']); return { out, end: 'component-failed' } }
      out.push([d, scenario === 'needs-reboot' && d === 'vdd' ? 'reboot' : 'done'])
    }
    if (v.components.firewall) out.push(['firewall', 'running'], ['firewall', 'done'])
    out.push(['service', 'running'])
    if (scenario === 'fail-service') { out.push(['service', 'failed']); return { out, end: 'service-failed' } }
    out.push(['service', 'done'])
    if (v.components.autostart) out.push(['autostart', 'done'])
    if (scenario === 'fail-generic') return { out, end: 'failed' }
    if (scenario === 'needs-reboot') { out.push(['reboot', 'reboot']); return { out, end: 'needs-reboot' } }
    return { out, end: 'success' }
  }

  const finish = (end) => {
    v.progress.finished = true
    v.opening = false
    v.panelFailed = false
    if (end === 'success') { v.restart = 'none'; go('done') }
    else if (end === 'needs-reboot') { v.restart = 'optional'; v.rebootReasons = ['vdd', 'vigem']; go('done') }
    else if (end === 'component-failed') { v.failure = 'driver'; v.exitCode = 3; go('failed') }
    else if (end === 'service-failed') { v.failure = 'service'; v.exitCode = 4; go('failed') }
    else { v.failure = 'generic'; v.exitCode = 1; go('failed') }
  }

  const advance = () => {
    timer = null
    const item = script.shift()
    if (!item) return false
    item()
    if (script.length) timer = speed > 0 ? timers.set(advance, (script.length % 3 ? 380 : 900) * speed) : null
    return true
  }

  const startWorker = () => {
    v.uacCancelled = false
    v.failure = null
    v.exitCode = 0
    v.opening = false
    v.panelFailed = false
    v.restart = 'none'
    v.rebootReasons = []
    v.progress = { groups: [], current: 0, steps: {}, lastStep: null, finished: false, planned: [], fraction: {} }
    go('uac')
    if (scenario === 'uac-cancel') {
      script = [() => { v.uacCancelled = true; go(v.maintenance ? 'maintenance' : 'welcome') }]
    } else {
      const { out, end } = phases()
      v.progress.planned = planOf(out)
      script = out.map(([phase, state, fraction], i) => () => {
        if (i === 0) v.page = 'installing'
        v.progress.steps[phase] = state
        v.progress.lastStep = phase
        if (fraction !== undefined) v.progress.fraction[phase] = fraction
        else delete v.progress.fraction[phase]
        emit()
      })
      script.push(() => finish(end))
    }
    if (timer) timers.clear(timer)
    timer = speed > 0 ? timers.set(advance, 1200 * speed) : null
  }

  const handle = (a) => {
    opts.onAction?.(a)
    switch (a.type) {
      case 'ready': emit(); break
      case 'choose-dir': if (v.page === 'welcome' && v.installDir.editable) {
        const r = resolvePick(picks[pick % picks.length])
        pick += 1
        setDir(r.path, r.pickedPath, r.note)
      } break
      case 'set-dir': if (v.installDir.editable && ['welcome', 'components'].includes(v.page) && norm(a.path) !== v.installDir.path) setDir(norm(a.path)); break
      case 'use-picked-dir': if (v.installDir.editable && v.installDir.pickedPath) setDir(v.installDir.pickedPath); break
      case 'use-safe-dir': if (v.installDir.editable && v.installDir.safePath) { setDir(v.installDir.safePath); if (v.page === 'components') go('welcome') } break
      case 'cancel-dir-risk': if (v.installDir.confirm) { askedAt = 0; v.installDir = { ...v.installDir, confirm: false }; emit() } break
      case 'install':
      case 'confirm-dir-risk': {
        if (!['welcome', 'maintenance', 'components'].includes(v.page) || v.installDir.error) break
        if (a.type === 'confirm-dir-risk') {
          // the host takes the answer only while the question is open and after its seconds: an answer that comes early is not taken, and the question stays open
          if (!v.installDir.confirm || now() - askedAt < v.installDir.confirmSeconds * 1000) break
          confirmed = v.installDir.path
          askedAt = 0
          v.installDir = { ...v.installDir, confirm: false }
        }
        else if (v.installDir.editable && v.installDir.warning && confirmed !== v.installDir.path) {
          if (!v.installDir.confirm) askedAt = now()
          v.installDir = { ...v.installDir, confirm: true }  // a warning is asked about once
          emit()
          break
        }
        startWorker()
        break
      }
      case 'retry': if (v.page === 'failed') startWorker(); break
      case 'customize': if (v.page === 'welcome' || v.page === 'maintenance') go('components'); break
      case 'back': if (v.page === 'components') go(v.maintenance ? 'maintenance' : 'welcome'); break
      case 'toggle-component': if (v.page === 'components') { v.components[a.id] = !v.components[a.id]; emit() } break
      case 'select-all': if (v.page === 'components') {
        const all = COMPONENT_IDS.every((id) => v.components[id])
        for (const id of COMPONENT_IDS) v.components[id] = !all
        emit()
      } break
      case 'open-panel': if (v.page === 'done') {
        v.opening = true; v.panelFailed = false; emit()
        const t = () => { v.opening = false; v.panelFailed = scenario === 'panel-fails'; emit() }
        speed > 0 ? timers.set(t, 1500 * speed) : t()
      } break
      default: break  // uninstall, restart-pc, copy-details, open-log-folder, minimise, exit: host-side effects only
    }
  }

  if (opts.page && opts.page !== v.page) {
    // Gallery jump: put the mock straight on a page with plausible data.
    if (opts.page === 'installing' || opts.page === 'done' || opts.page === 'failed') {
      const { out, end } = phases()
      const upto = opts.page === 'installing' ? Math.ceil(out.length / 2) : out.length
      v.progress.planned = planOf(out)
      for (const [phase, state] of out.slice(0, upto)) { v.progress.steps[phase] = state; v.progress.lastStep = phase }
      if (opts.page !== 'installing') finish(end === 'success' && opts.page === 'failed' ? 'failed' : end)
    }
    v.page = opts.page
  }

  return {
    kind: 'mock',
    async view() { return emit() },
    subscribe(fn) { listeners.add(fn); fn(structuredClone(v)); return () => listeners.delete(fn) },
    async send(action) { if (validAction(action)) handle(action) },
    state: () => structuredClone(v),
    step: advance,  // tests with speed 0: run the next scripted worker event
  }
}
