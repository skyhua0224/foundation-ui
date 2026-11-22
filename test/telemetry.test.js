import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { CONSENT_KEY, DOCUMENT_FIELDS, DOCUMENT_REQUIRED, QUEUE_KEY, QUEUE_MAX, RATE, REPORT_LIMITS, allowReport, buildReport, describeError, enqueue, flushQueue, issueUrl, loadQueue, mayCollect, normalizeConsent, readConsent, reportProblems, reportToDocument, reportToFile, reportToText, scrubText, sendDocument, signatureOf, submitReport, writeConsent } from '../src/telemetry/index.js'

const memory = () => { const data = new Map(); return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => { data.set(k, String(v)) }, removeItem: (k) => { data.delete(k) } } }
const ctx = { product: 'web', version: '2026.1102.1', os: 'Windows 11', page: 'config', locale: 'zh', logs: 'line one\nline two', now: Date.parse('2026-11-03T10:00:00Z') }

test('scrub: names, paths, addresses and secrets do not survive', () => {
  assert.equal(scrubText('open C:\\Users\\alice\\a.txt'), 'open C:\\Users\\<user>\\a.txt')
  assert.ok(!scrubText('open C:\\Users\\alice\\AppData\\Roaming\\a.txt').includes('alice'))
  assert.ok(!scrubText('/home/alice/.config/x').includes('alice')); assert.ok(!scrubText('/Users/alice/Library').includes('alice'))
  assert.equal(scrubText('mail me at someone@example.org now'), 'mail me at <email> now')
  assert.equal(scrubText('host 192.168.7.31 down'), 'host <ip> down')
  assert.ok(!scrubText('mac 00:1A:2B:3C:4D:5E').includes('00:1A'))
  assert.ok(!scrubText('token=abcdef123456 and password: hunter2 and Authorization: Bearer abcdefghijklmnop').match(/abcdef123456|hunter2|abcdefghijklmnop/))
  assert.ok(!scrubText('GET https://127.0.0.1:57990/api/config?name=Sky&pin=1234').match(/127\.0\.0\.1|Sky|1234/))
  assert.ok(!scrubText('id 0123456789abcdef0123456789abcdef0123').includes('0123456789abcdef0123456789abcdef'))
  assert.equal(scrubText(null), ''); assert.equal(scrubText(undefined), ''); assert.equal(scrubText({ toString() { throw new Error('x') } }), '')
  assert.equal(scrubText('ab '.repeat(2000), 100).length, 100)
  assert.equal(scrubText('a\u0000b\u202ec'), 'abc')
  assert.equal(scrubText('addr fd00:: and fe80:: and fe80::1 and fdab::'), 'addr <ipv6> and <ipv6> and <ipv6> and <ipv6>')
  assert.equal(scrubText('pub 2001:db8::1'), 'pub <ipv6>')
  assert.equal(scrubText('keep std::vector and time 10:15:30'), 'keep std::vector and time 10:15:30')
  assert.equal(scrubText('id 123e4567-e89b-12d3-a456-426614174000'), 'id <id>')
  assert.equal(scrubText('key sk-abcdefghijklmnopqrstuvwxyz'), 'key <hidden>')
  assert.equal(scrubText('open C:/Users/alice/a.txt'), 'open C:/Users/<user>/a.txt')
})

test('consent: on until turned off; only an on collects', () => {
  assert.equal(normalizeConsent(undefined), 'on'); assert.equal(normalizeConsent('maybe'), 'on'); assert.equal(normalizeConsent(null), 'on'); assert.equal(normalizeConsent('ask'), 'on', 'the retired value of an older version reads as the default')
  assert.equal(normalizeConsent('on'), 'on'); assert.equal(normalizeConsent(true), 'on'); assert.equal(normalizeConsent('false'), 'off'); assert.equal(normalizeConsent(0), 'off')
  assert.equal(mayCollect('off'), false); assert.equal(mayCollect('on'), true)
  const s = memory()
  assert.equal(readConsent(s), 'on'); writeConsent('off', s); assert.equal(readConsent(s), 'off'); assert.equal(s.getItem(CONSENT_KEY), 'off'); writeConsent('on', s); assert.equal(readConsent(s), 'on'); assert.equal(s.getItem(CONSENT_KEY), 'on')
})

test('describeError reads an Error, a string, an event and a rejection reason', () => {
  assert.equal(describeError(new TypeError('boom')).name, 'TypeError')
  assert.equal(describeError('plain').message, 'plain')
  assert.equal(describeError({ message: 'ev', filename: 'a.js', lineno: 3, colno: 4 }).stack, 'at a.js:3:4')
  assert.equal(describeError({ reason: new Error('r') }).message, 'r')
  assert.equal(describeError(undefined).message, 'Unknown error'); assert.equal(describeError({ a: 1 }).message, '{"a":1}')
})

test('a report is scrubbed, cut to the limits and says where it came from', () => {
  const error = Object.assign(new Error('failed at C:\\Users\\alice\\a.js with token=abc12345'), { stack: 'Error: x\n    at f (https://127.0.0.1:57990/assets/Home.js:1:2)\n' + 'y'.repeat(20000) })
  const r = buildReport(error, { kind: 'vue', context: { ...ctx, logs: 'z'.repeat(20000) } })
  assert.equal(r.kind, 'vue'); assert.equal(r.product, 'web'); assert.equal(r.version, '2026.1102.1')
  assert.ok(!r.message.includes('alice') && !r.message.includes('abc12345'))
  assert.ok(r.stack.length <= REPORT_LIMITS.stack && r.logs.length <= REPORT_LIMITS.logs && r.message.length <= REPORT_LIMITS.message)
  assert.ok(!r.stack.includes('127.0.0.1'))
  assert.equal(buildReport('x', { kind: 'nonsense', context: { product: 'tv' } }).kind, 'error'); assert.equal(buildReport('x', { context: { product: 'tv' } }).product, 'web')
  assert.equal(signatureOf(r), signatureOf(buildReport(error, { kind: 'vue', context: ctx })), 'the same error is the same signature')
})

test('text and file of a report carry the same facts', () => {
  const r = buildReport(new Error('boom'), { context: ctx })
  const text = reportToText(r, { title: 'T', description: 'what I did' })
  assert.ok(text.includes('Error: boom') && text.includes('2026.1102.1') && text.includes('what I did') && text.includes('line one'))
  const file = reportToFile(r, { title: 'T' })
  assert.match(file.name, /^foundation-sunshine-error-20261103-100000\.json$/); assert.equal(JSON.parse(file.text).message, 'boom'); assert.equal(JSON.parse(file.text).title, 'T')
})

test('the form needs a title and a description; the document has exactly the allowed fields', () => {
  const r = buildReport(new Error('boom'), { context: ctx })
  assert.deepEqual(reportProblems({}), ['title', 'description']); assert.deepEqual(reportProblems({ title: ' ', description: 'x' }), ['title']); assert.deepEqual(reportProblems({ title: 'x', description: 'y' }), [])
  assert.equal(reportToDocument(r, { title: '', description: 'x' }), null); assert.equal(reportToDocument(r, { title: 'x', description: '   ' }), null)
  const doc = reportToDocument(r, { title: 'Crash on save', description: 'I pressed save', contact: ' me@example.org ' })
  assert.equal(doc.contact, 'me@example.org', 'the contact the person left is kept, cleaned to one line, for the one issue of this report')
  assert.ok(!('contact' in reportToDocument(r, { title: 'Crash on save', description: 'I pressed save' })), 'no contact, no field')
  for (const key of DOCUMENT_REQUIRED) assert.ok(key in doc, key)
  for (const key of Object.keys(doc)) assert.ok(DOCUMENT_FIELDS.includes(key), key)
  assert.ok(doc.title.length <= 120 && doc.description.length <= 4000)
  assert.equal(reportToDocument(r, { title: 'ab '.repeat(200), description: 'cd '.repeat(3000) }).title.length, 120)
})

test('no Firestore, no Google host: the sources and the docs of the library carry none, and the rules file is gone', () => {
  assert.ok(!fs.existsSync(new URL('../docs/firestore.rules', import.meta.url)))
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(new URL(`${e.name}/`, dir)) : [new URL(e.name, dir)]))
  for (const file of walk(new URL('../src/', import.meta.url))) {
    if (!/\.(js|vue|css)$/.test(file.pathname)) continue
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /firestore\.googleapis|firebaseio|FIREBASE|toFirestoreFields|google-analytics|googletagmanager/i, file.pathname)
  }
})

const answer = (status) => async () => ({ ok: status >= 200 && status < 300, status })
test('sending: sent, offline (network, timeout, 5xx, 429) or rejected (4xx); what goes is one error event named user_report', async () => {
  const doc = reportToDocument(buildReport(new Error('x'), { context: ctx }), { title: 't', description: 'd' })
  assert.deepEqual(await sendDocument(doc, { transport: answer(200) }), { state: 'sent' })
  for (const status of [500, 503, 429, 408]) assert.equal((await sendDocument(doc, { transport: answer(status) })).state, 'offline', String(status))
  for (const status of [400, 401, 403, 404]) assert.equal((await sendDocument(doc, { transport: answer(status) })).state, 'rejected', String(status))
  assert.equal((await sendDocument(doc, { transport: async () => { throw new TypeError('Failed to fetch') } })).state, 'offline')
  assert.equal((await sendDocument(doc, { transport: () => new Promise(() => {}), timeoutMs: 20 })).reason, 'timeout')
  let seen
  await sendDocument(doc, { transport: async (events) => { seen = events; return { ok: true, status: 200 } } })
  assert.equal(seen.length, 1); assert.deepEqual([seen[0].kind, seen[0].name], ['error', 'user_report'])
  assert.equal((await sendDocument(doc, { transport: null })).state, 'offline')
})

test('where the host or the server cannot be reached the report waits in a local queue and is tried again', async () => {
  const s = memory()
  const doc = reportToDocument(buildReport(new Error('x'), { context: ctx }), { title: 't', description: 'd' })
  const first = await submitReport(doc, { storage: s, transport: async () => { throw new TypeError('x') } })
  assert.equal(first.state, 'queued'); assert.equal(loadQueue(s).length, 1)
  assert.deepEqual(await flushQueue({ storage: s, transport: async () => { throw new TypeError('x') } }), { sent: 0, rejected: 0, left: 1 })
  assert.equal(loadQueue(s)[0].attempts, 1)
  assert.deepEqual(await flushQueue({ storage: s, transport: answer(200) }), { sent: 1, rejected: 0, left: 0 })
  assert.equal(loadQueue(s).length, 0)
  enqueue(doc, s); assert.deepEqual(await flushQueue({ storage: s, transport: answer(403) }), { sent: 0, rejected: 1, left: 0 }, 'a rejected report is not kept')
  for (let i = 0; i < QUEUE_MAX + 10; i += 1) enqueue(doc, s)
  assert.equal(loadQueue(s).length, QUEUE_MAX)
  s.setItem(QUEUE_KEY, '{bad'); assert.deepEqual(loadQueue(s), [])
})

test('at most a few reports an hour leave one window', async () => {
  const s = memory()
  let t = Date.parse('2026-11-03T10:00:00Z')
  for (let i = 0; i < RATE.perHour; i += 1) assert.equal(allowReport(s, t + i), true)
  assert.equal(allowReport(s, t + 100), false)
  assert.equal(allowReport(s, t + 3600_001 + RATE.perHour), true, 'an hour later again')
  // different reports (the same one pressed again is one report, see feedbacksend.test.js)
  const docOf = (n) => reportToDocument(buildReport(new Error('x'), { context: ctx }), { title: `t${n}`, description: 'd' })
  const r = memory(); for (let i = 0; i < RATE.perHour; i += 1) await submitReport(docOf(i), { storage: r, transport: answer(200), now: t })
  assert.equal((await submitReport(docOf(99), { storage: r, transport: answer(200), now: t })).state, 'limited')
})

test('the GitHub issue is prefilled and never longer than a URL can take', () => {
  const r = buildReport(new Error('boom'), { context: { ...ctx, logs: 'l'.repeat(6000) } })
  const url = new URL(issueUrl(r, { title: 'My title', description: 'My text' }))
  assert.equal(url.origin + url.pathname, 'https://github.com/AlkaidLab/foundation-sunshine/issues/new'); assert.equal(url.searchParams.get('title'), 'My title')
  assert.ok(url.searchParams.get('body').includes('My text') && url.searchParams.get('body').length <= 4500)
})
