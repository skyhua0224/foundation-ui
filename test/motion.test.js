import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { DEFAULTS, MOTIONS, normalize } from '../src/appearance/appearance.js'
import { motionMode, reducedMotion } from '../src/appearance/motion.js'

const dir = new URL('../src/css/', import.meta.url)
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.css')).map((f) => [f, fs.readFileSync(new URL(f, dir), 'utf8')])
const toMs = (v) => (v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000)

// every declaration that loops: animation shorthand with `infinite`
const loops = []
for (const [file, css] of files) {
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decl = m[2]
    for (const a of decl.matchAll(/animation:\s*([^;]*\binfinite\b[^;]*)/g)) loops.push({ file, sel: m[1].trim().slice(-60), value: a[1] })
  }
}

test('no loop is fast: every infinite animation lasts at least 0.6 s, a pulse 1.6 s, a decorative turn 9 s', () => {
  assert.ok(loops.length > 10)
  const SPINNERS = /m-loading-turn|m-update-spin|m-turn 1\.4s|m-dturn 6s|m-wave-circle-spin 6000ms/ // busy spinners that turn once in a second or two on purpose (the circular indeterminate: 1080 deg in 6 s, ProgressIndicator.kt)
  for (const l of loops) {
    for (const part of l.value.split(/,(?![^(]*\))/)) {
      if (!/\binfinite\b/.test(part)) continue
      const dur = /(\d*\.?\d+m?s)/.exec(part)
      assert.ok(dur, `${l.file} ${part}`)
      const ms = toMs(dur[1])
      assert.ok(ms >= 600, `${l.file}: ${part} is a strobe (${ms} ms)`)
      if (/pulse/.test(part)) assert.ok(ms >= 1600, `${l.file}: ${part} pulses faster than 1.6 s`)
      if (/turn|spin|rotate/.test(part) && !SPINNERS.test(part)) assert.ok(ms >= 9000, `${l.file}: ${part} turns faster than 9 s`)
    }
  }
})

test('reduced motion never speeds a loop up: one iteration, an instant, a slow fade for busy indicators; the setting overrides the system', () => {
  const css = fs.readFileSync(new URL('motion.css', dir), 'utf8')
  assert.match(css, /animation-iteration-count: 1 !important/)
  // a transition is switched off, not shortened: `transition-duration: 0.01ms` on every element keeps `transition-property: all` and makes every style change of every element a transition object (≈790 on a dialog's close, ≈65 ms)
  assert.ok(!/transition-duration/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'no transition-duration trick on the universal selector')
  assert.equal((css.match(/transition: none !important/g) || []).length, 2)
  assert.match(css, /html:not\(\[data-motion='full'\]\)/)
  assert.match(css, /html\[data-motion='reduced'\]/)
  assert.match(css, /m-rm-busy 2s ease-in-out infinite !important/)
  // the old global rule (a 0.01 ms duration with the animation still looping) is gone
  assert.ok(!/animation-duration: 0\.01ms !important[^}]*\}\s*\}/.test(fs.readFileSync(new URL('base.css', dir), 'utf8')))
  // no rule sets a sub-50 ms duration on an infinite animation
  for (const [file, text] of files) for (const m of text.matchAll(/\{([^{}]*)\}/g)) if (/infinite/.test(m[1])) assert.ok(!/animation-duration:\s*0?\.0\d*ms/.test(m[1]), file)
  // every reduced-motion block answers the setting too (full motion is not undone by the system, reduced is applied without it)
  for (const [file, text] of files) {
    if (file === 'motion.css') continue
    const n = (text.match(/@media \(prefers-reduced-motion: reduce\)/g) || []).length
    if (!n) continue
    assert.equal((text.match(/html\[data-motion='reduced'\]/g) || []).length >= n, true, file)
    assert.ok(!/@media \(prefers-reduced-motion: reduce\) \{ (?!html)/.test(text), `${file}: a reduced-motion block with a bare selector`)
  }
})

test('the setting: full motion by default (); the system is followed only when chosen; reduced decides without it', () => {
  assert.deepEqual([...MOTIONS], ['system', 'full', 'reduced'])
  assert.equal(DEFAULTS.motion, 'full')
  assert.equal(normalize({}).motion, 'full')
  assert.equal(normalize({ motion: 'reduced' }).motion, 'reduced')
  assert.equal(normalize({ motion: 'fast' }).motion, 'full')
  // a record from before the rule that says 'system' only kept the old default: it reads as full; one written under the rule keeps the choice
  assert.equal(normalize({ motion: 'system' }).motion, 'full')
  assert.equal(normalize({ motion: 'system', motionRule: 2 }).motion, 'system')
  assert.equal(normalize(normalize({ motion: 'system', motionRule: 2 })).motion, 'system')
  const dataset = {}
  globalThis.document = { documentElement: { dataset } }
  globalThis.matchMedia = () => ({ matches: true })
  try {
    assert.equal(motionMode(), 'full'); assert.equal(reducedMotion(), false) // nothing marked yet: the system asks for reduced motion and is not followed
    dataset.motion = 'system'; assert.equal(reducedMotion(), true) // chosen: the system's setting
    dataset.motion = 'full'; assert.equal(reducedMotion(), false) // a machine whose system turns animations off keeps full motion
    dataset.motion = 'reduced'; globalThis.matchMedia = () => ({ matches: false }); assert.equal(reducedMotion(), true)
  } finally { delete globalThis.document; delete globalThis.matchMedia }
})

test('the spring durations and the theme transitions answer the setting too (the system alone does not zero them)', () => {
  const springs = fs.readFileSync(new URL('../src/tokens/springs.css', import.meta.url), 'utf8')
  assert.ok(!/@media \(prefers-reduced-motion: reduce\) \{\s*:root \{/.test(springs), 'a bare :root under the media query zeroes the springs for a person who has full motion')
  assert.match(springs, /@media \(prefers-reduced-motion: reduce\) \{\s*:root:not\(\[data-motion='full'\]\) \{/)
  assert.match(springs, /:root\[data-motion='reduced'\] \{/)
  const ap = fs.readFileSync(new URL('../src/css/appearance.css', import.meta.url), 'utf8')
  assert.ok(!/@media \(prefers-reduced-motion: reduce\) \{ html\.m-/.test(ap), 'appearance.css: a reduced-motion rule without the setting')
  // the mark is on the page from the moment the library loads, before the first appearance is applied
  assert.match(fs.readFileSync(new URL('../src/vue/useAppearance.js', import.meta.url), 'utf8'), /!document\.documentElement\.dataset\.motion\) document\.documentElement\.dataset\.motion = read\(\)\.motion/)
})

test('the JS that moves things asks the one question', () => {
  const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
  for (const p of ['src/appearance/apply.js', 'src/vue/useAppearance.js', 'src/vue/tips.js', 'src/vue/MStatusBell.vue', 'src/vue/MDashNews.vue', 'src/vue/MDockClock.vue']) {
    const s = read(p)
    assert.ok(s.includes("reducedMotion"), p)
    assert.ok(!s.includes("matchMedia?.('(prefers-reduced-motion: reduce)')") && !/matchMedia\('\(prefers-reduced-motion: reduce\)'\)/.test(s.replace(/function reducedMotion[\s\S]*/, '')), p)
  }
})

// 动画 says what 跟随系统 means now; the welcome flow has a step with the same three choices and a live sample
import { motionSystemLabel, appearanceTexts } from '../src/vue/appearanceTexts.js'
import { buildGuideSteps } from '../src/vue/guideModel.js'
import { guideTexts } from '../src/vue/guideTexts.js'
import { readFileSync } from 'node:fs'

test('跟随系统 carries the system\'s current state in the wording of the page, in both languages', () => {
  assert.equal(motionSystemLabel(appearanceTexts('zh'), true), '跟随系统（当前：减少）')
  assert.equal(motionSystemLabel(appearanceTexts('zh'), false), '跟随系统（当前：完整）')
  assert.equal(motionSystemLabel(appearanceTexts('en'), true), 'Follow system (now: Reduced)')
  assert.equal(motionSystemLabel(appearanceTexts('en'), false), 'Follow system (now: Full)')
})

test('the 个性化 page shows that label on the choice 跟随系统 and follows a change of the system\'s setting', () => {
  const src = readFileSync(new URL('../src/vue/MAppearance.vue', import.meta.url), 'utf8')
  assert.ok(src.includes("o.value === 'system' && motionWide.value ? { ...o, label: motionSystemLabel(T.value, sysReduced.value) }"), 'wide enough: the state is in the label')
  assert.ok(src.includes("<p v-if=\"!motionWide && s.motion === 'system'\" class=\"m-ap__note\">{{ motionSystemLabel(T, sysReduced) }}</p>"), 'too narrow for it (a phone, a side sheet): the same words in the line under the row')
  assert.ok(src.includes('watchSystemMotion((v) => { sysReduced.value = v })'))
})

test('the animations are an optional page of the done page, with a title and no lead', () => {
  assert.ok(!buildGuideSteps().some((s) => s.id === 'motion'), 'not a step of the flow')
  assert.deepEqual(buildGuideSteps().at(-1).optional.slice(0, 2), ['appearance', 'motion'], 'the look and then the animations, first in the list')
  assert.equal(guideTexts('zh').titles.motion, '动画'); assert.equal(guideTexts('en').titles.motion, 'Animations')
  assert.equal(guideTexts('zh').leads.motion, ''); assert.equal(guideTexts('en').leads.motion, '')
  assert.equal(guideTexts('zh').done.items.motion.title, '动效')
})

test('the step offers the three choices of 个性化, saves them by the appearance path and shows a sample that follows the motion rule', () => {
  const flow = readFileSync(new URL('../src/vue/MGuideMotion.vue', import.meta.url), 'utf8')
  assert.ok(readFileSync(new URL('../src/vue/MGuideFlow.vue', import.meta.url), 'utf8').includes(`<MGuideMotion v-else-if="pageId === 'motion'" :locale="locale" />`))
  assert.ok(flow.includes("[['system', 'contrast', motionSystemLabel(T.value, sysReduced.value)], ['full', 'slow_motion_video', T.value.motionFull], ['reduced', 'speed', T.value.motionReduced]]"))
  assert.ok(flow.includes('@click="appearance.set({ motion: o.value })"') && flow.includes(':aria-checked="appearance.state.motion === o.value"'))
  assert.ok(flow.includes('<span class="m-guide__motion-dot"></span>') && flow.includes('<MLoading size="40px" />'), 'a running dot and the product\'s busy indicator')
  const css = readFileSync(new URL('../src/css/expressive.css', import.meta.url), 'utf8')
  assert.ok(!/m-guide__motion[^{]*\{[^}]*prefers-reduced|m-guide-fade/.test(css), 'the sample has no motion rule of its own: motion.css stops the loop and fades the busy indicator for reduced motion, the same as everywhere')
  const rm = readFileSync(new URL('../src/css/motion.css', import.meta.url), 'utf8')
  assert.ok(rm.includes('.m-loading__shape') && rm.includes('m-rm-busy'), 'the rule the sample relies on')
})
