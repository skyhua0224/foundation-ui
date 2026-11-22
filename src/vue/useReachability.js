import { reactive } from 'vue'
import { normalizeReport } from '../settings/reachability.js'
import { checkProgress } from '../settings/networkCheck.js'
import { createNetworkCheck, timedCall } from './useNetworkCheck.js'

/**
 * The reachability check of the host as one state for a product: the card of 主机设置 › 网络, the first-run step and the home tile read the same report.
 * `request(path, { method, body, signal })` is the product's way to the host and returns { ok, status, json } (the Web UI and the control panel reach the same API); pass `signal` on to fetch. The host does
 * the check itself (no outside service). `refresh(true)` runs it: on a host that has the step-by-step run (POST /api/network/check) the run is shown as it goes (`view.progress`) and the report is read when it is
 * done; on an older host the one blocking request (`?refresh=1`) does it. `refresh()` reads what the host has. `refresh(true, { test })` tests an address that is not saved (`&test=host[:port]`, comma separated): a
 * host that does not know the parameter ignores it and answers the saved addresses, which the screen tells apart by the missing result.
 *
 * It cannot hang and it does not hide a failure: every request has a timeout, and a request that fails is `error` with its reason even when an earlier report is still shown beside it.
 *   view.status:   'idle' | 'loading' | 'ready' | 'unavailable' (404, 444 — the host closes the connection on a route it does not have —, or an answer that is not a v1 report: an older host) | 'error'
 *   view.http:     the HTTP status of the last answer that was not a report (0 when the host did not answer); view.cause: 'bad-answer' | 'offline' | 'timeout' | ''
 *   view.progress: while a run is going, { done, total, text, steps: [{ key, id, subject, phase }] }; null otherwise
 */
export function createReachability({ request, timeoutMs = 12000, ...runOptions }) {
  const view = reactive({ report: null, status: 'idle', http: 0, cause: '', progress: null })
  const check = createNetworkCheck({ request, onUpdate: (run) => { view.progress = checkProgress(run) }, ...runOptions })
  let running = null

  const fail = (cause, http = 0) => { view.status = 'error'; view.http = http; view.cause = cause }
  /** reads the report: `query` is the part after the question mark; true when the screen has a report or an explanation */
  async function read(query) {
    const r = await timedCall(request, `/api/network/reachability${query ? `?${query}` : ''}`, { method: 'GET' }, timeoutMs)
    if (r.failed) return fail(r.failed === 'timeout' ? 'timeout' : 'offline')
    view.http = Number(r.status) || 0
    if (r.status === 404 || r.status === 444 || r.status === 501) { view.report = null; view.status = 'unavailable'; view.cause = ''; return undefined }
    if (!r.ok) return fail('', view.http)
    const report = normalizeReport(r.json)
    // An answer that is not a report does not show that the host cannot check: when this host gave a report before, that report stays and the answer is a failure ('bad-answer'); only a first read says "older host".
    if (!report) {
      if (view.report) return fail('bad-answer', view.http)
      view.status = 'unavailable'; view.cause = ''; return undefined
    }
    view.report = report; view.status = 'ready'; view.http = 0; view.cause = ''
    return undefined
  }

  async function run(force, options) {
    const test = String(options?.test ?? '').trim()
    if (!force || test) {
      const query = []
      if (force) query.push('refresh=1')
      if (test) query.push(`test=${encodeURIComponent(test)}`)
      return read(query.join('&'))
    }
    await check.start()
    const state = check.view.status
    if (state === 'unavailable') return read('refresh=1') // an older host: the one blocking request does it
    if (state === 'error') return fail(check.view.error.kind === 'timeout' ? 'timeout' : check.view.error.kind === 'bad-answer' ? 'bad-answer' : check.view.error.http ? '' : 'offline', check.view.error.http)
    return read('') // the run has filled the host's cache: this is not another probe
  }

  function begin(force, options) {
    view.status = 'loading'; view.progress = null
    const p = run(force, options).catch(() => fail('offline')).finally(() => { view.progress = null; if (running === p) running = null })
    running = p
    return p
  }

  let queued = null
  /**
   * `refresh()` reads, `refresh(true)` runs the check and joins one that is going. A request to test an address (`{ test }`) is never joined to a run that is going, because that run does not test it: it waits for the
   * run (and for the tests asked before it) and then makes its own request, so the address is always tested and its result is what the caller gets.
   */
  function refresh(force = false, options = {}) {
    const test = String(options?.test ?? '').trim()
    if (!running && !queued) return begin(force, options)
    if (!test) return queued || running // a read asked for meanwhile is the one that is going or waiting: it never starts a second one beside it
    const next = (queued || running).then(() => begin(force, options))
    queued = next
    next.finally(() => { if (queued === next) queued = null })
    return next
  }
  return { view, refresh }
}
