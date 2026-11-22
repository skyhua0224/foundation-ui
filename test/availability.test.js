import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { AVAILABILITY, REASONS, ds5Availability, ds5ReasonCode, isUnavailable, lockedBy, reasonText } from '../src/settings/availability.js'
import { dualsenseEntries } from '../src/settings/dualsense.js'
import { settingDocs } from '../src/search/docs.js'
import { buildIndex, search } from '../src/search/index.js'

// A setting that cannot be used now says why, from its descriptor, the same way in the search and on its page; the search keeps it, after the usable ones.
// keys.json: the descriptors of the host's DualSense tuning (ids, keys, authority and whether the host build wires them), read from the host source (ds5/tuning_descriptors.inc, key_implemented).
const keys = JSON.parse(fs.readFileSync(new URL('./fixtures/ds5-keys.json', import.meta.url), 'utf8'))
const label = (k) => ({ 'config.input_gamepad_title': '手柄', 'ds5.pending.title': '当前不可用' }[k] || (/input/.test(k) ? '输入' : k))

test('every reason has an icon the kit draws and a sentence in both languages; an unknown code is the generic one', async () => {
  const icons = await import('../src/icons/names.js')
  for (const [code, r] of Object.entries(REASONS)) {
    assert.ok(r.zh && r.en, code)
    assert.ok(icons.NAMES.includes(r.icon), `${code}: the icon ${r.icon} is in the glyph set`)
  }
  assert.equal(reasonText('nope', 'zh'), REASONS.unwired.zh)
  assert.equal(reasonText('setting', 'zh', { name: '启用震动' }), '需先开启「启用震动」')
  assert.equal(reasonText('setting', 'en', { name: 'Rumble' }), 'Turn on “Rumble” first')
})

test('no reason says that a thing is not open yet', () => {
  for (const [code, r] of Object.entries(REASONS)) { assert.ok(!/暂未开放|尚未提供|coming soon|not available yet/i.test(`${r.zh} ${r.en}`), code) }
})

test('a key the host wires is usable; one it does not carries the reason of its part of the host, or the host’s own code', () => {
  const wired = keys.find((k) => k.implemented)
  assert.equal(ds5Availability(wired, { locale: 'zh' }), null)
  const mic = keys.find((k) => k.id === 96)
  assert.deepEqual(ds5Availability(mic, { locale: 'zh' }), { state: 'unavailable', code: 'mic', reason: REASONS.mic.zh, icon: 'mic_off' })
  assert.equal(ds5Availability({ ...mic, reason_code: 'client' }, { locale: 'en' }).reason, 'Needs client support', 'a code of the host wins')
  assert.equal(ds5Availability({ ...mic, reason_code: 'invented' }, { locale: 'en' }).code, 'mic', 'a code this build does not know is not taken')
  assert.equal(ds5ReasonCode({ id: 3 }, { nativePath: false }), 'platform')
  assert.equal(ds5ReasonCode({ id: 999, authority: 'client' }), 'client')
  assert.equal(ds5ReasonCode({ id: 999, authority: 'device' }), 'device')
  assert.equal(ds5ReasonCode({ id: 999, authority: 'host' }), 'unwired')
})

test('the keys the host build does not wire today, each with its reason', () => {
  const off = keys.filter((k) => !k.implemented).map((k) => [k.id, k.key, ds5Availability(k, { locale: 'zh' }).code])
  assert.deepEqual(off, [
    [10, 'ds5.haptics.bt.fallback', 'transport'],
    [31, 'ds5.trigger.adaptive.slopeScale', 'slope'],
    [96, 'ds5.audio.micRoute', 'mic'],
    [97, 'ds5.audio.preamp', 'preamp'],
    [98, 'ds5.audio.btFallback', 'transport'],
    [100, 'ds5.compat.btOutput', 'transport'],
    [101, 'ds5.compat.reportRateCapHz', 'client'],
    [102, 'ds5.sync.allowHostOverrides', 'control-channel'],
    [103, 'ds5.sync.allowClientOverrides', 'control-channel'],
    [104, 'ds5.sync.maxRateHz', 'control-channel'],
    [105, 'ds5.feedback.target', 'client'],
  ])
})

test('a setting that needs another one is locked while that one is off, with the way to it', () => {
  assert.equal(lockedBy(null), null)
  assert.equal(lockedBy({ key: 'ds5.rumble.enabled', title: '启用震动', on: true }), null)
  const l = lockedBy({ key: 'ds5.rumble.enabled', title: '启用震动', on: false, params: { tab: 'input', focus: 'ds5:ds5.rumble.enabled' } }, 'zh')
  assert.deepEqual([l.state, l.code, l.reason], [AVAILABILITY.LOCKED, 'setting', '需先开启「启用震动」'])
  assert.deepEqual(l.blockedBy, { id: 'setting:ds5.rumble.enabled', title: '启用震动', route: 'config', params: { tab: 'input', focus: 'ds5:ds5.rumble.enabled' } })
  const strength = keys.find((k) => k.key === 'ds5.rumble.strength')
  assert.equal(ds5Availability(strength, { locale: 'zh', requires: { key: 'ds5.rumble.enabled', title: '启用震动', on: false } }).state, 'locked')
  assert.equal(isUnavailable({ availability: l }), true); assert.equal(isUnavailable({ availability: null }), false); assert.equal(isUnavailable({}), false)
})

test('the search entries of the keys carry the availability; the path of an unusable key stops at the page it is on', () => {
  const entries = dualsenseEntries({ keys, label, locale: 'zh', altLocale: 'en' })
  const by = (key) => entries.find((e) => e.keyName === key)
  assert.equal(by('ds5.haptics.hd.gain').availability, null)
  const cap = by('ds5.compat.reportRateCapHz')
  assert.equal(cap.availability.code, 'client')
  assert.equal(cap.path, '输入 › 手柄', 'the group is not named after the state any more: the reason says it')
  assert.equal(cap.params.focus, 'ds5:ds5.compat.reportRateCapHz', 'it opens its place and the row is marked there')
  assert.ok(cap.params.sub, 'the page it is on')
  assert.ok(by('ds5.haptics.hd.gain').path.endsWith('触觉与震动') || by('ds5.haptics.hd.gain').path.startsWith('输入 › 手柄'))
  const locked = dualsenseEntries({ keys, label, locale: 'zh', requiresOf: (d) => (d.key === 'ds5.rumble.strength' ? { key: 'ds5.rumble.enabled', title: '启用震动', on: false } : null) })
  assert.equal(locked.find((e) => e.keyName === 'ds5.rumble.strength').availability.state, 'locked')
  assert.ok(locked.find((e) => e.keyName === 'ds5.rumble.strength').path.endsWith('ds5.cards.haptics'), 'a locked key is on its card: its path keeps it')
})

test('the docs keep the availability, and the search puts the usable settings first without dropping the others', () => {
  const entries = dualsenseEntries({ keys, label, locale: 'zh', altLocale: 'en' })
  const docs = settingDocs(entries, { locale: 'zh' })
  assert.equal(docs.find((d) => d.key === 'ds5.compat.reportRateCapHz').availability.code, 'client')
  assert.ok(!('availability' in docs.find((d) => d.key === 'ds5.haptics.hd.gain')), 'a usable setting has none')
  // the unusable one is the better title match ("体感上报频率上限" starts with the query), the usable one only contains it
  const r = search(buildIndex([
    { id: 'a', type: 'setting', title: '体感上报频率上限', key: 'cap', availability: { state: 'unavailable', code: 'client', reason: 'x' } },
    { id: 'b', type: 'setting', title: '滤波截止体感上报频率', key: 'filter' },
    { id: 'c', type: 'setting', title: '体感上报频率上限（实验）', key: 'exp' },
  ]), '体感上报')
  assert.deepEqual(r.flat.map((d) => d.id), ['c', 'b', 'a'])
  const none = search(buildIndex([{ id: 'only', type: 'setting', title: '体感上报频率上限', availability: { state: 'unavailable', code: 'client', reason: 'x' } }]), '频率')
  assert.deepEqual(none.flat.map((d) => d.id), ['only'], 'an unusable setting is found when it is all there is')
  const real = search(buildIndex(docs), '频率')
  const order = real.flat.map((d) => d.key)
  const firstUnusable = order.findIndex((k) => docs.find((d) => d.key === k).availability)
  assert.ok(firstUnusable > 0 && order.slice(firstUnusable).every((k) => docs.find((d) => d.key === k).availability), 'every usable result comes before every unusable one')
})

test('the search result says why, marks the row for a screen reader and offers the way to the setting that unlocks it', () => {
  const view = fs.readFileSync(new URL('../src/vue/MSearchResults.vue', import.meta.url), 'utf8')
  assert.match(view, /class="m-usearch__why"/)
  assert.match(view, /:aria-description="e\.why \? e\.why\.reason : undefined"/)
  assert.match(view, /v-if="e\.why && e\.why\.blockedBy" type="button" class="m-usearch__unlock"/)
  assert.match(view, /const unlock = \(why\) => s\.choose\(\{ kind: 'doc', doc: \{ type: 'setting', \.\.\.why\.blockedBy \} \}\)/)
  assert.ok(!/disabled/.test(view.match(/<li v-else-if="e\.kind === 'row'"[^>]*>/)[0]), 'the row of an unusable setting is not disabled: it opens its place')
})
