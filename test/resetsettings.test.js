// 恢复默认设置: the host calls, the countdown of the confirm button, the words in both languages, the search that finds it, and the page and the question as they render.
import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { RESET_KEYWORDS, RESET_SECONDS, backupTime, backupView, countdownLabel, createCountdown, createLatest, createResetClient, failureText, fill, latestBackup, resetTexts } from '../src/reset/index.js'
import { ACTION_DEFS, actionDocs, searchTexts } from '../src/search/texts.js'
import { buildIndex, search } from '../src/search/index.js'
import { diagnosticsTexts } from '../src/diagnostics/texts.js'
import { scanText } from '../scripts/copy-lint.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let server, mod
before(async () => {
  server = await createServer({ root, configFile: false, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('md-') } } })] })
  mod = await server.ssrLoadModule('/src/vue/index.js')
})
after(async () => { await server?.close() })

const answer = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => { if (body === undefined) throw new Error('no body'); return body } })
function fakeFetch(reply) {
  const calls = []
  const fetcher = async (path, init) => { calls.push({ path, init }); return typeof reply === 'function' ? reply(path, init) : reply }
  return { fetcher, calls }
}

test('the host calls: the paths, the methods and the JSON bodies', async () => {
  const { fetcher, calls } = fakeFetch(answer(200, { status: true }))
  const client = createResetClient(fetcher)
  await client.status()
  await client.reset(true)
  await client.reset()
  await client.restore()
  assert.deepEqual(calls.map((c) => [c.init.method, c.path]), [['GET', '/api/config/reset'], ['POST', '/api/config/reset'], ['POST', '/api/config/reset'], ['POST', '/api/config/reset/restore']])
  assert.equal(calls[0].init.body, undefined)
  assert.equal(calls[0].init.headers, undefined)
  assert.deepEqual(JSON.parse(calls[1].init.body), { clear_apps: true })
  assert.deepEqual(JSON.parse(calls[2].init.body), { clear_apps: false })
  assert.deepEqual(JSON.parse(calls[3].init.body), {})
  for (const call of calls.slice(1)) assert.equal(call.init.headers['Content-Type'], 'application/json')
})

test('an answer is ok with the data, or not ok with one word of the host', async () => {
  assert.deepEqual(await createResetClient(fakeFetch(answer(200, { status: true, backup: '20261119-153012' })).fetcher).reset(), { ok: true, data: { status: true, backup: '20261119-153012' } })
  assert.deepEqual(await createResetClient(fakeFetch(answer(409, { status: false, code: 'busy' })).fetcher).reset(), { ok: false, code: 'busy', status: 409 })
  assert.deepEqual(await createResetClient(fakeFetch(answer(404, { status: false, code: 'no_backup' })).fetcher).restore(), { ok: false, code: 'no_backup', status: 404 })
  // a 403 without a body (the CSRF token was refused) and a 200 that says it failed
  assert.deepEqual(await createResetClient(fakeFetch(answer(403)).fetcher).reset(), { ok: false, code: 'http_403', status: 403 })
  assert.deepEqual((await createResetClient(fakeFetch(answer(200, { status: false })).fetcher).reset()).ok, false)
  const down = createResetClient(async () => { throw new TypeError('network') })
  assert.deepEqual(await down.reset(), { ok: false, code: 'unreachable' })
})

test('the newest backup, its time and the filled words', () => {
  const status = { backups: [{ stamp: 'b', created_ms: 2000, has_apps: true }, { stamp: 'a', created_ms: 1000 }] }
  assert.equal(latestBackup(status).stamp, 'b')
  assert.equal(latestBackup({ backups: [] }), null)
  assert.equal(latestBackup(null), null)
  assert.equal(backupTime(0), '')
  assert.equal(backupTime(NaN), '')
  assert.match(backupTime(Date.UTC(2026, 10, 19, 7, 30), 'en'), /2026/)
  assert.equal(fill('Backed up {time}', { time: 'now' }), 'Backed up now')
  assert.equal(fill('{a} {missing}', { a: 1 }), '1 {missing}')
})

test('the confirm button counts down five seconds and is ready only after the last one', () => {
  assert.equal(RESET_SECONDS, 5)
  const c = createCountdown()
  assert.equal(c.ready, false, 'not started')
  c.start()
  for (let i = 0; i < 4; i += 1) { c.tick(); assert.equal(c.ready, false, `${i + 1} s`) }
  assert.equal(c.state.remaining, 1)
  c.tick()
  assert.equal(c.state.remaining, 0)
  assert.equal(c.ready, true)
  c.tick()
  assert.equal(c.state.remaining, 0, 'it does not go below zero')
  c.start()
  assert.equal(c.ready, false, 'a question that opens again starts again')
  c.tick(); c.stop()
  assert.equal(c.ready, false, 'a question that is closed does not become ready')
})

test('the label shows the seconds left, and the plain label once it can be pressed', () => {
  for (const [locale, label, counting] of [['zh', '恢复默认', '恢复默认（5 秒）'], ['en', 'Restore defaults', 'Restore defaults (5 s)']]) {
    const T = resetTexts(locale)
    assert.equal(T.host.confirm, label)
    assert.equal(countdownLabel(T, label, 5), counting)
    assert.equal(countdownLabel(T, label, 1), counting.replace('5', '1'))
    assert.equal(countdownLabel(T, label, 0), label)
  }
})

test('useCountdown ticks once a second, is ready after the last tick, and stops its timer', async () => {
  const { useCountdown } = await server.ssrLoadModule('/src/vue/useCountdown.js')
  const timers = []
  const cleared = []
  const c = useCountdown(3, { setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length }, clearTimer: (id) => cleared.push(id) })
  c.begin()
  assert.equal(timers[0].ms, 1000)
  assert.deepEqual([c.remaining.value, c.ready.value], [3, false])
  timers[0].fn(); timers[0].fn()
  assert.deepEqual([c.remaining.value, c.ready.value], [1, false])
  timers[0].fn()
  assert.deepEqual([c.remaining.value, c.ready.value], [0, true])
  assert.deepEqual(cleared, [1], 'the timer stops itself at zero')
  c.begin()
  assert.deepEqual([c.remaining.value, c.ready.value], [3, false], 'opening again starts again')
  c.end()
  assert.deepEqual(cleared, [1, 2])
})

test('every word exists in both languages with the same shape, and none of them talks about telemetry', () => {
  const shape = (value, prefix = '') => Object.entries(value).flatMap(([k, v]) => (v && typeof v === 'object' ? shape(v, `${prefix}${k}.`) : [`${prefix}${k}`])).sort()
  const en = resetTexts('en')
  const zh = resetTexts('zh')
  assert.deepEqual(shape(zh), shape(en))
  assert.notEqual(zh.title, en.title)
  assert.deepEqual(shape(resetTexts('zh_TW')), shape(en))
  assert.equal(resetTexts('de'), en, 'other languages read English')
  const all = JSON.stringify([en, zh, RESET_KEYWORDS])
  assert.doesNotMatch(all, /遥测|telemetry/i)
  const strings = []
  const walk = (value) => { for (const v of Object.values(value)) { if (typeof v === 'string') strings.push(v); else walk(v) } }
  walk(en); walk(zh)
  for (const text of strings) assert.deepEqual(scanText(text), [], text)
})

test('what is reset and what stays is written down, and the host keeps the pairing, apps, sign-in, language, port and privacy choices', () => {
  const zh = resetTexts('zh').host
  assert.deepEqual([zh.resetsLabel, zh.keepsLabel], ['会重置', '会保留'])
  for (const word of ['已配对的设备', '应用列表', '登录账号', '界面语言', '服务端口', '隐私选项']) assert.ok(zh.keeps.includes(word), word)
  const en = resetTexts('en').host
  for (const word of ['paired devices', 'application list', 'sign-in account', 'language', 'service port', 'privacy choices']) assert.ok(en.keeps.includes(word), word)
  assert.ok(zh.clearApps.includes('应用列表') && en.clearApps.includes('application list'))
  assert.match(failureText(resetTexts('en'), 'busy'), /still working.*not changed/)
  assert.equal(failureText(resetTexts('en'), 'http_500'), resetTexts('en').failed)
  // a call that got no answer may have been carried out before the connection dropped: it never says that nothing was changed
  for (const locale of ['en', 'zh']) {
    const T = resetTexts(locale)
    assert.equal(failureText(T, 'unreachable'), T.errors.unreachable)
    assert.ok(!failureText(T, 'unreachable').includes(T.failed))
  }
  assert.match(failureText(resetTexts('en'), 'unreachable'), /not confirmed/)
  // the panel's own reset that stopped half way: it does not say that nothing was changed either
  for (const locale of ['en', 'zh']) {
    const T = resetTexts(locale)
    assert.equal(failureText(T, 'panel_failed'), T.errors.panel_failed)
    assert.ok(!failureText(T, 'panel_failed').includes(T.failed))
  }
})

test('the diagnostics page row says what the page says', () => {
  for (const locale of ['en', 'zh']) {
    const D = diagnosticsTexts(locale)
    const T = resetTexts(locale)
    assert.equal(D.resetSettings, T.hostRow)
    assert.equal(D.resetSettingsText, T.hostRowText)
  }
})

test('the search finds 恢复默认设置 by the words a person types, in either interface language', () => {
  const ACTION = ACTION_DEFS.find((a) => a.id === 'resetSettings')
  assert.ok(ACTION, 'the action is defined')
  assert.equal(ACTION.tier, 1, 'it opens the page: the page asks before it resets anything')
  for (const locale of ['en', 'zh']) {
    const docs = actionDocs(locale, { resetSettings() {}, restart() {}, resetDisplay() {} }, searchTexts(locale).types.action)
    const index = buildIndex(docs)
    for (const query of ['reset', 'restore defaults', 'default settings', 'factory', 'factory reset', 'defaults', 'initialize', '恢复默认', '重置设置', '初始化', '恢复出厂', '还原', '默认设置', 'reset settings']) {
      const found = search(index, query).flat.map((d) => d.id)
      assert.ok(found.includes('action:resetSettings'), `${locale}: “${query}” finds it`)
    }
    assert.equal(search(index, '恢复默认').flat[0].id, 'action:resetSettings', `${locale}: the title word ranks it first`)
    assert.equal(search(index, 'restore defaults').flat[0].id, 'action:resetSettings')
  }
  assert.equal(actionDocs('en', {}, '').some((d) => d.id === 'action:resetSettings'), false, 'a product without the page does not offer it')
})

const render = (component, props) => renderToString(createSSRApp({ render: () => h(component, props) })).then((html) => html.replace(/<!--.*?-->/g, ''))
const idle = { status: async () => ({ ok: true, data: { backups: [] } }), reset: async () => ({ ok: true }), restore: async () => ({ ok: true }) }

test('the page shows the host rows, the panel row only where there is a panel, and the restore row disabled until there is a backup', async () => {
  const withPanel = await render(mod.MResetSettings, { locale: 'zh', host: idle, panel: { reset: async () => {} } })
  assert.match(withPanel, /恢复默认设置/)
  for (const kind of ['host', 'restore', 'panel']) assert.ok(withPanel.includes(`data-reset="${kind}"`), kind)
  const restore = /<[a-z]+[^>]*data-reset="restore"[^>]*>/.exec(withPanel)[0]
  assert.match(restore, /disabled/)
  const web = await render(mod.MResetSettings, { locale: 'en', host: idle, panel: null })
  assert.ok(web.includes('data-reset="host"') && !web.includes('data-reset="panel"'))
  assert.match(web, /Restore default settings/)
})

test('the restore row: what the last read of the backups says, and when it offers a backup, a retry or nothing', () => {
  const T = resetTexts('en')
  const backups = [{ stamp: 'b', created_ms: Date.UTC(2026, 10, 19, 7, 30), has_apps: true }, { stamp: 'a', created_ms: 1000 }]
  const ok = backupView({ state: 'ok', backups }, T, 'en')
  assert.equal(ok.enabled, true); assert.equal(ok.retry, false); assert.match(ok.text, /Backed up .*2026/)
  assert.deepEqual(backupView({ state: 'ok', backups: [] }, T, 'en'), { text: T.noBackup, enabled: false, retry: false })
  // a read that failed is not “no backup”: the row offers to read again
  assert.deepEqual(backupView({ state: 'error', backups: [] }, T, 'en'), { text: T.backupsFailed, enabled: true, retry: true })
  // after a reset or restore the list is old: no backup is offered until it is read again
  assert.deepEqual(backupView({ state: 'stale', backups }, T, 'en'), { text: T.backupsWait, enabled: false, retry: false })
  // not read yet: nothing is claimed
  assert.deepEqual(backupView({ state: 'loading', backups: [] }, T, 'en'), { text: '', enabled: false, retry: false })
  assert.deepEqual(backupView(undefined, T, 'en'), { text: '', enabled: false, retry: false })
})

test('the question names what is reset and what stays, offers the application list, and its button waits', async () => {
  const host = await render(mod.MResetConfirm, { modelValue: false, kind: 'host', locale: 'zh' })
  assert.match(host, /<strong>会重置<\/strong>：/); assert.match(host, /<strong>会保留<\/strong>：/); assert.match(host, /同时清除应用列表/)
  const button = /<button[^>]*data-reset-confirm[^>]*>[\s\S]*?<\/button>/.exec(host)[0]
  assert.match(button, /disabled/, 'the confirm button cannot be pressed at the start')
  assert.match(button, /恢复默认（5 秒）/)
  assert.match(button, /m-btn--danger/)
  const panel = await render(mod.MResetConfirm, { modelValue: false, kind: 'panel', locale: 'en' })
  assert.match(panel, /Restore default Panel preferences\?/)
  assert.ok(!panel.includes('Also clear the application list'), 'the panel question has no application list')
  assert.match(panel, /Restore defaults \(5 s\)/)
  const restore = await render(mod.MResetConfirm, { modelValue: false, kind: 'restore', locale: 'en', time: 'Nov 19, 2026', hasApps: true })
  assert.match(restore, /Nov 19, 2026/); assert.match(restore, /application list goes back/)
  const restoreButton = /<button[^>]*data-reset-confirm[^>]*>[\s\S]*?<\/button>/.exec(restore)[0]
  assert.ok(!/disabled/.test(restoreButton) && /Restore the backup/.test(restoreButton), 'a restore can be taken back, so it does not wait')
  const streaming = await render(mod.MResetConfirm, { modelValue: false, kind: 'host', locale: 'en', streaming: true })
  assert.match(streaming, /A stream is running now\./)
})

test('the entry row at the bottom of a settings page opens the page', async () => {
  const out = await render(mod.MResetEntry, { locale: 'zh' })
  assert.match(out, /data-reset="entry"/)
  assert.match(out, /恢复默认设置/)
})

test('a read that was started before a reset worked, or before a newer read, is not the current one', () => {
  const reads = createLatest()
  const first = reads.next()
  assert.equal(reads.isCurrent(first), true)
  const second = reads.next()
  assert.equal(reads.isCurrent(first), false, 'a newer read makes the older one old')
  assert.equal(reads.isCurrent(second), true)
  reads.invalidate()
  assert.equal(reads.isCurrent(second), false, 'a reset that worked makes every read in flight old')
  assert.equal(reads.isCurrent(reads.next()), true)
})

test('the language is not part of the panel reset: it is kept, because the host and the tray follow it', () => {
  for (const locale of ['en', 'zh']) {
    const T = resetTexts(locale)
    const reset = locale === 'zh' ? /语言/ : /language/i
    assert.doesNotMatch(T.panel.resets, reset)
    assert.match(T.panel.keeps, reset)
    assert.match(T.panelRowText, reset)
  }
})
