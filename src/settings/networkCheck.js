// The network check run of the host (POST/GET /api/network/check, JSON v1) as far as a screen needs it while it is going: which steps there are and how far each is. The results of the steps
// are the report's (GET /api/network/reachability); this is only the progress. Pure: no DOM, no Vue.
import { reachTexts } from './reachTexts.js'

export const CHECK_VERSION = 1
const STATES = Object.freeze(['pending', 'running', 'ok', 'warn', 'fail', 'skipped'])
const str = (v) => (v === undefined || v === null ? '' : String(v).trim())

/** The run from the host's answer, or null when it is not a v1 run. */
export function normalizeRun(raw) {
  if (!raw || typeof raw !== 'object' || Number(raw.version) !== CHECK_VERSION || !Array.isArray(raw.steps) || !str(raw.id)) return null
  return {
    id: str(raw.id), state: raw.state === 'done' ? 'done' : 'running', timedOut: raw.timed_out === true,
    steps: raw.steps.filter((s) => s && typeof s === 'object' && str(s.id)).map((s) => ({ id: str(s.id), subject: str(s.subject), state: STATES.includes(s.state) ? s.state : 'pending', checked: s.checked === true })),
  }
}

/**
 * The progress of a run: { done, total, text, steps: [{ key, id, subject, phase }] } with phase `pending` | `running` | `done`. A step is done when it has a result or its probe has ended. The screens name
 * the steps (`stepTitle`) in their own language. null for no run.
 */
export function checkProgress(run) {
  if (!run) return null
  const steps = run.steps.map((s, i) => ({ key: `${s.id}:${s.subject || i}`, id: s.id, subject: s.subject, state: s.state, phase: s.state === 'running' ? (s.checked ? 'done' : 'running') : s.state === 'pending' ? 'pending' : 'done' }))
  const done = steps.filter((s) => s.phase === 'done').length
  return { done, total: steps.length, text: `${done}/${steps.length}`, steps }
}

/** The icon of a step: only a step that passed gets the check; a failure, a note and a skip have their own. */
export function stepIcon(step) {
  if (step.phase === 'pending') return 'radio_button_unchecked'
  if (step.phase === 'running') return 'sync'
  return ({ ok: 'check_circle', warn: 'info', fail: 'error', skipped: 'do_not_disturb_on' })[step.state] || 'check_circle'
}

/** What a step is at, in words (for a screen reader and the tooltip): waiting, going, or its result (ok, warn, fail, skipped). */
export function stepPhaseWord(step, locale = 'en') {
  const T = reachTexts(locale).check.phase
  if (step.phase === 'pending') return T.pending
  if (step.phase === 'running') return T.running
  return T[step.state] || T.done
}

/** The name of a step in the person's language: `本机端口`, `公网地址 203.0.113.9:60000`. */
export function stepTitle(step, locale = 'en') {
  const T = reachTexts(locale).check
  return String(T.steps[step.id] || step.id).replace('{subject}', step.subject || '')
}
