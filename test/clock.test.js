import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { CLOCK_ALIGNS, CLOCK_FACES, CLOCK_SIZES, DEFAULTS, normalize } from '../src/appearance/appearance.js'
import { DOT_R, HANZI_CHARS, dotPaths, hanziNumber, hanziTime } from '../src/appearance/clockFaces.js'
import { CLOCK_INK } from '../src/appearance/clockInk.js'
import { readDash } from './dashSource.js'

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const NEW = ['flex', 'tall', 'dots', 'outline', 'flip', 'hanzi']

test('the dock clock: fifteen faces, four sizes, seconds off; defaults Default, 中, right; anything else falls back', () => {
  assert.deepEqual([...CLOCK_FACES], ['default', 'metro', 'calligraphy', 'inflate', 'growth', 'handwritten', 'numoverlap', 'analog', 'minimal', ...NEW])
  assert.deepEqual([...CLOCK_ALIGNS], ['left', 'center', 'right'])
  assert.deepEqual([...CLOCK_SIZES], ['s', 'm', 'l', 'xl'])
  assert.deepEqual([DEFAULTS.clockFace, DEFAULTS.clockAlign, DEFAULTS.clockSize, DEFAULTS.clockSeconds], ['default', 'right', 'm', false])
  const d = normalize(null)
  assert.deepEqual([d.clockFace, d.clockAlign, d.clockSize, d.clockSeconds], ['default', 'right', 'm', false])
  const v = normalize({ clockFace: 'flip', clockAlign: 'left', clockSize: 'xl', clockSeconds: true })
  assert.deepEqual([v.clockFace, v.clockAlign, v.clockSize, v.clockSeconds], ['flip', 'left', 'xl', true])
  const x = normalize({ clockFace: 'nope', clockAlign: 'up', clockSize: 'huge', clockSeconds: 'yes' })
  assert.deepEqual([x.clockFace, x.clockAlign, x.clockSize, x.clockSeconds], ['default', 'right', 'm', false])
})

test('文字: the time in Chinese words, 24 hours, two o\'clock is 两点, a full hour is 整, and only characters the font holds', () => {
  assert.deepEqual([0, 7, 10, 14, 20, 36, 59].map(hanziNumber), ['零', '七', '十', '十四', '二十', '三十六', '五十九'])
  assert.deepEqual(hanziTime(10, 32, 7), { hour: '十点', minute: '三十二分', second: '零七秒' })
  assert.deepEqual(hanziTime(2, 5, 0), { hour: '两点', minute: '零五分', second: '零秒' })
  assert.deepEqual(hanziTime(22, 0, 41), { hour: '二十二点', minute: '整', second: '四十一秒' })
  assert.equal(hanziTime(0, 10).hour, '零点')
  for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m++) for (const t of Object.values(hanziTime(h, m, m))) for (const c of t) assert.ok(HANZI_CHARS.includes(c), `${h}:${m} ${c}`)
  // the font face's unicode-range is exactly those characters (and the space)
  const range = /font-family: 'Clock Brush'[^}]*unicode-range: ([^;]+);/.exec(read('src/fonts/fonts.css'))[1].split(',').map((s) => parseInt(s.trim().slice(2), 16))
  assert.deepEqual(range.sort((a, b) => a - b), [0x20, ...[...HANZI_CHARS].map((c) => c.codePointAt(0))].sort((a, b) => a - b))
})

test('dot matrix: 5 × 7 dots a digit (lit or unlit, never both), every digit distinct, the box tight to the dots, seconds widen it', () => {
  const count = (d) => (d.match(/M/g) || []).length
  const lit = new Set()
  for (let i = 0; i < 10; i++) { const p = dotPaths(`${i}${i}`, `${i}${i}`); assert.equal(count(p.off) + count(p.h) + count(p.m), 4 * 35); lit.add(p.h) }
  assert.equal(lit.size, 10)
  const a = dotPaths('10', '32'), b = dotPaths('10', '32', '07')
  assert.equal(count(a.colon), 2)
  assert.equal(count(b.off) + count(b.h) + count(b.m) + count(b.s), 6 * 35)
  assert.ok(b.ratio > a.ratio)
  assert.equal(a.box, '0.1 0.1 24.8 6.8')
  // 小 and 中 leave more room between the dots; an unlit dot is about half a lit one
  const small = dotPaths('10', '32', '', DOT_R.m), big = dotPaths('10', '32', '', DOT_R.xl)
  assert.ok(DOT_R.m < DOT_R.xl && DOT_R.s === DOT_R.m && DOT_R.l === DOT_R.xl)
  const rOf = (d) => +/a([\d.]+)/.exec(d)[1]
  assert.ok(rOf(small.h) < rOf(big.h) && rOf(big.off) <= rOf(big.h) * 0.6)
  // the ink edge: a leading or trailing 1 has a dark outer column, given back as a margin; the seconds count as full
  assert.deepEqual([dotPaths('10', '32').inL, dotPaths('20', '32').inL, dotPaths('10', '31').inR, dotPaths('10', '31', '07').inR], [1, 0, 1, 0])
})

test('dot matrix colours: the lit dots in full contrast (primary, on-surface), the unlit ones very faint', () => {
  const css = read('src/css/clock.css')
  assert.match(css, /\.m-clock__dots-h, \.m-clock__dots-c \{ fill: var\(--md-sys-color-primary\); \}/)
  assert.match(css, /\.m-clock__dots-m, \.m-clock__dots-s \{ fill: var\(--md-sys-color-on-surface\); \}/)
  const off = +/\.m-clock__dots-off \{ fill: color-mix\(in srgb, var\(--md-sys-color-on-surface\) (\d+)%, transparent\); \}/.exec(css)[1]
  assert.ok(off <= 8, `unlit ${off} %`)
})

test('every face has its style and its box factors; the breathing faces breathe on the minute; nothing moves with reduced motion', () => {
  const css = read('src/css/clock.css')
  for (const f of CLOCK_FACES) {
    assert.match(css, new RegExp(`\\.m-clock--${f}\\b`), f)
    assert.match(css, new RegExp(`\\.m-clock--${f} \\{ --hf: [\\d.]+;( --hf-s: [\\d.]+;)? --wf: [\\d.]+; --wf-s: [\\d.]+;`), `${f}: --hf --wf --wf-s`)
  }
  for (const f of ['default', 'metro', 'calligraphy', 'inflate', 'handwritten', 'numoverlap', 'minimal', 'flex', 'outline']) assert.match(css, new RegExp(`\\.m-clock--${f}\\.is-tick`), f)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^}]*animation: none !important/)
  assert.match(css, /html\[data-motion='reduced'\] \.m-clock \*[^{]*\{ animation: none !important; transition: none !important; \}/)
  // the flip turns on transforms only, the second hand sweeps on a transform
  for (const k of ['m-flip-a', 'm-flip-b', 'm-clock-sweep']) { const body = new RegExp(`@keyframes ${k} \\{(.*)\\}`).exec(css)[1]; assert.doesNotMatch(body.replace(/transform/g, ''), /[a-z-]+:/, k) }
})

test('the ink inset: measured from the glyphs, given back as em margins, the dock header a size container with a stepless inset ≥ 24 px from 840 px', () => {
  const css = read('src/css/clock.css')
  assert.match(css, /\.m-clock \[data-ink\] \{ margin-left: calc\(\(var\(--ovl, 0\) \+ var\(--ink-xl, 0\)\) \* 1em\); margin-right: calc\(\(var\(--ovr, 0\) \+ var\(--ink-xr, 0\)\) \* 1em\); \}/)
  const inset = /--m-clock-inset: clamp\((\d+)px, calc\(([\d.]+)vw \+ (\d+)px\), (\d+)px\)/.exec(css)
  assert.ok(inset, 'the inset')
  const at = (vw) => Math.min(+inset[4], Math.max(+inset[1], (+inset[2] * vw) / 100 + +inset[3]))
  assert.ok(at(840) >= 24 && at(1199) >= 24 && at(1440) > at(840) && at(360) >= 16 && at(5120) <= 48)
  for (let w = 360; w < 5120; w++) assert.ok(Math.abs(at(w + 1) - at(w)) < 0.05, `stepless at ${w}`) // no size-class step: a resize never jumps
  assert.match(css, /\.m-dock__head \{ container: m-clock-head \/ size;[^}]*padding-inline: var\(--m-clock-inset\)/)
  // sizes in container units: never larger than the header (no collision with the banner, the tiles or the edge), no script in the resize path
  for (const z of CLOCK_SIZES) assert.match(css, new RegExp(`\\.m-dock__head > \\.m-clock\\.is-${z} \\{ --clock-size: max\\(28px, min\\([^;]*var\\(--clock-fit\\)\\)\\); \\}`), z)
  assert.match(css, /--clock-fit: min\(calc\(\(100cqh - var\(--clock-text-h\)\) \/ var\(--hf-now\)\), calc\(\(100cqw - var\(--clock-text-w\)\) \/ var\(--wf-now\)\)\)/)
  const vue = read('src/vue/MDockClock.vue')
  assert.match(vue, /CLOCK_INK\[`\$\{props\.face\}:\$\{roleOf\(p\)\}`\]/)
  assert.doesNotMatch(vue, /addEventListener\('resize'|ResizeObserver/) // the size follows the window in CSS, not in script
  // the italic faces get no exception: they are measured like the others
  for (const f of ['calligraphy', 'handwritten']) assert.match(vue, /<span v-else-if="LINE\.has\(face\)" class="m-clock__line" data-ink/, f)
})

test('the glyph ink table (measured from pixels): every role of every text face, every glyph it can draw; the italics lean right, the Outline layer reaches right', () => {
  const roles = { default: ['l', 's'], metro: ['l', 's'], inflate: ['l', 's'], outline: ['l', 's'], calligraphy: ['line', 's'], handwritten: ['line', 's'], minimal: ['line', 's'], tall: ['line', 's'], growth: ['line', 's'], flex: ['fx0', 'fx4', 's'], numoverlap: ['d0', 'd3', 's'], hanzi: ['l', 'ls'] }
  for (const [f, rs] of Object.entries(roles)) for (const r of rs) {
    const t = CLOCK_INK[`${f}:${r}`]
    assert.ok(t, `${f}:${r}`)
    for (const c of f === 'hanzi' ? HANZI_CHARS : '0123456789') { assert.equal(t[c]?.length, 2, `${f}:${r} ${c}`); for (const v of t[c]) assert.ok(Math.abs(v) < 0.4, `${f}:${r} ${c} ${v}`) }
  }
  // what the team saw (G2c): the italic faces' ink passes the box on the right, and the table knows it
  for (const f of ['calligraphy', 'handwritten']) assert.ok(Object.values(CLOCK_INK[`${f}:line`]).some(([, r]) => r > 0), f)
  assert.ok(Object.entries(CLOCK_INK['outline:l']).filter(([c]) => c !== '1').every(([, [, r]]) => r > 0), 'the Outline layer (a tabular 1 is narrow in a wide box)')
  // every face that has [data-ink] lines has a table
  const vue = read('src/vue/MDockClock.vue')
  assert.match(vue, /<span v-else class="m-clock__line" data-ink/)
})

test('seconds: one shared timer on the whole second, paused while hidden; the tick is transform/opacity and skipped with reduced motion', () => {
  const faces = read('src/appearance/clockFaces.js')
  assert.match(faces, /step - \(t % step\)/)
  assert.match(faces, /visibilitychange/)
  assert.match(faces, /hidden\) return/)
  const vue = read('src/vue/MDockClock.vue')
  assert.match(vue, /onClockTick\(/)
  assert.doesNotMatch(vue, /setInterval/)
  const tick = /watch\(ss, \(\) => \{([^]*?)\}, \{ flush: 'post' \}\)/.exec(vue)[1]
  assert.match(tick, /reducedMotion\(\)/)
  assert.match(tick, /\[\{ transform: '[^']+', opacity: [\d.]+ \}, \{ transform: 'none', opacity: 1 \}\]/)
  assert.match(tick, /props\.face === 'dots' \? \[\{ opacity: [\d.]+ \}, \{ opacity: 1 \}\]/)
  assert.doesNotMatch(read('src/css/clock.css').match(/@keyframes m-clock-breathe-hand \{[^\n]*/)[0], /rotate/) // the breathing never moves the ink towards the date
})

test('open fonts only: every font file of the clock has its licence text and a row in FONTS.md, all OFL-1.1', () => {
  const css = read('src/fonts/fonts.css')
  const files = [...css.matchAll(/url\(\.\/(clock-[a-z-]+\.woff2)\)/g)].map((m) => m[1])
  assert.equal(files.length, 5)
  const doc = read('src/fonts/FONTS.md')
  for (const f of files) { assert.ok(fs.existsSync(new URL(`../src/fonts/${f}`, import.meta.url)), f); assert.ok(doc.includes(f), f) }
  for (const n of ['Google-Sans-Flex', 'roboto-flex', 'Fraunces', 'Caveat', 'MaShanZheng']) assert.match(read(`src/fonts/LICENSE-${n}.txt`), /SIL Open Font License, Version 1\.1/, n)
  const families = new Set([...read('src/css/clock.css').matchAll(/font-family: ([^;]+);/g)].flatMap((m) => m[1].split(',').map((x) => x.trim().replace(/['"]/g, ''))))
  const allowed = new Set(['Clock Flex', 'Roboto Flex', 'sans-serif', 'Clock Roboto Flex', 'Clock Fraunces', 'Georgia', 'serif', 'Clock Caveat', 'Segoe Print', 'cursive', 'Clock Brush', 'KaiTi', 'STKaiti'])
  for (const f of families) assert.ok(allowed.has(f), f)
})

test('the dock header takes the position; 个性化 offers face, size, position and seconds, with live previews', () => {
  const dash = readDash()
  assert.match(dash, /<header class="m-dock__head" :data-align="appearance\.state\.clockAlign" :style="dockHeadMin \? \{ minHeight: `\$\{dockHeadMin\}px` \} : undefined">/)
  assert.match(dash, /<MDockClock class="m-dock__time" :face="appearance\.state\.clockFace"/)
  assert.match(dash, /appearance\.set\(\{ clockAlign: a \}\)/)
  const ap = read('src/vue/MAppearance.vue')
  assert.match(ap, /const FACES = CLOCK_FACES/)
  for (const k of ['clockFace: f', 'clockAlign: v', 'clockSize: v', 'clockSeconds: v']) assert.ok(ap.includes(`ap.set({ ${k} })`), k)
  assert.match(ap, /<MDockClock :face="f"[^>]*:seconds="s\.clockSeconds" preview \/>/)
  // the size and the seconds reach the dock clock through the appearance, so the dock's markup needs no change
  assert.match(read('src/vue/MDockClock.vue'), /props\.size \|\| ap\.clockSize/)
})
