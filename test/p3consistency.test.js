// P3 consistency (2026-11-09): one rule for help and folds, a press opens an info icon, the expert row pins to the overview.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { focusKeepsTip, pressAction } from '../src/vue/tips.js'
import { appIcon } from '../src/about/appicon.js'
import { existsSync } from 'node:fs'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

test('an info icon opens on a press of any pointer, a second press or any other press closes it', () => {
  const info = { classList: { contains: (c) => c === 'm-info__btn' } }
  const other = { classList: { contains: () => false } }
  assert.equal(pressAction(null, info), 'show')
  assert.equal(pressAction(other, info), 'show')
  assert.equal(pressAction(info, info), 'hide')
  assert.equal(pressAction(info, other), 'hide')
  assert.equal(pressAction(info, null), 'hide')
  const tips = read('../src/vue/tips.js')
  assert.doesNotMatch(tips, /pointerType === 'touch'\) \{ current/, 'the press is not limited to touch')
  assert.match(tips, /!pinned\) hideTip\(\)/, 'a tip a press opened stays when the pointer leaves')
})

test('the expert row pins like every row: a pin prop, an overflow button, a long press', () => {
  const v = read('../src/vue/MExpertItem.vue')
  assert.match(v, /pin: \{ type: Object, default: null \}/)
  assert.match(v, /inject\('m-pin', null\)/)
  assert.match(v, /m-item__more/)
  assert.match(v, /@pointerdown="onDown"/)
})

test('the expert row keeps its help behind an info icon: no fold per row, a reset button when it differs', () => {
  const v = read('../src/vue/MExpertItem.vue')
  assert.match(v, /<MInfo v-if="help" :text="help" \/>/)
  assert.doesNotMatch(v, /aria-expanded|m-expert__detail|keyboard_arrow_down/)
  assert.match(v, /v-if="changed" icon="restart_alt"/)
  assert.match(read('../src/css/controls.css'), /\.m-tipbox \{[^}]*white-space: pre-line/)
})

test('the log viewer hides debug and verbose lines until the level menu says all', () => {
  const v = read('../src/vue/MLogViewer.vue')
  assert.match(v, /const quiet = ref\(true\)/)
  assert.match(v, /QUIET_LEVELS = \['Fatal', 'Error', 'Warning', 'Info'\]/)
  assert.match(v, /id: '__all', label: T\.value\.allLevels/)
  assert.match(v, /levels: levels\.value\.size \? levels\.value : quiet\.value \? new Set\(QUIET_LEVELS\)/)
})

test('the product icon is the cloudless vector of SunshineQ, with its source on record', () => {
  assert.match(appIcon(20, 2).src, /app-icon\.svg$/)
  assert.equal(appIcon(256, 1).srcset, '')
  const svg = read('../src/assets/app/app-icon.svg')
  assert.match(svg, /<svg[^>]*viewBox="0 0 1024 1024"/)
  const source = read('../src/assets/app/SOURCE.md')
  assert.match(source, /AlkaidLab\/SunshineQ/)
  assert.match(source, /9c5f5873722f6354955216da41cdf1e0c7df52a1/)
  assert.equal(existsSync(new URL('../src/assets/app/app-icon-256.png', import.meta.url)), false, 'the cloud PNG set is gone')
})

test('no wheel trap: a stack turns only for a sideways wheel, the dock has no row to take the wheel, the update notes size to their content', () => {
  const stack = read('../src/vue/MDashStack.vue')
  assert.match(stack, /const stackWheelTurn = \(e\) => \(Math\.abs\(e\.deltaX\) >= 6 && Math\.abs\(e\.deltaX\) > Math\.abs\(e\.deltaY\)/)
  assert.doesNotMatch(stack, /turn\(e\.deltaY/)
  const dock = read('../src/vue/dash/dashDock.js')
  assert.ok(!/onDockWheel|scrollLeft/.test(dock), 'the dock is not a row that scrolls: the wheel is the page\'s')
  assert.match(read('../src/css/expressive.css'), /\.m-update__lines\.is-open \{ max-height: none; overflow: visible; \}/)
})

test('the focus moving onto the button a press just opened does not close its tip (the press moves the focus: the old one loses it first)', () => {
  const btn = { contains: (x) => x === btn }
  assert.equal(focusKeepsTip(true, btn, btn), true)
  assert.equal(focusKeepsTip(true, btn, {}), false)
  assert.equal(focusKeepsTip(false, btn, btn), false)
  assert.equal(focusKeepsTip(true, btn, null), false)
  assert.match(read('../src/vue/tips.js'), /focusout', \(e\) => \{ if \(!focusKeepsTip\(pinned, current, e\.relatedTarget\)\) hideTip\(\) \}/)
})
