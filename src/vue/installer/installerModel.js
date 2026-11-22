// What each installer page shows, as plain data computed from an InstallerView (bridge.js): the rail, the facts, the notes, the buttons, the components list, the steps of the group that runs.
// Pure functions, no DOM: the pages only draw this, and the tests read it.
import { COMPONENT_IDS, PROGRESS_GROUPS, groupState } from './bridge.js'
import { t } from './installerTexts.js'

/** the pages in the order a person meets them: used for the direction of the shared-axis slide */
const RANK = { welcome: 0, maintenance: 0, components: 1, uac: 2, installing: 3, failed: 4, done: 4 }

/** 'fwd' | 'bck': a new run (retry, install) always moves forward; going back (components -> start page, a cancelled permission) moves back */
export function pageDirection(prev, next) {
  if (!prev || prev === next) return 'fwd'
  if (next === 'uac' || next === 'installing') return 'fwd'
  return RANK[next] >= RANK[prev] ? 'fwd' : 'bck'
}

/** the five items of the left rail: four groups of the engine, then the first-run guide */
export const RAIL_COUNT = 5

const stepOf = (progress, id) => progress.steps[id]
/** the word of a step: the worker and the engine are one line, `prepare the installer` */
const wordOf = (id) => (id === 'engine' ? 'worker' : id)

/**
 * A step as shown: 'running' only for the step the latest event was about (the engine reports `running` once and settles with a later event, or none),
 * 'reboot' (a step that wants a restart) is shown as done: no page asks for a restart.
 */
function effective(progress, id, finished) {
  const s = stepOf(progress, id)
  if (!s) return 'pending'
  if (s === 'running') return !finished && progress.lastStep === id ? 'running' : 'done'
  if (s === 'reboot') return 'done'
  return s
}

/** the state of one rail item: 'pending' | 'running' | 'done' | 'failed' */
export function railStates(view) {
  const out = Array(RAIL_COUNT).fill('pending')
  const p = view.progress
  const groups = PROGRESS_GROUPS.map((_, i) => p.groups[i]?.state ?? groupState(p, i))
  const mapped = groups.map((s) => (s === 'reboot' ? 'done' : s))
  switch (view.page) {
    case 'uac':
      out[0] = 'running'
      break
    case 'installing':
      mapped.forEach((s, i) => { out[i] = s })
      break
    case 'failed': {
      mapped.forEach((s, i) => { out[i] = s === 'running' ? 'failed' : s })
      if (!out.includes('failed')) {
        // the engine stopped between two groups: the first item that is not done is where it stopped
        const at = out.findIndex((s) => s !== 'done')
        out[at < 0 ? RAIL_COUNT - 1 : at] = 'failed'
      }
      break
    }
    case 'done':
      for (let i = 0; i < 4; i++) out[i] = 'done'
      out[4] = view.opening ? 'running' : 'done'
      break
    default:
  }
  return out
}

/** the rail: title, one line under it, and the state; a running item names the step that runs */
export function railItems(view, locale) {
  const states = railStates(view)
  const p = view.progress
  const lastGroup = p.lastStep ? PROGRESS_GROUPS.findIndex((g) => g.steps.includes(p.lastStep)) : -1
  return states.map((state, i) => {
    let sub = t(locale, `rail.${i}.sub`)
    if (state === 'running' && view.page === 'installing' && i === lastGroup && p.lastStep) sub = t(locale, `step.${wordOf(p.lastStep)}.run`)
    else if (state === 'done' && i < 4) sub = t(locale, 'rail.done')
    else if (state === 'failed') sub = t(locale, 'rail.failed')
    return { index: i, title: t(locale, `rail.${i}`), sub, state }
  })
}

// ---------------------------------------------------------------- the steps of the installing page

const GROUP_ROWS = [
  [['worker', 'engine'], ['wizard'], ['prepare']],
  [['files'], ['permissions'], ['path'], ['config']],
  [['vdd'], ['gamepad'], ['usbip'], ['vmouse']],
  [['firewall'], ['service'], ['autostart']],
]
const OPTIONAL = new Set(['vdd', 'gamepad', 'usbip', 'vmouse', 'firewall', 'autostart'])

/** the rows of one group: the steps the engine runs for this selection (a driver that is not ticked has no row) */
function rowsOf(view, groupIndex) {
  const p = view.progress
  const finished = p.finished
  const rows = []
  for (const ids of GROUP_ROWS[groupIndex]) {
    const id = ids[ids.length - 1]
    if (OPTIONAL.has(id) && !view.components[id]) continue
    const known = ids.filter((x) => stepOf(p, x))
    let state = 'pending'
    if (known.length) {
      const states = known.map((x) => effective(p, x, finished))
      state = states.includes('failed') ? 'failed' : states.includes('running') ? 'running' : states.every((s) => s === 'done') ? 'done' : 'pending'
    }
    rows.push({ id: known.length ? known[known.length - 1] : ids[0], key: ids[0], state })
  }
  return rows
}

/** the group's rows with the words for their state; a step the engine skipped (nothing to move on a fresh install) is not listed once its group is over */
export function stepRows(view, locale, groupIndex = view.progress.current) {
  const groupDone = (view.progress.groups[groupIndex]?.state ?? groupState(view.progress, groupIndex)) === 'done'
  return rowsOf(view, groupIndex)
    .filter((r) => !(groupDone && r.state === 'pending'))
    .map((r) => ({ ...r, label: t(locale, r.state === 'running' ? `step.${wordOf(r.id)}.run` : `step.${wordOf(r.id)}`) }))
}

/** overall progress by the steps the engine has settled: { value 0..1, done, total }; 1 when the engine reported its end */
export function installProgress(view) {
  let total = 0, done = 0, part = 0
  const fraction = view.progress.fraction || {}
  for (let g = 0; g < 4; g++) {
    for (const r of rowsOf(view, g)) {
      total += 1
      if (r.state === 'done') done += 1
      // a running step that reports its own fraction (files: the engine's file copy) moves the bar inside the step
      else if (r.state === 'running' && typeof fraction[r.id] === 'number') part = Math.max(part, Math.min(0.99, Math.max(0, fraction[r.id])))
    }
  }
  if (view.progress.finished) return { value: 1, done: total, total }
  return { value: total ? (done + part) / total : 0, done, total }
}

// ---------------------------------------------------------------- the components page

export const COMPONENT_ICONS = Object.freeze({
  vdd: 'display_settings', gamepad: 'sports_esports', usbip: 'usb', vmouse: 'mouse',
  firewall: 'shield', autostart: 'power_settings_new', tools: 'build', desktopicon: 'desktop_windows',
})
/** recommended: the Inno "recommended" type (everything but the desktop shortcut); optional: what a plain install leaves out of the pitch */
export const COMPONENT_SECTIONS = Object.freeze([
  Object.freeze({ id: 'recommended', ids: Object.freeze(['vdd', 'gamepad', 'usbip', 'vmouse', 'firewall', 'autostart', 'tools']) }),
  Object.freeze({ id: 'optional', ids: Object.freeze(['desktopicon']) }),
])

export function componentSections(view, locale) {
  return COMPONENT_SECTIONS.map((s) => ({
    id: s.id,
    title: t(locale, `comp.${s.id}`),
    // a component this Windows cannot run (view.unsupported: the minimum Windows version it needs) is off, disabled, and its line says why
    items: s.ids.map((id) => {
      const needs = view.unsupported?.[id]
      return { id, icon: COMPONENT_ICONS[id], title: t(locale, `comp.${id}`), text: needs ? t(locale, 'comp.needs', needs) : t(locale, `comp.${id}.text`), on: !needs && !!view.components[id], disabled: !!needs }
    }),
  }))
}

// ---------------------------------------------------------------- the install location

/** 1536 -> '1.5 KB' ... : binary units, as Explorer shows them; one decimal under 10, none above */
export function formatBytes(n) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = Math.max(0, Number(n) || 0)
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${i < 3 || v >= 10 ? Math.round(v) : Math.round(v * 10) / 10} ${units[i]}`
}

/** a path in two parts: the head may be cut short with an ellipsis, the tail (the last folder, taking its parents while it is under 12 characters and the whole stays under 32) shows whole while there is room */
export function splitPath(path) {
  const parts = String(path || '').split('\\')
  let tail = parts.length > 1 ? `\\${parts[parts.length - 1]}` : String(path || '')
  let at = parts.length - 1
  while (tail.length < 12 && at > 1 && parts[at - 1].length + 1 + tail.length <= 32) { at -= 1; tail = `\\${parts[at]}${tail}` }
  const head = String(path || '').slice(0, String(path || '').length - tail.length)
  return { head, tail }
}

/**
 * The install-location row: label, the path (as typed in the field, and in two parts for a place that only shows it), the free space, the Change button and the field (a fresh install
 * only), the reason when the folder is refused, the warning with its safe place when it is only a risk, the note about a picked folder with files in it, and the choice to use the picked
 * folder as it is. null when the host sent no folder (a host without the row).
 */
export function locationModel(view, locale) {
  const d = view.installDir
  if (!d || typeof d.path !== 'string') return null
  const { head, tail } = splitPath(d.path)
  let error = null
  if (d.error) {
    const key = `dir.err.${d.error}`
    error = { code: d.error, text: d.error === 'too-long' ? t(locale, key, d.maxLength) : d.error === 'no-space' ? t(locale, key, formatBytes(d.neededBytes)) : t(locale, key) }
  }
  const editable = !!d.editable
  const warning = !error && d.warning ? { code: d.warning, text: t(locale, `dir.warn.${d.warning}`) } : null
  return {
    label: t(locale, 'dir.label'),
    field: t(locale, 'dir.field'),
    path: d.path,
    head,
    tail,
    free: typeof d.freeBytes === 'number' && !d.error ? t(locale, 'dir.free', formatBytes(d.freeBytes)) : '',
    editable,
    change: t(locale, 'dir.change'),
    error,
    warning,
    note: !error && !warning && d.note ? t(locale, `dir.note.${d.note}`) : '',
    // "use the selected folder itself": only for a fresh install, and only while the path is the picked one with the product's name added
    useSelected: editable && d.pickedPath ? t(locale, 'dir.useSelected') : '',
    // the safe place of a warning, one press away
    safe: editable && warning && d.safePath ? { label: t(locale, 'dir.safe'), path: d.safePath } : null,
  }
}

/**
 * The question about a folder that only has a warning (installDir.confirm): what is wrong, the folder and the safe place, and the buttons. "Install anyway" counts down
 * `seconds` (the same seconds as the other risky questions: reset's RESET_SECONDS); the safe place is the primary choice. null while the question is closed.
 */
export function confirmModel(view, locale) {
  const d = view.installDir
  if (!d?.editable || !d.confirm || !d.warning) return null
  return {
    title: t(locale, 'dir.confirm.title'),
    text: t(locale, `dir.warn.${d.warning}`),
    pathLabel: t(locale, 'dir.label'),
    path: d.path,
    safeLabel: t(locale, 'dir.confirm.safeLabel'),
    safePath: d.safePath || '',
    safe: t(locale, 'dir.safe'),
    install: t(locale, 'dir.confirm.install'),
    cancel: t(locale, 'dir.confirm.cancel'),
    seconds: Number.isFinite(d.confirmSeconds) && d.confirmSeconds > 0 ? d.confirmSeconds : 5,
  }
}

/** the label of "Install anyway" while it counts down: "仍然安装（5 秒）" / "Install anyway (5 s)"; the plain label when it can be pressed */
export const confirmLabel = (locale, model, remaining) => (remaining > 0 ? t(locale, 'dir.confirm.seconds', model.install, remaining) : model.install)

// ---------------------------------------------------------------- the page: header, notes, facts and buttons

const btn = (key, label, variant, act, extra = {}) => ({ key, label, variant, act, ...extra })

/**
 * {
 *   page, glyph: {icon, tone, busy}, title, lead,
 *   note: {icon, tone, text} | null,
 *   facts: [{icon, tone, title, text}],
 *   start: [button], end: [button]   // the footer: `start` at the left edge, `end` at the right edge in reading order, the primary one last
 * }
 */
export function pageModel(view, locale) {
  const m = view.maintenance
  const out = { page: view.page, glyph: { icon: 'desktop_windows', tone: 'primary', busy: false }, title: '', lead: '', note: null, facts: [], start: [], end: [] }
  // a folder the host refused: no way on until another one is picked (the reason shows under the location row)
  const dirBad = !!view.installDir?.error
  const fact = (icon, tone, key) => ({ icon, tone, title: t(locale, key), text: t(locale, `${key}.text`) })
  switch (view.page) {
    case 'welcome':
      out.title = t(locale, 'welcome.title')
      out.lead = t(locale, 'welcome.lead')
      if (view.uacCancelled) out.note = { icon: 'warning', tone: 'warning', text: t(locale, 'welcome.cancelled') }
      else if (view.upgrade) out.note = { icon: 'info', tone: 'secondary', text: t(locale, 'welcome.upgrade') }
      // only two facts: the administrator permission and the components. With a note the page is full and the Customize button says the second; a picked folder that offers "use the selected
      // folder itself" leaves the room of one fact, and a message under the location row (a refusal, a warning, a folder with files in it) the room of none
      const dir = view.installDir
      const dirMessage = !!(dir?.editable && (dir.error || dir.warning || dir.note))
      const dirLink = !!(dir?.editable && dir.pickedPath)
      out.facts = dirMessage ? [] : [fact('shield', 'tertiary', 'fact.admin'), ...(out.note || dirLink ? [] : [fact('display_settings', 'primary', 'fact.components')])]
      out.start = [btn('exit', t(locale, 'btn.exit'), 'text', { type: 'exit' })]
      out.end = [btn('customize', t(locale, 'btn.customize'), 'tonal', { type: 'customize' }, { disabled: dirBad }), btn('install', t(locale, 'btn.install'), 'filled', { type: 'install' }, { disabled: dirBad })]
      break
    case 'maintenance': {
      out.glyph = { icon: 'restart_alt', tone: 'primary', busy: false }
      out.title = t(locale, 'maint.title')
      out.lead = t(locale, 'maint.lead', m?.installedVersion ?? '', m?.packageVersion ?? '')
      if (m?.downgrade) out.note = { icon: 'warning', tone: 'warning', text: t(locale, 'maint.downgrade') }
      else if (m?.same) out.note = { icon: 'restart_alt', tone: 'secondary', text: t(locale, 'maint.same') }
      // two facts: with the location row above them a third does not fit the window (it was cut at the edge of the list)
      out.facts = [fact('folder', 'primary', 'maint.f1'), fact('build', 'tertiary', 'maint.f2')]
      const verb = m?.downgrade ? 'maint.downgradeTo' : m?.same ? 'maint.reinstall' : 'maint.update'
      out.start = [btn('uninstall', t(locale, 'maint.uninstall'), 'text', { type: 'uninstall' }, { disabled: !m?.hasUninstaller })]
      // `short`: the label in a narrow window (the version is in the lead already)
      const short = m?.downgrade ? 'maint.downgradeShort' : m?.same ? 'maint.reinstallShort' : 'maint.updateShort'
      out.end = [btn('modify', t(locale, 'maint.modify'), 'tonal', { type: 'customize' }, { short: t(locale, 'maint.modifyShort') }), btn('install', t(locale, verb) + (m?.packageVersion ?? ''), 'filled', { type: 'install' }, { short: t(locale, short) })]
      break
    }
    case 'components':
      out.title = t(locale, 'comp.title')
      out.lead = t(locale, view.maintenance ? 'comp.lead.maint' : 'comp.lead.fresh')
      out.end = [btn('back', t(locale, 'comp.back'), 'tonal', { type: 'back' }), btn('install', t(locale, 'comp.start'), 'filled', { type: 'install' }, { disabled: dirBad })]
      break
    case 'uac':
      out.glyph = { icon: 'shield', tone: 'tertiary', busy: false }
      out.title = t(locale, 'uac.title')
      out.lead = t(locale, 'uac.lead')
      out.facts = [fact('info', 'secondary', 'uac.f1'), fact('close', 'secondary', 'uac.f2')]
      out.end = [btn('wait', t(locale, 'uac.wait'), 'filled', null, { disabled: true, loading: true })]
      break
    case 'installing': {
      const g = Math.min(3, Math.max(0, view.progress.current))
      out.glyph = { icon: 'sync', tone: 'primary', busy: true }
      out.title = t(locale, `ins.g${g}`)
      out.lead = t(locale, `ins.g${g}.lead`)
      out.note = { icon: g === 2 ? 'info' : 'check', tone: 'secondary', text: t(locale, g === 2 ? 'ins.hint.drivers' : 'ins.hint') }
      out.end = [btn('minimise', t(locale, 'ins.minimise'), 'tonal', { type: 'minimise' })]
      break
    }
    case 'done':
      out.glyph = { icon: 'check', tone: 'success', busy: false }
      out.title = t(locale, 'done.title')
      out.lead = view.panelFailed ? t(locale, 'done.panelFailed') : ''
      // the weak button sits beside the primary one, on its left; it restarts when Windows asked for it, otherwise it closes. No sentence about restarting anywhere.
      out.end = [
        view.restart === 'optional' ? btn('restart', t(locale, 'done.restart'), 'text', { type: 'restart-pc' }) : btn('close', t(locale, 'done.close'), 'text', { type: 'exit' }),
        btn('open', view.opening ? t(locale, 'done.opening') : t(locale, view.guidePending ? 'done.journey' : 'done.panel'), 'filled', { type: 'open-panel' }, { loading: view.opening }),
      ]
      break
    case 'failed': {
      const kind = view.failure || 'generic'
      out.glyph = { icon: 'error', tone: 'error', busy: false }
      out.title = t(locale, `fail.${kind}.title`)
      out.lead = t(locale, `fail.${kind}.lead`)
      out.note = { icon: 'error', tone: 'error', text: t(locale, `fail.${kind}.code`, view.exitCode) }
      out.facts = [
        { icon: kind === 'generic' ? 'restart_alt' : 'build', tone: 'primary', title: t(locale, `fail.${kind}.f1`), text: t(locale, `fail.${kind}.f1.text`) },
        { icon: kind === 'service' ? 'display_settings' : 'description', tone: 'secondary', title: t(locale, `fail.${kind}.f2`), text: t(locale, `fail.${kind}.f2.text`) },
      ]
      out.start = [btn('log', t(locale, 'fail.log'), 'text', { type: 'open-log-folder' })]
      out.end = [
        btn('copy', t(locale, 'fail.copy'), 'tonal', { type: 'copy-details' }),
        btn('retry', t(locale, kind === 'generic' ? 'fail.retry' : 'fail.repair'), 'filled', { type: 'retry' }),
      ]
      break
    }
    default:
  }
  return out
}

export { COMPONENT_IDS }
