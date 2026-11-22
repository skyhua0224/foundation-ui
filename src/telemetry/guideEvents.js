// The anonymous funnel of the first-run guide as the `guide_funnel` event (kind `usage`: it follows the choice about anonymous usage statistics like every usage event). Which step a person reached, whether
// they skipped, finished or closed the guide, how long they stayed on a step, and which of the optional pages they opened. Fixed words and numbers only: nothing a person typed, no names, no addresses.
// The fields are the Worker's (docs/data-contract.md of the telemetry Worker, `guide_funnel`); a field the Worker does not know it drops.
import { catalogueId } from './events.js'

export const GUIDE_FUNNEL_PHASES = Object.freeze(['reached', 'skipped', 'finished', 'closed', 'optional_opened'])
/** The steps of the guide as the event names them (the flow of guideModel.js). A step of an older version of the guide is not counted. */
export const GUIDE_FUNNEL_STEPS = Object.freeze(['whatsnew', 'intro', 'account', 'channel', 'install', 'pair', 'connect', 'done'])
export const GUIDE_FUNNEL_OPTIONAL = Object.freeze(['appearance', 'motion', 'setup', 'webaccess', 'remote'])
export const GUIDE_FUNNEL_MODES = Object.freeze(['fresh', 'upgrade'])
const MAX_MS = 3_600_000

/** The props of one `guide_funnel` event, or null when the phase or the step is not one of the fixed words. `timeMs` is the time spent on the step the event is about (for `reached`: on the step before it). */
export function guideFunnelProps({ phase, step, optional, timeMs, mode } = {}) {
  if (!GUIDE_FUNNEL_PHASES.includes(phase) || !GUIDE_FUNNEL_STEPS.includes(step)) return null
  const props = { phase, step, mode: GUIDE_FUNNEL_MODES.includes(mode) ? mode : 'fresh' }
  if (phase === 'optional_opened') {
    if (!GUIDE_FUNNEL_OPTIONAL.includes(optional)) return null
    props.optional = optional
  }
  if (Number.isFinite(timeMs) && timeMs >= 0) props.time_ms = Math.min(MAX_MS, Math.round(timeMs))
  return props
}

/**
 * The funnel of one run of the guide. `send(props)` gets the props of an event (the product hands them to the event sender's `track.guideFunnel`); a missing `send` makes every call a no-op.
 * `enter(step)` is called whenever a step is shown: it reports `reached` with the time spent on the step before. `skip`, `finish` and `close` report on the step that is open. `optional(id)` is a page of
 * the done page being opened. The first call of a step that is already the current one is ignored (a re-render is not a visit).
 */
export function createGuideFunnel({ send, mode = 'fresh', now = () => Date.now() } = {}) {
  let step = ''
  let since = 0
  const emit = (props) => { if (props && typeof send === 'function') { try { send(props) } catch { /* a statistic never breaks the guide */ } } }
  const spent = () => (since ? now() - since : 0)
  return {
    enter(next) {
      const id = catalogueId(next, 16)
      if (!id || id === step) return
      emit(guideFunnelProps({ phase: 'reached', step: id, timeMs: step ? spent() : 0, mode }))
      step = id
      since = now()
    },
    skip: () => step && emit(guideFunnelProps({ phase: 'skipped', step, timeMs: spent(), mode })),
    finish: () => step && emit(guideFunnelProps({ phase: 'finished', step, timeMs: spent(), mode })),
    close: () => step && emit(guideFunnelProps({ phase: 'closed', step, timeMs: spent(), mode })),
    optional: (id) => step && emit(guideFunnelProps({ phase: 'optional_opened', step, optional: id, timeMs: spent(), mode })),
    get step() { return step },
  }
}
