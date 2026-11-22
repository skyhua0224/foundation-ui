import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { GUIDE_TEXTS_EN, GUIDE_TEXTS_ZH } from '../src/vue/guideTexts.js'

const read = (f) => readFileSync(new URL(`../src/vue/${f}`, import.meta.url), 'utf8')
const flow = read('MGuideFlow.vue')

test('the account form of the guide submits on Enter through the shared helper, as the sign-in does', () => {
  assert.match(flow, /import \{ submitOnEnter \} from '\.\/submitOnEnter\.js'/)
  assert.match(flow, /<form id="m-guide-account"[^>]*@submit\.prevent="submitAccount" @keydown="submitOnEnter">/)
  assert.match(read('MLoginPage.vue'), /@submit\.prevent="submit" @keydown="submitOnEnter"/, 'the same wiring as the sign-in')
})

test('on a phone the pairing step puts the PIN first and the QR code second', () => {
  assert.match(flow, /const phone = typeof navigator !== 'undefined' && isPhoneLike\(/)
  assert.match(flow, /:class="\{ 'has-qr': qrShown, 'is-pin-first': phone \}"/)
  const css = readFileSync(new URL('../src/css/expressive.css', import.meta.url), 'utf8')
  assert.match(css, /\.m-guide__pair\.is-pin-first \.m-guide__pair-pin \{ order: -2; \}[^\n]*\.m-guide__pair-or \{ order: -1; \}/)
})

test('on a phone no pairing window is opened for a code the phone cannot scan itself: the code is made only when the person asks for it', () => {
  assert.match(flow, /const showQr = ref\(!phone\)/)
  assert.match(flow, /const qrShown = computed\(\(\) => hasQr\.value && showQr\.value\)/)
  assert.match(flow, /if \(qrShown\.value\) void qrPair\.begin\(\)/, 'entering the step starts the window only while the code is shown')
  assert.match(flow, /function revealQr\(\) \{ showQr\.value = true; void qrPair\?\.begin\(\) \}/)
  assert.match(flow, /<MButton v-if="hasQr && !qrShown" class="m-guide__showqr"[^>]*@click="revealQr">\{\{ T\.pair\.showQr \}\}/)
  // what to do when the client does not find this computer (the address, the usual causes, the port) shows no second code: the pairing card has the one
  assert.match(flow, /<MGuideAddress v-if="!pairedClient" only="trouble"(?![^>]*pair-qr)/)
  assert.ok(GUIDE_TEXTS_EN.pair.showQr && GUIDE_TEXTS_ZH.pair.showQr)
})

test('the PIN of the pairing step starts empty and only what is typed on the pad is sent; the phone keyboard is not offered a code', () => {
  assert.match(flow, /pairedClient\.value = null; pairError\.value = ''; pin\.value = ''; pinTyped\.value = false/, 'every visit starts empty')
  assert.match(flow, /if \(!pinTyped\.value \|\| !canPair\(pin\.value, pairName\.value\)\) return/, 'a value that nobody typed is never sent')
  assert.match(flow, /<MButton class="m-guide__pairgo"[^>]*:disabled="busy \|\| !pinTyped \|\| !canPair\(pin, pairName\)" @click="submitPin">\{\{ T\.pair\.send \}\}/, '「配对」is in the PIN card, disabled until a typed PIN and a name are there')
  assert.match(flow, /@update:model-value="pinTyped = true" @complete="submitPin"/)
  for (const f of ['MPinEntry.vue', 'MDashWidget.vue']) assert.ok(!read(f).includes('one-time-code'), `${f} does not ask for a one-time code`)
  assert.ok(!/ref\(['"]0000['"]\)|pin\.value = ['"]0000/.test(flow))
})
