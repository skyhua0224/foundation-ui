import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fitDash } from '../src/vue/homeFit.js'
import { packDash } from '../src/vue/homePack.js'
import { boxOf, maxSpanOf, spanFor } from '../src/vue/homeSizes.js'
import { readDash } from './dashSource.js'

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('RZ2: the overview measures from the observer of its container (after layout, before paint), reads only there, and nothing slides while the size changes', () => {
  const src = readDash()
  assert.match(src, /ro = new ResizeObserver\(onObserved\)/)
  assert.match(src, /ro\.observe\(root\.value\)/); assert.match(src, /if \(scroller0\) D\.ro\.observe\(scroller0\)/)
  // the callback takes the width from its entry; the window handler reads two numbers and forces no layout
  assert.match(src, /const onObserved = \(entries\) => \{[\s\S]*e\.borderBoxSize\?\.\[0\]\?\.inlineSize/)
  assert.match(src, /const onSizes = \(\) => \{ const t = window\.innerHeight, w = window\.innerWidth; if \(t !== tall\.value \|\| w !== wide\.value\) noteResize\(\); tall\.value = t; wide\.value = w \}/)
  assert.match(src, /window\.addEventListener\('resize', onSizes\)/); assert.match(src, /window\.visualViewport\?\.addEventListener\('resize', onSizes\)/)
  // the scroller is found once, not at every frame
  assert.match(src, /scroller0 = findScroller\(\)/); assert.ok(!/getComputedStyle[^\n]*\n[^\n]*onObserved/.test(src))
  // the first frame has the real width: read when mounted, before the first paint
  assert.match(src, /the first frame: the real width before the first paint/)
  // a change of scale does not change the CSS size: two numbers refreshed
  assert.match(src, /matchMedia\(`\(resolution: \$\{window\.devicePixelRatio\}dppx\)`\)/); assert.match(src, /const onDprChange = \(\) => \{ onSizes\(\); watchDpr\(\) \}/)
  // no slide while resizing (a class on the root, set in the same flush that moves the tiles), and the moves are the person's: only edit mode has the spring
  // no settle timer: the shell's signal (raised in the first frame of a change, dropped in the first frame without one) is what the overview follows
  assert.ok(!/setTimeout|markResize|resizeTimer/.test(src.slice(src.indexOf('// ---- measuring'), src.indexOf('const mode = computed'))))
  assert.match(src, /const resizing = ref\(isResizing\(\)\)/); assert.match(src, /stopResizing = watchResizing\(\(on\) => \{ resizing\.value = on \}\)/)
  assert.match(src, /if \(w !== width\.value\) noteResize\(\)/)
  assert.match(src, /'is-resizing': resizing/)
  // the springs (move, enter, leave) are edit mode's and not while resizing: otherwise a tile that leaves keeps its old cell for the frames of its leave and lies over the new one
  assert.match(src, /enabled: \(\) => \(edit\.value \|\| planMoving\.value\) && !resizing\.value/) // the tiles slide (FLIP, flipGroup.js) only in edit mode and never while the size changes: nothing is left to lie over the new cell
  const css = read('src/css/gallery.css')
  assert.match(css, /\.m-dash\.is-resizing \.m-dash__cell, \.m-dash\.is-resizing \.m-dash__cell \*[^{]*\{ transition: none !important; \}/)
  // the dock has no row to measure: its columns are the grid's, from the width the page measured (no observer of its own, nothing read after a write of the window)
  assert.ok(!/measureDock\(|dockRow/.test(src), 'no row of tiles to measure')
  // the clock block's height is read in the callback of an observer (after layout, before paint), once per change of the pane or of the overview, never in a window handler
  assert.match(src, /dockObserver = new ResizeObserver\(measureDockHead\)/)
  assert.match(src, /const dockGrid = computed\(\(\) => gridOf\(width\.value\)\)/)
})

// the default overview's tiles at the widths a window goes through while it is dragged (720 to 5120, every 20 px): every tile placed inside the columns, none on another
const CARDS = [['hero', 'm', 'hero'], ['pair', 'm', 'hero'], ['download', 'm', 'card'], ['encoder', 's', 'card'], ['memory', 's', 'card'], ['cpu', 's', 'hero'], ['gpu', 's', 'hero'], ['gamepad-type', 'm', 'strip'], ['quick', 'm', 'strip'], ['devices', 's', 'card'], ['apps', 's', 'list'], ['sponsor', 's', 'list'], ['vdd', 's', 'card'], ['display', 's', 'card']]
const SPANS = { s: 2, m: 4, l: 8 }
const box = (c, units) => { const span = spanFor(SPANS[c.key], units); return { span, rows: 1, cls: c.cls, max: maxSpanOf(c.key, span, units) } }

test('RZ: at every width of a continuous resize the packed tiles sit inside the columns and never on each other', () => {
  const cards = CARDS.map(([id, key, cls]) => ({ id, key, cls }))
  for (let width = 720; width <= 5120; width += 20) {
    const narrow = width < 860
    const f = fitDash(cards, width, box, narrow ? { units: 4 } : {})
    const placed = f.packed.placed
    const items = [...placed.entries()].map(([id, p]) => ({ id, ...p }))
    assert.equal(items.length, cards.length, `${width}: every tile placed`)
    for (const p of items) { assert.ok(p.col >= 0 && p.col + p.span <= f.units, `${width}: ${p.id} inside ${f.units} columns`) }
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j]
      const across = a.col < b.col + b.span && b.col < a.col + a.span
      const down = a.row < b.row + b.rows && b.row < a.row + a.rows
      assert.ok(!(across && down), `${width}: ${a.id} and ${b.id} share a cell`)
    }
  }
})

test('RZ: the same width always gives the same layout, whichever width it came from (no stale state in the packer)', () => {
  const cards = CARDS.map(([id, key, cls]) => ({ id, key, cls }))
  const layoutAt = (w) => JSON.stringify([...fitDash(cards, w, box, w < 860 ? { units: 4 } : {}).packed.placed.entries()])
  const direct = layoutAt(1200)
  for (const w of [900, 2400, 760, 5000, 1200]) layoutAt(w)
  assert.equal(layoutAt(1200), direct)
  assert.ok(packDash)
  assert.ok(boxOf)
})
