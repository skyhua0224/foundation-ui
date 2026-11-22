import test from 'node:test'
import assert from 'node:assert/strict'
import { GUIDE_TEXTS_EN } from '../src/vue/guideTexts.js'
import { PARTIALS, TEXT_CODES } from '../src/locale/texts/index.js'

const leaves = (value, path = []) => {
  if (Array.isArray(value)) return value.flatMap((item, i) => leaves(item, path.concat(i)))
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => leaves(item, path.concat(key)))
  return [{ path, value }]
}
const dig = (value, path) => path.reduce((node, key) => node?.[key], value)
const placeholders = (text) => [...new Set(String(text).match(/\{\w+\}/g) || [])].sort()
const where = (code, path) => code + ' ' + path.join('.')

// A language that falls back to English is not translated. Every language carries every guide string the English table uses,
// with the same placeholders, and no key the English table dropped.
test('every guide translation has every English key, the same placeholders, and no stale key', () => {
  const english = leaves(GUIDE_TEXTS_EN).filter(({ value }) => value !== '')
  const known = new Set(leaves(GUIDE_TEXTS_EN).map(({ path }) => path.join('.')))
  for (const code of TEXT_CODES) {
    const partial = PARTIALS[code].guide
    for (const { path, value } of english) {
      const got = dig(partial, path)
      assert.equal(typeof got, 'string', 'missing ' + where(code, path))
      assert.notEqual(got, '', 'empty ' + where(code, path))
      assert.deepEqual(placeholders(got), placeholders(value), 'placeholders ' + where(code, path))
    }
    for (const { path } of leaves(partial)) {
      assert.ok(known.has(path.join('.')), 'stale ' + where(code, path))
    }
  }
})
