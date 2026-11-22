import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// RZ2: the page that fills the window is laid out by CSS in the frame itself, never by a width that was measured a frame ago (a fast drag painted the grid up to 18 px past the window).
const scene = fs.readFileSync(new URL('../src/vue/MScene.vue', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/css/layout.css', import.meta.url), 'utf8')

test('the filling pane is a 1fr track and its content is 100% wide; the fixed panes are clamped to the room that is left', () => {
  assert.match(scene, /i === fill \? 'minmax\(0, 1fr\)'/)
  assert.match(scene, /i === fill \? fillInner : `\$\{L\.inner\[i\]\}px`/)
  assert.match(scene, /\? `\$\{settleWidth\.value\}px` : '100%'/)
  assert.match(scene, /max\(0px, min\(\$\{L\.cols\[i\]\}px, calc\(100% - \$\{rail\}px/)
  assert.match(css, /grid-template-columns: var\(--c-rail\) var\(--t-list, var\(--c-list\)\) var\(--t-detail, var\(--c-detail\)\) var\(--t-sup, var\(--c-sup\)\);/)
})

test('the numbers stay in px for what is placed with them (the list fill, the overlay, the buttons)', () => {
  assert.match(scene, /'--c-list': `\$\{L\.cols\[0\]\}px`, '--c-detail': `\$\{L\.cols\[1\]\}px`, '--c-sup': `\$\{L\.cols\[2\]\}px`/)
  assert.match(css, /left: calc\(var\(--c-rail\) \+ var\(--c-list\)\)/)
})

test('a single scene fills with its visible pane: the list when the list is shown, the detail otherwise', () => {
  assert.match(scene, /scene\.value\.kind === 'single' && scene\.value\.visible === 'list' \? 0 : 1/)
})

// the overview opened from the apps page was planned at the width of the sliding column and arranged again at every width on the way: while the columns slide the filling pane's page keeps the width it ends at
test('while the columns slide the filling pane lays out at the width it ends at; at rest, in a drag and in a window resize it is the track (100%)', () => {
  assert.match(scene, /const settleWidth = ref\(null\)/)
  assert.match(scene, /const fillInner = animating\.value && !dragging\.value && !resizing\.value && settleWidth\.value !== null/)
  // read before the DOM is patched (the scrollbar the pane shows now), from the layout the scene is going to
  assert.match(scene, /settleWidth\.value = settledWidth\(layout\.value, fillOf\.value, pane \? pane\.offsetWidth - pane\.clientWidth : 0\)/)
  // it ends with the slide, and at once when the window changes size
  assert.match(scene, /timer = setTimeout\(\(\) => \{ animating\.value = false; settleWidth\.value = null \}, 520\)/)
  assert.match(scene, /noteResize\(\); animating\.value = false; settleWidth\.value = null/)
})
