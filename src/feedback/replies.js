// The answers of the developers to the feedback a person sent. Pure and framework-free (the composable and the sheet are in vue/feedback).
//
// The way it works: the page makes a random key for each report (rk_ + 32 hex) and sends it with the report; this window keeps {key, title, time} of its own reports on this computer. The developers' answer to a
// report is stored under that key, and the window asks for the answers to its keys: once after it starts and then at most every four hours, with one GET to the developers' server (no cookie, no header of its own,
// no identifier but the keys). An answer that is new is shown once in the status button of the caption bar; opening it shows the whole text.
// A key is the address of an answer and nothing else: it holds nothing of the person, the computer or the report. Design and API: docs/feedback-reply-channel.zh.md of the developers' server.

import { fillText } from './texts.js'

export const REPLY_KEY = /^rk_[0-9a-f]{32}$/
export const STORE_KEY = 'foundation-ui.feedback.replies'
export const REPLY_BASE = 'https://api.alkaidlab.com'
/** At most this many reports are remembered (the newest), each for KEEP_MS; a lookup carries at most ASK_MAX keys (the server's limit). */
export const REPORTS_MAX = 20
export const KEEP_MS = 90 * 86_400_000
export const ASK_MAX = 10
/** The window asks again after this long, whatever the number of times it starts (the time of the last ask is in the shared storage). */
export const ASK_GAP_MS = 4 * 3_600_000
export const ASK_TIMEOUT_MS = 8000
export const TEXT_MAX = 4000
export const TITLE_MAX = 120
const SEEN_MAX = 200

const emptyState = () => ({ v: 1, reports: [], seen: [], inbox: [], lastAt: 0 })
const store = () => { try { return globalThis.localStorage } catch { return null } }

/** A new key: 128 random bits. Throws when the platform has no secure random source (a guessable key would be an address anyone could read). */
export function newReplyKey(random = globalThis.crypto) {
  if (!random || typeof random.getRandomValues !== 'function') throw new Error('no secure random source')
  const bytes = random.getRandomValues(new Uint8Array(16))
  return `rk_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}

const cleanReport = (r) => (r && REPLY_KEY.test(String(r.key)) && Number.isFinite(r.at) ? { key: r.key, title: String(r.title || '').slice(0, TITLE_MAX), at: r.at, product: String(r.product || '').slice(0, 20) } : null)
const cleanItem = (i) => (i && typeof i.id === 'string' && REPLY_KEY.test(String(i.key)) && (i.kind === 'reply' || i.kind === 'fixed') && Number.isFinite(i.at)
  ? { id: i.id.slice(0, 120), key: i.key, kind: i.kind, text: String(i.text || '').slice(0, TEXT_MAX), version: String(i.version || '').slice(0, 40), at: i.at, title: String(i.title || '').slice(0, TITLE_MAX), dismissed: !!i.dismissed }
  : null)

/** What the storage holds, checked field by field (a storage that was edited, or written by another version, never breaks the window). */
export function loadState(storage = store()) {
  let raw = null
  try { raw = JSON.parse(storage?.getItem(STORE_KEY) || 'null') } catch { raw = null }
  if (!raw || raw.v !== 1) return emptyState()
  return {
    v: 1,
    reports: (Array.isArray(raw.reports) ? raw.reports : []).map(cleanReport).filter(Boolean),
    seen: (Array.isArray(raw.seen) ? raw.seen : []).filter((s) => typeof s === 'string').slice(-SEEN_MAX),
    inbox: (Array.isArray(raw.inbox) ? raw.inbox : []).map(cleanItem).filter(Boolean),
    lastAt: Number.isFinite(raw.lastAt) ? raw.lastAt : 0,
  }
}
export function saveState(state, storage = store()) {
  try { storage?.setItem(STORE_KEY, JSON.stringify(state)) } catch { /* not remembered: the answer is shown again after the next start, once */ }
}

/** Drops what is older than KEEP_MS and what is over the limits. */
export function prune(state, now = Date.now()) {
  const fresh = (at) => now - at <= KEEP_MS
  const reports = state.reports.filter((r) => fresh(r.at)).sort((a, b) => b.at - a.at).slice(0, REPORTS_MAX)
  return { ...state, reports, inbox: state.inbox.filter((i) => fresh(i.at)), seen: state.seen.slice(-SEEN_MAX) }
}

/** Remembers a report this window has sent (or queued): its key and the title the person wrote. A report with a key of the wrong shape is not remembered. */
export function rememberReport({ key, title = '', product = '' } = {}, { storage = store(), now = Date.now } = {}) {
  if (!REPLY_KEY.test(String(key))) return loadState(storage)
  const state = loadState(storage)
  const entry = cleanReport({ key, title: String(title).replace(/\s+/g, ' ').trim(), at: now(), product })
  const next = prune({ ...state, reports: [entry, ...state.reports.filter((r) => r.key !== key)] }, now())
  saveState(next, storage)
  return next
}

/** The keys to ask for now: none while the last ask is younger than ASK_GAP_MS (unless `force`) or when no report is remembered; the newest first, at most ASK_MAX. */
export function keysToAsk(state, now = Date.now(), { force = false } = {}) {
  if (!force && now - state.lastAt < ASK_GAP_MS) return []
  return state.reports.filter((r) => now - r.at <= KEEP_MS).slice(0, ASK_MAX).map((r) => r.key)
}

/** The answer of the server as a list of replies, or null when it is not one. Every field is checked: the text of an answer is drawn as text, never as markup. */
export function parseAnswer(body) {
  if (!body || body.v !== 1 || !Array.isArray(body.replies)) return null
  const out = []
  for (const r of body.replies) {
    if (!r || !REPLY_KEY.test(String(r.key)) || typeof r.id !== 'string' || !r.id || r.id.length > 120 || (r.kind !== 'reply' && r.kind !== 'fixed') || !Number.isFinite(r.at)) continue
    const text = typeof r.text === 'string' ? r.text.slice(0, TEXT_MAX) : ''
    const version = typeof r.version === 'string' ? r.version.slice(0, 40) : ''
    if (r.kind === 'reply' ? !text.trim() : !version) continue
    out.push({ key: r.key, id: r.id, kind: r.kind, text, version, at: r.at })
  }
  return out
}

/**
 * Asks the server for the answers to `keys`. -> { state: 'ok', replies } | { state: 'busy' } (429 or 503: it said to wait) | { state: 'failed' } (no answer, a bad answer).
 * No cookie, no referrer, no header of its own; a failure is never retried here (the next turn of the window asks again).
 */
export async function askReplies({ keys, base = REPLY_BASE, fetchFn = globalThis.fetch, timeoutMs = ASK_TIMEOUT_MS } = {}) {
  const ask = (keys || []).filter((k) => REPLY_KEY.test(String(k))).slice(0, ASK_MAX)
  if (!ask.length || typeof fetchFn !== 'function') return { state: 'failed' }
  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : 0
  try {
    const url = `${String(base).replace(/\/$/, '')}/v1/replies?${ask.map((k) => `k=${k}`).join('&')}`
    const response = await fetchFn(url, { method: 'GET', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', mode: 'cors', ...(controller ? { signal: controller.signal } : {}) })
    if (response.status === 429 || response.status === 503) return { state: 'busy' }
    if (!response.ok) return { state: 'failed' }
    const replies = parseAnswer(await response.json())
    return replies ? { state: 'ok', replies } : { state: 'failed' }
  } catch {
    return { state: 'failed' }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

const seenId = (r) => `${r.key}:${r.id}`

/** Takes the replies of an answer into the state: a reply of a report this window remembers and has not shown before is new. -> { state, fresh } (`fresh`: the new inbox items, oldest first). */
export function applyReplies(state, replies, now = Date.now()) {
  const titles = new Map(state.reports.map((r) => [r.key, r.title]))
  const seen = new Set(state.seen)
  const fresh = []
  for (const r of [...replies].sort((a, b) => a.at - b.at)) {
    if (!titles.has(r.key) || seen.has(seenId(r))) continue
    seen.add(seenId(r))
    fresh.push({ id: seenId(r), key: r.key, kind: r.kind, text: r.text, version: r.version, at: r.at, title: titles.get(r.key) || '', dismissed: false })
  }
  return { state: prune({ ...state, lastAt: now, seen: [...seen], inbox: [...state.inbox, ...fresh] }, now), fresh }
}

/** The item is out of the status button for good (the person closed it or opened it). */
export function dismissItem(state, id) {
  return { ...state, inbox: state.inbox.map((i) => (i.id === id ? { ...i, dismissed: true } : i)) }
}

/** The line a reply shows in the status button: the first two lines of the text, cut at 72 characters (查看 opens the rest). A fixed message has no text of its own. */
export function previewOf(item, words, max = 72) {
  if (item.kind === 'fixed') return fillText(words.replyFixed, { version: item.version })
  const lines = String(item.text).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2).join(' ')
  return lines.length > max ? `${lines.slice(0, max - 1).trimEnd()}…` : lines
}
