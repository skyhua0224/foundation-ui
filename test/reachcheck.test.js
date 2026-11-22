import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { checkProgress, normalizeRun, stepIcon, stepPhaseWord, stepTitle } from '../src/settings/networkCheck.js'
import { endpointRow, normalizeReport, reachOverview, reachView } from '../src/settings/reachability.js'
import { reachTexts } from '../src/settings/reachTexts.js'
import { failureOf } from '../src/settings/remoteFlow.js'
import { createReachability } from '../src/vue/useReachability.js'
import { createNetworkCheck, timedCall } from '../src/vue/useNetworkCheck.js'
import { failureWords } from '../src/settings/reachTexts.js'

const fixture = (name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))
const report = (fn = () => {}) => { const r = fixture('reachability-public-verified'); fn(r); return r }
const run = (state, steps) => ({ version: 1, id: 'r1', state, timed_out: false, steps: steps.map(([id, st, checked = false, subject = null]) => ({ id, subject, state: st, checked })) })
const STEPS_GOING = [['listening', 'ok'], ['firewall', 'running', true], ['addresses', 'running'], ['cgnat', 'pending'], ['router', 'pending'], ['endpoint', 'pending', false, '203.0.113.9:60000']]
const STEPS_DONE = STEPS_GOING.map(([id, , , subject]) => [id, 'ok', true, subject])
const ok = (json, status = 200) => ({ ok: true, status, json })
const bad = (status) => ({ ok: false, status, json: null })
const instant = () => Promise.resolve()

// a host: the start and the polls of the run, and the report
function host({ start = ok(run('running', STEPS_GOING)), polls = [ok(run('done', STEPS_DONE))], rep = ok(report()) } = {}) {
  const calls = []
  let at = 0
  const request = async (path, init) => {
    calls.push(`${init?.method || 'GET'} ${path}`)
    if (path.startsWith('/api/network/reachability')) return typeof rep === 'function' ? rep(path) : rep
    if (init?.method === 'POST') return start
    const next = polls[Math.min(at, polls.length - 1)]
    at += 1
    return next
  }
  return { request, calls }
}
const make = (h, extra = {}) => createReachability({ request: h.request, sleep: instant, intervalMs: 1, ...extra })

// ---- the host's run as progress

test('a run is shown as the steps it has and how far each is', () => {
  const p = checkProgress(normalizeRun(run('running', STEPS_GOING)))
  assert.deepEqual(p.steps.map((s) => [stepTitle(s, 'zh'), s.phase]), [['本机端口', 'done'], ['防火墙', 'done'], ['公网地址（STUN）', 'running'], ['共享地址（CGNAT）', 'pending'], ['路由器（UPnP）', 'pending'], ['公网地址 203.0.113.9:60000', 'pending']])
  assert.equal(p.text, '2/6')
  assert.equal(checkProgress(normalizeRun(run('done', STEPS_DONE))).text, '6/6')
  assert.equal(stepTitle({ id: 'router', subject: '' }, 'en'), 'Router (UPnP)')
  assert.equal(checkProgress(null), null)
  for (const raw of [null, {}, { version: 2, id: 'a', steps: [] }, { version: 1, id: 'a' }, { version: 1, steps: [] }]) assert.equal(normalizeRun(raw), null)
})

// ---- the flow: progress, the report, failures that are shown

test('a check shows its steps as they go and reads the report when it is done', async () => {
  const h = host({ polls: [ok(run('running', STEPS_GOING)), ok(run('done', STEPS_DONE))] })
  const r = make(h)
  const seen = []
  const watch = setInterval(() => { if (r.view.progress) seen.push(r.view.progress.text) }, 0)
  const done = r.refresh(true)
  assert.equal(r.view.status, 'loading')
  await done
  clearInterval(watch)
  assert.equal(r.view.status, 'ready')
  assert.equal(r.view.progress, null)
  assert.ok(r.view.report)
  assert.deepEqual(h.calls, ['POST /api/network/check', 'GET /api/network/check?id=r1', 'GET /api/network/check?id=r1', 'GET /api/network/reachability'])
})

test('a host without the run falls back to the one blocking request', async () => {
  for (const status of [404, 444, 501]) {
    const h = host({ start: bad(status) })
    const r = make(h)
    await r.refresh(true)
    assert.equal(r.view.status, 'ready', String(status))
    assert.deepEqual(h.calls, ['POST /api/network/check', 'GET /api/network/reachability?refresh=1'])
  }
  const old = host({ start: bad(404), rep: bad(404) })
  const r = make(old)
  await r.refresh(true)
  assert.equal(r.view.status, 'unavailable')
})

test('reading what the host has is one request; a test address uses the blocking request', async () => {
  const h = host()
  const r = make(h)
  await r.refresh()
  await r.refresh(true, { test: 'a.example.net:60000' })
  assert.deepEqual(h.calls, ['GET /api/network/reachability', 'GET /api/network/reachability?refresh=1&test=a.example.net%3A60000'])
})

test('a failure is shown even when an earlier report is still there: the button never just goes back to 检测', async () => {
  const r = make(host())
  await r.refresh(true)
  const kept = r.view.report
  assert.equal(r.view.status, 'ready')
  const failing = [[bad(500), 'server', 500], [bad(403), 'auth', 403]]
  for (const [answer, reason, http] of failing) {
    const f = make(host({ start: answer }))
    f.view.report = kept
    await f.refresh(true)
    assert.equal(f.view.status, 'error', reason)
    assert.equal(f.view.report, kept, 'the last report stays beside the reason')
    assert.deepEqual([failureOf(f.view).kind, failureOf(f.view).reason, failureOf(f.view).http], ['failed-run', reason, http])
  }
  const down = createReachability({ request: async () => { throw new Error('offline') }, sleep: instant })
  down.view.report = kept
  await down.refresh(true)
  assert.equal(down.view.status, 'error')
  assert.equal(failureOf(down.view).reason, 'offline')
  const plain = make(host({ rep: bad(502) }))
  plain.view.report = kept
  await plain.refresh()
  assert.equal(plain.view.status, 'error', 'a plain read that fails is shown too')
})

test('a request that never answers ends at its timeout and says so', async () => {
  const hang = createReachability({ request: () => new Promise(() => {}), timeoutMs: 30, startTimeoutMs: 30, sleep: instant })
  await hang.refresh(true)
  assert.equal(hang.view.status, 'error')
  assert.equal(hang.view.cause, 'timeout')
  assert.equal(failureOf(hang.view).reason, 'timeout')
  assert.match(failureWords(failureOf(hang.view), 'zh').why, /没有在限定时间内答复/)
  const plain = createReachability({ request: () => new Promise(() => {}), timeoutMs: 30, sleep: instant })
  await plain.refresh()
  assert.equal(plain.view.cause, 'timeout')
  // the next click starts again: nothing stays stuck in "loading"
  await plain.refresh()
  assert.equal(plain.view.status, 'error')
})

test('the signal of the timeout reaches the product\'s request', async () => {
  let seen = null
  await timedCall(async (path, init) => { seen = init.signal; return ok({}) }, '/x', { method: 'GET' }, 1000)
  assert.ok(seen && typeof seen.aborted === 'boolean')
})

test('a second click joins the check that is going', async () => {
  const h = host()
  const r = make(h)
  const first = r.refresh(true)
  assert.equal(r.refresh(true), first)
  await first
  assert.equal(h.calls.filter((c) => c.startsWith('POST')).length, 1)
})

test('one poll that fails does not end the run, a few in a row do, and a run the host forgot ends at once', async () => {
  const flaky = make(host({ polls: [bad(502), ok(run('done', STEPS_DONE))] }))
  await flaky.refresh(true)
  assert.equal(flaky.view.status, 'ready')
  const dead = make(host({ polls: [bad(502)] }))
  await dead.refresh(true)
  assert.equal(dead.view.status, 'error')
  assert.equal(dead.view.http, 502)
  const gone = make(host({ polls: [bad(404)] }))
  await gone.refresh(true)
  assert.equal(gone.view.cause, 'offline')
})

test('a run that goes on and on is ended by its own limit', async () => {
  let clock = 0
  const h = host({ polls: [ok(run('running', STEPS_GOING))] })
  const c = createNetworkCheck({ request: h.request, sleep: async () => { clock += 20000 }, now: () => clock, maxMs: 45000 })
  await c.start()
  assert.deepEqual([c.view.status, c.view.error.kind], ['error', 'timeout'])
})

// ---- the verdicts a person reads

test('a public address this computer cannot reach itself is neutral and says why in the words of the host check', () => {
  const r = report((x) => {
    x.public.verdict = 'unknown'; x.public.reasons = ['mappings_complete']; x.public.evidence = []
    x.public.endpoints = [{ input: '203.0.113.9:60000', host: '203.0.113.9', kind: 'ip', port: 60000, port_explicit: true, https_port: 59995, resolved: ['203.0.113.9'], scope: 'public', matches_wan: true, state: 'failed', error: 'timeout', inconclusive: true, tested: { address: '203.0.113.9', port: 59995, latency_ms: 2500 }, attempts: [{ address: '203.0.113.9', port: 59995, connected: false, identity_match: false, error: 'timeout', latency_ms: 2500 }], reasons: [] }]
  })
  const v = reachView(normalizeReport(r), 'zh')
  const e = v.paths[0].endpoints[0]
  assert.deepEqual([e.tone, e.icon, e.word, e.inconclusive], ['neutral', 'help', '本机无法验证', true])
  const text = v.paths[0].reasons.find((x) => x.code === 'loopback_unverifiable')
  assert.equal(text.text, '这台电脑连不上自己的公网地址，很多路由器不支持回环，这不说明外面连不上，请用手机流量从外面试一次。')
  assert.equal(text.kind, 'note')
  assert.equal(text.action, 'outside')
  assert.notEqual(v.paths[0].verdict, 'unreachable')
  // a failure that is the host's own finding stays red
  const dns = endpointRow({ ...normalizeReport(r).public.endpoints[0], inconclusive: false, error: 'identity_mismatch' }, reachTexts('zh'))
  assert.equal(dns.tone, 'error')
})

test('UDP is a note that nothing has tried it from outside, and not red', () => {
  const unverified = reachView(normalizeReport(report((x) => { x.public.evidence = []; x.public.reasons = ['mappings_complete', 'hairpin_verified'] })), 'zh')
  const note = unverified.paths[0].reasons.find((x) => x.code === 'udp_unverified')
  assert.equal(note.text, 'UDP（画面、声音）还没有从外面验证。')
  assert.equal(note.kind, 'note')
  const notes = reachOverview(normalizeReport(report((x) => { x.public.evidence = []; x.public.reasons = ['mappings_complete'] })), 'zh').find((p) => p.id === 'public').notes
  assert.ok(notes.some((n) => n.code === 'udp_unverified' && n.kind === 'note'))
  // a session from the internet carried UDP: no note; an unreachable path has bigger things to say
  const proven = reachView(normalizeReport(report()), 'zh')
  assert.ok(!proven.paths[0].reasons.some((x) => x.code === 'udp_unverified'))
  const down = reachView(normalizeReport(report((x) => { x.public.verdict = 'unreachable'; x.public.evidence = []; x.public.reasons = ['not_listening:tcp/47989'] })), 'zh')
  assert.ok(!down.paths[0].reasons.some((x) => x.code === 'udp_unverified'))
})

test('the sentences exist in English too', () => {
  const T = reachTexts('en')
  assert.match(T.reasons.loopback_unverifiable, /cannot connect to its own public address/)
  assert.match(T.reasons.udp_unverified, /not been verified from outside/)
  assert.match(failureWords({ kind: 'failed-run', reason: 'timeout', http: 0 }, 'en').why, /did not answer in time/)
})

// ---- the outside check ----

const endpointWith = (outside) => ({ input: '203.0.113.9:60000', host: '203.0.113.9', kind: 'ip', port: 60000, port_explicit: true, https_port: 59995, ports: [{ role: 'https', port: 59995 }], resolved: ['203.0.113.9'], scope: 'public', matches_wan: true, state: 'failed', error: 'timeout', inconclusive: !outside || outside.state === 'unavailable', outside, tested: { address: '203.0.113.9', port: 59995, latency_ms: 2500 }, attempts: [{ address: '203.0.113.9', port: 59995, connected: false, identity_match: false, error: 'timeout', latency_ms: 2500 }], reasons: [] })
const withOutside = (outside, reasons = ['outside_verified', 'mappings_complete'], verdict = 'verified') => normalizeReport(report((x) => { x.public.verdict = verdict; x.public.reasons = reasons; x.public.evidence = []; x.public.endpoints = [endpointWith(outside)] }))

test('a connection from the internet that reached this host is shown as reached, in green, whatever this computer could see of its own address', () => {
  const v = reachView(withOutside({ state: 'reachable', reason: null }), 'zh')
  const e = v.paths[0].endpoints[0]
  assert.deepEqual([e.tone, e.icon, e.word, e.reached], ['ok', 'check_circle', '已从外部连通', true])
  assert.ok(v.paths[0].reasons.some((r) => r.code === 'outside_verified' && r.kind === 'good'))
  assert.ok(!v.paths[0].reasons.some((r) => r.code === 'loopback_unverifiable'), 'nothing to explain: the address works')
  const udp = v.paths[0].reasons.find((r) => r.code === 'udp_unverified_forwarded')
  assert.equal(udp.text, 'TCP 已从外部验证；UDP 未验证。路由器也转发了 UDP 端口，所以很可能可连。')
  assert.equal(udp.kind, 'note')
})

test('a connection from the internet that found nothing is red with its reason and the fix, and another device answering is named', () => {
  for (const [state, word] of [['closed', '外部连不上：端口关闭'], ['timeout', '外部连不上：没有应答'], ['another_host', '外部连到的是另一台设备']]) {
    const v = reachView(withOutside({ state, reason: null }, ['not_reached_from_outside'], 'unreachable'), 'zh')
    const e = v.paths[0].endpoints[0]
    assert.deepEqual([e.tone, e.word], ['error', word], state)
    const r = v.paths[0].reasons.find((x) => x.code === 'not_reached_from_outside')
    assert.equal(r.action, 'forward')
  }
})

test('an outside check that could not run says what the result rests on and is never red', () => {
  const v = reachView(withOutside({ state: 'unavailable', reason: 'no_answer' }, ['mappings_complete'], 'unknown'), 'zh')
  const e = v.paths[0].endpoints[0]
  assert.equal(e.tone, 'neutral')
  assert.equal(e.word, '本机无法验证')
  const note = v.paths[0].reasons.find((x) => x.code === 'outside_unavailable')
  assert.equal(note.text, '外部验证现在不可用，这个结果只来自这台电脑自己。')
  assert.equal(note.kind, 'note')
  assert.notEqual(v.paths[0].verdict, 'unreachable')
  // when it was not asked there is no note at all
  const off = reachView(withOutside(null, ['mappings_complete'], 'unknown'), 'zh')
  assert.ok(!off.paths[0].reasons.some((x) => x.code === 'outside_unavailable'))
})

test('the outside sentences exist in English', () => {
  const T = reachTexts('en')
  assert.match(T.reasons.outside_unavailable, /not available now/)
  assert.match(T.reasons.udp_unverified_forwarded, /UDP is not/)
  assert.equal(T.endpoint.outsideReached, 'Reached from outside')
})

// ---- review round 1

test('an answer that is not a check result is "bad-answer" even though its HTTP status was 200; refusals and host failures keep their kind', async () => {
  const kept = createReachability({ request: async () => ok(report()) })
  await kept.refresh()
  const h = host({ rep: () => ok({}, 200) })
  const r = make(h)
  r.view.report = kept.view.report
  await r.refresh()
  assert.equal(r.view.status, 'error')
  assert.equal(r.view.report, kept.view.report, 'an answer that is no report does not remove the report this host gave before')
  assert.deepEqual([failureOf(r.view).reason, failureOf(r.view).http], ['bad-answer', 200])
  assert.equal(failureOf({ status: 'error', http: 403, cause: '' }).reason, 'auth')
  assert.equal(failureOf({ status: 'error', http: 502, cause: '' }).reason, 'server')
  // a first read that is no report is still an older host
  const first = make(host({ rep: () => ok({}, 200) }))
  await first.refresh()
  assert.equal(first.view.status, 'unavailable')
})

test('a step that failed does not look like one that passed, and a screen reader gets words for every phase', () => {
  const steps = [['listening', 'ok'], ['firewall', 'fail'], ['addresses', 'warn'], ['cgnat', 'skipped'], ['router', 'running'], ['endpoint', 'pending', false, 'a.example.net:60000']]
  const p = checkProgress(normalizeRun(run('running', steps)))
  assert.deepEqual(p.steps.map(stepIcon), ['check_circle', 'error', 'info', 'do_not_disturb_on', 'sync', 'radio_button_unchecked'])
  assert.deepEqual(p.steps.map((s) => stepPhaseWord(s, 'zh')), ['通过', '未通过', '通过但有提示', '已跳过', '检测中', '等待'])
  assert.equal(stepPhaseWord(p.steps[1], 'en'), 'failed')
  assert.equal(p.done, 4, 'the count of finished steps is unchanged')
})

test('the run keeps to one deadline: a poll is not allowed to run past it, and an answer after it is not taken', async () => {
  const began = Date.now()
  const stuck = createNetworkCheck({ request: async (path, init) => (init?.method === 'POST' ? ok(run('running', STEPS_GOING)) : new Promise(() => {})), maxMs: 150, intervalMs: 5, pollTimeoutMs: 6000, startTimeoutMs: 6000 })
  await stuck.start()
  assert.deepEqual([stuck.view.status, stuck.view.error.kind], ['error', 'timeout'])
  assert.ok(Date.now() - began < 1500, 'it ended at the deadline, not at the poll timeout')
  let t = 0
  const late = createNetworkCheck({ request: async (path, init) => { if (init?.method === 'POST') return ok(run('running', STEPS_GOING)); t = 50000; return ok(run('done', STEPS_DONE)) }, now: () => t, sleep: instant })
  await late.start()
  assert.deepEqual([late.view.status, late.view.error.kind], ['error', 'timeout'], 'a "done" that came after the deadline is not a result')
  t = 0
  const inTime = createNetworkCheck({ request: async (path, init) => (init?.method === 'POST' ? ok(run('running', STEPS_GOING)) : ok(run('done', STEPS_DONE))), now: () => t, sleep: instant })
  await inTime.start()
  assert.equal(inTime.view.status, 'done')
})

test('a run that has started never falls back to the older host\'s check: polls that fail are a failure of the run', async () => {
  const h = host({ polls: [bad(501), bad(501), bad(501)] })
  const r = make(h)
  await r.refresh(true)
  assert.equal(r.view.status, 'error')
  assert.equal(failureOf(r.view).reason, 'server')
  assert.ok(!h.calls.some((c) => c.includes('refresh=1')), 'the check was not started a second time')
  const older = make(host({ start: bad(501) }))
  await older.refresh(true)
  assert.equal(older.view.status, 'ready', 'a start answered with "no such route" is still the older host, which the blocking request serves')
})

test('a request to test an address that arrives while a run is going waits for it and is made after it, never dropped', async () => {
  const h = host({ polls: [ok(run('running', STEPS_GOING)), ok(run('done', STEPS_DONE))] })
  const r = make(h)
  const first = r.refresh(true)
  const same = r.refresh(true)
  assert.equal(same, first, 'the same forced refresh shares the run')
  const a = r.refresh(true, { test: 'a.example.net:60000' })
  const b = r.refresh(true, { test: 'b.example.net:60000' })
  assert.notEqual(a, first)
  await Promise.all([first, a, b])
  const tests = h.calls.filter((c) => c.includes('test='))
  assert.deepEqual(tests, ['GET /api/network/reachability?refresh=1&test=a.example.net%3A60000', 'GET /api/network/reachability?refresh=1&test=b.example.net%3A60000'])
  const lastRun = h.calls.lastIndexOf('POST /api/network/check')
  assert.ok(h.calls.indexOf(tests[0]) > lastRun, 'after the run, in the order asked')
  assert.equal(r.view.status, 'ready')
})

test('a connection from the internet that did not reach outranks what this computer saw of its own address', () => {
  const T = reachTexts('zh')
  const ep = normalizeReport(fixture('reachability-endpoints')).public.endpoints[0]
  const closed = endpointRow({ ...ep, reached: true, outside: { state: 'closed' } }, T)
  assert.deepEqual([closed.tone, closed.reached, closed.word], ['error', false, T.endpoint.outsideErrors.closed])
  const ok1 = endpointRow({ ...ep, reached: false, outside: { state: 'reachable' } }, T)
  assert.deepEqual([ok1.tone, ok1.reached, ok1.word], ['ok', true, T.endpoint.outsideReached])
  const own = endpointRow({ ...ep, reached: true, outside: null }, T)
  assert.deepEqual([own.tone, own.reached], ['ok', true])
})

// ---- review round 2

test('a read asked for between a run and the test that waits for it does not run beside it', async () => {
  const h = host({ polls: [ok(run('running', STEPS_GOING)), ok(run('done', STEPS_DONE))] })
  const r = make(h)
  const first = r.refresh(true)
  let between = null
  first.then(() => { between = r.refresh() })
  const waiting = r.refresh(true, { test: 'a.example.net:60000' })
  await Promise.all([first, waiting])
  await between
  assert.equal(h.calls.filter((c) => c === 'GET /api/network/reachability').length, 1, 'only the run read the cached report; the plain read joined what was waiting')
  assert.equal(r.view.status, 'ready')
})

test('the steps list of the overview follows the real loading state of the component, never an undeclared prop', () => {
  const vue = fs.readFileSync(new URL('../src/vue/MReachOverview.vue', import.meta.url), 'utf8')
  assert.match(vue, /const running = computed\(\(\) => !!\(loading\.value && props\.progress/)
  assert.ok(!/props\.loading/.test(vue), 'props has no `loading`')
})

// ---- the outside check behind a proxy on the router, or out of budget

test('a proxy on the router is a note with its own sentence, never red, said once', () => {
  for (const locale of ['zh', 'en']) {
    const T = reachTexts(locale)
    // the host names the reason itself, and the sentence is said once whether or not the report also lists it
    for (const reasons of [['outside_router_proxy', 'mappings_complete'], ['mappings_complete']]) {
      const v = reachView(withOutside({ state: 'unavailable', reason: 'router_proxy', caller: '198.51.100.7' }, reasons, 'likely'), locale)
      const found = v.paths[0].reasons.filter((r) => r.code === 'outside_router_proxy')
      assert.equal(found.length, 1, `${locale}: once`)
      assert.equal(found[0].kind, 'note')
      assert.equal(found[0].text, T.reasons.outside_router_proxy)
      assert.ok(!v.paths[0].reasons.some((r) => r.code === 'outside_unavailable'), `${locale}: not the general sentence as well`)
      assert.notEqual(v.paths[0].verdict, 'unreachable')
      assert.notEqual(v.paths[0].endpoints[0].tone, 'error')
    }
  }
  assert.match(reachTexts('zh').reasons.outside_router_proxy, /路由器层面走了代理/)
  assert.equal(withOutside({ state: 'unavailable', reason: 'router_proxy', caller: '198.51.100.7' }).public.endpoints[0].outside.caller, '198.51.100.7')
})

test('a service that has used up its day says so and asks to come back tomorrow, not that something is wrong', () => {
  for (const locale of ['zh', 'en']) {
    const T = reachTexts(locale)
    const v = reachView(withOutside({ state: 'unavailable', reason: 'budget', caller: '' }, ['mappings_complete'], 'likely'), locale)
    const found = v.paths[0].reasons.find((r) => r.code === 'outside_budget')
    assert.equal(found.text, T.reasons.outside_budget, locale)
    assert.ok(!v.paths[0].reasons.some((r) => r.code === 'outside_unavailable'), locale)
  }
  assert.match(reachTexts('zh').reasons.outside_budget, /次数已用尽/)
  // any other reason is still the general sentence
  const other = reachView(withOutside({ state: 'unavailable', reason: 'no_answer', caller: '' }, ['mappings_complete'], 'likely'), 'en')
  assert.ok(other.paths[0].reasons.some((r) => r.code === 'outside_unavailable'))
})

test('endpoints with different reasons each get their own sentence, and the general one stays for a reason without one', () => {
  const x = reachView(normalizeReport(report((r) => {
    r.public.verdict = 'likely'; r.public.reasons = ['mappings_complete']
    const base = fixture('reachability-endpoints').public.endpoints[0]
    r.public.endpoints = [{ ...base, input: 'a.example.net:60000', outside: { state: 'unavailable', reason: 'router_proxy', caller: '198.51.100.7' } },
      { ...base, input: 'b.example.net:60000', outside: { state: 'unavailable', reason: 'budget' } },
      { ...base, input: 'c.example.net:60000', outside: { state: 'unavailable', reason: 'no_answer' } }]
  })), 'en')
  const codes = x.paths[0].reasons.map((r) => r.code)
  for (const code of ['outside_router_proxy', 'outside_budget', 'outside_unavailable']) assert.equal(codes.filter((c) => c === code).length, 1, code)
})
