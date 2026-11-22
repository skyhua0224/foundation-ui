// How a page feels, as small sketches (docs/telemetry-plan.zh.md, "Panel 与 Web UI"). Nothing here is a trace: every visit of a page is reduced to one bucket index per metric (pageBuckets.js), the visits of one route
// are added up bucket by bucket, and what leaves the window is one `page_vitals` event per route (at most 12) and one `api_latency` event per loopback endpoint (at most 8) when the page is hidden, and every 15 minutes in a
// long session. A window that has nothing to say sends nothing.
//
// The metrics and their sources (primary sources are in docs/authority/source-index.tsv):
//   LCP   largest-contentful-paint entries (W3C Largest Contentful Paint; web.dev/articles/lcp). The first visit of a document only: a route change inside the app has no LCP of its own.
//   CLS   layout-shift entries without a recent input, the largest session window: a gap of at most 1 s, at most 5 s long (web.dev/articles/cls).
//   INP   Event Timing entries with an interactionId, durationThreshold 40 ms (the spec default is 104 ms, the minimum 16 ms): the worst interaction, ignoring the highest one per 50 interactions (web.dev/articles/inp).
//   LoAF  long-animation-frame entries (W3C Long Animation Frames): how many, the sum of blockingDuration and the worst one. A runtime that has no such entry type is skipped, nothing is sent for it.
//   frames  requestAnimationFrame intervals, only while the page scrolls or animates and for 500 ms after: four counts (<= 17, <= 34, <= 50, > 50 ms). Idle pages run no callback.
//   heap  performance.memory.usedJSHeapSize (non-standard, Chromium and so WebView2): the largest and the last reading of a visit, read every 60 s while the page is visible.
//   first paint  first-contentful-paint of the document; interactive  the moment the page itself says it can be used (markInteractive), measured from the start of the document for the first visit.
import { bucketOf, emptyBuckets, frameClassOf, PAGE_METRICS } from './pageBuckets.js'

export const PAGE_PERF = Object.freeze({
  maxRoutes: 12,
  maxEndpoints: 8,
  /** a long session sends its summary again after this long */
  periodMs: 15 * 60_000,
  /** a page that is hidden and shown again and again sends at most once a minute (what it measured in between adds to the same sketches); leaving the page always sends */
  minGapMs: 60_000,
  /** sends of one computer in a day: a window that stays open sends every 15 minutes (96 a day), nothing sends more */
  maxSendsPerDay: 96,
  dayKey: 'foundation-ui.telemetry.pageperf.day',
  heapEveryMs: 60_000,
  activeMs: 500,
  eventThresholdMs: 40,
  /** durations kept per visit to read INP: INP ignores one interaction per 50, so ten are enough for 500 interactions */
  keepInteractions: 10,
  /** a gap this long (an inactive tab, a suspended window) is not a frame interval */
  maxFrameGapMs: 1000,
})

const ID = /^[a-z0-9][a-z0-9._-]*$/
const clampInt = (value, max) => Math.max(0, Math.min(max, Math.round(Number.isFinite(value) ? value : 0)))
const routeWord = (value) => {
  const id = String(value ?? '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[^a-z0-9]+/, '').slice(0, 40).replace(/-+$/, '')
  return ID.test(id) ? id : ''
}

/** `/api/apps/12/edit?x=1` -> `apps.edit`... digits-only and long segments are not part of the word; the telemetry calls themselves have none. */
export function endpointWord(url, base = 'http://localhost') {
  let path = ''
  try { path = new URL(String(url), base).pathname } catch { return '' }
  const segments = path.split('/').filter((s) => s && !/^\d+$/.test(s) && !/^[0-9a-f-]{16,}$/i.test(s) && s.length <= 24)
  if (segments[0] === 'api') segments.shift()
  if (!segments.length || segments[0] === 'telemetry') return ''
  return routeWord(segments.slice(0, 2).join('.'))
}

function newVisit(id, at, first) {
  return {
    id, at, first,
    cls: 0, clsWindow: null,
    interactions: new Map(), interactionCount: 0,
    loafN: 0, loafBlockMs: 0, loafWorst: 0,
    frames: [0, 0, 0, 0],
    heapMax: 0, heapLast: 0,
    fpaint: null, lcp: null, tti: null,
    visibleMs: 0, visibleSince: null,
  }
}

const inpOf = (visit) => {
  if (!visit.interactions.size) return null
  const worst = [...visit.interactions.values()].sort((a, b) => b - a)
  // web.dev: for pages with many interactions, ignore the highest one for every 50 interactions
  const skip = Math.min(Math.floor(visit.interactionCount / 50), worst.length - 1)
  return worst[skip]
}

/**
 * @param {object} [env] the browser pieces, replaceable for tests
 * @param {(page: string, ms: number) => void} [options.onReady] called once, when the first page of the document says it is ready
 * @param {(props: object, name: string) => void} options.emit gets the props of an event ready to queue (`page_vitals`, `api_latency`)
 */
export function createPagePerf({ emit = () => {}, onReady = () => {}, env = {} } = {}) {
  const win = env.win ?? globalThis.window
  const doc = env.doc ?? globalThis.document
  const performanceObject = env.performance ?? win?.performance ?? globalThis.performance
  const Observer = env.PerformanceObserver ?? win?.PerformanceObserver ?? globalThis.PerformanceObserver
  const raf = env.requestAnimationFrame ?? (typeof win?.requestAnimationFrame === 'function' ? win.requestAnimationFrame.bind(win) : globalThis.requestAnimationFrame?.bind(globalThis))
  const caf = env.cancelAnimationFrame ?? (typeof win?.cancelAnimationFrame === 'function' ? win.cancelAnimationFrame.bind(win) : globalThis.cancelAnimationFrame?.bind(globalThis))
  const nowMs = env.now ?? (() => (performanceObject && typeof performanceObject.now === 'function' ? performanceObject.now() : Date.now()))
  const setTimer = env.setInterval ?? ((fn, ms) => { const id = setInterval(fn, ms); id?.unref?.(); return id })
  const clearTimer = env.clearInterval ?? ((id) => clearInterval(id))

  let visit = null
  let observers = []
  let offs = []
  let timers = []
  let started = false
  // everything finished since the last send, by route
  let routes = new Map()
  let apis = new Map()
  let lastSend = Number.NEGATIVE_INFINITY
  let sendsToday = { day: '', n: 0 }
  const storage = env.storage ?? (() => { try { return win?.localStorage ?? null } catch { return null } })()
  const today = env.today ?? (() => new Date().toISOString().slice(0, 10))
  /** The daily cap, kept in the storage of the window when it has one (so a restart of the page does not reset it). */
  const takeSend = () => {
    const day = today()
    if (sendsToday.day !== day) {
      sendsToday = { day, n: 0 }
      try { const saved = JSON.parse(storage?.getItem(PAGE_PERF.dayKey) || 'null'); if (saved && saved.day === day && Number.isFinite(saved.n)) sendsToday = { day, n: saved.n } } catch { /* no saved count */ }
    }
    if (sendsToday.n >= PAGE_PERF.maxSendsPerDay) return false
    sendsToday.n += 1
    try { storage?.setItem(PAGE_PERF.dayKey, JSON.stringify(sendsToday)) } catch { /* the count stays in memory */ }
    return true
  }

  const visible = () => !doc || doc.visibilityState !== 'hidden'

  // ---- the visit in progress --------------------------------------------------------------------------------------------------------------------------------
  const beginVisit = (id, first) => {
    visit = newVisit(id, nowMs(), first)
    if (visible()) visit.visibleSince = nowMs()
    readHeap()
  }
  const readHeap = () => {
    const used = performanceObject?.memory?.usedJSHeapSize
    if (!visit || !Number.isFinite(used) || used <= 0) return
    const mb = used / 1048576
    visit.heapLast = mb
    if (mb > visit.heapMax) visit.heapMax = mb
  }
  const pauseClock = () => { if (visit && visit.visibleSince !== null) { visit.visibleMs += nowMs() - visit.visibleSince; visit.visibleSince = null } }
  const resumeClock = () => { if (visit && visit.visibleSince === null) visit.visibleSince = nowMs() }

  const routeOf = (id) => {
    let r = routes.get(id)
    if (!r) {
      if (routes.size >= PAGE_PERF.maxRoutes) id = 'other'
      r = routes.get(id)
      if (!r) { r = { visits: 0, vec: {}, loafN: 0, loafBlockMs: 0, fr: [0, 0, 0, 0], dwellS: 0 }; routes.set(id, r) }
    }
    return r
  }
  const add = (route, metric, value) => {
    const b = bucketOf(metric, value)
    if (b < 0) return
    ;(route.vec[metric] ??= emptyBuckets())[b] += 1
  }
  // a visit is over: its numbers go into the sketch of its route
  const finishVisit = () => {
    if (!visit) return
    pauseClock()
    readHeap()
    // a stretch that lasted less than a second and measured nothing (a route left at once, a send a moment ago) is not a visit
    const measured = visit.lcp !== null || visit.fpaint !== null || visit.tti !== null || visit.cls > 0 || visit.interactions.size > 0 || visit.loafN > 0 || visit.frames.some((n) => n > 0)
    if (!measured && visit.visibleMs < 1000) { visit = null; return }
    const route = routeOf(visit.id)
    route.visits += 1
    if (visit.first && visit.lcp !== null) add(route, 'lcp', visit.lcp)
    if (visit.first && visit.fpaint !== null) add(route, 'fpaint', visit.fpaint)
    if (visit.tti !== null) add(route, 'tti', visit.tti)
    // CLS and INP exist only when something shifted or was pressed; a quiet page has no INP. A visit without a layout shift has CLS 0, a good value, but only a visit that was visible long enough to have one counts.
    if (visit.visibleMs >= 1000 || visit.cls > 0) add(route, 'cls', visit.cls)
    const inp = inpOf(visit)
    if (inp !== null) add(route, 'inp', inp)
    if (loafSupported) add(route, 'loaf', visit.loafWorst)
    route.loafN += visit.loafN
    route.loafBlockMs += visit.loafBlockMs
    visit.frames.forEach((n, i) => { route.fr[i] += n })
    if (visit.heapMax > 0) add(route, 'heap', visit.heapMax)
    route.dwellS += visit.visibleMs / 1000
    visit = null
  }

  // ---- observers ---------------------------------------------------------------------------------------------------------------------------------------------
  let loafSupported = false
  const supported = (type) => {
    try { return !!Observer && Array.isArray(Observer.supportedEntryTypes) ? Observer.supportedEntryTypes.includes(type) : !!Observer }
    catch { return false }
  }
  const observe = (type, onEntries, extra = {}) => {
    if (!Observer || !supported(type)) return false
    try {
      const o = new Observer((list) => { try { onEntries(list.getEntries()) } catch { /* a bad entry is not worth a broken page */ } })
      o.observe({ type, buffered: true, ...extra })
      observers.push(o)
      return true
    } catch { return false }
  }

  const onEntries = {
    lcp: (entries) => {
      const last = entries[entries.length - 1]
      const first = routeFirst()
      if (first && last) first.lcp = last.renderTime || last.loadTime || last.startTime
    },
    cls: (entries) => {
      if (!visit) return
      for (const e of entries) {
        if (e.hadRecentInput) continue
        const w = visit.clsWindow
        if (w && e.startTime - w.last < 1000 && e.startTime - w.first < 5000) { w.value += e.value; w.last = e.startTime }
        else visit.clsWindow = { value: e.value, first: e.startTime, last: e.startTime }
        if (visit.clsWindow.value > visit.cls) visit.cls = visit.clsWindow.value
      }
    },
    inp: (entries) => {
      if (!visit) return
      for (const e of entries) {
        if (!e.interactionId) continue
        const prev = visit.interactions.get(e.interactionId)
        if (prev === undefined) visit.interactionCount += 1
        if (prev === undefined || e.duration > prev) visit.interactions.set(e.interactionId, e.duration)
        if (visit.interactions.size > PAGE_PERF.keepInteractions * 4) {
          // keep the worst few: the rest cannot become the INP
          const keep = [...visit.interactions].sort((a, b) => b[1] - a[1]).slice(0, PAGE_PERF.keepInteractions)
          visit.interactions = new Map(keep)
        }
      }
    },
    loaf: (entries) => {
      if (!visit) return
      for (const e of entries) {
        visit.loafN += 1
        visit.loafBlockMs += e.blockingDuration || 0
        if (e.duration > visit.loafWorst) visit.loafWorst = e.duration
      }
    },
    paint: (entries) => {
      const first = routeFirst()
      const fcp = entries.find((e) => e.name === 'first-contentful-paint')
      if (first && fcp) first.fpaint = fcp.startTime
    },
  }
  // LCP and the first paint belong to the document, so to its first visit; once that is finished they are not read again (there is no soft-navigation entry in the runtimes we run)
  const routeFirst = () => (visit && visit.first ? visit : null)

  // ---- frames while the page scrolls or animates -----------------------------------------------------------------------------------------------------------------
  let activeUntil = 0
  let rafId = 0
  let lastFrame = null
  const tick = (ts) => {
    rafId = 0
    if (!visit || !visible()) { lastFrame = null; return }
    const t = Number.isFinite(ts) ? ts : nowMs()
    if (lastFrame !== null) {
      const delta = t - lastFrame
      if (delta > 0 && delta <= PAGE_PERF.maxFrameGapMs) visit.frames[frameClassOf(delta)] += 1
    }
    lastFrame = t
    if (nowMs() < activeUntil) rafId = raf(tick)
    else lastFrame = null
  }
  const activity = () => {
    activeUntil = nowMs() + PAGE_PERF.activeMs
    if (!rafId && raf && visible()) { lastFrame = null; rafId = raf(tick) }
  }

  // ---- sending --------------------------------------------------------------------------------------------------------------------------------------------------
  const vecOf = (route) => {
    const out = {}
    for (const metric of PAGE_METRICS) if (route.vec[metric]) out[metric] = route.vec[metric].slice()
    return out
  }
  /** Close the visit in progress (a new one of the same route follows), and hand every sketch to `emit`; the sketches start again. -> the number of events emitted. */
  function collect({ continueVisit = true, force = false } = {}) {
    // between two sends of a page that is hidden and shown again and again the sketches only grow; leaving the page (force) always sends
    if (!force && nowMs() - lastSend < PAGE_PERF.minGapMs) return 0
    const id = visit?.id
    finishVisit()
    let sent = 0
    const allowed = routes.size + apis.size === 0 || takeSend()
    for (const [page, route] of routes) {
      if (!allowed) break
      if (!route.visits) continue
      emit({
        page, visits: clampInt(route.visits, 100000), ...vecOf(route),
        loaf_n: clampInt(route.loafN, 10000000), loaf_block_ms: clampInt(route.loafBlockMs, 100000000),
        fr_a: clampInt(route.fr[0], 100000000), fr_b: clampInt(route.fr[1], 100000000), fr_c: clampInt(route.fr[2], 100000000), fr_d: clampInt(route.fr[3], 100000000),
        dwell_s: clampInt(route.dwellS, 8640000),
      }, 'page_vitals')
      sent += 1
    }
    const endpoints = [...apis].sort((a, b) => b[1].calls - a[1].calls).slice(0, PAGE_PERF.maxEndpoints)
    for (const [endpoint, a] of allowed ? endpoints : []) {
      emit({ endpoint, calls: clampInt(a.calls, 10000000), errors: clampInt(a.errors, 10000000), timeouts: clampInt(a.timeouts, 10000000), lat: a.lat.slice() }, 'api_latency')
      sent += 1
    }
    routes = new Map()
    apis = new Map()
    if (sent > 0 || !allowed) lastSend = nowMs()
    if (continueVisit && id) beginVisit(id, false)
    return sent
  }

  // ---- the loopback calls --------------------------------------------------------------------------------------------------------------------------------------
  /** One finished call: `ms` until the response arrived, `outcome` ok | error | timeout. */
  function apiCall(url, ms, outcome = 'ok') {
    const word = endpointWord(url)
    if (!word) return
    let key = word
    if (!apis.has(key) && apis.size >= PAGE_PERF.maxEndpoints * 2) key = 'other'
    let a = apis.get(key)
    if (!a) { a = { calls: 0, errors: 0, timeouts: 0, lat: emptyBuckets() }; apis.set(key, a) }
    a.calls += 1
    if (outcome === 'error') a.errors += 1
    else if (outcome === 'timeout') a.timeouts += 1
    const b = bucketOf('api', ms)
    if (b >= 0) a.lat[b] += 1
  }
  /** `fetch` with the clock around it. Telemetry calls and calls without a word are passed through untimed. */
  function timedFetch(fetchImpl = globalThis.fetch) {
    return async function timed(input, init) {
      const url = typeof input === 'string' ? input : input?.url
      if (!endpointWord(url)) return fetchImpl(input, init)
      const t0 = nowMs()
      try {
        const response = await fetchImpl(input, init)
        apiCall(url, nowMs() - t0, response && response.status >= 500 ? 'error' : 'ok')
        return response
      } catch (error) {
        const name = error && error.name
        // a call the page itself cancelled says nothing about the host
        if (name === 'TimeoutError') apiCall(url, nowMs() - t0, 'timeout')
        else if (name !== 'AbortError') apiCall(url, nowMs() - t0, 'error')
        throw error
      }
    }
  }

  // ---- lifecycle ------------------------------------------------------------------------------------------------------------------------------------------------
  function start(firstRoute = 'home') {
    if (started) return stop
    started = true
    loafSupported = supported('long-animation-frame')
    beginVisit(routeWord(firstRoute) || 'home', true)
    // buffered entries of the document arrive through the first visit
    observe('largest-contentful-paint', onEntries.lcp)
    observe('layout-shift', onEntries.cls)
    observe('event', onEntries.inp, { durationThreshold: PAGE_PERF.eventThresholdMs })
    observe('long-animation-frame', onEntries.loaf)
    observe('paint', onEntries.paint)
    if (win && typeof win.addEventListener === 'function') {
      for (const name of ['scroll', 'wheel', 'touchmove', 'transitionrun', 'animationstart']) {
        win.addEventListener(name, activity, { capture: true, passive: true })
        offs.push(() => win.removeEventListener?.(name, activity, { capture: true }))
      }
    }
    if (doc && typeof doc.addEventListener === 'function') {
      const onVisibility = () => { if (doc.visibilityState === 'hidden') { pauseClock(); collect() } else resumeClock() }
      doc.addEventListener('visibilitychange', onVisibility)
      offs.push(() => doc.removeEventListener?.('visibilitychange', onVisibility))
    }
    timers.push(setTimer(() => { if (visible()) readHeap() }, PAGE_PERF.heapEveryMs))
    timers.push(setTimer(() => { if (visible() && nowMs() - lastSend >= PAGE_PERF.periodMs) collect() }, 60_000))
    return stop
  }
  function stop() {
    for (const o of observers) { try { o.disconnect() } catch { /* already gone */ } }
    observers = []
    offs.forEach((off) => off())
    offs = []
    timers.forEach((id) => clearTimer(id))
    timers = []
    if (rafId && caf) caf(rafId)
    rafId = 0
    started = false
  }

  return {
    start, stop, collect, apiCall, timedFetch,
    /** A route change: the visit in progress is over, the next one starts. */
    visit(id) {
      const word = routeWord(id)
      if (!word || !started) return
      if (visit && visit.id === word) return
      finishVisit()
      beginVisit(word, false)
    },
    /** The page can be used: its content is in place and its handlers are attached. Measured from the start of the document for the first visit, from the start of the visit for the others. */
    markInteractive(forRoute) {
      // a page that was left before it was ready does not make the next page ready
      if (!visit || visit.tti !== null || (forRoute && routeWord(forRoute) !== visit.id)) return
      visit.tti = visit.first ? nowMs() : nowMs() - visit.at
      // the first page of a document tells at once when it was ready (from the start of the document): the host judges it against its limit and the install's own usual time
      if (visit.first) { try { onReady(visit.id, Math.round(visit.tti)) } catch { /* a failing listener is not the page's problem */ } }
    },
    get started() { return started },
    get routes() { return routes },
    get apis() { return apis },
    _visit: () => visit,
  }
}
