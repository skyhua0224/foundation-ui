import test from 'node:test'
import assert from 'node:assert/strict'
import { catalogueId, createEventSender, installEventListeners, updateSourceMissOf, updateSourceOf } from '../src/telemetry/events.js'

const store = (initial = {}) => { const m = new Map(Object.entries(initial)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) } }
const make = ({ usage = true, errors = true, status = 200, product = 'panel' } = {}) => {
  const posts = []
  const sender = createEventSender({
    product, usageOn: () => usage, errorsOn: () => errors, storage: store(),
    post: async (body, extra) => { posts.push({ body, extra }); return { ok: status < 400, status } },
    schedule: () => 1, cancel: () => {},
  })
  return { sender, posts }
}
const names = (posts) => posts.flatMap((p) => p.body.events.map((e) => e.name))

test('catalogue ids are the contract\'s tokens', () => {
  assert.equal(catalogueId('Display Modes!'), 'display-modes')
  assert.equal(catalogueId('  weird/Name_1.2 '), 'weird-name_1.2')
  assert.equal(catalogueId('x'.repeat(100), 10).length, 10)
  assert.equal(catalogueId(''), '')
  assert.equal(catalogueId('-lead'), 'lead')
})

test('events leave in the contract shape with the product and version, and nothing but kind, name and props', async () => {
  const { sender, posts } = make()
  sender.setContext({ version: '1.4.0.杂鱼' })
  sender.track.appStart({ startMs: 812.4, updateSource: 'mirror' })
  sender.track.appStart({ startMs: 1 })
  sender.track.feature('apps.add'); sender.track.error('Load_Failed', 'at C:\\Users\\Bob\\x.js from 10.0.0.2')
  await sender.flush()
  assert.equal(posts.length, 1)
  assert.equal(posts[0].body.product, 'panel'); assert.equal(posts[0].body.version, '1.4.0.杂鱼')
  const [start, feature, error] = posts[0].body.events
  assert.deepEqual(start, { kind: 'usage', name: 'app_start', props: { cold: true, start_ms: 812, update_source: 'mirror' } })
  assert.deepEqual(feature, { kind: 'usage', name: 'feature_used', props: { feature: 'apps.add' } })
  assert.equal(error.kind, 'error'); assert.equal(error.props.component, 'panel'); assert.equal(error.props.code, 'load_failed'); assert.equal(error.props.count, 1)
  assert.deepEqual(Object.keys(error.props).sort(), ['code', 'component', 'count', 'severity'], 'an error event has no text')
  assert.doesNotMatch(JSON.stringify(posts[0].body), /Bob|10\.0\.0\.2/)
  assert.equal(posts[0].body.events.length, 3, 'a second app_start in one load is not counted')
})

test('update source: mirror, cnb, github, anything else is other', () => {
  assert.deepEqual(['mirror', 'github', 'auto', 'cnb', undefined].map(updateSourceOf), ['mirror', 'github', 'other', 'cnb', 'other'])
})

test('the reason the chosen source was not used travels with the start record, only as one of the contract words', async () => {
  const posts = []
  const sender = createEventSender({ product: 'panel', usageOn: () => true, errorsOn: () => true, post: async (b) => { posts.push(b); return { ok: true, status: 200 } }, schedule: () => 1, cancel: () => {} })
  sender.track.appStart({ startMs: 5, updateSource: 'cnb', updateSourceMiss: 'version_lag' })
  await sender.flush()
  assert.deepEqual(posts[0].events[0].props, { cold: true, start_ms: 5, update_source: 'cnb', update_source_miss: 'version_lag' })
  assert.deepEqual(['version_lag', 'cdk_invalid', 'quota', 'network', 'no_cdk', '', 'bogus', undefined].map(updateSourceMissOf), ['version_lag', 'cdk_invalid', 'quota', 'network', 'no_cdk', '', '', ''])
})

test('page time to content is a whole number of ms after the first painted frames', async () => {
  const posts = []
  let t = 100
  const sender = createEventSender({ product: 'web', usageOn: () => true, errorsOn: () => true, post: async (b) => { posts.push(b); return { ok: true, status: 200 } }, now: () => (t += 25), schedule: () => 1, cancel: () => {} })
  const raf = globalThis.requestAnimationFrame
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0)
  try {
    sender.track.pageView('Display Modes')
    sender.track.pageView('apps') // the second page replaces the first before it painted: one number, for the page that is on screen
    await new Promise((r) => setTimeout(r, 20))
    await sender.flush()
  } finally { if (raf) globalThis.requestAnimationFrame = raf; else delete globalThis.requestAnimationFrame }
  const events = posts.flatMap((b) => b.events)
  assert.deepEqual(events.map((e) => e.props.page), ['apps'])
  assert.equal(events[0].name, 'panel_page'); assert.equal(events[0].kind, 'experience'); assert.ok(Number.isInteger(events[0].props.time_to_content_ms) && events[0].props.time_to_content_ms > 0)
})

test('each kind follows its own choice: usage off keeps errors, errors off keeps usage, both off requests nothing', async () => {
  for (const [opts, expected] of [[{ usage: false }, ['error']], [{ errors: false }, ['feature_used']], [{ usage: false, errors: false }, []]]) {
    const { sender, posts } = make(opts)
    sender.track.feature('x'); sender.track.error('boom', 'text'); sender.track.appStart()
    await sender.flush()
    assert.deepEqual(names(posts).filter((n) => n !== 'app_start'), expected)
    if (opts.usage === false) assert.ok(!names(posts).includes('app_start'))
  }
})

test('a choice that turns off between queueing and sending drops the events of that kind', async () => {
  let usage = true
  const posts = []
  const sender = createEventSender({ product: 'web', usageOn: () => usage, errorsOn: () => true, post: async (b) => { posts.push(b); return { ok: true, status: 200 } }, schedule: () => 1, cancel: () => {} })
  sender.track.feature('a'); sender.track.error('b', 'c')
  usage = false
  await sender.flush()
  assert.deepEqual(posts.flatMap((b) => b.events.map((e) => e.name)), ['error'])
})

test('an embedded page counts nothing', async () => {
  const { sender, posts } = make()
  sender.setContext({ version: '1', embedded: true })
  sender.track.appStart(); sender.track.feature('x'); sender.track.error('a', 'b')
  await sender.flush()
  assert.equal(posts.length, 0)
})

test('a busy host (5xx, 429) gets the events once more, later; a refusal drops them; a throw is silent', async () => {
  const { sender, posts } = make({ status: 503 })
  sender.track.feature('a')
  await sender.flush(); assert.equal(sender.pending, 1, 'put back once')
  await sender.flush(); assert.equal(sender.pending, 0, 'and not a second time'); assert.equal(posts.length, 2)
  const refused = make({ status: 400 })
  refused.sender.track.feature('a'); await refused.sender.flush(); assert.equal(refused.sender.pending, 0)
  const thrower = createEventSender({ product: 'web', usageOn: () => true, errorsOn: () => true, post: async () => { throw new Error('offline') }, schedule: () => 1, cancel: () => {} })
  thrower.track.feature('a'); await assert.doesNotReject(thrower.flush())
})

test('the queue is bounded and a full queue is sent at once', async () => {
  const { sender, posts } = make()
  for (let i = 0; i < 25; i += 1) sender.track.feature(`f${i}`)
  await new Promise((r) => setTimeout(r, 5))
  assert.ok(posts.length >= 1 && posts[0].body.events.length === 20)
})

test('the window listeners: off drops what waited, known limits and shell errors become error events, hiding the page sends', async () => {
  const { sender, posts } = make()
  const listeners = new Map()
  const win = { addEventListener: (n, f) => listeners.set(n, f), removeEventListener: (n) => listeners.delete(n) }
  const doc = { visibilityState: 'visible', addEventListener: (n, f) => listeners.set(`doc:${n}`, f), removeEventListener: () => {} }
  const off = installEventListeners(sender, win, doc)
  sender.track.feature('waiting'); sender.queue('experience', 'panel_page', { page: 'home', time_to_content_ms: 5 })
  listeners.get('foundation-telemetry-consent')({ detail: 'off' })
  assert.equal(sender.pending, 0)
  listeners.get('foundation-known-env')({ detail: { category: 'GPU', code: 'No Encoder', text: 'ignored' } })
  listeners.get('foundation-error-reported')({ detail: { message: 'failed at /home/amy/x for 192.168.0.9', fatal: true } })
  doc.visibilityState = 'hidden'; listeners.get('doc:visibilitychange')()
  await new Promise((r) => setTimeout(r, 5))
  assert.equal(posts[0].extra.keepalive, true)
  const [known, shell] = posts[0].body.events
  assert.deepEqual(known.props, { component: 'known-env', code: 'gpu.no-encoder', severity: 'warning', count: 1 })
  assert.equal(shell.props.severity, 'fatal'); assert.equal('message' in shell.props, false); assert.doesNotMatch(JSON.stringify(posts[0].body), /amy|192\.168/)
  off(); assert.equal(listeners.has('pagehide'), false)
})
