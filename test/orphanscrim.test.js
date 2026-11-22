import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { modalsAfter, modalsAfterFrameGone } from '../src/vue/useModalBridge.js'
import { recentErrorCount } from '../src/vue/homeModel.js'
import { BUILTIN_ITEMS, OPEN_SOURCE_ID, activeItems, fetchAnnouncements, parseAnnouncements } from '../src/announcements/index.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const memory = () => { const data = new Map(); return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => { data.set(k, String(v)) }, removeItem: (k) => { data.delete(k) } } }

test('the shell keeps the ids of the modals open in the frames; a close message takes one away', () => {
  let ids = new Set()
  ids = modalsAfter(ids, { id: 'a', open: true }); ids = modalsAfter(ids, { id: 'b', open: true })
  assert.deepEqual([...ids], ['a', 'b'])
  ids = modalsAfter(ids, { id: 'a', open: false })
  assert.deepEqual([...ids], ['b'])
  assert.deepEqual([...modalsAfter(ids, { open: true })], ['b'], 'a message without an id changes nothing')
})

test('a frame that is hidden or has loaded another page leaves no modal behind, so no scrim can be orphaned', () => {
  const ids = modalsAfter(modalsAfter(new Set(), { id: 'a', open: true }), { id: 'b', open: true })
  assert.equal(ids.size, 2)
  assert.equal(modalsAfterFrameGone(ids).size, 0)
})

test('the scene drops the frame modals when the frame is hidden (the overlay goes off) and when the frame loads a page', () => {
  const scene = read('src/vue/MScene.vue')
  assert.match(scene, /watch\(\(\) => props\.overlay, \(on\) => \{ if \(!on\) dropFrameModals\(\) \}\)/)
  assert.match(scene, /document\.addEventListener\('load', onFrameLoad, true\)/)
  assert.match(scene, /document\.removeEventListener\('load', onFrameLoad, true\)/)
  assert.match(scene, /modals\.value = modalsAfterFrameGone\(\)/)
  assert.match(scene, /for \(let i = 0; i < 4; i \+= 1\) closeFrameModal\(\)/, 'every open modal of the frame is closed, not only the top one')
})

test('the home counts the recent errors of a log that is not loaded as none (it threw on null before)', () => {
  assert.equal(recentErrorCount(null), 0); assert.equal(recentErrorCount(undefined), 0); assert.equal(recentErrorCount(''), 0); assert.equal(recentErrorCount(5), 0)
  assert.equal(recentErrorCount('[2026-11-01 10:00:00.000]: Error: boom\n[2026-11-01 10:00:01.000]: Warning: hm\n[2026-11-01 10:00:02.000]: Fatal: bad'), 2)
  const webHome = path.join(root, '..', 'ds5-web-advanced/src_assets/common/assets/web/views/Home.vue')
  if (fs.existsSync(webHome)) assert.ok(!/parseErrorLog\([^)]*\)\.length/.test(fs.readFileSync(webHome, 'utf8')), 'the Web home does not take .length of a possible null')
})

const answer = (body, status = 200) => async () => ({ ok: status >= 200 && status < 300, status, headers: new Headers({ 'content-type': 'application/json' }), text: async () => body, json: async () => JSON.parse(body) })

test('an announcements file that is empty, missing or malformed gives no items, never an error, and the shipped notice stays', async () => {
  const cases = { empty: answer(''), emptyDocument: answer('{"schema":1,"items":[]}'), missing: answer('', 404), serverError: answer('oops', 500), notJson: answer('{'), wrongSchema: answer('{"schema":2,"items":[]}'), jsonNull: answer('null'), array: answer('[]'), junkItems: answer('{"schema":1,"items":[null,5,"x",{}]}') }
  for (const [name, f] of Object.entries(cases)) {
    const items = await fetchAnnouncements({ fetch: f, storage: memory(), force: true })
    assert.deepEqual(items, [], name)
    assert.deepEqual(parseAnnouncements({ schema: 1, items }), [], name)
    // the list the products show is the shipped notice then, with every field a card or the tile reads
    const list = activeItems([...BUILTIN_ITEMS, ...items], { locale: 'zh' })
    assert.equal(list.length, 1, name)
    assert.equal(list[0].id, OPEN_SOURCE_ID); assert.ok(list[0].title && list[0].body && list[0].dismissible === false, name)
  }
  for (const bad of [null, undefined, 5, 'x', [], {}, { schema: 1 }, { schema: 1, items: 'x' }, { schema: 1, items: [null] }]) assert.deepEqual(parseAnnouncements(bad), [], JSON.stringify(bad))
})
