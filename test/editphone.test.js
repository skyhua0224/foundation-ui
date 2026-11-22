import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// The overview's edit mode on a phone (card web-tiles-phone-1120): the page scrolls under a finger, a tile is picked up by a press that holds still, the add sheet fits a phone, the add button
// never covers the app's bottom bar, the selected tile's actions are a bar with finger-sized targets, and a smart overview ends in a full row in every window class. The behaviour is gated in a
// browser (touch emulation at 320x568 .. 932x430); these checks keep the parts it stands on from being removed.
const read = (p) => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8')

test('a tile in edit mode lets the page scroll under a finger and is lifted by a press that holds still', () => {
  const css = read('css/edit-phone.css')
  assert.match(css, /@media \(pointer: coarse\) \{[^]*\.is-edit \.m-dash__cell \{ touch-action: pan-y; \}/)
  const drag = read('vue/dash/dashDrag.js')
  assert.match(drag, /const LIFT_MS = 320/)
  assert.match(drag, /document\.addEventListener\('touchmove', onTouchMove, \{ passive: false \}\)/)
  // a finger that moves before the lift is a scroll: no drag, no selection; a cancelled press is not a tap
  assert.match(drag, /if \(d\.touch && !d\.lifted\) \{ clearTimeout\(pressTimer\); drag\.value = null/)
  assert.match(drag, /ev\.type === 'pointercancel' && drag\.value && !drag\.value\.moved/)
  // the mouse is as it was: a press of 450 ms selects, a move of 6 px drags
  assert.match(drag, /pressTimer = setTimeout\(\(\) => \{ if \(drag\.value && !drag\.value\.moved\) select\(id\) \}, 450\)/)
})

test('the add sheet fits a phone: its tools are a row of their own, or icons beside the search on a phone on its side', () => {
  const dash = read('vue/MHomeDash.vue')
  assert.match(dash, /<div class="m-dedit__tools">/)
  assert.equal((dash.match(/class="m-dpill__t"/g) || []).length, 4)
  const css = read('css/edit-phone.css')
  assert.match(css, /\.m-dedit__tools \{ display: contents; \}/)
  assert.match(css, /@media \(max-width: 599\.98px\), \(max-height: 519\.98px\) \{[^]*\.m-dedit__tools \{ display: flex; order: 2; flex: 1 0 100%;[^}]*overflow-x: auto/)
  assert.match(css, /@media \(max-height: 519\.98px\) \{[^]*\.m-dedit\.m-dedit--gallery \{ top: 8px; bottom: 8px;/)
  assert.match(read('css/all.css'), /@import '\.\/edit-phone\.css';/)
})

test('the selected tile has a bar of finger-sized actions where the pointer is coarse, and the add button stands above the bottom bar', () => {
  const dash = read('vue/MHomeDash.vue')
  assert.match(dash, /class="m-dedit__selbar"/)
  // the add button stays within reach while a tile is selected (the bar replaces the floating button)
  assert.match(dash, /class="m-dedit__selbtn" :aria-label="T\.addCard"[^>]*@click="pickerOpen = true"/)
  assert.match(dash, /querySelector\('\.m-rail--bar:not\(\.m-rail--side\)'\)/)
  assert.match(dash, /class="m-dedit__fab" :style="fabStyle"/)
  const css = read('css/edit-phone.css')
  assert.match(css, /\.m-dedit__selsizes button \{[^}]*min-width: 52px; height: 48px;/)
  assert.match(css, /\.m-dedit__selbtn \{[^}]*width: 48px; height: 48px;/)
  assert.match(css, /\.m-dash__sizes, \.m-dash__handle \{ display: none; \}/)
  assert.match(css, /\.is-edit \.m-dash__grid \{ row-gap: var\(--m-dash-gap, 12px\); \}/)
  assert.match(read('vue/dash/dashDrag.js'), /\.m-dedit__fab, \.m-dedit__selbar'\)\) sel\.value = ''/)
})

test('a smart overview ends in a full row at every window class: the tail fill runs for a phone too, with tiles that have data first and tiles without data last', () => {
  const dock = read('vue/dash/dashDock.js')
  assert.match(dock, /if \(windowClass\.value === 'compact'\) return \[blockOf\('grid', list, width\.value, \{ tail: true \}\)\]/)
  assert.match(dock, /fill: \{ rows, max: avail \}, tail: width\.value < TAIL_BELOW/)
  assert.match(dock, /if \(tail && holesOf\(packed, f\.units\) > 0\)/)
  assert.match(dock, /pool: fillCardsEmpty\.value/)
  // no row is added and no tile is stretched: the tail's height limit is the height the plan already has
  assert.match(dock, /max: heightOf\(packed, rowPx, UNIT_GAP\)/)
  // the tiles of the tail are not part of the memory that orders the fill
  assert.match(dock, /fillMemory = memory0/)
  // editing starts from the page that was on the screen: the tiles of the fill are frozen into the saved layout with the plan's
  assert.match(dock, /layout\.freeze\(withFill\(/)
  assert.match(dock, /watch\(blocks, \(list\) => \{ if \(!edit\.value\) lastShown =/)
})

test('the controls inside the tiles are not smaller than a finger: swatches and colour discs keep their size and scroll, small buttons grow where the pointer is coarse', () => {
  const css = read('css/edit-phone.css')
  assert.match(css, /\.m-b3s__discs button \{ flex: none; \}/)
  assert.match(css, /\.m-b3s__discs button \{ width: 40px; height: 40px; \}/)
  assert.match(css, /\.m-b2dl \.m-b2dl__go, \.m-b2dl\.is-s \.m-b2dl__go \{ height: 44px;/)
  assert.match(css, /\.m-gr--access \.m-b2opt::after \{ content: ''; position: absolute; inset: -3px 0; \}/)
  // the swatches of a strip: one row, not squeezed, with the fade of an edge that has more behind it
  const charts = read('css/charts.css')
  assert.match(charts, /\.m-dstripctl \.m-swatch \{ flex: none; width: 34px; height: 34px; \}/)
  assert.match(charts, /\.m-dstripctl \.m-swatches\[data-edge='end'\]/)
  const widget = read('vue/MDashWidget.vue')
  assert.equal((widget.match(/ref="stripChips" :data-edge="stripEdge"/g) || []).length, 4)
})
