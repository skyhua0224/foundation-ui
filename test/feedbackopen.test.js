// How the report sheet opens: the window is captured and redacted before the sheet exists, the log and the environment are collected beside the redaction and are not waited for, and a second press does nothing.
import test from 'node:test'
import assert from 'node:assert/strict'
import { devReport, devReportReady, registerDevReport, openDevReport, closeDevReport, CONTEXT_WAIT_MS } from '../src/vue/devmode/devReport.js'
import { maskCapture } from '../src/devmode/shotCanvas.js'
import { makePng } from './pngFixture.js'

const png = makePng(40, 20)
const view = { width: 40, height: 20, dpr: 1 }
const gate = () => { let open; const promise = new Promise((resolve) => { open = resolve }); return { promise, open } }

test('the sheet opens when the picture is redacted: the slow log and environment are not waited for', async () => {
  const logs = gate(), env = gate()
  const order = []
  registerDevReport({
    collect: () => { order.push('boxes'); return [] },
    capture: async () => { order.push('capture'); return png },
    mask: async (bytes) => { order.push('mask'); assert.equal(devReport.open, false, 'nothing of the sheet exists while the picture is redacted'); return { bytes: Uint8Array.from([1, 2, 3]), width: 40, height: 20, regions: [] } },
    logs: () => logs.promise, env: () => env.promise,
  })
  closeDevReport()
  globalThis.document = {} // the boxes are only measured where there is a document
  try { await openDevReport({ kind: 'error', error: { name: 'E', message: 'm' }, carriedLogs: 'carried line', carriedLabel: 'from the error' }) } finally { delete globalThis.document }
  assert.equal(devReport.open, true)
  assert.deepEqual([...devReport.shot], [1, 2, 3], 'the picture in the sheet is the redacted one, not the capture')
  assert.equal(devReport.loading, true)
  assert.equal(devReport.logs, 'carried line', 'the lines the error carried are there at once')
  assert.deepEqual(order.slice(0, 2), ['boxes', 'capture'], 'the first measure of the boxes is not waited for before the capture')
  logs.open('live line'); env.open('os 11')
  await devReportReady()
  assert.equal(devReport.loading, false)
  assert.equal(devReport.logs, 'live line\n\nfrom the error\ncarried line')
  assert.equal(devReport.env, 'os 11')
  closeDevReport()
})

test('a second press while the first is on its way takes no second capture; a failing log or environment leaves the sheet open and empty', async () => {
  let captures = 0
  const slow = gate()
  registerDevReport({ capture: async () => { captures += 1; await slow.promise; return png }, mask: async () => ({ bytes: Uint8Array.from([9]), width: 40, height: 20, regions: [] }), logs: () => { throw new Error('no log') }, env: () => Promise.reject(new Error('no env')) })
  closeDevReport()
  const first = openDevReport({ kind: 'feedback' })
  const second = openDevReport({ kind: 'feedback' })
  slow.open()
  await Promise.all([first, second])
  assert.equal(captures, 1)
  assert.equal(devReport.open, true)
  await devReportReady()
  assert.equal(devReport.logs, ''); assert.equal(devReport.env, ''); assert.equal(devReport.loading, false)
  closeDevReport()
})

test('a report opened again before the first one finished loading keeps the answers of the new one only', async () => {
  const old = gate()
  registerDevReport({ capture: async () => null, mask: async () => null, logs: () => old.promise, env: () => '' })
  closeDevReport()
  await openDevReport({ kind: 'feedback' })
  const oldReady = devReportReady()
  closeDevReport()
  registerDevReport({ logs: () => 'new log', env: () => 'new env' })
  await openDevReport({ kind: 'feedback' })
  await devReportReady()
  old.open('old log')
  await oldReady // the old collection has finished, and has not touched the new report
  assert.equal(devReport.logs, 'new log'); assert.equal(devReport.env, 'new env')
  closeDevReport()
})

test('a log or environment that never arrives does not keep the report waiting for ever', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  registerDevReport({ capture: async () => null, mask: async () => null, logs: () => new Promise(() => {}), env: () => 'env' })
  closeDevReport()
  await openDevReport({ kind: 'feedback' })
  assert.equal(devReport.loading, true)
  t.mock.timers.tick(CONTEXT_WAIT_MS)
  await devReportReady()
  assert.equal(devReport.loading, false)
  closeDevReport()
})

// ---- maskCapture: one decode and one encode, size from the header
function fakeCanvasWorld(decodedWidth, decodedHeight) {
  const calls = { decode: 0, encode: 0, fills: [], drawn: 0 }
  globalThis.createImageBitmap = async () => { calls.decode += 1; return { width: decodedWidth, height: decodedHeight, close() {} } }
  globalThis.OffscreenCanvas = class {
    constructor(w, h) { this.w = w; this.h = h }
    getContext() { return { drawImage: () => { calls.drawn += 1 }, fillRect: (...a) => calls.fills.push(a), set fillStyle(v) {} } }
    async convertToBlob() { calls.encode += 1; return new Blob([makePng(this.w, this.h)], { type: 'image/png' }) }
  }
  return calls
}
const restore = () => { delete globalThis.createImageBitmap; delete globalThis.OffscreenCanvas }

test('maskCapture decodes once and encodes once, painting every box on the decoded picture', async () => {
  const calls = fakeCanvasWorld(40, 20)
  try {
    const done = await maskCapture(png, [{ x: 2, y: 2, w: 10, h: 4, kind: 'host' }, { x: 20, y: 8, w: 6, h: 6, kind: 'pin' }], view)
    assert.equal(calls.decode, 1); assert.equal(calls.encode, 1); assert.equal(calls.drawn, 1)
    assert.equal(calls.fills.length, 2)
    assert.equal(done.regions.length, 2); assert.equal(done.width, 40); assert.equal(done.height, 20)
    assert.notEqual(done.bytes, png, 'the result is the canvas that was painted, encoded again')
  } finally { restore() }
})

test('maskCapture refuses what it cannot vouch for: no PNG header, or a picture that decodes to another size than its header says', async () => {
  const calls = fakeCanvasWorld(40, 20)
  try {
    assert.equal(await maskCapture(Uint8Array.from([1, 2, 3, 4]), [], view), null)
    assert.equal(calls.decode, 0, 'a file that is not a PNG is not even decoded')
  } finally { restore() }
  const mismatch = fakeCanvasWorld(41, 20)
  try {
    assert.equal(await maskCapture(png, [{ x: 2, y: 2, w: 10, h: 4 }], view), null)
    assert.equal(mismatch.encode, 1)
  } finally { restore() }
})
