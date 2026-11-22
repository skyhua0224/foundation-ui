import { driverGuardTexts, fill } from './texts.js'

// The graphics-driver notice, the safe mode and the encoder check, as data for the Panel home, the Web UI home and the tray.
// The host reads them from GET /api/gpu-driver-guard (see the contract in docs/gpu-driver-guard.md of Foundation Sunshine):
//   { v: 1, probe: 'pending' | 'running' | 'done' | 'failed' | 'skipped',
//     safe_mode: { active, since, auto_exit_s, skipped: ['encoder_probe', 'display_restore'] },
//     driver: null | { show, vendor, module, driver, phase, kind: 'crash' | 'hang', time, key } }
// and takes { action: 'dismiss' | 'retry' } on POST. The host decides whether a notice is due (not dismissed for this driver version, the installed driver is still
// the one it happened in); `driver.show` is its answer.

/**
 * The official pages of each vendor: where the driver is updated, and where its support is reached when the driver is already the latest version.
 * `assistant` is for a vendor whose download pages are split by hardware generation, so no single page covers them all: its own tool that finds the right driver.
 * Intel: `update` is the Graphics category of its download center (Arc and Core Ultra, 11th-14th gen, 7th-10th gen and 6th gen are separate downloads there).
 */
export const DRIVER_LINKS = Object.freeze({
  intel: Object.freeze({
    update: 'https://www.intel.com/content/www/us/en/search.html#sortCriteria=@lastmodifieddt%20descending&cf-tabfilter=Downloads&cf-downloadsppth=Graphics',
    assistant: 'https://www.intel.com/content/www/us/en/support/detect.html',
    support: 'https://www.intel.com/content/www/us/en/support/contact-intel.html',
  }),
  nvidia: Object.freeze({
    update: 'https://www.nvidia.com/en-us/drivers/',
    support: 'https://www.nvidia.com/en-us/support/',
  }),
  amd: Object.freeze({
    update: 'https://www.amd.com/en/support/download/drivers.html',
    support: 'https://www.amd.com/en/forms/contact-us/support.html',
  }),
})

const PHASES = ['startup', 'probe', 'idle', 'streaming']
const KINDS = ['crash', 'hang']

/** The values of one driver mark for the templates; nothing is trusted: an unknown vendor has no notice. */
function driverValues(driver, t) {
  if (!driver || !Object.hasOwn(DRIVER_LINKS, driver.vendor)) return null
  const phase = PHASES.includes(driver.phase) ? driver.phase : 'startup'
  const kind = KINDS.includes(driver.kind) ? driver.kind : 'crash'
  const version = typeof driver.driver === 'string' ? driver.driver : ''
  const module = typeof driver.module === 'string' ? driver.module : ''
  return { vendor: t.vendors[driver.vendor], phase: t.phases[phase], outcome: t.outcomes[kind], version, module }
}

/**
 * The notice for the last failure that lay in a graphics driver, or null when there is none to show.
 * `{ id, tone, icon, title, text, actions: [{ id: 'update' | 'assistant' | 'support', label, href } | { id: 'dismiss', label }] }`; `assistant` only where the vendor has one
 */
export function driverNotice(guard, locale = 'zh') {
  const driver = guard?.driver
  if (!driver?.show) return null
  const t = driverGuardTexts(locale)
  const values = driverValues(driver, t)
  if (!values) return null
  const links = DRIVER_LINKS[driver.vendor]
  return {
    id: 'gpu-driver',
    tone: 'warn',
    icon: 'memory',
    key: driver.key || '',
    title: fill(t.driverTitle, values),
    text: fill(values.version ? t.driverBody : t.driverBodyNoVersion, values),
    actions: [
      { id: 'update', label: t.update, href: links.update },
      ...(links.assistant ? [{ id: 'assistant', label: fill(t.assistant, values), href: links.assistant }] : []),
      { id: 'support', label: fill(t.support, values), href: links.support },
      { id: 'dismiss', label: t.dismiss },
    ],
  }
}

/** The safe-mode notice: what was skipped and how to leave it. `{ id, tone, icon, title, text, actions: [{ id: 'retry', label }] }`, null when the safe mode is off. */
export function safeModeNotice(guard, locale = 'zh') {
  const safe = guard?.safe_mode
  if (!safe?.active) return null
  const t = driverGuardTexts(locale)
  const minutes = Math.max(1, Math.round((Number(safe.auto_exit_s) || 300) / 60))
  return {
    id: 'safe-mode',
    tone: 'info',
    icon: 'shield',
    title: t.safeTitle,
    text: fill(t.safeBody, { minutes }),
    actions: [{ id: 'retry', label: t.retry }],
  }
}

/** The line shown while the encoders are being checked (the check runs after the host is already up), or '' when it is over or was left out. */
export function probeLine(guard, locale = 'zh') {
  const probe = guard?.probe
  return probe === 'pending' || probe === 'running' ? driverGuardTexts(locale).probing : ''
}

/** Everything a surface draws, in the order it draws it: the safe mode first, then the driver notice. The encoder-check line is separate (it is not a banner). */
export function guardNotices(guard, locale = 'zh') {
  return [safeModeNotice(guard, locale), driverNotice(guard, locale)].filter(Boolean)
}

/** The tray notification: the same title and sentence as the driver notice (the safe mode when there is no driver notice). null when there is nothing to say. */
export function trayNotification(guard, locale = 'zh') {
  const notice = driverNotice(guard, locale) || safeModeNotice(guard, locale)
  return notice ? { title: notice.title, message: notice.text } : null
}
