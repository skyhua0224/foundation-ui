import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BREAKPOINTS, RAIL_WIDTH, SUPPORTING_WIDTH, canExpand, navigationOf, railWidthOf, calculateScene, layoutOf, listDetailStrategy, listWidth, settledWidth, supportingPaneStrategy } from '../src/nav/scenes.js'

const entries = [{ key: 'l', id: 'input:list', role: 'list' }, { key: 'd', id: 'gamepad', role: 'detail', supporting: 'state' }]
const strategies = [supportingPaneStrategy(), listDetailStrategy()]
const kind = (width, list = entries) => calculateScene(strategies, list, { width, height: 900 }).kind

test('the supporting pane starts at 1600 and only for pages that declare one', () => {
  assert.equal(BREAKPOINTS.supporting, 1600)
  assert.equal(kind(1599), 'list-detail')
  assert.equal(kind(1440), 'list-detail')
  assert.equal(kind(1200), 'list-detail')
  assert.equal(kind(1600), 'list-detail-supporting')
  assert.equal(kind(2200), 'list-detail-supporting')
  assert.equal(kind(1920, [entries[0], { key: 'd', id: 'x', role: 'detail' }]), 'list-detail')
})
test('the supporting pane is at least 400 wide and the detail keeps room', () => {
  for (const width of [1600, 1920, 2560, 3440]) {
    const scene = calculateScene(strategies, entries, { width, height: 900 })
    const space = width - RAIL_WIDTH.collapsed
    const { cols } = layoutOf(scene, space)
    assert.ok(cols[2] >= SUPPORTING_WIDTH.min && cols[2] <= SUPPORTING_WIDTH.max, `${width}: ${cols[2]}`)
    assert.ok(cols[1] >= SUPPORTING_WIDTH.detailMin, `${width}: detail ${cols[1]}`)
    assert.equal(cols[0] + cols[1] + cols[2], space)
  }
})
test('the list pane is 320 to 360 wide from 1000 px of space on, narrower below', () => {
  for (const space of [1000, 1120, 1368, 1700, 2400]) assert.ok(listWidth(space) >= 320 && listWidth(space) <= 360, String(space))
  assert.ok(listWidth(640) < 320)
})

test('the navigation is a bottom bar under 600 and a collapsed rail from 600; the expanded rail is only the choice, and only where it fits', () => {
  assert.equal(navigationOf(480), 'bar')
  assert.equal(navigationOf(599, true), 'bar')
  assert.equal(navigationOf(600), 'rail')
  assert.equal(navigationOf(1440), 'rail')
  assert.equal(navigationOf(1440, true), 'expanded')
  assert.equal(navigationOf(1119, true), 'rail')
  assert.equal(navigationOf(1120, true), 'expanded')
  assert.deepEqual([railWidthOf('bar'), railWidthOf('rail'), railWidthOf('expanded')], [0, 96, 240])
  assert.ok(RAIL_WIDTH.collapsed === 96 && RAIL_WIDTH.expanded >= 220 && RAIL_WIDTH.expanded <= 360)
  assert.equal(canExpand(1119), false)
  assert.equal(canExpand(1120), true)
})

test('where the expanded rail is allowed the list stays under 360 and the detail pane keeps room beside it', () => {
  for (const width of [1120, 1200, 1440]) {
    const space = width - railWidthOf(navigationOf(width, true))
    const list = listWidth(space)
    assert.ok(list <= 360, `${width}: list ${list}`)
    assert.ok(space - list >= 560, `${width}: detail ${space - list}`)
  }
  // and collapsed at 1024, where the expanded rail would not leave room
  const space = 1024 - railWidthOf(navigationOf(1024, true))
  assert.ok(space - listWidth(space) >= 560)
})

test('the pane that fills the space ends at its column of the layout the scene is going to, less the scrollbar it shows now (apps page to overview: the list folds away, the page keeps the full width)', () => {
  const space = 1344
  const listDetail = layoutOf({ kind: 'list-detail', visible: 'both' }, space)
  const single = layoutOf({ kind: 'single', visible: 'detail' }, space)
  assert.equal(settledWidth(single, 1), space, 'the overview opens at the whole space')
  assert.equal(settledWidth(single, 1, 12), space - 12, 'less the scrollbar of the pane')
  assert.equal(settledWidth(listDetail, 1), space - listDetail.cols[0], 'with the list beside it, the detail ends narrower')
  assert.equal(settledWidth(layoutOf({ kind: 'single', visible: 'list' }, space), 0), space, 'a single scene that shows the list fills with the list')
  assert.equal(settledWidth(single, 1, -5), space, 'a negative scrollbar is none')
  assert.equal(settledWidth({ cols: [0, 4, 0] }, 1, 12), 0, 'never below zero')
})
