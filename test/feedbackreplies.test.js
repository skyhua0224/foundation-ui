import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ASK_GAP_MS, ASK_MAX, KEEP_MS, REPLY_KEY, REPORTS_MAX, STORE_KEY, applyReplies, askReplies, dismissItem, keysToAsk, loadState, newReplyKey, parseAnswer, previewOf, prune, rememberReport, saveState } from '../src/feedback/replies.js'
import { feedbackTexts } from '../src/feedback/texts.js'
import { buildReport, enqueue, queuedReplyKey, reportIdOf, reportToDocument, reportToEvent } from '../src/telemetry/index.js'
import { resetNotify, useNotify } from '../src/notify/store.js'
import { replySheet, useFeedbackReplies } from '../src/vue/feedback/useFeedbackReplies.js'
import { devProviders } from '../src/vue/devmode/devReport.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const memory = () => { const data = new Map(); return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => { data.set(k, String(v)) }, removeItem: (k) => { data.delete(k) }, data } }
const K = (n) => `rk_${String(n).padStart(32, '0').replace(/[^0-9a-f]/g, 'a')}`
const T0 = Date.parse('2026-11-21T10:00:00Z')
const reply = (key, id, over = {}) => ({ key, id, kind: 'reply', text: 'Thanks, fixed in the next beta.', version: '', at: T0 + 1000, ...over })
const json = (body, status = 200) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body })

test('a key is rk_ and 128 random bits; a platform without a secure random source makes none', () => {
  const a = newReplyKey(), b = newReplyKey()
  assert.match(a, REPLY_KEY); assert.notEqual(a, b)
  assert.throws(() => newReplyKey({}), /secure random/)
  assert.throws(() => newReplyKey(null), /secure random/)
})

test('remembering a report: its key and title, once per key, the newest 20, none older than 90 days, a bad key not at all', () => {
  const s = memory()
  rememberReport({ key: 'rk_nope', title: 'x' }, { storage: s, now: () => T0 })
  assert.equal(s.data.size, 0, 'a key of the wrong shape is not remembered')
  rememberReport({ key: K(1), title: `  The   tile\nshows the wrong adapter ${'x'.repeat(200)}`, product: 'panel' }, { storage: s, now: () => T0 })
  let state = loadState(s)
  assert.equal(state.reports.length, 1)
  assert.ok(state.reports[0].title.length <= 120 && state.reports[0].title.startsWith('The tile shows the wrong adapter x'))
  rememberReport({ key: K(1), title: 'again' }, { storage: s, now: () => T0 + 5 })
  assert.deepEqual(loadState(s).reports.map((r) => r.title), ['again'], 'the same key is one report')
  for (let i = 2; i < 30; i += 1) rememberReport({ key: K(i), title: `t${i}` }, { storage: s, now: () => T0 + i })
  state = loadState(s)
  assert.equal(state.reports.length, REPORTS_MAX)
  assert.equal(state.reports[0].title, 't29', 'newest first')
  rememberReport({ key: K(99), title: 'late' }, { storage: s, now: () => T0 + KEEP_MS + 1000 })
  assert.deepEqual(loadState(s).reports.map((r) => r.title), ['late'], 'a report is forgotten after 90 days')
})

test('a storage that was edited, cleared or written by another version never breaks the window', () => {
  const s = memory()
  assert.deepEqual(loadState(s), { v: 1, reports: [], seen: [], inbox: [], lastAt: 0 })
  s.setItem(STORE_KEY, '{not json'); assert.equal(loadState(s).reports.length, 0)
  s.setItem(STORE_KEY, JSON.stringify({ v: 2, reports: [{ key: K(1), at: T0 }] })); assert.equal(loadState(s).reports.length, 0)
  s.setItem(STORE_KEY, JSON.stringify({ v: 1, reports: [{ key: 'bad', at: T0 }, { key: K(1), at: T0, title: 7 }, null], seen: [1, 'a:b'], inbox: [{ id: 'x' }, { id: `${K(1)}:c1`, key: K(1), kind: 'reply', at: T0, text: 'hi' }], lastAt: 'x' }))
  const state = loadState(s)
  assert.deepEqual(state.reports.map((r) => [r.key, r.title]), [[K(1), '7']])
  assert.deepEqual(state.seen, ['a:b']); assert.equal(state.inbox.length, 1); assert.equal(state.lastAt, 0)
  assert.doesNotThrow(() => saveState(state, { setItem() { throw new Error('quota') } }))
  assert.doesNotThrow(() => loadState({ getItem() { throw new Error('denied') } }))
})

test('the keys to ask: none without reports or inside the four hours, the newest ten otherwise, all of them when forced', () => {
  let state = { ...loadState(memory()), reports: Array.from({ length: 14 }, (_, i) => ({ key: K(i + 1), title: '', at: T0 - i * 1000, product: '' })), lastAt: 0 }
  assert.equal(keysToAsk(state, T0).length, ASK_MAX)
  assert.equal(keysToAsk(state, T0)[0], K(1))
  state = { ...state, lastAt: T0 - ASK_GAP_MS + 1 }
  assert.deepEqual(keysToAsk(state, T0), [])
  assert.equal(keysToAsk(state, T0, { force: true }).length, ASK_MAX)
  assert.equal(keysToAsk(state, T0 + 2).length, ASK_MAX, 'after the gap it asks again')
  assert.deepEqual(keysToAsk({ ...state, reports: [], lastAt: 0 }, T0), [])
})

test('an answer is read field by field: a reply without text, a fixed message without a version, a bad key or kind are left out', () => {
  assert.equal(parseAnswer(null), null); assert.equal(parseAnswer({ v: 2, replies: [] }), null); assert.equal(parseAnswer({ v: 1 }), null)
  const out = parseAnswer({ v: 1, replies: [
    reply(K(1), 'c1'), reply(K(1), 'c2', { text: '   ' }), reply('rk_bad', 'c3'), reply(K(1), 'c4', { kind: 'other' }), reply(K(1), 'c5', { at: 'x' }),
    { key: K(1), id: 'fixed:1.0.8', kind: 'fixed', text: 'ignored markup <b>', version: '1.0.8', at: T0 }, { key: K(1), id: 'fixed:', kind: 'fixed', version: '', at: T0 },
    reply(K(1), 'c9', { text: 'x'.repeat(9000) }),
  ] })
  assert.deepEqual(out.map((r) => r.id), ['c1', 'fixed:1.0.8', 'c9'])
  assert.equal(out[2].text.length, 4000)
})

test('asking: one GET with the keys, no cookie, no referrer; busy on 429 and 503; failed on anything else', async () => {
  const calls = []
  const ok = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ v: 1, replies: [reply(K(1), 'c1')] }) } }
  const res = await askReplies({ keys: [K(1), K(2), 'rk_bad'], base: 'https://api.example.test/', fetchFn: ok })
  assert.equal(res.state, 'ok'); assert.equal(res.replies.length, 1)
  assert.equal(calls[0].url, `https://api.example.test/v1/replies?k=${K(1)}&k=${K(2)}`)
  assert.deepEqual([calls[0].init.method, calls[0].init.credentials, calls[0].init.referrerPolicy, 'headers' in calls[0].init], ['GET', 'omit', 'no-referrer', false])
  for (const status of [429, 503]) assert.equal((await askReplies({ keys: [K(1)], fetchFn: json({}, status) })).state, 'busy', String(status))
  for (const status of [400, 404, 500]) assert.equal((await askReplies({ keys: [K(1)], fetchFn: json({}, status) })).state, 'failed', String(status))
  assert.equal((await askReplies({ keys: [K(1)], fetchFn: json({ v: 9 }) })).state, 'failed', 'an answer that is not one')
  assert.equal((await askReplies({ keys: [K(1)], fetchFn: async () => { throw new Error('offline') } })).state, 'failed')
  assert.equal((await askReplies({ keys: [], fetchFn: ok })).state, 'failed', 'nothing to ask'); assert.equal(calls.length, 1)
  assert.equal((await askReplies({ keys: [K(1)], timeoutMs: 5, fetchFn: (u, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))) })).state, 'failed', 'it does not wait for ever')
})

test('a new reply of a remembered report is new once; the answer to a report this window never sent is ignored', () => {
  const s = memory()
  rememberReport({ key: K(1), title: 'Wrong adapter' }, { storage: s, now: () => T0 })
  const state = loadState(s)
  const first = applyReplies(state, [reply(K(1), 'c2', { at: T0 + 2000 }), reply(K(1), 'c1'), reply(K(7), 'c9')], T0 + 5000)
  assert.deepEqual(first.fresh.map((i) => i.id), [`${K(1)}:c1`, `${K(1)}:c2`], 'oldest first, the stranger is out')
  assert.equal(first.fresh[0].title, 'Wrong adapter'); assert.equal(first.state.lastAt, T0 + 5000)
  const second = applyReplies(first.state, [reply(K(1), 'c1'), reply(K(1), 'c2')], T0 + 9000)
  assert.deepEqual(second.fresh, [], 'shown once')
  assert.equal(second.state.inbox.length, 2)
  const closed = dismissItem(second.state, `${K(1)}:c1`)
  assert.deepEqual(closed.inbox.map((i) => i.dismissed), [true, false])
  assert.deepEqual(applyReplies(closed, [reply(K(1), 'c1')], T0 + 9500).fresh, [], 'a closed one does not come back')
  assert.equal(prune({ ...closed, inbox: closed.inbox }, T0 + KEEP_MS + 100_000).inbox.length, 0, 'after 90 days the inbox is empty')
})

test('the line in the status button: the first two lines, cut; a fixed message has its own words in both languages', () => {
  const W = feedbackTexts('zh'), E = feedbackTexts('en')
  const long = { kind: 'reply', text: `第一行\n\n第二行\n第三行不显示${'字'.repeat(200)}` }
  assert.equal(previewOf(long, W), '第一行 第二行')
  assert.ok(previewOf({ kind: 'reply', text: '字'.repeat(300) }, W).length === 72 && previewOf({ kind: 'reply', text: '字'.repeat(300) }, W).endsWith('…'))
  assert.equal(previewOf({ kind: 'fixed', version: '1.0.8' }, W), '已修复，将在 1.0.8 发布')
  assert.equal(previewOf({ kind: 'fixed', version: '1.0.8' }, E), 'Fixed, coming in 1.0.8')
})

test('the event carries the key when it has the right shape, and the id of a report does not depend on it', () => {
  const report = buildReport(new Error('x'), { kind: 'manual', fatal: false, context: { product: 'panel', page: 'home', now: T0 } })
  const doc = reportToDocument(report, { title: 'T', description: 'D' })
  const id = reportIdOf(doc)
  assert.equal(reportIdOf({ ...doc, reply_key: K(1) }), id, 'the same words are the same report')
  assert.equal(reportToEvent({ ...doc, reply_key: K(1) }).props.reply_key, K(1))
  for (const bad of ['', 'rk_123', K(1).toUpperCase(), `${K(1)}0`, 5, null]) assert.ok(!('reply_key' in reportToEvent({ ...doc, reply_key: bad }).props), String(bad))
  assert.ok(!('reply_key' in reportToEvent(doc).props))
  const s = memory()
  enqueue({ ...doc, reply_key: K(3) }, s, T0, { id })
  assert.equal(queuedReplyKey(id, s), K(3)); assert.equal(queuedReplyKey('other', s), ''); assert.equal(queuedReplyKey('', s), '')
})

test('the status button: a new answer shows once with the title the person wrote, opens the whole text, and does not come back after it is closed or after a restart', async () => {
  resetNotify()
  const s = memory()
  rememberReport({ key: K(1), title: 'Wrong adapter' }, { storage: s, now: () => T0 })
  rememberReport({ key: K(2), title: '输入框里的网址' }, { storage: s, now: () => T0 + 1 })
  const answer = { v: 1, replies: [reply(K(1), 'c1', { text: 'Thanks!\nThe tile follows the bound address in 1.0.8.\nMore.' }), { key: K(2), id: 'fixed:1.0.8', kind: 'fixed', text: '', version: '1.0.8', at: T0 + 3000 }] }
  let asked = 0
  const fetchFn = async () => { asked += 1; return { ok: true, status: 200, json: async () => answer } }
  const r = useFeedbackReplies({ locale: 'en', storage: s, fetchFn, now: () => T0 + 10_000, startDelayMs: 1e9, tickMs: 1e9 })
  assert.equal(devProviders().replies, true, 'the report panel may now say where an answer shows')
  await r.refresh()
  assert.equal(asked, 1)
  const notify = useNotify()
  assert.equal(notify.systemCount.value, 2)
  const one = notify.systems.value.find((n) => n.id === `feedback-reply:${K(1)}:c1`)
  assert.deepEqual([one.title, one.text, one.tone, one.dismissible, one.icon], ['Wrong adapter', 'Thanks! The tile follows the bound address in 1.0.8.', 'info', true, 'forum'])
  assert.equal(one.actions[0].label, 'View')
  assert.equal(notify.systems.value.find((n) => n.id === `feedback-reply:${K(2)}:fixed:1.0.8`).text, 'Fixed, coming in 1.0.8')
  await r.refresh()
  assert.equal(asked, 1, 'the next ask is after the gap')
  await r.refresh(true)
  assert.equal(notify.systemCount.value, 2, 'an answer already shown is not shown again')
  // 查看: the sheet opens with the whole answer and the notice goes
  one.actions[0].onClick()
  assert.equal(replySheet.open, true); assert.match(replySheet.item.text, /More\.$/)
  assert.equal(notify.systemCount.value, 1)
  // the person closes the other one with the x
  notify.dismissSystem(`feedback-reply:${K(2)}:fixed:1.0.8`)
  assert.equal(notify.systemCount.value, 0)
  // a restart: nothing comes back, even when the server still answers
  resetNotify()
  const again = useFeedbackReplies({ locale: 'zh', storage: s, fetchFn, now: () => T0 + 10_000 + ASK_GAP_MS + 5, startDelayMs: 1e9, tickMs: 1e9 })
  await again.refresh()
  assert.equal(useNotify().systemCount.value, 0)
  replySheet.open = false
})

test('a notice nobody closed comes back after a restart, in the language of the new window; a server that is down or says wait changes nothing and is not asked in a loop', async () => {
  resetNotify()
  const s = memory()
  rememberReport({ key: K(1), title: '网卡磁贴' }, { storage: s, now: () => T0 })
  const r1 = useFeedbackReplies({ locale: 'zh', storage: s, fetchFn: json({ v: 1, replies: [reply(K(1), 'c1', { text: '已修复。' })] }), now: () => T0 + 100, startDelayMs: 1e9, tickMs: 1e9 })
  await r1.refresh()
  resetNotify()
  useFeedbackReplies({ locale: 'zh', storage: s, fetchFn: json({}, 503), now: () => T0 + 200, startDelayMs: 1e9, tickMs: 1e9 })
  const [n] = useNotify().systems.value
  assert.deepEqual([n.title, n.text, n.actions[0].label], ['网卡磁贴', '已修复。', '查看'])
  // a refused ask leaves the state as it was but starts the gap
  resetNotify()
  let calls = 0
  const busy = async () => { calls += 1; return { ok: false, status: 503, json: async () => ({}) } }
  const r2 = useFeedbackReplies({ locale: 'en', storage: s, fetchFn: busy, now: () => T0 + ASK_GAP_MS + 1000, startDelayMs: 1e9, tickMs: 1e9 })
  await r2.refresh(); await r2.refresh()
  assert.equal(calls, 1, 'one ask, then the gap')
  assert.equal(useNotify().systemCount.value, 1)
  assert.equal(useNotify().systems.value[0].text, '已修复。', 'the stored answer is as it was written')
})

test('the panel makes the key once per report, remembers it only when the report went, and says where an answer shows only when the product shows them', () => {
  const panel = read('src/vue/feedback/MFeedbackPanel.vue')
  assert.match(panel, /d\.reply_key = queuedReplyKey\(id\) \|\| /)
  assert.match(panel, /if \(d\.reply_key && !answer\.again\) rememberReport\(/)
  assert.match(panel, /result\.value\.reply = !!d\.reply_key && !!devProviders\(\)\.replies/)
  assert.match(panel, /v-if="result\.reply"/)
  assert.match(read('src/vue/devmode/DevReportHost.vue'), /<MFeedbackReplySheet :locale="locale" \/>/)
  assert.match(read('src/vue/index.js'), /useFeedbackReplies, replySheet/)
})
