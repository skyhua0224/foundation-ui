import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { BREAKPOINTS, RAIL_WIDTH, barSideOf, canExpand, navigationOf, railWidthOf } from '../src/nav/scenes.js'

test('the menu button does what it says at every height: where it is shown, the choice gives the expanded rail', () => {
  // 2026-11-10: a window of 1267 x 547 (1900 x 820 at 150 % scaling) showed the button, but the height below 600 turned the expanded rail back into the collapsed one: the click changed nothing
  assert.equal(BREAKPOINTS.expandedMinHeight, undefined, 'no height limit of the expanded rail')
  for (const width of [1120, 1267, 1440, 1900]) {
    assert.ok(canExpand(width), `the button is shown at ${width}`)
    assert.equal(navigationOf(width, false), 'rail')
    assert.equal(navigationOf(width, true), 'expanded')
  }
  assert.equal(navigationOf(1267, true, 547), 'expanded', 'a short window (a third argument is not read)')
  assert.equal(navigationOf(1119, true), 'rail', 'no room across: no button either')
  assert.ok(!canExpand(1119))
  assert.equal(navigationOf(500, true), 'bar')
  const scene = fs.readFileSync(new URL('../src/vue/MScene.vue', import.meta.url), 'utf8')
  assert.ok(scene.includes('navigationOf(size.value.width, expandedChoice.value, size.value.height)'), 'the scene gives the size and the choice')
  assert.ok(scene.includes('canExpand(size.value.width) && mode.value !== \'bar\''), 'the button is shown by width alone')
  // a window shorter than SHORT_HEIGHT takes the compact navigation whatever its width; it stands beside the content from SIDE_MIN_WIDTH on
  assert.equal(navigationOf(844, false, 390), 'bar'); assert.equal(navigationOf(1400, true, 470), 'bar'); assert.equal(navigationOf(844, false, 480), 'rail')
  assert.ok(barSideOf(844, 390) && barSideOf(568, 320) && !barSideOf(390, 844) && !barSideOf(360, 420) && !barSideOf(844, 480))
  assert.equal(railWidthOf('bar', true), RAIL_WIDTH.side); assert.equal(railWidthOf('bar'), 0)
})

test('the expanded rail is one labelled column at every height, and its rows scroll when they are taller than the window', () => {
  const css = fs.readFileSync(new URL('../src/css/layout.css', import.meta.url), 'utf8')
  // no tier drops the labels or wraps the items into two columns
  assert.ok(!/\.m-rail[^{]*data-tier='3'/.test(css)); assert.ok(!/grid-template-columns: repeat\(2, 4\dpx\)/.test(css))
  assert.match(css, /\.m-rail--expanded \.m-rail__label--row/)
  assert.match(css, /\.m-rail__items \{[^}]*overflow-y: auto/, 'the rows scroll')
  assert.match(css, /\.m-rail \{[^}]*min-height: 0/, 'the rail does not grow past the window')
})

test('the rail takes the roomiest tier in which every item is visible, decided in the frame of the change', () => {
  const rail = fs.readFileSync(new URL('../src/vue/MRail.vue', import.meta.url), 'utf8')
  const css = fs.readFileSync(new URL('../src/css/layout.css', import.meta.url), 'utf8')
  assert.match(rail, /new ResizeObserver\(fit\)/)
  assert.match(rail, /items\.scrollHeight <= items\.clientHeight \+ 1/)
  assert.ok(!/setTimeout|requestAnimationFrame/.test(rail), 'no timer, no deferral')
  for (const t of [1, 2]) assert.match(css, new RegExp(`\\.m-rail--rail\\[data-tier='${t}'\\]`))
  // the height that is left goes to the space between destinations, up to the spec's 12 px; labels are of normal weight, the current one is a step heavier
  assert.match(css, /\.m-rail__items \{ display: flex; flex-direction: column; gap: var\(--m-rail-gap, 6px\)/)
  assert.match(rail, /const STATES = \[\[0, false, \[8, 12\]\], \[0, true, \[4, 12\]\], \[1, true, \[4, 12\]\], \[2, true, null\]\]/)
  assert.match(css, /\.m-rail\[data-foot='compact'\] \.m-rail__foot \{ padding: 6px 0 8px/)
  assert.match(css, /cursor: pointer; font: 400 12px\/16px/)
  assert.match(rail, /document\.fonts\?\.ready\?\.then\(fit\)/, 'decided again when the fonts of the machine arrive')
  assert.match(css, /\.m-rail\[data-tier='2'\] \{ overflow-y: auto/, 'the labels are kept and the whole rail scrolls')
})
