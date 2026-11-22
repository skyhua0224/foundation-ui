import test from 'node:test'
import assert from 'node:assert/strict'
import { DRIVER_LINKS, driverGuardTexts, driverNotice, fill, guardNotices, probeLine, safeModeNotice, trayNotification } from '../src/driverGuard/index.js'

const intel = { show: true, vendor: 'intel', module: 'igd12umd64.dll', driver: '32.0.101.6325', phase: 'startup', kind: 'crash', time: 1731889200, key: 'intel:32.0.101.6325' }
const guard = (over = {}) => ({ v: 1, probe: 'done', safe_mode: { active: false, since: 0, auto_exit_s: 0, skipped: [] }, driver: null, ...over })

test('the notice names the vendor, the driver version and the phase, and says it is not Sunshine', () => {
  const zh = driverNotice(guard({ driver: intel }), 'zh')
  assert.equal(zh.title, '上次启动时 Intel 显卡驱动崩溃')
  assert.match(zh.text, /版本 32\.0\.101\.6325/)
  assert.match(zh.text, /igd12umd64\.dll/)
  assert.match(zh.text, /不是 Sunshine 的问题/)
  const en = driverNotice(guard({ driver: intel }), 'en')
  assert.equal(en.title, 'The Intel graphics driver crashed at startup')
  assert.match(en.text, /version 32\.0\.101\.6325/)
  assert.match(en.text, /not in Sunshine/)
})

test('every phase and both outcomes read as a sentence', () => {
  const t = (phase, kind, locale) => driverNotice(guard({ driver: { ...intel, phase, kind } }), locale).title
  assert.equal(t('probe', 'hang', 'zh'), '上次检测编码器时 Intel 显卡驱动无响应')
  assert.equal(t('streaming', 'crash', 'zh'), '上次串流时 Intel 显卡驱动崩溃')
  assert.equal(t('idle', 'crash', 'zh'), '上次运行时 Intel 显卡驱动崩溃')
  assert.equal(t('probe', 'hang', 'en'), 'The Intel graphics driver stopped responding while checking encoders')
  assert.equal(t('streaming', 'crash', 'en'), 'The Intel graphics driver crashed during a stream')
  assert.equal(t('idle', 'crash', 'en'), 'The Intel graphics driver crashed while running')
})

test('an unknown phase or kind falls back, an unknown vendor has no notice', () => {
  assert.equal(driverNotice(guard({ driver: { ...intel, phase: '??', kind: '??' } }), 'zh').title, '上次启动时 Intel 显卡驱动崩溃')
  assert.equal(driverNotice(guard({ driver: { ...intel, vendor: 'apple' } }), 'zh'), null)
  for (const vendor of ['constructor', 'toString', '__proto__']) assert.equal(driverNotice(guard({ driver: { ...intel, vendor } }), 'zh'), null)
})

test('no notice while the host says it is not due, and none without a guard', () => {
  assert.equal(driverNotice(guard({ driver: { ...intel, show: false } }), 'zh'), null)
  assert.equal(driverNotice(guard(), 'zh'), null)
  assert.equal(driverNotice(null, 'zh'), null)
  assert.equal(driverNotice(undefined, 'en'), null)
})

test('a driver without a known version still reads whole', () => {
  const n = driverNotice(guard({ driver: { ...intel, driver: '' } }), 'zh')
  assert.doesNotMatch(n.text, /版本/)
  assert.doesNotMatch(n.text, /\{/)
})

test('update goes to the official download page, support to the vendor, and the notice can be dismissed', () => {
  for (const vendor of ['intel', 'nvidia', 'amd']) {
    const n = driverNotice(guard({ driver: { ...intel, vendor } }), 'zh')
    const ids = n.actions.map((a) => a.id)
    assert.deepEqual(ids, vendor === 'intel' ? ['update', 'assistant', 'support', 'dismiss'] : ['update', 'support', 'dismiss'])
    for (const id of ['update', 'assistant', 'support']) {
      if (ids.includes(id)) assert.equal(n.actions.find((a) => a.id === id).href, DRIVER_LINKS[vendor][id])
    }
    assert.equal(n.actions.at(-1).href, undefined)
  }
  const support = (locale) => driverNotice(guard({ driver: intel }), locale).actions.find((a) => a.id === 'support').label
  assert.equal(support('zh'), '联系 Intel 支持')
  assert.equal(support('en'), 'Contact Intel support')
})

test('Intel has two ways to the driver, because its download pages are split by hardware generation: the download center category and its own assistant', () => {
  const links = DRIVER_LINKS.intel
  assert.equal(new URL(links.update).pathname, '/content/www/us/en/search.html')
  assert.match(new URL(links.update).hash, /cf-downloadsppth=Graphics/)
  assert.equal(links.assistant, 'https://www.intel.com/content/www/us/en/support/detect.html')
  const labels = (locale) => driverNotice(guard({ driver: intel }), locale).actions.map((a) => a.label)
  assert.deepEqual(labels('zh'), ['更新驱动', 'Intel 驱动与支持助理', '联系 Intel 支持', '关闭'])
  assert.deepEqual(labels('en'), ['Update driver', 'Intel Driver & Support Assistant', 'Contact Intel support', 'Dismiss'])
  for (const vendor of ['nvidia', 'amd']) assert.equal(DRIVER_LINKS[vendor].assistant, undefined)
})

test('the links are the vendors own https pages', () => {
  const hosts = { intel: 'www.intel.com', nvidia: 'www.nvidia.com', amd: 'www.amd.com' }
  for (const [vendor, links] of Object.entries(DRIVER_LINKS)) {
    for (const href of Object.values(links)) {
      const url = new URL(href)
      assert.equal(url.protocol, 'https:')
      assert.equal(url.hostname, hosts[vendor])
    }
  }
})

test('safe mode says what was skipped and how it ends, and can be retried', () => {
  const n = safeModeNotice(guard({ safe_mode: { active: true, since: 1, auto_exit_s: 300, skipped: ['encoder_probe', 'display_restore'] } }), 'zh')
  assert.equal(n.title, '已进入安全模式')
  assert.match(n.text, /跳过了编码器检测和显示设置恢复/)
  assert.match(n.text, /5 分钟/)
  assert.deepEqual(n.actions.map((a) => a.id), ['retry'])
  assert.equal(n.actions[0].label, '重试编码器检测')
  const en = safeModeNotice(guard({ safe_mode: { active: true, since: 1, auto_exit_s: 300, skipped: [] } }), 'en')
  assert.match(en.text, /5 minutes/)
  assert.equal(safeModeNotice(guard(), 'zh'), null)
})

test('the encoder check line shows only while it runs', () => {
  assert.equal(probeLine(guard({ probe: 'pending' }), 'zh'), '正在检测编码器')
  assert.equal(probeLine(guard({ probe: 'running' }), 'en'), 'Checking encoders')
  for (const probe of ['done', 'failed', 'skipped']) assert.equal(probeLine(guard({ probe }), 'zh'), '')
  assert.equal(probeLine(null, 'zh'), '')
})

test('the safe mode comes before the driver notice', () => {
  const both = guard({ driver: intel, safe_mode: { active: true, since: 1, auto_exit_s: 300, skipped: [] } })
  assert.deepEqual(guardNotices(both, 'zh').map((n) => n.id), ['safe-mode', 'gpu-driver'])
})

test('the tray says the same as the home page', () => {
  const g = guard({ driver: intel })
  const tray = trayNotification(g, 'zh')
  const notice = driverNotice(g, 'zh')
  assert.equal(tray.title, notice.title)
  assert.equal(tray.message, notice.text)
  assert.equal(trayNotification(guard(), 'zh'), null)
  const safeOnly = trayNotification(guard({ safe_mode: { active: true, since: 1, auto_exit_s: 300, skipped: [] } }), 'en')
  assert.equal(safeOnly.title, 'Safe mode is on')
})

test('no placeholder is left open and the banned words never appear', () => {
  for (const locale of ['zh', 'en']) {
    const t = driverGuardTexts(locale)
    const all = JSON.stringify(t)
    assert.doesNotMatch(all, new RegExp(['遥测', 'tele' + 'metry'].join('|'), 'i')) // the word users react badly to
    for (const n of [driverNotice(guard({ driver: intel }), locale), safeModeNotice(guard({ safe_mode: { active: true, auto_exit_s: 300 } }), locale)]) {
      assert.doesNotMatch(`${n.title} ${n.text} ${n.actions.map((a) => a.label).join(' ')}`, /\{\w+\}/)
    }
  }
  assert.equal(fill('{a} {b}', { a: 1 }), '1 {b}')
})

test('another locale reads English', () => {
  assert.equal(driverGuardTexts('ja').probing, 'Checking encoders')
  assert.equal(driverGuardTexts('zh-CN').probing, '正在检测编码器')
  assert.equal(driverGuardTexts('zh_TW').probing, '正在检测编码器')
})

import { createDriverGuardClient } from '../src/driverGuard/client.js'

const idleState = { v: 1, probe: 'done', safe_mode: { active: false }, driver: null }

test('the client reads the state of the host and keeps it', async () => {
  let seen
  const client = createDriverGuardClient({ get: async () => idleState, post: async () => idleState }, (s) => { seen = s })
  assert.deepEqual(await client.refresh(), idleState)
  assert.deepEqual(seen, idleState)
})

test('an older host without the route, or an answer that is not the contract, leaves the state empty instead of failing', async () => {
  let seen = 'unset'
  const old = createDriverGuardClient({ get: async () => { throw new Error('HTTP 404') }, post: async () => idleState }, (s) => { seen = s })
  assert.equal(await old.refresh(), null)
  assert.equal(seen, null)
  const odd = createDriverGuardClient({ get: async () => ({ error: 'x' }), post: async () => [] }, (s) => { seen = s })
  assert.equal(await odd.refresh(), null)
  assert.equal(await odd.retry(), null)
})

test('dismiss and retry post the action and take the answer as the new state', async () => {
  const posted = []
  const client = createDriverGuardClient({ get: async () => idleState, post: async (body) => { posted.push(body); return { ...idleState, probe: 'running' } } }, () => {})
  const afterDismiss = await client.dismiss('intel:32.0.101.6325')
  assert.deepEqual(posted[0], { action: 'dismiss', key: 'intel:32.0.101.6325' })
  assert.equal(afterDismiss.probe, 'running')
  await client.retry()
  assert.deepEqual(posted[1], { action: 'retry' })
})

test('it looks soon while the encoders are checked and rarely afterwards', async () => {
  let reply = { ...idleState, probe: 'running' }
  const client = createDriverGuardClient({ get: async () => reply, post: async () => reply }, () => {})
  await client.refresh()
  assert.equal(client.nextDelay(), 3000)
  reply = idleState
  await client.refresh()
  assert.equal(client.nextDelay(), 30000)
})

test('a response that arrives after a later call does not overwrite the newer state', async () => {
  const seen = []
  const waiting = []
  const api = { get: () => new Promise((resolve) => waiting.push(resolve)), post: async () => ({ v: 1, probe: 'done' }) }
  const client = createDriverGuardClient(api, (state) => seen.push(state))
  const slow = client.refresh()
  const fast = await client.retry()
  waiting[0]({ v: 1, probe: 'running' })
  await slow
  assert.equal(fast.probe, 'done')
  assert.deepEqual(seen.map((s) => s.probe), ['done'])
  assert.equal(client.nextDelay(), 30000)
})
