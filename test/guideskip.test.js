import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { guideTexts } from '../src/vue/guideTexts.js'

const source = readFileSync(new URL('../src/vue/MGuideFlow.vue', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../src/vue/MConnectPanel.vue', import.meta.url), 'utf8')

// The foot has 下一步 on every step. Only the two steps that ask the person to do something (pair, try) add 跳过这一步, and 下一步 waits there until it is done:
// two buttons that do the same thing were what the first collaborator report called confusing (feedback-attachments #34).
test('there is no 跳过引导 button any more: the X leaves the guide, the foot has 下一步', () => {
  assert.doesNotMatch(source, /skipDelay|skipLeft|skipTimer|T\.skipIn|T\.skip\b|async function skip\(/)
  assert.match(source, /function close\(\) \{ funnel\.close\(\); save\(\{ closed: props\.version \|\| '-' \}\); emit\('close'\) \}/)
})

test('跳过这一步 is offered on the pairing and the first-stream steps only, and only until the thing is done', () => {
  assert.match(source, /const ACTION_STEPS = \['pair', 'connect'\]/)
  const show = source.slice(source.indexOf('const canSkipThis = computed'), source.indexOf('function skipThis'))
  assert.match(show, /!sub\.value/, 'not inside a page of the done page')
  assert.match(show, /ACTION_STEPS\.includes\(id\.value\)/)
  assert.match(show, /!stepDone\.value/, 'gone once the client is paired or the stream is checked')
  assert.match(show, /!props\.required\.includes\(id\.value\)/)
  const skip = source.slice(source.indexOf('function skipThis'), source.indexOf('// a page of the done page opens as a sub-flow'))
  assert.match(skip, /funnel\.skip\(\)/)
  assert.match(skip, /\n  next\(\)\n/, 'it goes to the next step; it does not finish the guide')
  assert.ok(!/finish\(/.test(skip))
  assert.match(source, /v-if="canSkipThis"[^>]*@click="skipThis">\{\{ T\.skipThis \}\}/)
})

test('下一步 waits on those two steps until the person has done the thing (a host that cannot list clients never waits)', () => {
  const done = source.slice(source.indexOf('const stepDone = computed'), source.indexOf('const canSkipThis'))
  assert.match(done, /id\.value === 'pair' \? !!pairedClient\.value \|\| !Array\.isArray\(props\.state\.clients\)/)
  assert.match(done, /id\.value === 'connect' \? !!session\.value \|\| Object\.values\(checks\)\.some\(Boolean\)/)
  assert.match(source, /default: return \{ label: t\.next, run: next, icon: 'arrow_forward', disabled: ACTION_STEPS\.includes\(id\.value\) && !stepDone\.value/)
})

test('the wording is plain in Chinese and English', () => {
  assert.equal(guideTexts('zh').skipThis, '跳过这一步')
  assert.equal(guideTexts('en').skipThis, 'Skip this step')
  assert.equal(guideTexts('zh').next, '下一步')
})

// the install step: the source follows the language like the download page (CNB for Chinese, GitHub for the others), and the line under the button names the host the button uses (#37)
test('the install step downloads from the source of the language and names that source', () => {
  assert.match(panel, /const installTarget = computed\(\(\) => rows\.value\[0\]\?\.url \|\| pageUrl\.value\)/)
  assert.match(panel, /rows\.value\[0\]\.url === rows\.value\[0\]\.cnbUrl \? 'CNB' : 'GitHub'/)
  assert.match(panel, /fill\(T\.fromMirror, \{ host: installHost \}\)/)
  assert.doesNotMatch(panel, /rows\[0\]\.cnbUrl \? mirrorName\(locale\)/)
})
