import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createPaneScroll, placeOf } from '../src/nav/paneScroll.js'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('a page that is opened starts at the top, whatever was left before', () => {
  const scroll = createPaneScroll()
  assert.equal(scroll.enter('doctor'), 0)
  scroll.leave('logs', 1100)
  assert.equal(scroll.enter('doctor'), 0, 'another page does not inherit the height of the one that was left')
  assert.equal(scroll.enter('logs'), 0, 'opening the same page again is opening it: the top')
})

test('going back opens the page where it was left', () => {
  const scroll = createPaneScroll()
  scroll.leave('logs', 1100)
  assert.equal(scroll.enter('logs', true), 1100)
  scroll.leave('logs', -5)
  assert.equal(scroll.enter('logs', true), 0, 'a negative or unreadable height counts as the top')
  scroll.leave('logs', Number.NaN)
  assert.equal(scroll.enter('logs', true), 0)
  assert.equal(scroll.enter('never-left', true), 0)
})

test('only the last places are kept', () => {
  const scroll = createPaneScroll(3)
  for (const [i, place] of ['a', 'b', 'c', 'd'].entries()) scroll.leave(place, (i + 1) * 10)
  assert.equal(scroll.size, 3)
  assert.equal(scroll.enter('a', true), 0)
  assert.equal(scroll.enter('d', true), 40)
})

test('a place is its destination and its parameters, not the number of the entry', () => {
  assert.equal(placeOf({ id: 'doctor', key: 'doctor#7' }), 'doctor')
  assert.equal(placeOf({ id: 'cfg', params: { tab: 'x', b: 2, gone: undefined }, key: 'cfg#9' }), placeOf({ id: 'cfg', params: { b: 2, tab: 'x' }, key: 'cfg#12' }))
  assert.notEqual(placeOf({ id: 'cfg', params: { tab: 'x' } }), placeOf({ id: 'cfg', params: { tab: 'y' } }))
  assert.equal(placeOf(null), '')
})

test('MScene resets the detail pane when the destination changes and restores it going back', () => {
  const scene = read('../src/vue/MScene.vue')
  assert.match(scene, /import \{ createPaneScroll, placeOf \} from '\.\.\/nav\/paneScroll\.js'/)
  assert.match(scene, /ref="detailPane" class="m-scene__pane m-scene__pane--detail"/)
  assert.match(scene, /paneScroll\.leave\(placeOf\(before\), detailPane\.value\.scrollTop\)/)
  assert.match(scene, /detailPane\.value\.scrollTop = paneScroll\.enter\(placeOf\(entry\), back\)/)
  assert.match(scene, /props\.jumps\?\.returning\?\.\(\)/, 'the global back of a jump is a return too')
  assert.match(scene, /\{ flush: 'pre' \}/, 'the height of the page being left is read before the content is swapped')
})

test('the rail head and the caption are drag regions down to their empty gaps', () => {
  assert.match(read('../src/vue/MRail.vue'), /class="m-rail__head" data-tauri-drag-region="deep"/)
})

test('the expand button of the open-source notice uses icons the set has', async () => {
  const flow = read('../src/vue/MGuideFlow.vue')
  const { ICONS } = await import('../src/icons/icons.js')
  for (const name of flow.match(/'(keyboard_arrow_(?:up|down))'/g).map((q) => q.slice(1, -1))) assert.ok(ICONS[name], name)
  assert.doesNotMatch(flow, /expand_(more|less)/)
})

test('the global back of a jump says it is returning while the place it opens is drawn, and only then', async () => {
  const { createJumpHistory } = await import('../src/nav/jumpHistory.js')
  let at = { id: 'doctor' }
  const jumps = createJumpHistory({ locate: () => at, restore: (place) => { at = place } })
  assert.equal(jumps.returning(), false)
  jumps.jump(() => { at = { id: 'network' } })
  assert.equal(jumps.returning(), false, 'a jump forward is not a return')
  assert.equal(jumps.back(), true)
  assert.equal(at.id, 'doctor')
  assert.equal(jumps.returning(), true)
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
  assert.equal(jumps.returning(), false)
})
