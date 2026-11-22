// The events of telemetry v1 as a page sends them (docs/telemetry.md): usage counts, experience numbers and error events in the shape of the host's contract, handed to the host (POST /api/telemetry/events), which
// applies the two choices once more, adds the install identity and sends them with its own events to the developers' server. No script of a third party is loaded, so a content blocker or a network that does not
// reach a Google host changes nothing.
// The two choices are the shared ones (consent.js): usage statistics (usage and experience events) and error reports (error events), both on until the person turns them off. Nothing is queued for a kind that is
// off here, and the host refuses it again when its own copy of the choice says off. Names the person typed or the host holds (apps, devices, games) are never sent: an event carries a fixed word (a catalogue id) or a
// number, and an error event has no text at all.
import { installActionTracking } from './actions.js'
import { createPagePerf } from './pagePerf.js'
import { guideFunnelProps } from './guideEvents.js'
import { updateResultProps } from './updateEvents.js'
import { mayCollect, mayReportErrors, readConsent, readErrors } from './consent.js'

export const EVENTS_PATH = '/api/telemetry/events'
const MAX_PENDING = 100
const FLUSH_AFTER_MS = 8000
const FLUSH_AT = 20

/** A catalogue id: lower case letters, digits, '.', '_' and '-', starting with a letter or a digit, at most `max` characters (what the contract accepts as an id). */
export const catalogueId = (value, max = 48) => String(value ?? '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[^a-z0-9]+/, '').slice(0, max).replace(/-+$/, '')

/** The update source (the setting auto | cnb | github | mirror, or the source a download really came from) as the contract names where an update came from: mirror (Mirror酱), cnb, github, other (auto and anything else). */
export const updateSourceOf = (source) => (source === 'mirror' || source === 'cnb' || source === 'github' ? source : 'other')

/** Why the chosen source (Mirror酱) was not the one used, as the contract names it; anything else is dropped. */
export const UPDATE_SOURCE_MISSES = Object.freeze(['version_lag', 'cdk_invalid', 'quota', 'network', 'no_cdk'])
export const updateSourceMissOf = (miss) => (UPDATE_SOURCE_MISSES.includes(miss) ? miss : '')

const defaultNow = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now())

/**
 * @param {object} options
 * @param {'panel'|'web'|'sparxie-launch'} options.product
 * @param {(body: {product: string, version: string, events: object[]}, extra: {keepalive: boolean}) => Promise<{ok: boolean, status: number}>} options.post the transport to the host
 * @param {() => boolean} [options.usageOn] default: the stored choice of this window
 * @param {() => boolean} [options.errorsOn]
 */
export function createEventSender({ product, post, usageOn = () => mayCollect(readConsent()), errorsOn = () => mayReportErrors(readErrors()), now = defaultNow, storage, schedule = (fn, ms) => setTimeout(fn, ms), cancel = (id) => clearTimeout(id) } = {}) {
  let pending = []
  let timer = null
  let version = ''
  let inert = false
  let started = false
  const allowed = (kind) => (kind === 'error' ? errorsOn() : usageOn())

  const flush = async ({ keepalive = false } = {}) => {
    if (timer) { cancel(timer); timer = null }
    if (!pending.length) return
    const events = pending.splice(0, pending.length).filter((event) => allowed(event.kind))
    if (!events.length) return
    try {
      const response = await post({ product, version, events: events.map(({ kind, name, props }) => ({ kind, name, props })) }, { keepalive })
      // 5xx and 429: the host is busy or restarting; the events are put back once, never more
      if (response && !response.ok && (response.status >= 500 || response.status === 429)) pending.unshift(...events.filter((event) => !event.retried).map((event) => ({ ...event, retried: true })).slice(0, MAX_PENDING - pending.length))
    } catch { /* the host cannot be reached: the page has bigger problems than a statistic */ }
  }
  const queue = (kind, name, props = {}) => {
    if (inert || !allowed(kind)) return
    if (pending.length >= MAX_PENDING) pending.shift()
    pending.push({ kind, name, props })
    if (pending.length >= FLUSH_AT) void flush()
    else if (!timer) timer = schedule(() => { timer = null; void flush() }, FLUSH_AFTER_MS)
  }
  const feature = (id) => queue('usage', 'feature_used', { feature: catalogueId(id) })
  // An error event carries a code and a component, never the text of the error: an exception message can hold what the person typed, a path or a name. The one place for typed text is the report the person writes (report.js).
  const errorEvent = ({ code = '', severity = 'error', component = product } = {}) => queue('error', 'error', { component: catalogueId(component, 32) || product, code: catalogueId(code, 40) || 'unknown', severity, count: 1 })
  const frames = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => requestAnimationFrame(fn)) : setTimeout(fn, 0))
  const sessionFlag = (key) => { try { const s = storage ?? globalThis.sessionStorage; const first = s?.getItem(key) !== '1'; s?.setItem(key, '1'); return first } catch { return true } }

  const sender = {
    /** The product version as shown, and whether this page is embedded in another product that counts for itself (it then counts nothing). */
    setContext: ({ version: next = '', embedded = false } = {}) => { version = String(next || '').slice(0, 48); inert = !!embedded },
    queue, flush, feature, errorEvent,
    /** Hand events to the host now, whatever the queue holds and without asking the choices (the caller decides: a report the person sent by hand is their own press). -> the response of the host. */
    postNow: (events) => post({ product, version, events }, { keepalive: false }),
    /** An off drops what waited at once: `usage` false drops the usage and experience events, `errors` false the error events. */
    drop: ({ usage = true, errors = true } = {}) => { pending = pending.filter((e) => (e.kind === 'error' ? errors : usage)) },
    get pending() { return pending.length },
    track: {
      /** The product was opened: once per load (cold: the first load in this session of the window); `startMs` is the time it took to get here; `updateSource` the source the last update really came from (else the setting); `updateSourceMiss` why the chosen source was not used (UPDATE_SOURCE_MISSES), only when it was not. */
      appStart: ({ startMs, updateSource, updateSourceMiss } = {}) => {
        if (started) return
        started = true
        queue('usage', 'app_start', { cold: sessionFlag(`foundation-ui.telemetry.started.${product}`), ...(Number.isFinite(startMs) ? { start_ms: Math.round(startMs) } : {}), ...(updateSource ? { update_source: updateSourceOf(updateSource) } : {}), ...(updateSourceMissOf(updateSourceMiss) ? { update_source_miss: updateSourceMissOf(updateSourceMiss) } : {}) })
      },
      /** A page was opened: the time until its first painted frame, as the first number of how quickly a page has something to show. */
      pageView: (page) => {
        const id = catalogueId(page, 40)
        if (!id) return
        const at = now()
        let current = sender._page
        current = sender._page = { id, at }
        sender.perf?.visit(id)
        frames(() => { if (sender._page === current) queue('experience', 'panel_page', { page: id, time_to_content_ms: Math.max(0, Math.round(now() - at)) }) })
      },
      feature,
      /** A step of the first-run guide (guideEvents.js): the props the guide's funnel hands over, cleaned to the fixed words once more. Usage kind: it follows the choice about anonymous usage statistics. */
      guideFunnel: (props) => { const clean = guideFunnelProps({ phase: props?.phase, step: props?.step, optional: props?.optional, timeMs: props?.time_ms, mode: props?.mode }); if (clean) queue('usage', 'guide_funnel', clean) },
      error: (code, _message, extra = {}) => errorEvent({ code, ...extra }),
      /** A step of an update finished (updateEvents.js): where it came from, the step, ok or failed and the class of the failure. Follows the error-report choice like the other results. */
      updateResult: (details) => queue('error', 'update_result', updateResultProps({ ...details, source: updateSourceOf(details?.source) })),
    },
    _page: null,
    /** The page-experience collector of this window (pagePerf.js), set by installEventListeners; null where the runtime has none. */
    perf: null,
    /** `fetch` with the clock around the calls to the host's own API; without a collector it is `fetch` itself. */
    timedFetch: (fetchImpl = globalThis.fetch) => (sender.perf ? sender.perf.timedFetch(fetchImpl) : fetchImpl),
  }
  return sender
}

/**
 * The events every window has in common, from its own events: the two choices turning off, a known limit of the machine, an error the shell showed, and the page being hidden (what waits is sent).
 * `win` is the window (default: the global one); returns a function that removes the listeners.
 */
export function installEventListeners(sender, win = globalThis.window, doc = globalThis.document) {
  if (!win || typeof win.addEventListener !== 'function') return () => {}
  const on = (name, fn) => { win.addEventListener(name, fn); return () => win.removeEventListener?.(name, fn) }
  const offs = []
  // the last actions of the person (page changes, marked presses, settings, stream state) for the error reports
  offs.push(installActionTracking(win, doc))
  // page experience sketches (LCP, CLS, INP, long animation frames, frame times, API latency, heap): one event per route when the page is hidden, nothing in between. Started before the listeners that flush, so its events are queued first.
  if (!sender.perf && typeof win.PerformanceObserver !== 'undefined') {
    const perf = createPagePerf({ emit: (props, name) => sender.queue('experience', name, props), onReady: (page, ms) => sender.queue('experience', 'page_ready', { page, ms: Math.min(3_600_000, Math.max(0, ms)) }), env: { win, doc } })
    perf.start(sender._page?.id || 'home')
    sender.perf = perf
    offs.push(() => { perf.stop(); if (sender.perf === perf) sender.perf = null })
  }
  offs.push(on('foundation-telemetry-consent', (event) => { if (!mayCollect(event.detail)) { sender.drop({ usage: false }); sender.perf?.collect({ force: true }) } }))
  offs.push(on('foundation-telemetry-errors', (event) => { if (!mayReportErrors(event.detail)) sender.drop({ errors: false }) }))
  // a known limit of this machine or version (an unsupported GPU, a missing component): an error event of severity warning with the category and the code only, at most 20 a minute
  const known = []
  offs.push(on('foundation-known-env', (event) => {
    const t = Date.now()
    while (known.length && t - known[0] > 60_000) known.shift()
    if (known.length >= 20) return
    known.push(t)
    sender.queue('error', 'error', { component: 'known-env', code: catalogueId(`${event.detail?.category || ''}.${event.detail?.code || ''}`, 40) || 'unknown', severity: 'warning', count: 1 })
  }))
  // an error the shell showed: one error event, scrubbed, at most 10 a minute
  const stamps = []
  offs.push(on('foundation-error-reported', (event) => {
    const t = Date.now()
    while (stamps.length && t - stamps[0] > 60_000) stamps.shift()
    if (stamps.length >= 10) return
    stamps.push(t)
    sender.errorEvent({ code: 'shell_error', severity: event.detail?.fatal ? 'fatal' : 'error' })
  }))
  offs.push(on('pagehide', () => { sender.perf?.collect({ continueVisit: false, force: true }); void sender.flush({ keepalive: true }) }))
  if (doc && typeof doc.addEventListener === 'function') {
    const hidden = () => { if (doc.visibilityState === 'hidden') void sender.flush({ keepalive: true }) }
    doc.addEventListener('visibilitychange', hidden)
    offs.push(() => doc.removeEventListener?.('visibilitychange', hidden))
  }
  return () => offs.forEach((off) => off())
}
