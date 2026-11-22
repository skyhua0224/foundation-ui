import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { liftOffset } from '../src/vue/dragLift.js'
import { readDash } from './dashSource.js'

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('the lifted card follows the pointer: the offset is the pointer less the grab point less the slot, whatever the offset was before', () => {
  const slot = { left: 420, top: 300 }, grab = { x: 160, y: 30 }
  const at = (x, y) => liftOffset(x, y, grab, slot)
  assert.deepEqual(at(900, 500), { dx: 320, dy: 170 })
  // the same pointer position gives the same offset however many moves came before (the old formula built each offset on the last and ran away)
  let last
  for (const [x, y] of [[500, 320], [650, 400], [900, 500], [900, 500]]) last = at(x, y)
  assert.deepEqual(last, { dx: 320, dy: 170 })
  assert.deepEqual(at(slot.left + grab.x, slot.top + grab.y), { dx: 0, dy: 0 }) // grabbed and not moved: no offset
})

test('the gallery: categories at the left with icons, a frame per tile with a live preview paged through its sizes (swipe, arrows, dots, keys), the size as a caption, one 添加 or 已添加', () => {
  const g = read('src/vue/MTileGallery.vue')
  assert.match(g, /<nav class="m-gal__nav" role="tablist" aria-orientation="vertical">/)
  assert.match(g, /class="m-gal__cat"[\s\S]*<MIcon :name="g\.icon" \/>/)
  assert.match(g, /<slot name="preview" :entry="e" \/>/)
  // the sizes are pages, not a strip of buttons
  assert.ok(!/m-gal__sizes|m-gal__size"/.test(g))
  assert.match(g, /class="m-gal__arrow m-gal__arrow--prev"[^>]*:aria-label=/); assert.match(g, /class="m-gal__arrow m-gal__arrow--next"[^>]*:aria-label=/)
  assert.match(g, /<div v-if="e\.sizeKeys\.length > 1" class="m-gal__dots" role="tablist"/); assert.match(g, /:aria-label="sizeName\(k\)"/)
  assert.match(g, /<Transition :name="dir > 0 \? 'gal-next' : 'gal-prev'" mode="out-in">/)
  assert.match(g, /event\.key === 'ArrowRight'[\s\S]*event\.key === 'ArrowLeft'/)
  assert.match(g, /class="m-gal__cap" aria-live="polite">\{\{ sizeName\(e\.sizeKey\) \}\} · \{\{ boxOfKey\(e\.sizeKey\) \}\}/)
  assert.equal((g.match(/class="m-gal__add"/g) || []).length, 1) // one prominent button
  assert.match(g, /:disabled="e\.added"/); assert.match(g, /e\.added \? T\.galAdded : T\.galAdd/)
  // a sideways drag on the preview is the swipe (48 px turns the page), any other direction takes the tile out
  assert.match(g, /mode = Math\.abs\(dx\) > Math\.abs\(dy\) \* 1\.2 \? 'swipe' : 'pick'/); assert.match(g, /Math\.abs\(dx\) > 48\) step\(e, dx < 0 \? 1 : -1\)/)
  // drawn at the real size where there is room, scaled down only where the tile is wider than the room
  assert.match(g, /const scaleOf = \(e\) => Math\.min\(1,/)
  const css = read('src/css/gallery.css')
  assert.match(css, /\.m-gal \{ display: grid; grid-template-columns: 212px minmax\(0, 1fr\)/)
  assert.match(css, /\.m-gal__card \{[^}]*border-radius: 28px/)
  assert.match(css, /\.m-gal__stage \{[^}]*transition: height 320ms/) // the preview visibly changes its size
  assert.match(css, /\.m-gal__add \{ height: 44px;/)
})

test('GL3: the layout switch of the sheet has a label and a 40 px hit area; GL4: the download tile shows the real latest version, not a decorative circle', () => {
  const css = read('src/css/gallery.css')
  assert.match(css, /\.m-dedit \.m-dsize\.m-dedit__layout > button \{[^}]*min-height: 40px; min-width: 40px;/)
  assert.match(readDash(), /<span class="m-dedit__layoutlabel">\{\{ T\.layoutLabel \}\}<\/span>/)
  assert.match(read('src/vue/homeEditTexts.js'), /layoutLabel: '概览布局'/)
  const h = read('src/vue/homeSmall.js')
  const line = h.match(/case 'download':[^\n]*/)[0]
  assert.ok(!/avatars/.test(line)); assert.match(line, /d\.versionOf\?\.\(r\.client\)/); assert.match(line, /pills: ver \? \[\{ label: `v\$\{ver\}` \}\] : null/)
})

test('a tile dragged out of the gallery: the gallery slides away, the tile is never dropped back on it, the way back is a snackbar; 添加 does the same without the drag', () => {
  const d = readDash()
  assert.match(d, /sheetAway\.value = true \/\/ the gallery slides away/)
  assert.match(d, /fromGallery: true, before/)
  assert.match(d, /d\.over = !d\.fromGallery && inside\(sheetEl\.value, x, y\)/)
  assert.match(d, /if \(d\.fromGallery\) placed\(d\.id, d\.before\)/)
  assert.match(d, /notify\.snack\([\s\S]*action: T\.value\.galUndo[\s\S]*layout\.restore\(before\)/)
  assert.match(d, /function addFromGallery\(id\) \{[\s\S]*addCard\(id\)[\s\S]*sheetAway\.value = true[\s\S]*placed\(id, before\)/)
  const css = read('src/css/gallery.css')
  assert.match(css, /\.m-dedit\.is-away \{ transform: translateY\(calc\(100% \+ 48px\)\); opacity: 0; pointer-events: none; \}/)
  assert.match(read('src/css/notify.css'), /body:has\(\.m-dedit__fab, \.m-dedit__selbar\) \.m-snackbar\[popover\] \{ bottom: calc\(var\(--m-dedit-clear\) \+ 12px\) !important; \}/)
  assert.doesNotMatch(css, /\.m-flip-/) // the tile that is placed arrives by the FLIP of flipGroup.js (a scale and a lift on the spring, a fade), not by the classes of a TransitionGroup
})

test('the gallery lists every tile of the overview, those on it marked, not only the ones that can still be added', () => {
  const d = readDash()
  assert.match(d, /const gallerySource = computed\(\(\) => \{\s*const all = allCards\.value\.filter\(\(c\) => c\.available && !c\.id\.startsWith\('pin:'\)\)/)
  assert.match(d, /added: shownIds\.value\.includes\(c\.id\)/)
})

test('the preview is the real tile at the real size and is never clipped: it is scaled to the stage (the card less its padding), in the box of its scaled size', () => {
  const vue = fs.readFileSync(new URL('../src/vue/MTileGallery.vue', import.meta.url), 'utf8')
  const dash = readDash()
  const css = fs.readFileSync(new URL('../src/css/gallery.css', import.meta.url), 'utf8')
  assert.match(vue, /STAGE_PAD = 28/); assert.match(vue, /widthOf\(e\) - STAGE_PAD/)
  assert.match(vue, /MAIN_PAD = 4/) // the room is the content width of the main area
  assert.match(vue, /class="m-gal__sized"/); assert.match(vue, /width: `\$\{e\.w \* scaleOf\(e\)\}px`/) // the layout box is the scaled one: nothing overflows
  assert.match(vue, /useFlip\(\{ root: grid, select: '\.m-gal__card'/) // a card that grows moves the others on the spring, by FLIP: no TransitionGroup that clones a card on every update of a live preview
  assert.doesNotMatch(vue, /<TransitionGroup|import \{[^}]*TransitionGroup/)
  assert.match(dash, /class="m-dash m-gal__dash"/); assert.match(dash, /class="m-dash__cell m-gal__tile"/) // the frame of the overview: radius, surface, stretch
  assert.match(css, /\.m-gal__stage \{ border-radius: 0; background: none; \}/) // no box inside the card
})

test('a card keeps its column while its tile is readable there and grows only when it would be scaled below 0.7; the arrows are beside the dots', () => {
  const vue = fs.readFileSync(new URL('../src/vue/MTileGallery.vue', import.meta.url), 'utf8')
  const css = fs.readFileSync(new URL('../src/css/gallery.css', import.meta.url), 'utf8')
  assert.match(vue, /MIN_SCALE = 0\.7/); assert.match(vue, /props\.fit === 'auto' && \(colW\.value - STAGE_PAD\)/)
  assert.match(vue, /class="m-gal__pager"/)
  assert.match(css, /\.m-gal__pager \.m-gal__arrow \{ position: static;/)
})
