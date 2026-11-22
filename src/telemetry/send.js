// Sending a report to the developers, and keeping it when that is not possible. A report is an error event named `report` (reportToEvent) handed to the host the page belongs to (POST /api/telemetry/events through the
// transport the product registers with setReportTransport), which sends it to the developers' own server with its other events; no Google host is involved. A report the person sends by hand is an explicit action: the host
// takes it whatever the two choices say. Where the host or the server cannot be reached the report waits in a local queue and is tried again later; the person is told so, and can copy, download or open a GitHub issue.
import { reportToEvent } from './report.js'
import { catalogueId } from './events.js'
import { errorReportEvent } from './errorEvent.js'

export const QUEUE_KEY = 'foundation-ui.errors.queue'
export const SENT_KEY = 'foundation-ui.errors.sent'
export const QUEUE_MAX = 20
export const QUEUE_MAX_ATTEMPTS = 8
export const RATE = Object.freeze({ perHour: 6 })
export const SEND_TIMEOUT_MS = 8000

export const SENT_IDS_KEY = 'foundation-ui.errors.sentids'
export const SENT_IDS_MAX = 50
export const AUTO_FLUSH_GAP_MS = 30_000


/** A stable 32-hex id for a document: the same content, the same id (two 64-bit FNV-1a lanes over the keys in order; not a secret, only a name). */
export function reportIdOf(doc) {
  // the reply key is made once for a report and is not part of what the report says: the same words are the same report
  const text = JSON.stringify(Object.keys(doc || {}).filter((k) => k !== 'reply_key').sort().map((k) => [k, doc[k]]))
  let a = 0xcbf29ce484222325n, b = 0x84222325cbf29ce4n
  const M = 0xffffffffffffffffn
  for (let i = 0; i < text.length; i += 1) {
    const c = BigInt(text.charCodeAt(i))
    a = ((a ^ c) * 0x100000001b3n) & M
    b = ((b ^ (c + 31n)) * 0x1000193n) & M
  }
  return a.toString(16).padStart(16, '0') + b.toString(16).padStart(16, '0')
}
/** The short reference the person is told after a send: the start of the document id. */
export const referenceOf = (id) => String(id || '').slice(0, 8).toUpperCase()

let transport = null
/** The product registers how events reach its host: `(events) => Promise<Response-like { ok, status, json? }>`. Without one nothing can be sent (the report waits). */
export const setReportTransport = (fn) => { transport = typeof fn === 'function' ? fn : null }

// the answer of one request, in the words the callers use: sent / offline (worth trying again) / rejected (trying again changes nothing)
async function request(events, { transport: use = transport, timeoutMs = SEND_TIMEOUT_MS } = {}) {
  if (typeof use !== 'function') return { state: 'offline', reason: 'no-transport' }
  let timer = 0
  try {
    const response = await Promise.race([use(events), new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { name: 'AbortError' })), timeoutMs) })])
    if (response && response.ok) {
      // the host answers how many events it kept: none means it refused them; with a screenshot in the report it also says what became of the screenshot (`shot`: 'uploaded' or the reason it was left out)
      let accepted = null, shot = ''
      try { const answer = await response.json(); accepted = answer?.accepted; shot = typeof answer?.shot === 'string' ? answer.shot : '' } catch { /* an answer without a body is an answer */ }
      return accepted === 0 ? { state: 'rejected', reason: 'not-accepted' } : { state: 'sent', ...(shot ? { shot } : {}) }
    }
    const status = response ? response.status : 0
    if (status === 429 || status >= 500 || status === 408 || status === 0) return { state: 'offline', reason: status ? `http-${status}` : 'network', maybeArrived: status >= 500 || status === 408 }
    return { state: 'rejected', reason: `http-${status}` }
  } catch (error) {
    const timedOut = !!error && error.name === 'AbortError'
    return { state: 'offline', reason: timedOut ? 'timeout' : 'network', maybeArrived: timedOut }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * One report. The answer is one of: `sent` (with the `id` when it was given); `offline` (no answer, a timeout, a server error: worth trying again; `maybeArrived` when the request may have been handled before the answer was
 * lost); `rejected` (the host refused it: trying again changes nothing).
 */
export async function sendDocument(doc, { transport: use, timeoutMs = SEND_TIMEOUT_MS, id = '' } = {}) {
  const answer = await request([reportToEvent(doc)], { transport: use, timeoutMs })
  return answer.state === 'sent' && id ? { ...answer, id } : answer
}

const store = (storage) => { try { return storage ?? globalThis.localStorage ?? null } catch { return null } }
const readJson = (storage, key) => { try { const v = JSON.parse(store(storage)?.getItem(key) || 'null'); return v } catch { return null } }
const writeJson = (storage, key, value) => { try { store(storage)?.setItem(key, JSON.stringify(value)); return true } catch { return false } }

export const loadQueue = (storage) => { const v = readJson(storage, QUEUE_KEY); return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object' && x.doc && typeof x.doc === 'object').slice(-QUEUE_MAX) : [] }
export const saveQueue = (queue, storage) => writeJson(storage, QUEUE_KEY, queue.slice(-QUEUE_MAX))
/** The newest reports that keep a screenshot in the queue: the picture is the largest part of an entry and the window's storage is small, so older entries keep their text and lose the picture. */
export const QUEUE_SHOTS_MAX = 3
/**
 * Keep a report for later. With an `id` the same report is kept once: a second press replaces the entry instead of adding a copy.
 * -> { length, shotLost }: `shotLost` when the report carried a screenshot and had to be kept without it (the storage was full); the text is never given up for the picture.
 */
export function enqueueReport(doc, storage, now = Date.now(), { id = '', maybeArrived = false, explicit = false } = {}) {
  const queue = loadQueue(storage)
  const at = id ? queue.findIndex((e) => e.id === id) : -1
  const entry = { doc, attempts: 0, at: now, ...(id ? { id } : {}), ...(maybeArrived ? { maybeArrived: true } : {}), ...(explicit ? { explicit: true } : {}) }
  if (at >= 0) queue[at] = { ...queue[at], doc, ...(maybeArrived ? { maybeArrived: true } : {}), ...(explicit ? { explicit: true } : {}) }
  else queue.push(entry)
  let withShot = 0
  for (let i = queue.length - 1; i >= 0; i -= 1) if (queue[i].doc.shot && (withShot += 1) > QUEUE_SHOTS_MAX) queue[i] = { ...queue[i], doc: dropShot(queue[i].doc) }
  let shotLost = false
  if (!saveQueue(queue, storage)) {
    // the storage said no (the picture is large): the same entry without its picture, then the older pictures go too
    const key = at >= 0 ? at : queue.length - 1
    shotLost = !!queue[key].doc.shot
    queue[key] = { ...queue[key], doc: dropShot(queue[key].doc) }
    if (!saveQueue(queue, storage)) saveQueue(queue.map((e) => ({ ...e, doc: dropShot(e.doc) })), storage)
  }
  return { length: queue.length, shotLost }
}
const dropShot = (doc) => { const { shot, ...rest } = doc; return rest }
export const enqueue = (doc, storage, now, options) => enqueueReport(doc, storage, now, options).length
/** The reply key a queued report already carries (its first press made it): a second press of the same report keeps it. */
export const queuedReplyKey = (id, storage) => (id ? String(loadQueue(storage).find((e) => e.id === id)?.doc?.reply_key || '') : '')
export const isQueued = (id, storage) => !!id && loadQueue(storage).some((e) => e.id === id)
export const removeQueued = (id, storage) => { const queue = loadQueue(storage); const left = queue.filter((e) => e.id !== id); if (left.length !== queue.length) saveQueue(left, storage); return queue.length - left.length }
const sentListeners = new Set()
/** Called (with the id) when a report was sent from this computer, also by the automatic flush: the history of the person's own reports follows it. Returns the function that stops listening. */
export const onReportSent = (fn) => { sentListeners.add(fn); return () => sentListeners.delete(fn) }
const rememberSent = (id, storage) => { if (!id) return; for (const fn of sentListeners) { try { fn(id) } catch { /* a listener never breaks a send */ } } const ids = (readJson(storage, SENT_IDS_KEY) || []).filter((x) => typeof x === 'string' && x !== id); ids.push(id); writeJson(storage, SENT_IDS_KEY, ids.slice(-SENT_IDS_MAX)) }
/** Was this report (by id) sent from this computer already? A second press then says so without sending a second one. */
export const wasSent = (id, storage) => !!id && (readJson(storage, SENT_IDS_KEY) || []).includes(id)
// one request per report at a time, whoever asks (the person's press or the automatic flush): the second asker gets the answer of the first
const inflight = new Map()
const guarded = (id, run) => {
  if (inflight.has(id)) return inflight.get(id)
  const p = Promise.resolve().then(run).finally(() => { inflight.delete(id) })
  inflight.set(id, p)
  return p
}
// one try of a kept report, in the shape the form is told: sent / queued (offline) / rejected
async function sendEntry(entry, options) {
  const answer = await (options.send || sendDocument)(entry.doc, { ...options, id: entry.id || '' })
  if (answer.state === 'sent') { rememberSent(entry.id, options.storage); return { state: 'sent', id: entry.id } }
  if (answer.state === 'offline') return { state: 'queued', id: entry.id, reason: answer.reason, maybeArrived: !!answer.maybeArrived }
  return { ...answer, id: entry.id }
}
const keyOf = (e) => e.id || `at:${e.at}`
/**
 * Try every queued report once. A sent or rejected report leaves the queue; one that is offline stays (up to QUEUE_MAX_ATTEMPTS tries). Returns { sent, rejected, left }.
 * A report that is on its way already (the person pressed Retry) is not sent a second time, and what was added to the queue while this ran is kept.
 */
export async function flushQueue(options = {}) {
  const { storage } = options
  const snapshot = loadQueue(storage).filter((e) => !options.only || options.only(e))
  const result = new Map()
  let sent = 0, rejected = 0
  for (const entry of snapshot) {
    const answer = entry.id ? await guarded(entry.id, () => sendEntry(entry, options)) : await sendEntry(entry, options)
    if (answer.state === 'sent') { sent += 1; result.set(keyOf(entry), null) }
    else if (answer.state === 'rejected') { rejected += 1; result.set(keyOf(entry), null) }
    else result.set(keyOf(entry), entry.attempts + 1 < QUEUE_MAX_ATTEMPTS ? { attempts: entry.attempts + 1, ...(answer.maybeArrived ? { maybeArrived: true } : {}) } : null)
  }
  const now = loadQueue(storage).flatMap((e) => { if (!result.has(keyOf(e))) return [e]; const r = result.get(keyOf(e)); return r ? [{ ...e, ...r }] : [] })
  saveQueue(now, storage)
  return { sent, rejected, left: now.length }
}

let lastAutoFlush = 0
/**
 * The flush that runs by itself (start, back online, a new answer about error reports): it never runs while the person has turned error reports off (what they pressed stays on this computer until they press Retry), at most once
 * every AUTO_FLUSH_GAP_MS, and each report is tried at most QUEUE_MAX_ATTEMPTS times. -> the result of flushQueue, or null when it did not run.
 */
export async function flushQueueAuto({ consent = 'on', now = Date.now(), ...options } = {}) {
  // with error reports off only what the person pressed 发送 for goes out by itself (that press was the consent to send it); anything else waits for them
  const only = consent === 'off' ? (e) => !!e.explicit : null
  if (now - lastAutoFlush < AUTO_FLUSH_GAP_MS) return null
  if (!loadQueue(options.storage).some((e) => !only || only(e))) return null
  lastAutoFlush = now
  return flushQueue({ ...options, ...(only ? { only } : {}) })
}
export const resetAutoFlush = () => { lastAutoFlush = 0 }

/** At most RATE.perHour reports an hour from one window: a loop of errors cannot become a loop of requests. */
export function allowReport(storage, now = Date.now()) {
  const recent = (readJson(storage, SENT_KEY) || []).filter((t) => Number.isFinite(t) && now - t < 3600_000)
  if (recent.length >= RATE.perHour) return false
  recent.push(now)
  writeJson(storage, SENT_KEY, recent)
  return true
}

const isOffline = (options) => (options.online !== undefined ? !options.online : typeof navigator !== 'undefined' && navigator.onLine === false)
/**
 * The whole of sending: the same report is one document (its id comes from its content), a report already sent says `sent` without a request, one that waits in the queue is tried again without using the
 * rate limit, a window that is offline keeps it without a request, and when nothing answered it goes to the queue. Returns the state the person is told:
 * `sent` (`id`; `again` when it had been sent before), `queued` (`reason`: `offline`, `timeout`, `network`, `http-5xx`; it will be tried again), `rejected`, `limited`.
 * A press while the same report is on its way gets the answer of that one request.
 */
export function submitReport(doc, options = {}) {
  const id = options.id || reportIdOf(doc)
  return guarded(id, () => submitOnce(doc, id, options))
}
async function submitOnce(doc, id, options) {
  const { storage } = options
  if (wasSent(id, storage)) return { state: 'sent', id, again: true }
  const queued = loadQueue(storage).find((e) => e.id === id)
  if (!queued && !allowReport(storage, options.now)) return { state: 'limited' }
  if (isOffline(options)) { const kept = enqueueReport(doc, storage, options.now, { id, explicit: !!options.explicit }); return { state: 'queued', id, reason: 'offline', ...(kept.shotLost ? { shotLost: true } : {}) } }
  const answer = await sendDocument(doc, { ...options, id })
  if (answer.state === 'sent') { removeQueued(id, storage); rememberSent(id, storage); return { ...answer, id } }
  if (answer.state === 'offline') {
    if (queued) { const queue = loadQueue(storage).map((e) => (e.id === id ? { ...e, attempts: Math.min(e.attempts + 1, QUEUE_MAX_ATTEMPTS - 1), ...(answer.maybeArrived ? { maybeArrived: true } : {}), ...(options.explicit ? { explicit: true } : {}) } : e)); saveQueue(queue, storage) }
    const kept = queued ? { shotLost: false } : enqueueReport(doc, storage, options.now, { id, maybeArrived: !!answer.maybeArrived, explicit: !!options.explicit })
    return { state: 'queued', id, reason: answer.reason, ...(kept.shotLost ? { shotLost: true } : {}) }
  }
  if (queued) removeQueued(id, storage)
  return { ...answer, id }
}

const sanitizeCode = (value) => catalogueId(String(value || 'unknown').replace(/[^A-Za-z0-9_.:+-]+/g, '-').toLowerCase(), 64) || 'unknown'

/** The first occurrence of an automatic report: one `error` event with the details the contract has room for. -> `sent`, `offline`, `rejected`. */
export async function createIssue(doc, options = {}) {
  // the code and the component only: the text of the error stays on this computer (it can hold a path, a name or what the person typed)
  // and the same error as an `error_report`: the stack as function@file:line:column, the place, the last actions (no text) and the fingerprint the server groups by
  return request([
    { kind: 'error', name: 'error', props: { component: catalogueId(doc.product || 'web', 32) || 'web', code: sanitizeCode(`${doc.category}.${doc.code}`), severity: 'error', count: 1 } },
    errorReportEvent(doc),
  ], options)
}

/** Later occurrences of the same error: one `error` event that counts them (no new details). `issue` = { component, code } of the first occurrence. -> `sent`, `offline`, `rejected`. */
export async function bumpIssue(issue, n, options = {}) {
  const events = [{ kind: 'error', name: 'error', props: { component: catalogueId(issue.component || 'web', 32) || 'web', code: sanitizeCode(issue.code), severity: 'error', count: Math.max(1, Math.floor(n)) } }]
  // the count of the same error for the error_report groups (no stack, no actions: the server has the first sample)
  if (issue.fingerprint) events.push(errorReportEvent({ product: issue.component, category: String(issue.code).split('.')[0], code: String(issue.code).split('.').slice(1).join('.'), fingerprint: issue.fingerprint }, { count: n, withDetail: false }))
  return request(events, options)
}
