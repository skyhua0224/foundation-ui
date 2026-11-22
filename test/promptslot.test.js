import test from 'node:test'
import assert from 'node:assert/strict'
import { slotAhead, slotEnter, slotLeave } from '../src/vue/promptSlot.js'

// a card that opens or closes: the page under it is laid out for the final height at once (the fill of the overview is fitted once), whatever frame the animation is in
function card(h, mb) {
  const el = { offsetHeight: h, mb, finish: null, animate() { return { finished: new Promise((r) => { el.finish = r }) } } }
  return el
}
const withStyle = (el, fn) => {
  const prev = globalThis.getComputedStyle
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '', marginBottom: `${el.mb}px`, paddingTop: '12px', paddingBottom: '12px' })
  try { return fn() } finally { globalThis.getComputedStyle = prev }
}

test('slotAhead: 0 for a card at rest, and for nothing', () => {
  const el = card(70, 12)
  assert.equal(withStyle(el, () => slotAhead(el)), 0)
  assert.equal(slotAhead(null), 0)
})

test('slotAhead: an opening card owes its final height and margin, less what the frame has of it', async () => {
  const el = card(70, 12)
  await withStyle(el, async () => {
    let done = false
    slotEnter(el, () => { done = true })
    el.offsetHeight = 0; el.mb = 0 // the first keyframe
    assert.equal(slotAhead(el), 82)
    el.offsetHeight = 35; el.mb = 6 // half way
    assert.equal(slotAhead(el), 41)
    el.offsetHeight = 70; el.mb = 12; el.finish(); await new Promise((r) => setTimeout(r, 0))
    assert.ok(done)
    assert.equal(slotAhead(el), 0, 'at rest again')
  })
})

test('slotAhead: a closing card owes its whole height, the page under it goes up by it', async () => {
  const el = card(70, 12)
  await withStyle(el, async () => {
    slotLeave(el, () => {})
    assert.equal(slotAhead(el), -82)
    el.offsetHeight = 0; el.mb = 0; el.finish(); await new Promise((r) => setTimeout(r, 0))
    assert.equal(slotAhead(el), 0)
  })
})
