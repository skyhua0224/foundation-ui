import test from 'node:test'
import assert from 'node:assert/strict'
import { DEV_REPOS, DEFAULT_REPO, newIssueUrl, repoForArea, repoSlug, visibleRepos } from '../src/devmode/repos.js'
import { BACKEND_KEY, configureDevBackend, devBackend } from '../src/devmode/config.js'
import { API, createGithubClient, normalize, ago } from '../src/devmode/github.js'
import { composeReport, redactText, reportIssueUrl, reportZip, sendThroughBackend, zipName } from '../src/devmode/feedback.js'
import { createSignIn, readSession, SESSION_KEY } from '../src/devmode/signin.js'
import { addMine, listMine } from '../src/devmode/mine.js'
import { devmodeTexts } from '../src/devmode/texts.js'
import { zipList } from '../src/diagnostics/zip.js'
import { makePng } from './pngFixture.js'
import { buildGroups, flattenGroups } from '../src/contextmenu/builders.js'
import { contextTexts } from '../src/contextmenu/texts.js'

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), m } }
const headers = (h) => ({ get: (k) => h[String(k).toLowerCase()] ?? null })
const reply = (status, body, h = {}) => ({ status, ok: status >= 200 && status < 300, headers: headers(h), json: async () => body, text: async () => JSON.stringify(body) })
const raw = (n, extra = {}) => ({ number: n, title: `t${n}`, state: 'open', labels: [{ name: 'bug' }], user: { login: 'u' }, updated_at: '2026-11-09T10:00:00Z', created_at: '2026-11-09T09:00:00Z', comments: 2, body: 'b', html_url: `https://github.com/x/y/issues/${n}`, ...extra })

test('the repositories are the five confirmed ones, the private one only with access, and nothing else', () => {
  assert.deepEqual(DEV_REPOS.map((r) => repoSlug(r.id)), ['AlkaidLab/foundation-sunshine', 'qiin2333/sunshine-control-panel', 'qiin2333/zako-vdd', 'AlkaidLab/ZakoVirtualMouse', 'AlkaidLab/moonlight-audio-haptics'])
  assert.equal(DEV_REPOS.length, 5)
  assert.equal(visibleRepos({ signedIn: false }).some((r) => r.name === 'ZakoVirtualMouse'), false)
  assert.equal(visibleRepos({ signedIn: true }).some((r) => r.name === 'ZakoVirtualMouse'), true)
  for (const banned of ['qiin2333/Sunshine', 'qiin2333/Sunshine-Foundation', 'AlkaidLab/black-sunshine']) assert.equal(DEV_REPOS.some((r) => `${r.owner}/${r.name}` === banned), false)
})

test('a report goes to the repository of its place; the web issue address is filled in and stays short enough', () => {
  assert.equal(repoForArea('vdd-settings'), 'vdd'); assert.equal(repoForArea('audio-haptics'), 'ah'); assert.equal(repoForArea('virtual-mouse'), 'vm'); assert.equal(repoForArea('live-session'), DEFAULT_REPO)
  const u = new URL(newIssueUrl('vdd', { title: 'a b', body: 'x'.repeat(20000) }))
  assert.equal(u.origin + u.pathname, 'https://github.com/qiin2333/zako-vdd/issues/new')
  assert.equal(u.searchParams.get('title'), 'a b')
  assert.ok(u.href.length <= 7200, String(u.href.length))
})

test('backend config: empty is 未配置, an address needs https (or this computer), the stored values of the window win', () => {
  const s = memory()
  assert.equal(devBackend(s).configured, false)
  configureDevBackend({ workerUrl: 'https://fb.example.workers.dev/', clientId: 'Iv1.abcdef0123' })
  assert.deepEqual(devBackend(s), { workerUrl: 'https://fb.example.workers.dev', clientId: 'Iv1.abcdef0123', configured: true })
  s.setItem(BACKEND_KEY, JSON.stringify({ workerUrl: 'http://evil.example/x' }))
  assert.equal(devBackend(s).configured, false, 'plain http to another computer is refused')
  s.setItem(BACKEND_KEY, JSON.stringify({ workerUrl: 'http://127.0.0.1:8787' }))
  assert.equal(devBackend(s).workerUrl, 'http://127.0.0.1:8787')
  configureDevBackend({ workerUrl: '', clientId: '' })
  s.removeItem(BACKEND_KEY)
  assert.equal(devBackend(s).configured, false)
})

test('github list: pull requests leave the issues, a repeat inside five minutes is the cache, ETag 304 revalidates', async () => {
  const calls = []
  let clock = 1_000_000
  const answers = [reply(200, [raw(1), raw(2, { pull_request: {} }), raw(3)], { etag: 'W/"a"', 'x-ratelimit-remaining': '58', 'x-ratelimit-limit': '60', 'x-ratelimit-reset': '2000000' }), reply(304, null, { 'x-ratelimit-remaining': '58' })]
  const client = createGithubClient({ storage: memory(), now: () => clock, fetchImpl: async (url, init) => { calls.push({ url, init }); return answers.shift() } })
  const a = await client.list('fs', 'issue')
  assert.equal(a.state, 'ok'); assert.deepEqual(a.items.map((i) => i.n), [1, 3])
  assert.ok(calls[0].url.startsWith(`${API}/repos/AlkaidLab/foundation-sunshine/issues?state=open`))
  assert.equal(calls[0].init.method, 'GET'); assert.equal(calls[0].init.headers.authorization, undefined, 'no account, no credential')
  clock += 60_000
  assert.equal((await client.list('fs', 'issue')).fromCache, true); assert.equal(calls.length, 1)
  clock += 6 * 60_000
  const c = await client.list('fs', 'issue')
  assert.equal(calls.length, 2); assert.equal(calls[1].init.headers['if-none-match'], 'W/"a"')
  assert.equal(c.state, 'ok'); assert.equal(c.items.length, 2)
  assert.deepEqual(normalize(raw(5, { merged_at: 'x' }), 'fs', 'pr').state, 'merged')
  assert.equal(normalize(raw(6, { draft: true }), 'fs', 'pr').state, 'draft')
})

test('github list: the used-up limit says when it comes back and keeps the last items; offline and a private repository have their states', async () => {
  let mode = 'ok'
  let clock = 5_000_000
  const client = createGithubClient({ storage: memory(), now: () => clock, fetchImpl: async () => {
    if (mode === 'offline') throw new TypeError('fetch failed')
    if (mode === 'rate') return reply(403, {}, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor((clock + 1_800_000) / 1000)) })
    if (mode === 'hidden') return reply(404, {})
    return reply(200, [raw(1)])
  } })
  assert.equal((await client.list('fs', 'issue')).state, 'ok')
  clock += 400_000
  mode = 'rate'
  const r = await client.list('fs', 'issue')
  assert.equal(r.state, 'rate'); assert.equal(r.stale, true); assert.equal(r.items.length, 1); assert.ok(r.resetAt > clock)
  mode = 'ok'
  assert.equal((await client.list('cp', 'issue')).state, 'rate', 'no request while the window is not over')
  mode = 'offline'; clock += 3_600_000
  const o = await client.list('fs', 'issue', { force: true })
  assert.equal(o.state, 'offline'); assert.equal(o.items.length, 1)
  mode = 'hidden'
  assert.equal((await client.list('vm', 'issue')).state, 'forbidden')
})

test('relative time in both languages', () => {
  const now = Date.parse('2026-11-09T12:00:00Z')
  assert.equal(ago('2026-11-09T11:48:00Z', { now, locale: 'zh' }), '12 分钟前'); assert.equal(ago('2026-11-09T11:48:00Z', { now, locale: 'en' }), '12 min ago')
  assert.equal(ago('2026-11-08T11:00:00Z', { now, locale: 'zh' }), '昨天'); assert.equal(ago('', { now }), '')
})

test('redaction: user folders, addresses, names and secrets are gone from the text that is shown and sent', () => {
  const text = 'open C:\\Users\\Alice\\AppData\\x.log on host DESK-ALICE 192.168.1.23 token=abcdef123456 password: hunter2'
  const r = redactText(text, { hostNames: ['DESK-ALICE'] })
  assert.ok(!/Alice|192\.168\.1\.23|hunter2|abcdef123456/.test(r.text), r.text)
  assert.ok(r.counts.paths >= 1 && r.counts.secrets >= 1 && r.counts.ips >= 1)
})

const png = makePng(8, 6)
const base = { kind: 'error', repo: 'fs', error: { name: 'TypeError', message: 'x is undefined at C:\\Users\\Bob\\a.js', code: 'host-stop', stack: 'at f (C:\\Users\\Bob\\a.js:1)' }, env: 'os: Windows 11', logs: '[2026-11-09 10:00:00] [ERROR] boom 10.0.0.7\n', screenshot: png }

test('an error report attaches the screenshot and the log by default, the dump never; the person can untick each', () => {
  const r = composeReport(base)
  assert.deepEqual(r.files.map((f) => f.id), ['shot', 'logs']); assert.equal(r.problems.length, 0)
  assert.ok(!/Bob|10\.0\.0\.7/.test(r.body + r.files[1].bytes.length), 'redacted')
  assert.ok(!/Bob/.test(r.title))
  assert.deepEqual(composeReport({ ...base, include: { shot: false } }).files.map((f) => f.id), ['logs'])
  assert.deepEqual(composeReport({ ...base, include: { shot: false, logs: false } }).files, [])
  assert.deepEqual(composeReport({ ...base, dump: new Uint8Array(4) }).files.some((f) => f.id === 'dump'), false, 'not asked: not attached')
  const withDump = composeReport({ ...base, dump: new Uint8Array(4), include: { dump: true } })
  assert.equal(withDump.files.find((f) => f.id === 'dump').risk, true)
})

test('feedback needs a title and a few words; an error gets its title from the error', () => {
  assert.deepEqual(composeReport({ kind: 'feedback', repo: 'fs' }).problems, ['title', 'description'])
  assert.deepEqual(composeReport({ kind: 'feedback', repo: 'fs', title: 'a', description: 'b' }).problems, [])
  assert.match(composeReport(base).title, /^TypeError/)
})

test('no account: the zip holds the report, the environment, the log and the screenshot, and the issue page is on the right repository', () => {
  const r = composeReport({ ...base, repo: 'vdd' })
  const zip = reportZip(r, new Date(2026, 10, 9, 20, 30, 5))
  assert.equal(zip.name, 'foundation-report-20261109-203005.zip'); assert.equal(zipName(new Date(2026, 10, 9, 1, 2, 3)), 'foundation-report-20261109-010203.zip')
  assert.deepEqual(zipList(zip.bytes).map((e) => e.name).sort(), ['environment.txt', 'logs.txt', 'report.md', 'screenshot.png'])
  const url = new URL(reportIssueUrl(r, { zip: 'x.zip' }))
  assert.equal(url.pathname, '/qiin2333/zako-vdd/issues/new'); assert.match(url.searchParams.get('body'), /x\.zip/)
})

test('the backend path: 未配置 and signed out are told apart; with both it uploads each attachment then creates the issue; the states of a bad day', async () => {
  const r = composeReport(base)
  const backend = { workerUrl: 'https://w.example', clientId: 'Iv1.abcdef0123', configured: true }
  assert.equal((await sendThroughBackend({ report: r, session: { handle: 'h' }, backend: { configured: false } })).state, 'unconfigured')
  assert.equal((await sendThroughBackend({ report: r, session: null, backend })).state, 'signedout')
  const calls = []
  const ok = await sendThroughBackend({ report: r, session: { handle: 'h1' }, backend, fetchImpl: async (url, init) => { calls.push({ url, init }); return url.includes('/attachment') ? reply(200, { id: `a${calls.length}`, expires_at: 'z' }) : reply(200, { number: 12, url: 'https://github.com/AlkaidLab/foundation-sunshine/issues/12' }) } })
  assert.equal(ok.state, 'sent'); assert.equal(ok.number, 12)
  assert.deepEqual(calls.map((c) => new URL(c.url).pathname), ['/feedback/attachment', '/feedback/attachment', '/feedback/issue'])
  assert.equal(calls[0].init.headers.authorization, 'Bearer h1')
  assert.deepEqual(JSON.parse(calls[2].init.body).attachments, ['a1', 'a2'])
  assert.equal((await sendThroughBackend({ report: r, session: { handle: 'h' }, backend, fetchImpl: async () => { throw new TypeError('x') } })).state, 'queued')
  assert.equal((await sendThroughBackend({ report: r, session: { handle: 'h' }, backend, fetchImpl: async () => reply(401, {}) })).state, 'signedout')
  assert.equal((await sendThroughBackend({ report: r, session: { handle: 'h' }, backend, fetchImpl: async () => reply(429, {}) })).state, 'limited')
})

test('sign-in: nothing is asked without the backend; with it the code, the polling states and the session handle that is kept (never a token)', async () => {
  const s = memory()
  const off = createSignIn({ storage: s, backend: () => ({ configured: false }), fetchImpl: async () => { throw new Error('no request') } })
  assert.equal((await off.start()).state, 'unconfigured'); assert.equal((await off.poll('x')).state, 'unconfigured')
  const backend = () => ({ workerUrl: 'https://w.example', clientId: 'Iv1.abcdef0123', configured: true })
  const steps = [reply(200, { user_code: 'AB12-CD34', verification_uri: 'https://github.com/login/device', device_ref: 'd1', interval: 5, expires_in: 900 }), reply(200, { status: 'pending' }), reply(200, { status: 'slow_down' }), reply(200, { status: 'authorized', session: 'S1', login: 'sky' }), reply(200, {})]
  const on = createSignIn({ storage: s, backend, now: () => 0, fetchImpl: async () => steps.shift() })
  const c = await on.start()
  assert.equal(c.code, 'AB12-CD34'); assert.equal(c.expiresAt, 900_000)
  assert.equal((await on.poll('d1')).state, 'pending'); assert.equal((await on.poll('d1')).state, 'slow')
  const done = await on.poll('d1')
  assert.equal(done.state, 'signed'); assert.deepEqual(readSession(s), { handle: 'S1', login: 'sky', at: 0 })
  await on.signOut(); assert.equal(s.getItem(SESSION_KEY), null)
  for (const [status, state] of [['denied', 'denied'], ['expired', 'expired']]) assert.equal((await createSignIn({ storage: s, backend, fetchImpl: async () => reply(200, { status }) }).poll('d')).state, state)
  assert.equal((await createSignIn({ storage: s, backend, fetchImpl: async () => { throw new TypeError('x') } }).poll('d')).state, 'offline')
})

test('my feedback is kept, newest first, at most thirty', () => {
  const s = memory()
  for (let i = 0; i < 35; i += 1) addMine({ title: `t${i}`, repo: 'fs', status: 'saved' }, s, () => i)
  assert.equal(listMine(s).length, 30); assert.equal(listMine(s)[0].title, 't34')
})

test('every word exists in both languages, and the English one is not Chinese', () => {
  const zh = devmodeTexts('zh'); const en = devmodeTexts('en')
  const walk = (a, b, path = '') => { for (const k of Object.keys(a)) { assert.ok(k in b, `${path}${k} missing in en`); if (a[k] && typeof a[k] === 'object') walk(a[k], b[k], `${path}${k}.`); else assert.ok(!/[\u4e00-\u9fff]/.test(b[k]), `${path}${k} is Chinese in en`) } }
  walk(zh, en)
})

test('the context menu: 反馈此处问题 is for everyone; with developer mode a 「开发者」 section closes the menu (tools, route); the Web UI says which key; nothing developer without the mode', () => {
  const T = contextTexts('zh')
  const body = { getAttribute: () => null, parentElement: null, tagName: 'DIV' }
  const target = { field: null, selection: '', link: '', image: '', owners: [], blank: true }
  const ctx = (o = {}) => ({ T, cb: { openDevtools: () => {}, reportHere: () => {}, ...(o.cb || {}) }, caps: { product: 'panel', ...(o.caps || {}) }, platform: 'Win32', mode: 'system' })
  void body
  const plain = buildGroups(target, ctx())
  assert.equal(plain.flat().find((i) => i.id === 'dev-report')?.label, '反馈此处的问题', 'report here shows with developer mode off')
  assert.equal(plain.flat().some((i) => i.id === 'dev-head' || i.id === 'dev-tools'), false)
  const g = buildGroups(target, ctx({ caps: { developer: true } }))
  const sect = g.at(-1)
  assert.deepEqual(sect.map((i) => i.id), ['dev-head', 'dev-tools', 'copy-route']); assert.equal(sect[0].section, true); assert.equal(sect[0].label, '开发者')
  assert.ok(g.at(-2).page, 'the page group stays before the section')
  const web = buildGroups(target, ctx({ caps: { developer: true, product: 'web' }, cb: { openDevtools: null } }))
  assert.deepEqual(web.at(-1).map((i) => i.id), ['dev-head', 'dev-tools-hint', 'copy-route']); assert.equal(web.at(-1)[1].shortcut, 'F12')
  assert.equal(buildGroups(target, ctx({ caps: { developer: true }, cb: { reportHere: null } })).flat().some((i) => i.id === 'dev-report'), false, 'no callback, no item')
  assert.ok(g.at(-2).some((i) => i.id === 'dev-report'), 'the item sits in the page group, not in the developer section')
  // the page group still folds into one item when the menu is long, with the section behind it
  const flat = flattenGroups(g, T, 3)
  assert.equal(flat.some((i) => i.id === 'page'), true); assert.equal(flat.at(-1).id, 'copy-route')
})

test('the rail dot: the first check only sets the mark, later a newer update shows it, looking at the page clears it', async () => {
  const { createActivity, SEEN_KEY } = await import('../src/devmode/activity.js')
  const s = memory()
  let clock = Date.parse('2026-11-09T10:00:00Z')
  let at = '2026-11-09T09:00:00Z'
  let state = 'ok'
  const client = { list: async (repo, kind) => ({ state, items: kind === 'issue' ? [{ at }] : [] }) }
  const a = createActivity({ client, storage: s, now: () => clock })
  assert.equal(await a.check(), false); assert.ok(Number(s.getItem(SEEN_KEY)) > 0, 'a new window starts without a dot')
  clock += 60_000
  assert.equal(await a.check(), false, 'nothing newer')
  at = '2026-11-09T10:05:00Z'
  assert.equal(await a.check(), true)
  state = 'rate'
  assert.equal(await a.check(), false, 'an answer that is not ok shows nothing')
  state = 'ok'; clock = Date.parse('2026-11-09T10:10:00Z'); a.markSeen()
  assert.equal(await a.check(), false)
})

test('the shared client reads through the Worker only when the backend is configured and the person is signed in; the handle is the credential, never a GitHub token', async () => {
  const { sharedGithubClient } = await import('../src/devmode/github.js')
  const { SESSION_KEY } = await import('../src/devmode/signin.js')
  const store = memory()
  const old = globalThis.localStorage
  globalThis.localStorage = store
  const seen = []
  const oldFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => { seen.push({ url, init }); return reply(200, [raw(1)]) }
  try {
    const client = sharedGithubClient()
    await client.list('fs', 'issue', { force: true })
    assert.ok(seen[0].url.startsWith('https://api.github.com/repos/'), seen[0].url); assert.equal(seen[0].init.headers.authorization, undefined)
    configureDevBackend({ workerUrl: 'https://fb.example.workers.dev', clientId: 'Iv1.abcdef0123' })
    store.setItem(SESSION_KEY, JSON.stringify({ handle: 'H-1', login: 'u', at: 1 }))
    await client.list('cp', 'issue', { force: true })
    assert.ok(seen[1].url.startsWith('https://fb.example.workers.dev/github/repos/qiin2333/sunshine-control-panel/issues'), seen[1].url); assert.equal(seen[1].init.headers.authorization, 'Bearer H-1')
  } finally { globalThis.fetch = oldFetch; globalThis.localStorage = old; configureDevBackend({ workerUrl: '', clientId: '' }) }
})
