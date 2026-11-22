import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BUCKET_COUNT, bucketOf, createEventSender, createPagePerf, endpointWord, frameClassOf, installEventListeners, PAGE_BUCKETS } from '../src/telemetry/index.js'

// a PerformanceObserver that tests feed by hand
function fakeRuntime({ types = ['largest-contentful-paint', 'layout-shift', 'event', 'long-animation-frame', 'paint'], memory = null } = {}) {
  const observers = []
  const listeners = new Map()
  let t = 0
  const frames = []
  class Observer {
    static supportedEntryTypes = types
    constructor(cb) { this.cb = cb; this.type = ''; this.options = null; observers.push(this) }
    observe(options) { this.type = options.type; this.options = options }
    disconnect() { this.cb = null }
  }
  const win = {
    PerformanceObserver: Observer,
    addEventListener: (name, fn) => { listeners.set(name, [...(listeners.get(name) || []), fn]) },
    removeEventListener: (name, fn) => { listeners.set(name, (listeners.get(name) || []).filter((f) => f !== fn)) },
    requestAnimationFrame: (fn) => { frames.push(fn); return frames.length },
    cancelAnimationFrame: () => {},
    performance: { now: () => t, memory },
    location: { pathname: '/', hash: '' },
  }
  const doc = { visibilityState: 'visible', addEventListener: (name, fn) => { listeners.set(`doc:${name}`, [...(listeners.get(`doc:${name}`) || []), fn]) }, removeEventListener: (name, fn) => { listeners.set(`doc:${name}`, (listeners.get(`doc:${name}`) || []).filter((f) => f !== fn)) } }
  const fire = (name, event) => (listeners.get(name) || []).forEach((fn) => fn(event))
  return {
    win, doc, listeners, observers, fire,
    deliver: (type, entries) => observers.filter((o) => o.type === type && o.cb).forEach((o) => o.cb({ getEntries: () => entries })),
    at: (ms) => { t = ms },
    get now() { return t },
    // run the requestAnimationFrame callbacks that are waiting, at timestamp `ts`
    frame: (ts) => { t = ts; const run = frames.splice(0); run.forEach((fn) => fn(ts)) },
    hide: () => { doc.visibilityState = 'hidden'; fire('doc:visibilitychange') },
    show: () => { doc.visibilityState = 'visible'; fire('doc:visibilitychange') },
  }
}
const noTimers = { setInterval: () => 0, clearInterval: () => {} }
function make(runtime, extra = {}) {
  const out = []
  const perf = createPagePerf({ emit: (props, name) => out.push({ name, props }), env: { win: runtime.win, doc: runtime.doc, now: () => runtime.now, ...noTimers, ...extra } })
  return { perf, out }
}

test('the bucket bounds put the web.dev thresholds on bucket edges: good and poor are read from the counts', () => {
  // LCP: good <= 2500 ms, poor > 4000 ms
  assert.equal(bucketOf('lcp', 2500), 3)
  assert.equal(bucketOf('lcp', 2501), 4)
  assert.equal(bucketOf('lcp', 4000), 5)
  assert.equal(bucketOf('lcp', 4001), 6)
  // INP: good <= 200 ms, poor > 500 ms
  assert.equal(bucketOf('inp', 200), 3)
  assert.equal(bucketOf('inp', 201), 4)
  assert.equal(bucketOf('inp', 500), 6)
  assert.equal(bucketOf('inp', 501), 7)
  // CLS: good <= 0.1, poor > 0.25
  assert.equal(bucketOf('cls', 0.1), 3)
  assert.equal(bucketOf('cls', 0.11), 4)
  assert.equal(bucketOf('cls', 0.25), 5)
  assert.equal(bucketOf('cls', 0.26), 6)
  assert.equal(bucketOf('cls', 3), 7)
  assert.equal(bucketOf('cls', 0), 0)
  assert.equal(bucketOf('lcp', -1), -1)
  assert.equal(bucketOf('lcp', Number.NaN), -1)
  assert.equal(bucketOf('nothing', 1), -1)
  for (const [metric, bounds] of Object.entries(PAGE_BUCKETS)) {
    assert.equal(bounds.length + 1, BUCKET_COUNT, metric)
    assert.deepEqual([...bounds].sort((a, b) => a - b), [...bounds], metric)
  }
  assert.deepEqual([10, 17, 18, 34, 35, 50, 51].map(frameClassOf), [0, 0, 1, 1, 2, 2, 3])
})

test('an endpoint is a word: ids, long segments and the telemetry calls have none', () => {
  assert.equal(endpointWord('/api/apps'), 'apps')
  assert.equal(endpointWord('/api/apps/12/edit?x=1'), 'apps.edit')
  assert.equal(endpointWord('/api/config/video/extra'), 'config.video')
  assert.equal(endpointWord('https://localhost:47990/api/clients/list'), 'clients.list')
  assert.equal(endpointWord('/api/telemetry/events'), '')
  assert.equal(endpointWord('/api/9f8e7d6c5b4a39281716/status'), 'status')
  assert.equal(endpointWord('/'), '')
  assert.equal(endpointWord('/api'), '')
})

test('one visit becomes one bucket per metric and the visits of a route add up', () => {
  const rt = fakeRuntime()
  const { perf, out } = make(rt)
  perf.start('home')
  rt.at(800)
  rt.deliver('paint', [{ name: 'first-paint', startTime: 100 }, { name: 'first-contentful-paint', startTime: 420 }])
  rt.deliver('largest-contentful-paint', [{ startTime: 900, renderTime: 0, loadTime: 0 }, { startTime: 1200, renderTime: 1300, loadTime: 1250 }])
  // two shifts in one window (0.04 + 0.03), a recent-input shift that does not count, a later window (0.2) that is the largest
  rt.deliver('layout-shift', [{ startTime: 500, value: 0.04, hadRecentInput: false }, { startTime: 900, value: 0.03, hadRecentInput: false }, { startTime: 950, value: 5, hadRecentInput: true }, { startTime: 3000, value: 0.2, hadRecentInput: false }])
  rt.deliver('event', [{ interactionId: 1, duration: 56 }, { interactionId: 2, duration: 320 }, { interactionId: 2, duration: 120 }, { interactionId: 0, duration: 900 }])
  rt.deliver('long-animation-frame', [{ duration: 90, blockingDuration: 30 }, { duration: 160, blockingDuration: 80 }])
  rt.at(1500)
  perf.markInteractive()
  rt.at(5200)
  assert.equal(perf.collect({ force: true }), 1)
  assert.equal(out.length, 1)
  const e = out[0]
  assert.equal(e.name, 'page_vitals')
  assert.equal(e.props.page, 'home')
  assert.equal(e.props.visits, 1)
  assert.deepEqual(e.props.fpaint, [0, 1, 0, 0, 0, 0, 0, 0]) // 420 ms: <= 500
  assert.deepEqual(e.props.lcp, [0, 1, 0, 0, 0, 0, 0, 0]) // renderTime 1300: <= 1500
  assert.deepEqual(e.props.cls, [0, 0, 0, 0, 0, 1, 0, 0]) // 0.2 <= 0.25
  assert.deepEqual(e.props.inp, [0, 0, 0, 0, 0, 1, 0, 0]) // 320 ms <= 400 (interaction 2 keeps its worst; the one without interactionId is ignored)
  assert.deepEqual(e.props.loaf, [0, 0, 0, 0, 1, 0, 0, 0]) // worst 160 <= 200
  assert.deepEqual(e.props.tti, [0, 0, 0, 1, 0, 0, 0, 0]) // 1500 <= 1500
  assert.equal(e.props.loaf_n, 2)
  assert.equal(e.props.loaf_block_ms, 110)
  assert.equal(e.props.dwell_s, 5)
  // sent: the sketches start again
  assert.equal(perf.collect({ force: true }), 0)
  assert.equal(out.length, 1)
})

test('INP ignores the highest interaction for every fifty', () => {
  const rt = fakeRuntime()
  const { perf, out } = make(rt)
  perf.start('apps')
  const entries = []
  for (let i = 1; i <= 100; i += 1) entries.push({ interactionId: i, duration: i === 100 ? 900 : i === 99 ? 700 : 60 })
  rt.deliver('event', entries)
  rt.at(2000)
  perf.collect({ continueVisit: false, force: true })
  // 100 interactions: the highest two are ignored, the third is 60 ms
  assert.deepEqual(out[0].props.inp, [0, 1, 0, 0, 0, 0, 0, 0])
})

test('a route change closes the visit; routes and visits are kept apart', () => {
  const rt = fakeRuntime()
  const { perf, out } = make(rt)
  perf.start('home')
  rt.at(1000); perf.visit('apps')
  rt.at(3000); perf.visit('settings')
  rt.at(4000); perf.visit('apps')
  rt.at(9000)
  perf.collect({ continueVisit: false, force: true })
  const by = Object.fromEntries(out.filter((x) => x.name === 'page_vitals').map((x) => [x.props.page, x.props]))
  assert.deepEqual(Object.keys(by).sort(), ['apps', 'home', 'settings'])
  assert.equal(by.apps.visits, 2)
  assert.equal(by.home.visits, 1)
  assert.equal(by.apps.dwell_s, 7) // 2 s + 5 s
})

test('a hidden page sends once and starts a fresh visit; the time away is not dwell time', () => {
  const rt = fakeRuntime()
  const { perf, out } = make(rt)
  perf.start('home')
  rt.at(10_000)
  rt.hide()
  assert.equal(out.length, 1)
  assert.equal(out[0].props.dwell_s, 10)
  rt.at(100_000)
  rt.show()
  rt.at(103_000)
  rt.hide()
  assert.equal(out.length, 2)
  assert.equal(out[1].props.dwell_s, 3)
})

test('frame intervals are counted only while the page scrolls or animates', () => {
  const rt = fakeRuntime()
  const { perf, out } = make(rt)
  perf.start('apps')
  // idle: no callback was asked for
  rt.at(100)
  rt.frame(100)
  rt.fire('scroll')
  rt.frame(116) // first frame of the burst: no interval yet
  rt.frame(133) // 17
  rt.frame(168) // 35
  rt.frame(230) // 62
  rt.at(2000)
  perf.collect({ continueVisit: false, force: true })
  const p = out[0].props
  assert.deepEqual([p.fr_a, p.fr_b, p.fr_c, p.fr_d], [1, 0, 1, 1]) // 17, 35 and 62 ms
})

test('a window with no PerformanceObserver types sends what it has and never throws', () => {
  const rt = fakeRuntime({ types: [] })
  const { perf, out } = make(rt)
  perf.start('home')
  rt.at(4000)
  perf.collect({ continueVisit: false, force: true })
  const p = out[0].props
  assert.equal(p.visits, 1)
  assert.equal(p.loaf, undefined) // no long-animation-frame support: no value, not a zero
  assert.equal(p.lcp, undefined)
  assert.equal(p.inp, undefined)
  assert.deepEqual(p.cls, [1, 0, 0, 0, 0, 0, 0, 0]) // a visit with no shift is a good CLS, seen for long enough
})

test('the heap is the largest reading of the visit, in MB', () => {
  const memory = { usedJSHeapSize: 40 * 1048576 }
  const rt = fakeRuntime({ memory })
  const { perf, out } = make(rt, {})
  perf.start('home')
  memory.usedJSHeapSize = 150 * 1048576
  rt.at(1000)
  perf.visit('apps') // reads the heap before the visit ends
  memory.usedJSHeapSize = 90 * 1048576
  rt.at(2000)
  perf.collect({ continueVisit: false, force: true })
  const by = Object.fromEntries(out.map((x) => [x.props.page, x.props]))
  assert.deepEqual(by.home.heap, [0, 0, 0, 1, 0, 0, 0, 0]) // 150 MB <= 192
  assert.deepEqual(by.apps.heap, [0, 0, 0, 1, 0, 0, 0, 0]) // the visit began at 150 MB and ended at 90: the largest reading counts
})

test('the loopback calls are timed per endpoint: errors, timeouts and the calls the page cancelled', async () => {
  const rt = fakeRuntime()
  const { perf, out } = make(rt)
  perf.start('home')
  const timeline = [[0, 8], [0, 40], [0, 30], [0, 3000], [0, 20], [0, 5]]
  let i = 0
  const fetchImpl = async (url) => {
    const [, ms] = timeline[i]
    rt.at(rt.now + ms)
    i += 1
    if (url.includes('boom')) return { status: 500 }
    if (url.includes('slow')) throw Object.assign(new Error('t'), { name: 'TimeoutError' })
    if (url.includes('gone')) throw Object.assign(new Error('a'), { name: 'AbortError' })
    return { status: url.includes('missing') ? 404 : 200 }
  }
  const timed = perf.timedFetch(fetchImpl)
  await timed('/api/apps')
  await timed('/api/missing/thing') // 404 is the page's mistake, not the host's
  await assert.rejects(timed('/api/slow'))
  await assert.rejects(timed('/api/gone/x'))
  await timed('/api/boom')
  await timed('/api/telemetry/events') // not timed, but still passed through
  perf.collect({ continueVisit: false, force: true })
  const api = Object.fromEntries(out.filter((x) => x.name === 'api_latency').map((x) => [x.props.endpoint, x.props]))
  assert.deepEqual(Object.keys(api).sort(), ['apps', 'boom', 'missing.thing', 'slow'])
  assert.equal(api.apps.calls, 1)
  assert.deepEqual(api.apps.lat, [1, 0, 0, 0, 0, 0, 0, 0]) // 8 ms <= 10
  assert.equal(api.boom.errors, 1)
  assert.equal(api.slow.timeouts, 1)
  assert.equal(api.slow.errors, 0)
  assert.equal(api['missing.thing'].errors, 0)
})

test('what an event carries is a fixed set of words and numbers', () => {
  const rt = fakeRuntime()
  const { perf, out } = make(rt)
  perf.start('Weird Page/Name?x=1')
  rt.at(3000)
  perf.collect({ continueVisit: false, force: true })
  const allowed = new Set(['page', 'visits', 'lcp', 'inp', 'cls', 'loaf', 'fpaint', 'tti', 'heap', 'loaf_n', 'loaf_block_ms', 'fr_a', 'fr_b', 'fr_c', 'fr_d', 'dwell_s'])
  for (const key of Object.keys(out[0].props)) assert.ok(allowed.has(key), key)
  assert.match(out[0].props.page, /^[a-z0-9][a-z0-9._-]*$/)
})

test('beyond twelve routes the rest are counted as other', () => {
  const rt = fakeRuntime()
  const { perf, out } = make(rt)
  perf.start('r0')
  for (let i = 1; i < 20; i += 1) { rt.at(i * 1000); perf.visit(`r${i}`) }
  rt.at(30_000)
  perf.collect({ continueVisit: false, force: true })
  const pages = out.map((x) => x.props.page)
  assert.equal(pages.length, 13)
  assert.ok(pages.includes('other'))
})

test('the sender starts the collector, queues its events when the page is hidden and nothing when usage statistics are off', async () => {
  for (const usage of [true, false]) {
    const rt = fakeRuntime()
    const sent = []
    const sender = createEventSender({ product: 'web', post: async (body) => { sent.push(...body.events); return { ok: true, status: 200 } }, usageOn: () => usage, errorsOn: () => true, schedule: () => 0, cancel: () => {} })
    sender.setContext({ version: '1.2.3' })
    const off = installEventListeners(sender, rt.win, rt.doc)
    assert.ok(sender.perf)
    sender.track.pageView('apps')
    rt.at(2500)
    rt.hide()
    await Promise.resolve()
    await Promise.resolve()
    const pages = sent.filter((e) => e.name === 'page_vitals')
    if (usage) {
      assert.ok(pages.length >= 1)
      assert.equal(pages[0].kind, 'experience')
    } else {
      assert.equal(sent.length, 0)
    }
    off()
    assert.equal(sender.perf, null)
  }
})

test('a page that is hidden and shown again and again sends once a minute; what it measures in between is added to the same sketches', () => {
  const rt = fakeRuntime()
  const { perf, out } = make(rt)
  perf.start('home')
  rt.at(5000); rt.hide()
  assert.equal(out.length, 1)
  rt.at(8000); rt.show()
  rt.at(15_000); rt.hide() // 10 s after the last send: kept
  assert.equal(out.length, 1)
  rt.at(30_000); rt.show()
  rt.at(80_000); rt.hide() // more than a minute: sent, with the time of both stretches
  assert.equal(out.length, 2)
  assert.equal(out[1].props.dwell_s, 7 + 50)
})

test('the pagehide of a window always sends, but never more than 96 sends a day', () => {
  const rt = fakeRuntime()
  const saved = new Map()
  const storage = { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => { saved.set(k, v) } }
  let day = '2026-11-15'
  const { perf, out } = make(rt, { storage, today: () => day })
  perf.start('home')
  for (let i = 0; i < 100; i += 1) {
    rt.at(1000 * (i + 2))
    perf.visit(i % 2 ? 'apps' : 'home')
    rt.at(1000 * (i + 2) + 1500)
    perf.collect({ force: true })
  }
  assert.equal(out.filter((x) => x.name === 'page_vitals').length > 0, true)
  const sends = JSON.parse(saved.get('foundation-ui.telemetry.pageperf.day'))
  assert.equal(sends.n, 96)
  // the next day starts again, and a restarted page reads the count of its day
  day = '2026-11-16'
  const before = out.length
  rt.at(500_000); perf.visit('apps'); rt.at(502_000)
  perf.collect({ force: true })
  assert.ok(out.length > before)
  assert.equal(JSON.parse(saved.get('foundation-ui.telemetry.pageperf.day')).day, '2026-11-16')
})

test('a page says it is ready for its own route only', () => {
  const rt = fakeRuntime()
  const { perf, out } = make(rt)
  perf.start('home')
  rt.at(1000); perf.visit('apps')
  rt.at(1500); perf.markInteractive('home') // the home page finished late: the visit is the apps page now
  rt.at(1800); perf.markInteractive('apps')
  rt.at(3000)
  perf.collect({ continueVisit: false, force: true })
  const by = Object.fromEntries(out.map((x) => [x.props.page, x.props]))
  assert.equal(by.home.tti, undefined)
  assert.deepEqual(by.apps.tti, [0, 0, 1, 0, 0, 0, 0, 0]) // 800 ms after the visit began: <= 1000 is the third bucket
})

test('the first page of a document says at once when it was ready; later pages do not', () => {
  const rt = fakeRuntime()
  const ready = []
  const perf = createPagePerf({ emit: () => {}, onReady: (page, ms) => ready.push([page, ms]), env: { win: rt.win, doc: rt.doc, now: () => rt.now, ...noTimers } })
  perf.start('home')
  rt.at(34_200)
  perf.markInteractive('home')
  perf.markInteractive('home')
  rt.at(35_000); perf.visit('apps')
  rt.at(36_000); perf.markInteractive('apps')
  assert.deepEqual(ready, [['home', 34_200]])
})
