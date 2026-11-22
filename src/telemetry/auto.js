// Automatic reports, the E2 policy. An error is classified at the source (classify.js); only an UNEXPECTED error whose stack is our own code leaves the window on its own, and only when the person said yes.
//   - the first occurrence of a fingerprint (per release) goes as one `error` event with the details the contract has room for, at most AUTO.perDay of them a day from one install
//   - later occurrences only add to the count of that error (one batched `error` event with a count), never new details
//   - KNOWN-ENV errors are a counter (an `error` event of severity warning with the code, no text); EXPECTED-ENV errors and noise stay on the screen and in the breadcrumbs
//   - a flood (a loop of errors) is cut off: more than AUTO.floodPerMinute in a minute are dropped
// The events go to the host the page belongs to (send.js), which applies the choice again and sends them to the developers' server: no Google host, no server code in the product.
import { classifyError, KINDS } from './classify.js'
import { mayReportErrors, readErrors } from './consent.js'
import { fingerprintOf } from './fingerprint.js'
import { BREADCRUMBS, crumbs } from './levels.js'
import { scrubStack, scrubText } from './scrub.js'
import { bumpIssue, createIssue } from './send.js'

export const AUTO = Object.freeze({ perDay: 5, floodPerMinute: 20, bumpBatchMs: 10 * 60_000, bumpMax: 50, queueMax: 5 })
export const AUTO_KEY = 'foundation-ui.telemetry.auto'
export const ISSUE_SCHEMA = 1
export const ISSUE_LIMITS = Object.freeze({ category: 24, code: 40, name: 80, message: 1000, stack: 8000, breadcrumbs: 6000, os: 80, page: 120, locale: 20, release: 64, components: 300, key: 60, time: 40 })
export const ISSUE_REQUIRED = Object.freeze(['schema', 'fingerprint', 'stem', 'category', 'code', 'kind', 'product', 'release', 'message', 'first_seen', 'last_seen', 'count'])
export const ISSUE_FIELDS = Object.freeze([...ISSUE_REQUIRED, 'name', 'stack', 'os', 'page', 'locale', 'breadcrumbs', 'components', 'encoder', 'gpu_vendor', 'capture_backend'])
export const KEY_FIELDS = Object.freeze(['encoder', 'gpu_vendor', 'capture_backend'])

/** The custom keys of a report: only these three, each cut and scrubbed (never a name, a path, an address or a title). */
export function keysOf(keys = {}) {
  const out = {}
  for (const k of KEY_FIELDS) if (keys && keys[k]) out[k] = scrubText(String(keys[k]), ISSUE_LIMITS.key)
  return out
}

/** The `issues/{fingerprint}` document of a first occurrence. */
export function issueDocument({ report, cls, fp, product, release, now = Date.now(), keys = {}, components = '', breadcrumbs = '' }) {
  const L = ISSUE_LIMITS
  const time = new Date(now).toISOString()
  const doc = {
    schema: ISSUE_SCHEMA, fingerprint: fp.id, stem: fp.stem, category: cls.category, code: cls.code, kind: 'UNEXPECTED',
    product: product === 'panel' ? 'panel' : 'web', release: scrubText(release || '', L.release), message: scrubText(report.message || '', L.message),
    first_seen: time, last_seen: time, count: 1,
  }
  if (report.name) doc.name = scrubText(report.name, L.name)
  if (report.stack) doc.stack = scrubStack(report.stack, L.stack)
  if (report.os) doc.os = scrubText(report.os, L.os)
  if (report.page) doc.page = scrubText(report.page, L.page)
  if (report.locale) doc.locale = scrubText(report.locale, L.locale)
  if (breadcrumbs) doc.breadcrumbs = scrubText(breadcrumbs, L.breadcrumbs)
  if (components) doc.components = scrubText(components, L.components)
  Object.assign(doc, keysOf(keys))
  return doc
}

const readState = (storage) => { try { const v = JSON.parse(storage?.getItem(AUTO_KEY) || 'null'); return v && typeof v === 'object' ? v : null } catch { return null } }
const day = (now) => new Date(now).toISOString().slice(0, 10)
const blank = (now) => ({ day: day(now), detailed: 0, seen: {}, pending: {}, bumpAt: {}, meta: {}, queue: [], deferred: 0 })

/**
 * The reporter of one window. `context()` -> { product, version, os, page, locale, components, keys }. `emitKnown({ category, code })` counts a KNOWN-ENV error (an error event of severity warning).
 * `handle(error, { kind })` returns what was done: { action: 'dropped' | 'local' | 'counter' | 'detail' | 'increment' | 'queued' | 'deferred' | 'sampled' | 'rejected', reason?, fingerprint?, cls }.
 */
export function createAutoReporter({ storage = globalThis.localStorage, getConsent = () => readErrors(), context = () => ({}), now = () => Date.now(), origin = '', send = { create: createIssue, bump: bumpIssue }, emitKnown = null, buffer = crumbs } = {}) {
  let state = null
  const stamps = []
  let last = ''
  const load = () => {
    const t = now()
    state = state || readState(storage) || blank(t)
    if (state.day !== day(t)) { state.day = day(t); state.detailed = 0; state.deferred = 0 }
    state.seen ||= {}; state.pending ||= {}; state.bumpAt ||= {}; state.meta ||= {}; state.queue ||= []
    return state
  }
  const save = () => { try { storage?.setItem(AUTO_KEY, JSON.stringify(state)) } catch { /* no storage: the limits then live in memory */ } }
  const isApp = (url) => { try { return !origin || new URL(url).origin === origin || !/^https?:/.test(url) || /^(?:localhost|127\.0\.0\.1)$/.test(new URL(url).hostname) } catch { return true } }

  async function bumpNow(id, n) {
    const st = load()
    // the component and code of the first occurrence: a count without them has nothing to count (an older state): dropped
    if (!st.meta[id]) { delete st.pending[id]; save(); return false }
    const answer = await send.bump({ ...st.meta[id], fingerprint: id }, Math.min(n, AUTO.bumpMax))
    if (answer.state === 'sent') { delete st.pending[id]; st.bumpAt[id] = now(); save(); return true }
    if (answer.state === 'rejected') { delete st.pending[id]; save() }
    return false
  }

  async function handle(error, { kind = 'error', report = null } = {}) {
    const ctx = context() || {}
    const cls = classifyError(error, { page: ctx.page, origin, kind })
    const done = (action, extra = {}) => ({ action, cls, ...extra })
    if (cls.noise) return done('dropped', { reason: cls.noise })
    if (cls.kind === KINDS.EXPECTED_ENV) return done('local', { reason: 'expected-env' })
    if (!mayReportErrors(getConsent())) return done('local', { reason: 'no-consent' })
    if (cls.kind === KINDS.KNOWN_ENV) { try { emitKnown?.({ category: cls.category, code: cls.code }) } catch { /* a counter is optional */ } return done('counter') }
    if (!cls.appOrigin) return done('local', { reason: 'not-app-origin' })
    const t = now()
    while (stamps.length && t - stamps[0] > 60_000) stamps.shift()
    if (stamps.length >= AUTO.floodPerMinute) return done('sampled')
    stamps.push(t)
    const st = load()
    const fp = fingerprintOf({ category: cls.category, code: cls.code, stack: report?.stack ?? (error && error.stack) ?? '', release: ctx.version || '', isApp })
    if (st.seen[fp.id]) {
      st.pending[fp.id] = (st.pending[fp.id] || 0) + 1
      save()
      last = fp.id
      if (t - (st.bumpAt[fp.id] || 0) >= AUTO.bumpBatchMs || st.pending[fp.id] >= AUTO.bumpMax) await bumpNow(fp.id, st.pending[fp.id])
      return done('increment', { fingerprint: fp.id })
    }
    if (st.detailed >= AUTO.perDay) { st.deferred += 1; save(); return done('deferred', { fingerprint: fp.id }) }
    const doc = issueDocument({ report: report || { message: String(error?.message || error), name: error?.name, stack: error?.stack }, cls, fp, product: ctx.product, release: ctx.version, now: t, keys: ctx.keys, components: ctx.components, breadcrumbs: buffer.toText(BREADCRUMBS.perReport) })
    const answer = await send.create(doc)
    if (answer.state === 'sent') { st.seen[fp.id] = t; st.bumpAt[fp.id] = t; st.meta[fp.id] = { component: doc.product, code: `${doc.category}.${doc.code}` }; st.detailed += 1; save(); last = fp.id; return done('detail', { fingerprint: fp.id, doc }) }
    if (answer.state === 'offline') { if (st.queue.length < AUTO.queueMax) st.queue.push({ doc, at: t }); save(); return done('queued', { fingerprint: fp.id }) }
    return done('rejected', { fingerprint: fp.id })
  }

  /** Tries again what could not be sent (a queued first occurrence, counts that were waiting). */
  async function flush() {
    const st = load()
    const queue = st.queue.splice(0)
    const keep = []
    let sent = 0
    for (const entry of queue) {
      const answer = await send.create(entry.doc)
      if (answer.state === 'sent') { st.seen[entry.doc.fingerprint] = now(); st.meta[entry.doc.fingerprint] = { component: entry.doc.product, code: `${entry.doc.category}.${entry.doc.code}` }; st.detailed += 1; sent += 1 }
      else if (answer.state === 'offline') keep.push(entry)
    }
    st.queue = keep
    for (const [id, n] of Object.entries(st.pending)) if (n > 0 && await bumpNow(id, n)) sent += 1
    save()
    return { sent, queued: st.queue.length }
  }

  return { handle, flush, fingerprint: () => last, get state() { return load() } }
}

