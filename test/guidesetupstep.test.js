import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { guideTexts } from '../src/vue/guideTexts.js'

const flow = readFileSync(new URL('../src/vue/MGuideFlow.vue', import.meta.url), 'utf8')
const onboard = readFileSync(new URL('../src/css/onboard.css', import.meta.url), 'utf8')

test('the setup step has no 「允许 HDR」 switch: HDR follows the client, the host decides what it can offer', () => {
  assert.doesNotMatch(flow, /choice\.hdr/)
  assert.doesNotMatch(flow, /T\.setup\.hdr\b/)
  assert.doesNotMatch(flow, /MSwitchItem/)
  assert.match(flow, /const payload = \{ adapter: choice\.adapter, display: choice\.display \}/, 'the guide does not write the codec modes any more')
})

test('the state of HDR of a display is said in words, not as the host\'s raw word', () => {
  const zh = guideTexts('zh').setup.hdrState
  assert.equal(zh.UNKNOWN, 'HDR：未知')
  assert.equal(zh.ENABLED, 'HDR：当前已启用')
  assert.equal(zh.DISABLED, 'HDR：未启用')
  const en = guideTexts('en').setup.hdrState
  assert.deepEqual(Object.keys(en).sort(), ['DISABLED', 'ENABLED', 'UNKNOWN'])
  assert.match(flow, /text: hdr \? hdrStateText\(hdr\) : ''/)
  assert.doesNotMatch(flow, /`HDR: \$\{hdr\}`/)
})

test('Windows 10 is told once, at the virtual display: the base virtual display has no HDR there', () => {
  assert.match(flow, /v-if="choice\.display === 'ZakoHDR' && state\.setup\?\.win10" class="m-guide__note" data-note="win10-hdr"/)
  assert.match(guideTexts('zh').setup.hdrWin10, /Windows 10 上基地虚拟显示器不支持 HDR/)
  assert.match(guideTexts('en').setup.hdrWin10, /Windows 10 the Foundation Virtual Display has no HDR/)
})

test('the first-run window is always as high as the largest it may be, so no step changes its height', () => {
  assert.match(onboard, /\.m-onboard__window \{[^}]*min-height: var\(--m-onboard-h\);[^}]*max-height: var\(--m-onboard-h\);/)
  assert.doesNotMatch(onboard, /min-height: min\(var\(--m-onboard-h\), 560px\)/)
})
