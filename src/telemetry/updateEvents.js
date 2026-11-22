// The outcome of an update step as the `update_result` event of the contract (docs/privacy_telemetry.md in the host): where the update came from, the step it reached, whether it worked, and for a failure a class of
// the reason, never the text of an error. The step names are the Worker's (check, download, verify, apply, restart); the steps of the update sheet (model.js) map onto them.
import { catalogueId } from './events.js'

export const UPDATE_SOURCES = Object.freeze(['mirror', 'github', 'other'])
export const UPDATE_STAGES = Object.freeze(['check', 'download', 'verify', 'apply', 'restart'])
export const UPDATE_ERROR_CLASSES = Object.freeze(['network', 'http_4xx', 'http_5xx', 'hash_mismatch', 'disk', 'permission', 'cancelled', 'other'])

const STAGE_OF = Object.freeze({
  checking: 'check', check: 'check', available: 'check', latest: 'check',
  downloading: 'download', download: 'download',
  verifying: 'verify', verify: 'verify', checksum: 'verify', hash: 'verify',
  ready: 'apply', installing: 'apply', install: 'apply', apply: 'apply', extract: 'apply', replace: 'apply',
  restarting: 'restart', restart: 'restart', relaunch: 'restart',
})
/** The step of the update sheet (or a step word of the updater) as one of the five stages; anything unknown is `apply`, the step where most of the work is. */
export const updateStageOf = (step) => STAGE_OF[String(step ?? '').toLowerCase()] || 'apply'

/** The class of a failure from what the caller has at hand: an HTTP status, the name or code of an error. Text is never read. */
export function updateErrorClassOf({ status, name, code } = {}) {
  const s = Number(status)
  if (Number.isFinite(s) && s >= 500 && s < 600) return 'http_5xx'
  if (Number.isFinite(s) && s >= 400 && s < 500) return 'http_4xx'
  const word = `${name ?? ''} ${code ?? ''}`.toLowerCase()
  if (/abort|cancel/.test(word)) return 'cancelled'
  if (/hash|checksum|digest|sha/.test(word)) return 'hash_mismatch'
  if (/enospc|disk|quota|space/.test(word)) return 'disk'
  if (/eacces|eperm|permission|denied|access/.test(word)) return 'permission'
  if (/network|timeout|fetch|econn|enotfound|offline|dns|tls/.test(word)) return 'network'
  return 'other'
}

/** The props of an `update_result`. `fromVersion` and `toVersion` are product versions as shown; `durMs` the time the step took. */
export function updateResultProps({ source = 'other', step, ok, status, name, code, fromVersion, toVersion, durMs, rebootNeeded } = {}) {
  const props = { source: UPDATE_SOURCES.includes(source) ? source : 'other', stage: updateStageOf(step), result: ok ? 'ok' : 'failed' }
  if (!ok) props.error_class = updateErrorClassOf({ status, name, code })
  const from = catalogueId(fromVersion, 40)
  const to = catalogueId(toVersion, 40)
  if (from) props.from_version = from
  if (to) props.to_version = to
  if (Number.isFinite(durMs) && durMs >= 0) props.dur_ms = Math.min(3_600_000, Math.round(durMs))
  if (rebootNeeded === true) props.reboot_needed = true
  return props
}
