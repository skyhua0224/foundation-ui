// 恢复默认设置: what the page does without a window: the host calls, the time of a backup, the countdown of the confirm button. Pure functions (no Vue, no DOM).

/** The confirm button of a reset cannot be pressed until this many seconds have passed since the question opened. */
export const RESET_SECONDS = 5

/**
 * The host's side of it (FS /api/config/reset*). `fetcher(path, init)` is the product's own fetch (it adds the session, the CSRF header or the panel's proxy);
 * every call answers { ok: true, data } or { ok: false, code } with one of the host's words (busy, no_backup, ...) or `unreachable`.
 */
export function createResetClient(fetcher) {
  async function call(method, path, body) {
    let response
    try {
      response = await fetcher(path, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    } catch { return { ok: false, code: 'unreachable' } }
    let data = null
    try { data = await response.json() } catch { /* an answer without a body */ }
    if (response.ok && data?.status !== false) return { ok: true, data: data || {} }
    return { ok: false, code: typeof data?.code === 'string' && data.code ? data.code : `http_${response.status}`, status: response.status }
  }
  return {
    /** The backups that exist: { ok, data: { backups: [{ stamp, created_ms, has_apps }] (newest first), limit } } */
    status: () => call('GET', '/api/config/reset'),
    /** Back up, write the defaults, restart. `clearApps` also puts the default application list in place. */
    reset: (clearApps = false) => call('POST', '/api/config/reset', { clear_apps: !!clearApps }),
    /** Put the newest backup back (the settings that are there now are backed up first), restart. */
    restore: () => call('POST', '/api/config/reset/restore', {}),
  }
}

/** The newest backup of a status answer, or null. */
export const latestBackup = (status) => {
  const list = Array.isArray(status?.backups) ? status.backups : []
  return list.length ? list[0] : null
}

/** The date and time of a backup in the language of the interface ("Nov 19, 2026, 3:30 PM"). */
export function backupTime(ms, locale = 'en') {
  if (!Number.isFinite(ms) || ms <= 0) return ''
  try { return new Intl.DateTimeFormat(String(locale).replace('_', '-'), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms)) } catch { return new Date(ms).toISOString() }
}

/** `text` with {name} replaced. */
export const fill = (text, values = {}) => String(text).replace(/\{(\w+)\}/g, (all, key) => (key in values ? String(values[key]) : all))

/** The label of a confirm button while it counts down, and as it is once it can be pressed. */
export const countdownLabel = (texts, label, remaining) => (remaining > 0 ? fill(texts.seconds, { label, n: remaining }) : label)

/**
 * The countdown of a confirm button: `start()` sets it to `seconds`, `tick()` takes one away. A caller drives it with a timer (useCountdown) or by hand in a test;
 * nothing here reads a clock, so a question that stays open cannot come ready early.
 */
export function createCountdown(seconds = RESET_SECONDS) {
  const state = { remaining: seconds, running: false }
  return {
    state,
    start() { state.remaining = seconds; state.running = true },
    stop() { state.running = false },
    tick() { if (state.running && state.remaining > 0) state.remaining -= 1; if (state.remaining <= 0) state.running = false; return state.remaining },
    get ready() { return state.running === false && state.remaining <= 0 },
  }
}

/** Answers that do not say that nothing was changed: no answer came (the call may have been carried out), or the panel's own reset stopped half way. */
const UNSURE = new Set(['unreachable', 'panel_failed'])

/**
 * The text of an answer that did not work: the reason, and that nothing was changed. A call that got no answer (`unreachable`) may have been carried out before the connection
 * dropped (the host restarts right after a reset), so it never says that nothing was changed.
 */
export const failureText = (texts, code) => [texts.errors?.[code], UNSURE.has(code) ? null : texts.failed].filter(Boolean).join(' ')

/**
 * Reads that are answered out of order: `next()` starts one (its token), `isCurrent(token)` is true only for the newest, and `invalidate()` makes every read in flight old (a reset
 * or restore worked: what an earlier read says is not the list any more).
 */
export function createLatest() {
  let n = 0
  return { next: () => ++n, isCurrent: (token) => token === n, invalidate: () => { n += 1 } }
}

/**
 * What the restore row shows. `state` is how the last read of the backups went: 'loading' (not read yet), 'ok', 'error' (the read failed: the row offers to read again), 'stale'
 * (a reset or restore worked: the list is read again when the host is back, and until then the row does not offer a backup that is no longer the newest).
 */
export function backupView({ state = 'loading', backups = [] } = {}, texts, locale = 'en') {
  if (state === 'ok') {
    const latest = latestBackup({ backups })
    return latest ? { text: fill(texts.restoreRowText, { time: backupTime(latest.created_ms, locale) }), enabled: true, retry: false } : { text: texts.noBackup, enabled: false, retry: false }
  }
  if (state === 'error') return { text: texts.backupsFailed, enabled: true, retry: true }
  if (state === 'stale') return { text: texts.backupsWait, enabled: false, retry: false }
  return { text: '', enabled: false, retry: false }
}
