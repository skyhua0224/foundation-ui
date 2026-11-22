import test from 'node:test'
import assert from 'node:assert/strict'
import { GUIDE_TEXTS_EN, guideTexts } from '../src/vue/guideTexts.js'
import { modeListTexts, MODE_LIST_TEXTS } from '../src/settings/modeListTexts.js'
import { webAccessTexts, WEB_ACCESS_TEXTS } from '../src/vue/webAccessTexts.js'
import { appearanceTexts } from '../src/vue/appearanceTexts.js'
import { b3Texts } from '../src/vue/tiles/b3Texts.js'
import { LOCALE_CODES, PARTIALS, TEXT_CODES, TEXT_MODULES, canonicalLocale, resolveTexts } from '../src/locale/texts/index.js'

const leaves = (value, path = []) => {
  if (Array.isArray(value)) return value.flatMap((item, i) => leaves(item, path.concat(i)))
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => leaves(item, path.concat(key)))
  return [{ path, value }]
}
const dig = (value, path) => path.reduce((node, key) => node?.[key], value)

test('canonicalLocale keeps zh_TW and maps the 20 codes', () => {
  assert.equal(canonicalLocale('zh-TW'), 'zh_TW')
  assert.equal(canonicalLocale('zh_TW'), 'zh_TW')
  assert.equal(canonicalLocale('zh-Hant-HK'), 'zh_TW')
  assert.equal(canonicalLocale('zh-CN'), 'zh')
  assert.equal(canonicalLocale('en-GB'), 'en_GB')
  assert.equal(canonicalLocale('pt-BR'), 'pt_BR')
  assert.equal(canonicalLocale('de-DE'), 'de')
  assert.equal(canonicalLocale('klingon'), 'en')
  for (const code of LOCALE_CODES) assert.equal(canonicalLocale(code), code)
})

test('fallback is per key: zh_TW then zh then en, everyone else then en, empty does not win', () => {
  const en = { a: 'A', b: 'B', nest: { c: 'C', d: 'D' }, items: ['one', 'two'] }
  const zh = { a: '甲', b: '', nest: { c: '丙' }, items: ['一'] }
  const tw = { a: '臺', nest: { d: '' } }
  const de = { b: 'Be', nest: { d: 'De' } }
  const zhTable = resolveTexts(en, zh, 'zh', null)
  assert.equal(zhTable.a, '甲')
  assert.equal(zhTable.b, 'B', 'an empty Chinese string falls back to English')
  assert.equal(zhTable.nest.d, 'D')
  assert.equal(zhTable.items[1], 'two')
  const twTable = resolveTexts(en, zh, 'zh_TW', tw)
  assert.equal(twTable.a, '臺')
  assert.equal(twTable.nest.c, '丙')
  assert.equal(twTable.nest.d, 'D', 'an empty Traditional string falls back through Chinese to English')
  assert.equal(twTable.b, 'B')
  const deTable = resolveTexts(en, zh, 'de', de)
  assert.equal(deTable.a, 'A', 'German does not take Chinese')
  assert.equal(deTable.b, 'Be')
  assert.equal(deTable.nest.c, 'C')
  assert.equal(deTable.nest.d, 'De')
  assert.equal(resolveTexts(en, zh, 'fr', {}), en)
  assert.equal(resolveTexts(en, zh, 'en', { a: 'nope' }), en)
})

test('every language resolves every guide key, and an empty stub keeps the English object', () => {
  assert.deepEqual(TEXT_CODES.slice().sort(), Object.keys(PARTIALS).sort())
  for (const code of TEXT_CODES) for (const moduleName of TEXT_MODULES) {
    const partial = PARTIALS[code][moduleName]
    assert.equal(typeof partial, 'object')
    assert.ok(partial)
  }
  const english = leaves(GUIDE_TEXTS_EN)
  for (const code of LOCALE_CODES) {
    const table = guideTexts(code)
    for (const leaf of english) {
      const got = dig(table, leaf.path)
      const where = code + ' ' + leaf.path.join('.')
      assert.notEqual(got, undefined, where)
      assert.notEqual(got, null, where)
      if (leaf.value !== '') assert.notEqual(got, '', where)
    }
  }
  assert.notEqual(guideTexts('de').titles.account, 'Set up the WebUI panel account')
  assert.equal(guideTexts('de').skipThis, 'Diesen Schritt überspringen')
  assert.equal(guideTexts('ja').titles.intro, 'ようこそ')
  assert.equal(guideTexts('fr').intro.followSystem, 'Suivre le système')
  assert.equal(guideTexts('zh_TW').titles.pair, '連線並配對')
  assert.equal(guideTexts('zh').next, '下一步')
  assert.equal(modeListTexts('zh-CN'), MODE_LIST_TEXTS.zh)
  assert.equal(modeListTexts('de').resolutionTitle, 'Auflösungen von Foundation Virtual Display')
  assert.equal(modeListTexts('zh_TW').resolutionTitle, '基地虛擬顯示器支援的解析度')
  assert.equal(webAccessTexts('de').title, 'Zugriffsbereich')
  assert.equal(appearanceTexts('zh').title, '个性化')
  assert.equal(b3Texts({ __locale: 'zh_TW' }).restartNote, '重啟後生效')
  assert.equal(b3Texts({ __locale: 'de' }).on, 'Ein')
})
