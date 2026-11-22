import test from 'node:test'
import assert from 'node:assert/strict'
import { isVersionLike, versionParts } from '../src/vue/tiles/versionParts.js'

test('a CI version is the date as the hero and the build with its suffix as the second line', () => {
  assert.deepEqual(versionParts('2026.1116.22909'), { main: ['2026.', '1116'], build: '.22909', rest: '', sub: '.22909', key: [2026, 1116, 22909] })
  assert.deepEqual(versionParts('v2026.1116.22909 杂鱼'), { main: ['2026.', '1116'], build: '.22909', rest: '杂鱼', sub: '.22909 · 杂鱼', key: [2026, 1116, 22909] })
  assert.equal(versionParts('2026.1116.22909.杂鱼').sub, '.22909 · 杂鱼')
})

test('a six digit build, a stable and a dev version never put more than the date in the hero', () => {
  assert.deepEqual(versionParts('2026.1112.025657').main, ['2026.', '1112']); assert.equal(versionParts('2026.1112.025657').sub, '.025657')
  assert.deepEqual(versionParts('2026.1031.141735').main, ['2026.', '1031'])
  assert.deepEqual(versionParts('manual-20261116-123456-dev'), { main: ['2026.', '1116'], build: '', rest: 'manual · 123456 · dev', sub: 'manual · 123456 · dev', key: [2026, 1116, 123456] })
  assert.deepEqual(versionParts('1.4.2').main, ['1.4.2']); assert.equal(versionParts('1.4.2').key, null)
})

test('a text that is no version is shown whole, a label is not taken for a version', () => {
  assert.deepEqual(versionParts('有更新'), { main: ['有更新'], build: '', rest: '', sub: '', key: null })
  assert.equal(isVersionLike('有更新'), false); assert.equal(isVersionLike('2026.1103.1'), true); assert.equal(isVersionLike(''), false)
  assert.deepEqual(versionParts(null).main, [''])
})
