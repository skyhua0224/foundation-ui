import test from 'node:test'
import assert from 'node:assert/strict'
import { INPUT_RATE_FIGURES, INPUT_RATE_KEY, INPUT_RATE_WARNING_SECONDS, inputRateNeedsConfirm, inputRateWarning } from '../src/settings/index.js'
import { localizedKeyLabel, localizedOptionLabel } from '../src/settings/dualsenseLabels.js'
import { scanText } from '../scripts/copy-lint.mjs'

test('only a move from 250 Hz to something faster asks; every other change of the key and every other key does not', () => {
  assert.equal(inputRateNeedsConfirm(INPUT_RATE_KEY, 'hz250', 'hz500'), true)
  assert.equal(inputRateNeedsConfirm(INPUT_RATE_KEY, 'hz250', 'auto'), true)
  assert.equal(inputRateNeedsConfirm(INPUT_RATE_KEY, 'auto', 'hz500'), false, 'already above 250 Hz')
  assert.equal(inputRateNeedsConfirm(INPUT_RATE_KEY, 'hz500', 'hz250'), false, 'going down is safe')
  assert.equal(inputRateNeedsConfirm(INPUT_RATE_KEY, 'hz250', 'hz250'), false)
  assert.equal(inputRateNeedsConfirm('ds5.compat.reportRateCapHz', 'hz250', 'hz500'), false)
  assert.equal(INPUT_RATE_WARNING_SECONDS, 5)
})

test('the key and its options are named in both languages', () => {
  const descriptor = { key: INPUT_RATE_KEY, label: 'Input report rate' }
  assert.equal(localizedKeyLabel(descriptor, 'zh'), '手柄输入回报频率')
  assert.equal(localizedKeyLabel(descriptor, 'en'), 'Controller input report rate')
  assert.equal(localizedOptionLabel('hz250', 'zh'), '250 Hz')
  assert.equal(localizedOptionLabel('hz500', 'en'), '500 Hz')
  assert.equal(localizedOptionLabel('auto', 'zh'), '自动')
})

test('the dialog quotes the measured figures of the chosen option and of 250 Hz, with the method', () => {
  const zh = inputRateWarning('zh', 'hz500')
  const text = zh.lines.join('\n')
  assert.match(text, /「500 Hz」/)
  assert.match(text, /早 0\.7 ms/)
  assert.match(text, /丢掉 25% 的摇杆中间报告（250 Hz 丢 7\.5%）/)
  assert.match(text, /每 200 ms 停读 160 ms/)
  assert.match(text, /按键点按不丢（344 次点按全部读到）/)
  assert.match(text, /摇杆每档测 12 秒/)
  const auto = inputRateWarning('zh', 'auto').lines.join('\n')
  assert.match(auto, /「自动」/)
  assert.match(auto, /早 2\.1 ms/)
  assert.match(auto, /丢掉 26%/)
  const en = inputRateWarning('en', 'hz500').lines.join('\n')
  assert.match(en, /“500 Hz”/)
  assert.match(en, /0\.7 ms sooner/)
  assert.match(en, /25% of the in-between stick reports/)
  assert.match(en, /Button taps are not dropped \(all 344 taps were read\)/)
})

test('the figures keep the order the text claims: a faster option answers sooner and drops more under a stall', () => {
  const f = INPUT_RATE_FIGURES
  assert.ok(f.auto.latencyMs < f.hz500.latencyMs && f.hz500.latencyMs < f.hz250.latencyMs)
  assert.ok(f.hz250.lostPercent < f.hz500.lostPercent && f.hz500.lostPercent <= f.auto.lostPercent)
})

test('buttons: the wait button carries the countdown placeholder and both languages are complete', () => {
  for (const locale of ['zh', 'en']) {
    const t = inputRateWarning(locale, 'hz500')
    assert.ok(t.title && t.cancel && t.confirm && t.lines.length === 3)
    assert.ok(t.wait.includes('{seconds}'))
  }
})

test('the text passes the copy lint', () => {
  for (const locale of ['zh', 'en']) {
    const t = inputRateWarning(locale, 'hz500')
    for (const s of [t.title, t.cancel, t.confirm, t.wait, ...t.lines]) assert.deepEqual(scanText(s).map((r) => r.id ?? r), [], s)
  }
})
