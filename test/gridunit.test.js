import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { FLEX_BELOW, MAX_COLUMNS, UNIT_FLEX_MAX, UNIT_GAP, UNIT_PX, columnsOf, gridWidthOf, missingInRow } from '../src/vue/homeSizes.js'

// The unit of the overview grid is one fixed square (148 px at the standard density): the same on every window and every screen at the same OS scale. A bigger window holds more columns of it, never a bigger tile.
test('the unit is the same in every pane of FLEX_BELOW or more, at the standard density', () => {
  for (let w = FLEX_BELOW; w <= 4000; w += 7) assert.equal(columnsOf(w).unit, UNIT_PX, `${w}`)
})

test('a narrow pane is filled edge to edge: the columns share the whole width, between the standard unit and UNIT_FLEX_MAX', () => {
  for (let w = 2 * UNIT_PX + UNIT_GAP; w < FLEX_BELOW; w += 3) {
    const { columns, unit } = columnsOf(w)
    assert.ok(unit >= UNIT_PX && unit <= UNIT_FLEX_MAX, `${w}: ${unit}`)
    if (unit < UNIT_FLEX_MAX) assert.ok(w - gridWidthOf(columns, unit) <= 1, `${w} leaves ${w - gridWidthOf(columns, unit)} px`)
  }
  for (const [w, u] of [[328, 158], [358, 173], [398, 193]]) assert.equal(Math.round(columnsOf(w).unit), u, `${w}`)
})

test('a bigger pane holds more columns and never fewer', () => {
  let last = 0
  for (let w = 300; w <= 4000; w += 5) { const c = columnsOf(w).columns; assert.ok(c >= last, `${w}`); last = c }
  assert.equal(columnsOf(1760).columns, Math.floor((1760 + UNIT_GAP) / (UNIT_PX + UNIT_GAP)))
  assert.ok(columnsOf(3800).columns > columnsOf(1760).columns)
})

test('a pane narrower than two units and a gap gets a smaller unit, and the grid never exceeds the pane', () => {
  for (let w = 200; w <= 4000; w += 3) { const { columns, unit } = columnsOf(w); assert.ok(gridWidthOf(columns, unit) <= w + 0.5 || columns === 2, `${w}`); if (w >= FLEX_BELOW) assert.equal(unit, UNIT_PX) }
  assert.ok(columnsOf(300).unit < UNIT_PX); assert.ok(columnsOf(360).unit > UNIT_PX)
})

test('the density the person chose scales the fixed unit, and the unit stays fixed at that density too', () => {
  const small = columnsOf(1600, 'smaller').unit, large = columnsOf(1600, 'larger').unit
  assert.equal(small, Math.round(UNIT_PX * 0.875)); assert.equal(large, Math.round(UNIT_PX * 1.125))
  assert.equal(columnsOf(2600, 'larger').unit, large)
})

test('148 px packs the content widths of the common windows flush: 7, 8 and 11 columns; 2560 is capped at 12', () => {
  for (const [win, cols] of [[1280, 7], [1440, 8], [1920, 11]]) { const w = win - 160; assert.equal(columnsOf(w).columns, cols, `${win}`); assert.ok(w - gridWidthOf(cols, UNIT_PX) <= UNIT_GAP, `${win}: leaves ${w - gridWidthOf(cols, UNIT_PX)} px`) }
  assert.equal(columnsOf(2560 - 160).columns, 12)
})

test('the blocks of the overview are as wide as their columns of the fixed unit and do not grow', () => {
  const dock = fs.readFileSync(new URL('../src/vue/dash/dashDock.js', import.meta.url), 'utf8')
  assert.match(dock, /flex: '0 1 auto', width: `\$\{gridWidthOf\(b\.units, b\.unit\)\}px`/)
  const skel = fs.readFileSync(new URL('../src/vue/MDashSkeleton.vue', import.meta.url), 'utf8')
  assert.match(skel, /gridWidthOf\(b\.units, b\.unit\)/)
})

test('the grid has at most 12 columns of the fixed unit: a wider pane gets wider margins, not a wider grid', () => {
  assert.equal(MAX_COLUMNS, 12)
  for (const w of [1908, 2400, 3200, 3680, 5000]) { const c = columnsOf(w); assert.equal(c.columns, 12, `${w}`); assert.equal(c.unit, UNIT_PX) }
  assert.equal(columnsOf(1760).columns, 11)
  assert.equal(gridWidthOf(12, UNIT_PX), 1908)
})

test('the last row of the dock is completed with standard tiles: how many are missing', () => {
  assert.equal(missingInRow(10, 7), 4); assert.equal(missingInRow(14, 7), 0); assert.equal(missingInRow(0, 7), 0); assert.equal(missingInRow(3, 2), 1); assert.equal(missingInRow(5, 0), 0)
})
