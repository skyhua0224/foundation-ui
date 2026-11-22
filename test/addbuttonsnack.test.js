// On a phone the 添加磁贴 button stands above the app's bottom bar; the snackbar of an add (「已添加」) used to rest at a fixed 92 px and covered it for its whole time
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('the snackbar rests above the add button or the bar of the selected tile, wherever they stand, not at a fixed height', () => {
  const css = read('src/css/notify.css')
  assert.ok(!/\.m-snackbar\[popover\] \{ bottom: 92px/.test(css), 'no fixed 92 px')
  assert.match(css, /body:has\(\.m-dedit__fab, \.m-dedit__selbar\) \.m-snackbar\[popover\] \{ bottom: calc\(var\(--m-dedit-clear\) \+ 12px\) !important; \}/)
  const v = read('src/vue/MHomeDash.vue')
  // measured from the controls themselves: the top of whichever of the two is on the screen, and again when the editing, the selection, the picker or the bar under them changes
  assert.match(v, /document\.querySelectorAll\('\.m-dedit__fab, \.m-dedit__selbar'\)/)
  assert.match(v, /setProperty\('--m-dedit-clear', `\$\{Math\.max\(0, Math\.round\(window\.innerHeight - Math\.min\(\.\.\.tops\)\)\)\}px`\)/)
  assert.match(v, /watch\(\[edit, sel, pickerOpen, fabBottom\], \(\) => nextTick\(clearOfBottom\), \{ flush: 'post' \}\)/)
  assert.match(v, /removeProperty\('--m-dedit-clear'\)/)
})

test('the clearance is the viewport height minus the top of the highest control that is shown (a hidden one has no box)', () => {
  // the same arithmetic as clearOfBottom, on rectangles: a phone (844 high) with the app's bar under a button that is 56 high at a bottom of 84, and with the bar of a selected tile (80 high) at 84
  const clear = (vh, rects) => { const tops = rects.filter((r) => r.width > 0 && r.height > 0).map((r) => r.top); return tops.length ? Math.max(0, Math.round(vh - Math.min(...tops))) : null }
  assert.equal(clear(844, [{ top: 704, width: 130, height: 56 }, { top: 0, width: 0, height: 0 }]), 140)
  assert.equal(clear(844, [{ top: 0, width: 0, height: 0 }, { top: 680, width: 366, height: 80 }]), 164)
  assert.equal(clear(844, [{ top: 0, width: 0, height: 0 }]), null)
})
