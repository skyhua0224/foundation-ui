import test from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { WEB_ACCESS_SCOPES, accessPending, bindValid, scopeChange, scopeOf, webAddresses, webPortOf, webUrl } from '../src/vue/webAccess.js'
import { webAccessTexts, WEB_ACCESS_TEXTS } from '../src/vue/webAccessTexts.js'
import { buildGuideSteps } from '../src/vue/guideModel.js'
import { guideTexts } from '../src/vue/guideTexts.js'

test('the Web UI is HTTPS on the base port plus one, the team base 57989 gives 57990', () => {
  assert.equal(webPortOf(57989), 57990)
  assert.equal(webPortOf(undefined), 47990)
  assert.equal(webUrl('192.168.7.133', 57989), 'https://192.168.7.133:57990')
  assert.equal(webUrl('fd00::1', 47989), 'https://[fd00::1]:47990')
  assert.equal(webUrl('', 47989), '')
})

test('an unset or unknown scope reads as the host reads it: local network', () => {
  assert.equal(scopeOf(undefined), 'lan')
  assert.equal(scopeOf('x'), 'lan')
  assert.deepEqual(WEB_ACCESS_SCOPES.map(scopeOf), ['pc', 'lan', 'wan'])
})

test('the phone addresses are private LAN first and a bind address narrows them to itself', () => {
  const list = [{ name: 'Ethernet', address: '192.168.7.133' }, { name: 'ZeroTier', address: '10.99.8.70' }, { name: 'lo', address: '127.0.0.1' }, { name: 'Wi-Fi', address: '100.64.1.2' }]
  assert.deepEqual(webAddresses(list, { base: 57989 }).map((a) => a.url), ['https://192.168.7.133:57990', 'https://10.99.8.70:57990', 'https://100.64.1.2:57990'])
  assert.deepEqual(webAddresses(list, { bind: '10.99.8.70', base: 57989 }).map((a) => a.address), ['10.99.8.70'])
  assert.deepEqual(webAddresses(list, { bind: '192.168.5.5', base: 47989 }).map((a) => a.url), ['https://192.168.5.5:47990'])
  assert.deepEqual(webAddresses(null, {}), [])
})

test('the internet needs a confirmation, and without a password it is refused', () => {
  assert.deepEqual(scopeChange('lan', 'wan', { password: true }), { confirm: true, steps: 2, blocked: false })
  assert.deepEqual(scopeChange('lan', 'wan', { password: null }), { confirm: true, steps: 2, blocked: false })
  assert.deepEqual(scopeChange('lan', 'wan', { password: false }), { confirm: false, steps: 0, blocked: true })
  assert.deepEqual(scopeChange('wan', 'lan', { password: false }), { confirm: false, steps: 0, blocked: false })
  assert.deepEqual(scopeChange('lan', 'pc'), { confirm: false, steps: 0, blocked: false })
  assert.deepEqual(scopeChange('wan', 'wan', { password: false }), { confirm: false, steps: 0, blocked: false })
})

test('a restart is pending when the running choice differs from the saved one, or when it was changed here and the host does not say', () => {
  assert.equal(accessPending({ origin_web_ui_allowed: 'lan', bind_address: '' }, { origin_web_ui_allowed: 'wan', bind_address: '' }), true)
  assert.equal(accessPending({ origin_web_ui_allowed: 'lan', bind_address: '' }, { origin_web_ui_allowed: 'lan', bind_address: '' }), false)
  assert.equal(accessPending({ origin_web_ui_allowed: 'lan' }, { origin_web_ui_allowed: 'lan', bind_address: '1.2.3.4' }), false)
  assert.equal(accessPending({ port: 1 }, { port: 1 }, true), true)
  assert.equal(accessPending(null, null, false), false)
})

test('a bind address is empty or an IP address', () => {
  for (const ok of ['', ' ', '192.168.1.5', '::1', 'fe80::1']) assert.ok(bindValid(ok), ok)
  for (const bad of ['256.1.1.1', 'host.local', '1.2.3', 'a b']) assert.ok(!bindValid(bad), bad)
})

test('the words: the three choices, a one-sentence consequence for the internet, no subtitle that repeats its title', () => {
  const zh = webAccessTexts('zh-CN')
  assert.deepEqual(Object.values(zh.scopes), ['仅本机', '局域网', '公网'])
  assert.equal(webAccessTexts('de').title, 'Zugriffsbereich')
  assert.equal(zh.title, '访问范围')
  for (const t of Object.values(WEB_ACCESS_TEXTS)) {
    assert.deepEqual(Object.keys(t).sort(), Object.keys(WEB_ACCESS_TEXTS.zh).sort())
    assert.deepEqual(Object.keys(t.scopeText), WEB_ACCESS_SCOPES)
    for (const scope of WEB_ACCESS_SCOPES) assert.ok(!t.scopeText[scope].includes(t.scopes[scope] + t.scopes[scope]))
  }
  assert.ok(zh.confirmText.includes('密码') && !zh.confirmText.includes('\n'))
})

test('the optional pages of the done page have 手机和其他设备访问 before remote access, both marked advanced', () => {
  const optional = buildGuideSteps().at(-1).optional
  assert.equal(optional[optional.indexOf('webaccess') + 1], 'remote')
  assert.ok(optional.indexOf('setup') < optional.indexOf('webaccess'), 'after the graphics setup')
  assert.equal(guideTexts('zh').titles.webaccess, '手机和其他设备访问')
  assert.ok(guideTexts('en').titles.webaccess && guideTexts('zh').leads.webaccess && guideTexts('en').leads.webaccess)
  assert.ok(guideTexts('zh').done.items.webaccess.title && guideTexts('en').done.items.webaccess.title)
})

test('the internet asks twice: the question, then 「注意」 with what it costs; a No on either leaves the choice; the guide uses the same component', () => {
  const vue = readFileSync(new URL('../src/vue/MWebAccess.vue', import.meta.url), 'utf8')
  assert.match(vue, /const confirmed = \(\) => \{ final\.value = asked\.value; asked\.value = '' \}/, 'the first yes only opens the second question')
  assert.match(vue, /const confirmedFinal = \(\) => \{ scope\.value = final\.value; final\.value = '' \}/, 'the choice changes only after the second')
  assert.match(vue, /<MDialog :model-value="!!final"[^>]*:title="T\.finalTitle"[^>]*@update:model-value="final = ''">/)
  assert.match(vue, /<MButton variant="text" @click="final = ''">\{\{ T\.confirmNo \}\}<\/MButton>/)
  assert.equal(scopeChange('lan', 'wan').steps, 2)
  assert.equal(scopeChange('lan', 'pc').steps, 0)
  assert.match(readFileSync(new URL('../src/vue/MGuideWebAccess.vue', import.meta.url), 'utf8'), /<MWebAccess v-model:scope="own\.scope"/, 'the first-run step is the same component, so it asks twice too')
  assert.equal(WEB_ACCESS_TEXTS.zh.finalTitle, '注意')
  assert.equal(WEB_ACCESS_TEXTS.en.finalTitle, 'Note')
  for (const l of ['zh', 'en']) { const T = WEB_ACCESS_TEXTS[l]; assert.ok(T.finalText && T.finalYes && T.confirmText, l); assert.doesNotMatch(T.finalText, /\n/, 'one line'); assert.notEqual(T.finalText, T.confirmText) }
})
