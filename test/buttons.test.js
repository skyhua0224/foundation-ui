// M3 Expressive buttons and icon buttons: the five sizes of ButtonXSmall..XLargeTokens and XSmall..XLargeIconButtonTokens (Compose Material3, androidx-main),
// the square shape, the pressed shape per size, toggle buttons that swap round and square when selected.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/css/components.css', import.meta.url), 'utf8')
const btn = readFileSync(new URL('../src/vue/MButton.vue', import.meta.url), 'utf8')
const ib = readFileSync(new URL('../src/vue/MIconButton.vue', import.meta.url), 'utf8')
const vars = (sel) => { const m = css.match(new RegExp(`(?:^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`)); assert.ok(m, sel); return Object.fromEntries([...m[1].matchAll(/(--[a-z-]+): ([^;]+);/g)].map((x) => [x[1], x[2]])) }
const corner = { 'corner-small': 8, 'corner-medium': 12, 'corner-large': 16, 'corner-extra-large': 28 }
const px = (v) => (v.startsWith('var(--md-sys-shape-') ? corner[v.slice(19, -1)] : parseFloat(v))

test('buttons: the five heights, side spaces, icon gaps, icons, outlines, square and pressed corners of the spec', () => {
  const base = vars('.m-btn')
  const spec = { //       h    pad  gap icon outline square pressed (ButtonXSmall..XLargeTokens)
    xs: [32, 16, 8, 20, 1, 12, 8], s: [40, 16, 8, 20, 1, 12, 8], m: [56, 24, 8, 24, 1, 16, 12], l: [96, 48, 12, 32, 2, 28, 16], xl: [136, 64, 16, 40, 3, 28, 16],
  }
  for (const [size, want] of Object.entries(spec)) {
    const own = size === 's' ? {} : vars(size === 'xs' ? '.m-btn--xs, .m-btn--sm' : size === 'm' ? '.m-btn--m, .m-btn--lg' : `.m-btn--${size}`)
    const v = { ...base, ...own }
    const got = ['--m-btn-h', '--m-btn-pad', '--m-btn-gap', '--m-btn-icon', '--m-btn-outline', '--m-btn-square', '--m-btn-pressed'].map((k) => px(v[k]))
    assert.deepEqual(got, want, size)
  }
  assert.match(css, /\.m-btn:active \{ --m-btn-radius: var\(--m-btn-pressed\); \}/)
  assert.doesNotMatch(css, /\.m-btn:active \{[^}]*scale/)
})

test('the label grows with the size (ButtonDefaults.textStyleFor): labelLarge, titleMedium, headlineSmall, headlineLarge', () => {
  assert.match(css, /\.m-btn--m, \.m-btn--lg \{[^}]*font: var\(--m-title-medium\)/)
  assert.match(css, /\.m-btn--l \{[^}]*font: var\(--m-headline-small\)/)
  assert.match(css, /\.m-btn--xl \{[^}]*font: var\(--m-headline-large\)/)
})

test('toggle buttons: round becomes square and square becomes round when selected, with the selected colours', () => {
  assert.match(css, /\.m-btn\[aria-pressed='true'\] \{ --m-btn-rest: var\(--m-btn-square\); \}/)
  assert.match(css, /\.m-btn--square\[aria-pressed='true'\] \{ --m-btn-rest: calc\(var\(--m-btn-h\) \/ 2\); \}/)
  assert.match(css, /\.m-btn--tonal\[aria-pressed='true'\] \{ --m-btn-bg: var\(--md-sys-color-secondary\)/)
  assert.match(css, /\.m-btn--outlined\[aria-pressed='true'\] \{ --m-btn-bg: var\(--md-sys-color-inverse-surface\)/)
  assert.match(css, /\.m-btn\[aria-pressed='false'\]:not\([^)]*\) \{ --m-btn-bg: var\(--md-sys-color-surface-container\)/)
  assert.match(btn, /:aria-pressed="selected === undefined \? undefined : String\(selected\)"/)
  assert.match(btn, /selected: \{ type: Boolean, default: undefined \}/)
  assert.match(btn, /emit\('update:selected', !props\.selected\)/)
  assert.match(btn, /const SIZES = \{ xs: 'xs', sm: 'sm', s: '', md: '', m: 'm', lg: 'lg', l: 'l', xl: 'xl' \}/)
})

test('icon buttons: five sizes x narrow, uniform, wide; square and pressed corners; toggle swaps the shape', () => {
  const spec = { //  h   icon narrow uniform wide square pressed (XSmall..XLargeIconButtonTokens: icon + leading + trailing space)
    xs: [32, 20, 28, 32, 40, 12, 8], s: [40, 24, 32, 40, 52, 12, 8], m: [56, 24, 48, 56, 72, 16, 12], l: [96, 32, 64, 96, 128, 28, 16], xl: [136, 40, 104, 136, 184, 28, 16],
  }
  for (const [size, want] of Object.entries(spec)) {
    const v = vars(`.m-icon-btn--${size}`)
    assert.deepEqual(['--ib-h', '--ib-icon', '--ib-w-narrow', '--ib-w', '--ib-w-wide', '--ib-square', '--ib-pressed'].map((k) => px(v[k])), want, size)
  }
  assert.match(css, /\.m-icon-btn\.is-sized:active \{ border-radius: var\(--ib-pressed\); \}/)
  assert.match(css, /\.m-icon-btn\[aria-pressed='true'\] \{ --ib-rest: var\(--ib-square\); \} \.m-icon-btn--square\[aria-pressed='true'\] \{ --ib-rest: calc\(var\(--ib-h\) \/ 2\); \}/)
  assert.match(ib, /size && width !== 'uniform' && `m-icon-btn--\$\{width\}`/)
  assert.match(ib, /'is-sized': !!size/)
})

// The pressed shape morphs between the rest radius and the pressed one with a spring that overshoots (--m-spring-fast-spatial reaches 1.09). A rest radius of 9999px cannot be
// interpolated: the radius stays larger than half the height (a capsule) for almost the whole transition, and the overshoot takes it below zero (square corners, 0), so a press
// showed a capsule, a right-angled box for about 200 ms and then a one-frame jump back. The rest radius is half the real height, a finite value of the same order as the pressed one.
test('the rest radius of a button is half its height, never 9999px (a finite value the pressed-shape spring can interpolate)', () => {
  assert.match(css, /--m-btn-rest: calc\(var\(--m-btn-h\) \/ 2\); --m-btn-radius: var\(--m-btn-rest\);/)
  assert.match(css, /\.m-icon-btn\.is-sized \{ --ib-rest: calc\(var\(--ib-h\) \/ 2\);/)
  assert.match(css, /\.m-icon-btn--square\[aria-pressed='true'\] \{ --ib-rest: calc\(var\(--ib-h\) \/ 2\); \}/)
  assert.doesNotMatch(css, /--(?:m-btn|ib)-rest: 9999px/)
  const expressive = readFileSync(new URL('../src/css/expressive.css', import.meta.url), 'utf8')
  const toolbar = expressive.match(/\n\.m-toolbar__item \{([^}]*)\}/)
  assert.ok(toolbar && /height: 48px/.test(toolbar[1]) && /border-radius: 24px/.test(toolbar[1]) && !/9999px/.test(toolbar[1]))
})

test('a rule that resizes a .m-btn sets --m-btn-h too, and none overrides its border-radius (the rest radius follows the height, the pressed shape stays)', () => {
  for (const file of ['expressive', 'guideintro', 'installer', 'onboard']) {
    const text = readFileSync(new URL(`../src/css/${file}.css`, import.meta.url), 'utf8')
    for (const rule of text.matchAll(/(?:^|\n|\{)\s*([^{}\n]*\.m-btn[^{}]*)\{([^}]*)\}/g)) {
      const body = rule[2]
      if (/(?:^|[;\s])(?:min-)?height:/.test(body) && !/--m-btn-h:/.test(body)) assert.fail(`${file}.css: ${rule[1].trim()} sets a height without --m-btn-h`)
      assert.doesNotMatch(body, /(?:^|[;\s])border-radius:/, `${file}.css: ${rule[1].trim()} overrides the button radius`)
    }
  }
})
