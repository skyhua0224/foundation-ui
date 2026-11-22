import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/vue/MCaption.vue', import.meta.url), 'utf8')

test('the caption bar orders its slots: [back] brand [version], search, mita, connect, announcements, account, then the window controls', () => {
  const order = [...source.matchAll(/<slot name="([a-z]+)"/g)].map((m) => m[1])
  // back and version share a row with the brand; a product that fills neither gets the brand alone (a second slot with v-else)
  assert.deepEqual(order, ['back', 'brand', 'version', 'search', 'mita', 'connect', 'announcements', 'account', 'controls'])
  assert.match(source, /<header ref="root" class="m-caption" :class="\[bem, \{ 'm-caption--bar-more': barMore \}\]" :data-phone="phone \? '' : null">/)
})

// whatever the width, the window's own buttons stay: the bar leaves things out by tier, from the lowest priority, and lists them in 更多; the controls slot is in no tier
test('the caption bar picks the roomiest tier in which everything it shows fits; the window buttons are in no tier', () => {
  assert.match(source, /const TIERS = 6/)
  assert.match(source, /new ResizeObserver\(fit\)/)
  assert.ok(!/setTimeout|requestAnimationFrame/.test(source), 'decided in the frame of the change')
  const css = fs.readFileSync(new URL('../src/css/layout.css', import.meta.url), 'utf8')
  assert.match(css, /\.m-caption:not\(\[data-tier='0'\]\):not\(\[data-tier=''\]\) \.m-capver \{ display: none; \}/)
  assert.match(css, /\.m-caption:is\(\[data-tier='4'\], \[data-tier='5'\]\) :is\(\.m-annbtn, \[data-fb='titlebar'\]\) \{ display: none; \}/)
  assert.ok(!/data-tier[^{]*\.m-caption__controls|data-tier[^{]*__controls|data-tier[^{]*panel-caption__btn/.test(css), 'the window buttons are never left out')
})

// the caption bar of a phone is one design for both products: the sizes of its buttons are here, not in the product's styles
const layout = fs.readFileSync(new URL('../src/css/layout.css', import.meta.url), 'utf8')
const capver = fs.readFileSync(new URL('../src/css/capver.css', import.meta.url), 'utf8')

// a phone is what the shell says (isCompactNav: narrower than 600 or shorter than 480), so a phone on its side is one too: the bar writes data-phone, no media query on the width decides it
test('the caption bar knows it is on a phone from the same rule as the shell, not from a width media query', () => {
  assert.match(source, /import \{ isCompactNav \} from '\.\.\/nav\/scenes\.js'/)
  assert.match(source, /isCompactNav\(window\.innerWidth, window\.innerHeight\)/)
  assert.match(source, /el\.toggleAttribute\('data-phone', phone\.value\)/)
  assert.match(source, /const floor = phone\.value \? PHONE_TIER : 0/)
  assert.match(source, /window\.addEventListener\('resize', fit\)/)
  assert.ok(!/@media \(max-width: 599\.98px\)[^{]*\{[^}]*\.m-caption/.test(layout), 'no width media query decides the bar of a phone')
  assert.ok(!/@media \(max-width: 599\.98px\)[^{]*\{[^}]*\.m-capver/.test(capver), 'the version and the back button leave a phone by data-phone')
})

test('every button of the bar is one size and one gap (--m-cap-btn, --m-cap-gap), at every width', () => {
  assert.match(layout, /\.m-caption \{ --m-cap-btn: 44px; --m-cap-gap: 4px; \}/)
  assert.match(layout, /\.m-caption__actions \{ flex: none; display: flex; align-items: center; gap: var\(--m-cap-gap\); margin-inline-start: 8px; \}/)
  assert.match(layout, /\.m-caption \.m-icon-btn, \.m-caption \.m-annbtn, \.m-caption \.m-statusbell, \.m-caption \.m-usearch\.is-compact \.m-usearch__open \{ width: var\(--m-cap-btn\); height: var\(--m-cap-btn\); min-width: var\(--m-cap-btn\);/)
  assert.match(layout, /\.m-caption:is\(\[data-tier='2'\][^{]*\) \.m-caption-connect \{ width: var\(--m-cap-btn\);[^}]*background: transparent;[^}]*border-radius: 50%; \}/)
})

test('a search that is its icon sits with the other buttons, not in the middle column of the bar', () => {
  assert.match(layout, /\.m-caption\.m-caption:is\(\[data-phone\], \[data-tier='2'\][^{]*\) \{ grid-template-columns: minmax\(0, 1fr\) auto auto; \}/)
  assert.match(layout, /> :has\(> \.m-usearch\.is-compact\) \{ padding: 0; margin-inline-end: var\(--m-cap-gap\); \}/)
})

test('the status bell keeps no empty slot at any width; on a phone the version and the global back button are left to 更多', () => {
  assert.match(layout, /\.m-caption\[data-phone\] \.m-caption__actions \{ margin-inline-start: 0; padding-inline-end: 4px; \}/)
  assert.match(layout, /\.m-caption \.m-statusbell--rest \{ display: none; \}/)
  assert.ok(!/data-phone\] \.m-statusbell--rest/.test(layout), 'no empty slot at any width, not only on a phone')
  assert.match(layout, /\.m-caption\[data-phone\] :is\(\.m-capver, \.m-capback\) \{ display: none; \}/)
})

test('the name in the bar is set in the type scale (title-medium), not by hand', () => {
  assert.match(layout, /\.m-brand__name \{ font: var\(--m-title-medium\); font-weight: 600;/)
})

// what only a real phone does to a page (iOS Safari, Chrome for Android): rotation enlarges text unless told not to, and a field under 16px zooms the page when it is focused
test('a phone on its side keeps its type size and the search field never makes the page zoom', () => {
  const base = fs.readFileSync(new URL('../src/css/base.css', import.meta.url), 'utf8')
  const search = fs.readFileSync(new URL('../src/css/usearch.css', import.meta.url), 'utf8')
  assert.match(base, /html \{ font-synthesis: none; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; \}/)
  assert.match(search, /@media \(any-pointer: coarse\) \{ \.m-usearch__input \{ font-size: max\(16px, calc\(16px \* var\(--m-text-scale, 1\)\)\); \} \}/)
})

test('a hint longer than the field ends in an ellipsis, it is never cut in the middle of a letter', () => {
  const search = fs.readFileSync(new URL('../src/css/usearch.css', import.meta.url), 'utf8')
  assert.match(search, /\.m-usearch__input \{ all: unset; flex: 1; min-width: 0; font: var\(--m-body-large\); color: var\(--md-sys-color-on-surface\); overflow: hidden; text-overflow: ellipsis; \}/)
})

test('on a touch screen the search icon and the actions keep the same pitch as with a mouse: the gap is the bar\'s, not a margin of the icon', () => {
  const touch = fs.readFileSync(new URL('../src/css/touch.css', import.meta.url), 'utf8')
  assert.match(touch, /\.m-usearch\.is-compact \.m-usearch__open \{ width: var\(--m-cap-btn, 44px\); height: var\(--m-cap-btn, 44px\); \}/)
  assert.match(touch, /\.m-caption__actions \{ gap: var\(--m-cap-gap, 4px\); \}/)
})
