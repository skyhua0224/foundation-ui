import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { AUTO, ISSUE_FIELDS, ISSUE_LIMITS, ISSUE_REQUIRED, KINDS, LEVELS, SunshineError, appFramesOf, bumpIssue, classified, classifyError, createAutoReporter, createBreadcrumbs, createIssue, fingerprintOf, issueDocument, levelRank, mayUploadAlone } from '../src/telemetry/index.js'

const ORIGIN = 'https://host:57990'
const appError = (message = 'boom', name = 'TypeError') => {
  const e = new Error(message); e.name = name
  e.stack = `${name}: ${message}\n    at render (${ORIGIN}/assets/web/assets/index-AbC123xy.js:1:2345)\n    at run (${ORIGIN}/assets/web/assets/vue-Zq9PqrsT.js:1:99)`
  return e
}
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) } }

test('levels: DEBUG < INFO < WARN < ERROR < FATAL, and only an ERROR or a FATAL can be the reason for an upload', () => {
  assert.deepEqual([...LEVELS], ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'])
  assert.ok(levelRank('FATAL') > levelRank('ERROR') && levelRank('ERROR') > levelRank('WARN'))
  for (const l of ['DEBUG', 'INFO', 'WARN']) assert.equal(mayUploadAlone(l), false, l)
  for (const l of ['ERROR', 'FATAL']) assert.equal(mayUploadAlone(l), true, l)
})

test('breadcrumbs: a ring buffer of the last lines, scrubbed, the last 50 go along with a report', () => {
  let t = 0
  const b = createBreadcrumbs({ capacity: 100, now: () => (t += 1000) })
  for (let i = 0; i < 130; i++) b.add('INFO', 'nav', `page ${i}`)
  b.add('ERROR', 'api', 'GET https://192.168.1.77:57990/api/apps?token=abcd1234 failed for C:\\Users\\Sky\\x')
  assert.equal(b.size, 100)
  const text = b.toText(50)
  assert.equal(text.split('\n').length, 50)
  assert.ok(!/192\.168\.1\.77|Sky|abcd1234/.test(text), text.split('\n').at(-1))
  assert.equal(b.recent(10, 'ERROR').length, 1, 'by level')
})

test('classification: EXPECTED-ENV, KNOWN-ENV and UNEXPECTED, at the source', () => {
  const k = (e, hint) => classifyError(e, { origin: ORIGIN, ...hint })
  assert.deepEqual([k(new TypeError('Failed to fetch')).kind, k(new TypeError('Failed to fetch')).category], [KINDS.EXPECTED_ENV, 'network'])
  assert.deepEqual([k(Object.assign(new Error('HTTP 401'), { status: 401 })).kind, k(Object.assign(new Error('x'), { status: 401 })).category], [KINDS.EXPECTED_ENV, 'auth'])
  assert.equal(k(new Error('The user cancelled the pairing')).kind, KINDS.EXPECTED_ENV)
  assert.equal(k(new Error('Failed to fetch dynamically imported module: https://h/assets/x.js')).kind, KINDS.KNOWN_ENV)
  assert.equal(k(Object.assign(new Error('x'), { status: 503 })).kind, KINDS.KNOWN_ENV)
  assert.equal(k(new Error('Encoder not supported on this GPU')).kind, KINDS.KNOWN_ENV)
  const u = k(appError(), { page: 'vdd' })
  assert.deepEqual([u.kind, u.category, u.code, u.appOrigin], [KINDS.UNEXPECTED, 'display', 'type-error', true])
  const own = new SunshineError('no nvenc', { category: 'encoder', code: 'nvenc-missing', kind: KINDS.KNOWN_ENV })
  assert.deepEqual([k(own).category, k(own).code, k(own).kind], ['encoder', 'nvenc-missing', KINDS.KNOWN_ENV])
  const tagged = classified(new Error('x'), { category: 'audio', code: 'no-device', kind: KINDS.EXPECTED_ENV })
  assert.equal(k(tagged).category, 'audio')
})

test('noise: ResizeObserver loops, aborted fetches, extension and injected scripts are dropped; an error without our frames is not ours', () => {
  const k = (e, hint) => classifyError(e, { origin: ORIGIN, ...hint })
  assert.equal(k(new Error('ResizeObserver loop completed with undelivered notifications.')).noise, 'resize-observer')
  assert.equal(k(Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' })).noise, 'aborted')
  assert.equal(k(Object.assign(new Error('Transition was aborted because of invalid state'), { name: 'InvalidStateError' })).noise, 'view-transition', 'a skipped view transition is the browser, not us')
  const ext = new Error('x'); ext.stack = 'Error: x\n    at inject (chrome-extension://abcdef/content.js:1:1)\n    at render (https://host:57990/assets/web/assets/index-AbC123xy.js:1:2)'
  assert.equal(k(ext).noise, 'extension')
  assert.equal(k(ext).appOrigin, false)
  const foreign = new Error('x'); foreign.stack = 'Error: x\n    at a (https://cdn.example.com/lib.js:1:2)'
  assert.equal(k(foreign).appOrigin, false)
  assert.equal(k(Object.assign(new Error('no stack'), { stack: '' })).appOrigin, false)
  assert.equal(k('a string', { kind: 'vue' }).appOrigin, true, 'the Vue handler is ours by definition')
})

test('fingerprint: category + code + the top frames of our code (no line numbers, no bundle hashes) + the release; the stem is the same across releases', () => {
  const stack = appError().stack
  const a = fingerprintOf({ category: 'ui', code: 'type-error', stack, release: '2026.1103' })
  const b = fingerprintOf({ category: 'ui', code: 'type-error', stack: stack.replace(/:1:2345/, ':9:77').replace('AbC123xy', 'ZZZ99999'), release: '2026.1103' })
  assert.equal(a.id, b.id, 'rebuilt chunk, other line: the same fault')
  const c = fingerprintOf({ category: 'ui', code: 'type-error', stack, release: '2026.1104' })
  assert.notEqual(a.id, c.id)
  assert.equal(a.stem, c.stem, 'a regression in a new release is the same stem')
  assert.notEqual(a.id, fingerprintOf({ category: 'display', code: 'type-error', stack, release: '2026.1103' }).id)
  assert.match(a.id, /^[0-9a-f]{32}$/)
  assert.deepEqual(appFramesOf(stack), ['render@index.js', 'run@vue.js'])
})

function reporterFor({ consent = 'on', answers = {}, ctx = {}, now = { t: Date.UTC(2026, 10, 3, 12) } } = {}) {
  const calls = { create: [], bump: [], known: [] }
  const send = {
    create: async (doc) => { calls.create.push(doc); return { state: answers.create || 'sent' } },
    bump: async (issue, n) => { calls.bump.push([issue, n]); return { state: answers.bump || 'sent' } },
  }
  const reporter = createAutoReporter({ storage: memory(), getConsent: () => consent, context: () => ({ product: 'web', version: '2026.1103', os: 'Windows', page: 'vdd', locale: 'zh', components: 'webui=2026.1103', keys: { encoder: 'nvenc', gpu_vendor: 'NVIDIA', capture_backend: 'wgc', secret: 'x', ...ctx.keys }, ...ctx }), now: () => now.t, origin: ORIGIN, send, emitKnown: (d) => calls.known.push(d) })
  return { reporter, calls, now }
}

test('policy: only an UNEXPECTED error of our own code with consent goes up, the first time as one issue document with the details', async () => {
  const { reporter, calls } = reporterFor()
  const r = await reporter.handle(appError(), { kind: 'error' })
  assert.equal(r.action, 'detail')
  assert.equal(calls.create.length, 1)
  const d = calls.create[0]
  assert.equal(d.fingerprint, r.fingerprint)
  assert.equal(d.kind, 'UNEXPECTED'); assert.equal(d.count, 1); assert.equal(d.product, 'web'); assert.equal(d.release, '2026.1103')
  assert.deepEqual([d.encoder, d.gpu_vendor, d.capture_backend], ['nvenc', 'NVIDIA', 'wgc'])
  assert.ok(!('secret' in d), 'only the three custom keys')
  assert.ok(Object.keys(d).every((k) => ISSUE_FIELDS.includes(k)), Object.keys(d).join())
  assert.ok(ISSUE_REQUIRED.every((k) => k in d))
  assert.equal(reporter.fingerprint(), r.fingerprint)
})

test('policy: nothing goes up without a yes, for an expected error, for noise, or for a stack that is not ours', async () => {
  for (const consent of ['ask', 'off']) { const { reporter, calls } = reporterFor({ consent }); assert.equal((await reporter.handle(appError())).action, 'local'); assert.equal(calls.create.length + calls.bump.length, 0) }
  const { reporter, calls } = reporterFor()
  assert.equal((await reporter.handle(new TypeError('Failed to fetch'))).action, 'local')
  assert.equal((await reporter.handle(new Error('ResizeObserver loop limit exceeded'))).action, 'dropped')
  const foreign = new Error('x'); foreign.stack = 'Error: x\n    at a (https://cdn.example.com/lib.js:1:2)'
  const r = await reporter.handle(foreign)
  assert.deepEqual([r.action, r.reason], ['local', 'not-app-origin'])
  assert.equal(calls.create.length + calls.bump.length, 0)
})

test('policy: a KNOWN-ENV error is a counter (code only) and only with a yes; no report is made', async () => {
  const { reporter, calls } = reporterFor()
  const r = await reporter.handle(new Error('Encoder not supported on this GPU: secret path C:\\Users\\Sky'))
  assert.equal(r.action, 'counter')
  assert.deepEqual(calls.known, [{ category: r.cls.category, code: 'unsupported' }])
  assert.equal(calls.create.length, 0)
  const off = reporterFor({ consent: 'off' })
  await off.reporter.handle(new Error('Encoder not supported')); assert.equal(off.calls.known.length, 0)
})

test('dedupe: later occurrences of a fingerprint only add to its count (batched), never new details', async () => {
  const { reporter, calls, now } = reporterFor()
  await reporter.handle(appError())
  const again = await reporter.handle(appError())
  assert.equal(again.action, 'increment')
  assert.equal(calls.create.length, 1, 'details once')
  assert.equal(calls.bump.length, 0, 'the count waits for its batch')
  now.t += AUTO.bumpBatchMs + 1
  await reporter.handle(appError())
  assert.equal(calls.bump.length, 1)
  assert.equal(calls.bump[0][1], 2, 'the two that waited')
  assert.deepEqual(calls.bump[0][0], { component: 'web', code: `${again.cls.category}.${again.cls.code}`, fingerprint: again.fingerprint }, 'counted under the component and code of the first occurrence, with its fingerprint')
  // a new release is a new issue
  const next = reporterFor({ ctx: { version: '2026.1104' } })
  assert.equal((await next.reporter.handle(appError())).action, 'detail')
})

test('cap: at most AUTO.perDay detailed reports a day from one install, the rest are deferred; the next day starts again', async () => {
  const { reporter, calls, now } = reporterFor()
  const kinds = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  const seen = []
  for (const k of kinds) { const e = appError(`m${k}`, `Err${k.toUpperCase()}`); e.stack = e.stack.replace('render', `render${k}`); seen.push((await reporter.handle(e)).action) }
  assert.equal(seen.filter((a) => a === 'detail').length, AUTO.perDay)
  assert.equal(seen.filter((a) => a === 'deferred').length, kinds.length - AUTO.perDay)
  now.t += 24 * 3600_000
  const e = appError('next', 'ErrNext'); e.stack = e.stack.replace('render', 'renderNext')
  assert.equal((await reporter.handle(e)).action, 'detail')
  assert.ok(calls.create.length === AUTO.perDay + 1)
})

test('a flood is cut off, a first occurrence that cannot be sent waits in a queue and goes later', async () => {
  const flood = reporterFor()
  let sampled = 0
  for (let i = 0; i < AUTO.floodPerMinute + 10; i++) if ((await flood.reporter.handle(appError())).action === 'sampled') sampled += 1
  assert.equal(sampled, 10)
  const q = reporterFor({ answers: { create: 'offline' } })
  assert.equal((await q.reporter.handle(appError())).action, 'queued')
  assert.equal(q.reporter.state.queue.length, 1)
  q.calls.create.length = 0
  const again = createAutoReporter({ storage: { getItem: () => JSON.stringify(q.reporter.state), setItem() {} }, getConsent: () => 'on', context: () => ({}), send: { create: async () => ({ state: 'sent' }), bump: async () => ({ state: 'sent' }) }, origin: ORIGIN })
  assert.deepEqual(await again.flush(), { sent: 1, queued: 0 })
})

test('the issue document has exactly the listed fields, the required ones and the limits', () => {
  const doc = issueDocument({ report: { message: 'm', name: 'N', stack: 's', os: 'o', page: 'p', locale: 'l' }, cls: { category: 'ui', code: 'x' }, fp: fingerprintOf({ stack: appError().stack, release: 'r' }), product: 'panel', release: 'r', keys: { encoder: 'e' }, components: 'c', breadcrumbs: 'b' })
  assert.deepEqual(Object.keys(doc).filter((k) => !ISSUE_FIELDS.includes(k)), [])
})

test('the writes are error events for the host: the first occurrence with the details the contract has room for, later ones as a count', async () => {
  const seen = []
  const transport = (status) => async (events) => { seen.push(events); return { ok: status < 300, status } }
  const doc = { fingerprint: 'a'.repeat(32), count: 1, kind: 'UNEXPECTED', stem: 'b'.repeat(32), category: 'ui', code: 'x', name: 'TypeError', product: 'web', release: 'r', message: 'it broke at C:\\Users\\Ann\\a.js', first_seen: 't', last_seen: 't', schema: 1 }
  assert.deepEqual(await createIssue(doc, { transport: transport(200) }), { state: 'sent' })
  const [event, detail] = seen[0]
  assert.deepEqual([event.kind, event.name], ['error', 'error'])
  assert.deepEqual(event.props, { component: 'web', code: 'ui.x', severity: 'error', count: 1 })  // the text of the error stays on this computer
  assert.deepEqual([detail.kind, detail.name], ['error', 'error_report'])
  assert.equal(detail.props.fingerprint, 'a'.repeat(32)); assert.equal(detail.props.lang, 'js')
  assert.ok(!/Ann|broke/.test(JSON.stringify(seen[0])))
  assert.equal((await createIssue(doc, { transport: transport(503) })).state, 'offline')
  assert.equal((await createIssue(doc, { transport: transport(400) })).state, 'rejected')
  assert.equal((await createIssue(doc, { transport: async () => { throw new Error('x') } })).state, 'offline')
  seen.length = 0
  assert.equal((await bumpIssue({ component: 'panel', code: 'ui.x' }, 3, { transport: transport(200) })).state, 'sent')
  assert.deepEqual(seen[0][0].props, { component: 'panel', code: 'ui.x', severity: 'error', count: 3 })
  assert.equal(seen[0].length, 1, 'a count without a fingerprint has no error_report')
  seen.length = 0
  await bumpIssue({ component: 'panel', code: 'ui.x', fingerprint: 'c'.repeat(32) }, 3, { transport: transport(200) })
  assert.deepEqual(seen[0][1].props, { component: 'panel', lang: 'js', fingerprint: 'c'.repeat(32), code: 'ui.x', severity: 'error', count: 3 })
})

test('the report links to the automatic issue of the same error, and carries the classification and the last events', async () => {
  const { buildReport, reportToDocument } = await import('../src/telemetry/index.js')
  const report = buildReport(appError(), { context: { product: 'web', version: 'v', category: 'display', code: 'type-error', errorKind: 'UNEXPECTED', breadcrumbs: '12:00:00 ERROR ui x', components: 'webui=v', keys: { encoder: 'nvenc' } } })
  const doc = reportToDocument(report, { title: 't', description: 'd', issue: 'a'.repeat(32) })
  assert.deepEqual([doc.category, doc.code, doc.issue, doc.breadcrumbs, doc.encoder, doc.components], ['display', 'type-error', 'a'.repeat(32), '12:00:00 ERROR ui x', 'nvenc', 'webui=v'])
  assert.ok(!('issue' in reportToDocument(report, { title: 't', description: 'd', issue: 'not a fingerprint' })))
})
