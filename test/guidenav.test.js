import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildGuideSteps, prevIndex } from '../src/vue/guideModel.js'
import { guideTexts } from '../src/vue/guideTexts.js'

const flow = readFileSync(new URL('../src/vue/MGuideFlow.vue', import.meta.url), 'utf8')

test('every step but the first has 上一步 in the foot, and going back never leaves the flow', () => {
  assert.match(flow, /<MButton v-if="idx > 0 && !sub" class="m-guide__prev"[^>]*@click="back"><span class="m-guide__lbl">\{\{ T\.back \}\}<\/span><\/MButton>/, 'inside a page of the done page the back arrow and the foot button return to the done page')
  assert.match(flow, /<button v-if="idx > 0 \|\| sub" type="button" class="m-page__back"/)
  assert.equal(guideTexts('zh').back, '上一步')
  const steps = buildGuideSteps()
  assert.equal(prevIndex(0), 0)
  for (let i = 1; i < steps.length; i += 1) assert.equal(prevIndex(i), i - 1)
})

test('the progress bar has one clickable segment per step of the flow, enabled for every step reached before', () => {
  assert.match(flow, /<li v-for="\(s, i\) in counted" :key="s\.id">/, 'the segments follow the steps of the flow (a step left out has none; the done page is the end, not a step)')
  assert.match(flow, /:disabled="i > maxIdx \|\| busy"[^>]*@click="go\(i\)"/)
  assert.match(flow, /'is-done': i < idx \|\| id === 'done' \|\| progress\.done\.includes\(s\.id\)/)
})

test('the pairing step says where to scan in the client', () => {
  assert.match(flow, /T\.pair\.scanHow/)
  assert.match(guideTexts('zh').pair.scanHow, /扫码/)
  assert.match(guideTexts('en').pair.scanHow, /Scan/)
})

test('on a phone the foot is one row that never wraps: compact 40 high buttons, 上一步 and the long labels as icons with a label for screen readers', () => {
  const css = readFileSync(new URL('../src/css/guideintro.css', import.meta.url), 'utf8')
  const phone = css.slice(css.indexOf('@media (max-width: 599.98px) {'))
  assert.doesNotMatch(css, /flex-wrap: wrap;[^}]*\} \.m-onboard \.m-guide \.m-guide__actions \.m-btn:not/)
  assert.match(phone, /flex-direction: row; flex-wrap: nowrap;/)
  assert.match(phone, /height: 40px; min-height: 40px;[^}]*font: var\(--m-label-medium\)/)
  assert.match(phone, /\.m-guide__prev \.m-guide__lbl/)
  assert.match(flow, /class="m-guide__prev"[^>]*:aria-label="T\.back"/)
})

test('the guide window sets border-box itself: it is teleported out of .m-app, so rows no longer run past the group on a phone', () => {
  const css = readFileSync(new URL('../src/css/onboard.css', import.meta.url), 'utf8')
  assert.match(css, /\.m-onboard, \.m-onboard \*, \.m-onboard \*::before, \.m-onboard \*::after \{ box-sizing: border-box; \}/)
})

test('the 打开应用页 row of the first stream check wraps its button under the text on a phone', () => {
  assert.match(flow, /<MItem wrap icon="build" :title="callbacks\.restoreApps \? T\.connect\.restore : T\.connect\.openApps"/)
})
