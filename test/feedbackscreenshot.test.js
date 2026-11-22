// The screenshot of a feedback report: which files are taken, how a picture is made to fit, the redaction selector (PIN, password, CDK), what travels in the report, and what the queue does with it.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SHOT_LIMITS, base64ToBytes, bytesToBase64, checkShotFile, compressPlan, compressShot, fitSide, sizeText, sniffShotType } from '../src/feedback/shotImage.js'
import { SELECTOR } from '../src/devmode/shot.js'
import { SHOT_BASE64_MAX, isShotData, reportToEvent } from '../src/telemetry/report.js'
import { QUEUE_SHOTS_MAX, enqueueReport, loadQueue, submitReport } from '../src/telemetry/send.js'
import { phaseOf, feedbackPlan } from '../src/feedback/model.js'
import { userReportDocument } from '../src/devmode/userReport.js'
import { feedbackTexts, fillText } from '../src/feedback/texts.js'
import { devReport, registerDevReport, removeDevShot, setDevShot, retakeDevShot, openDevReport, closeDevReport } from '../src/vue/devmode/devReport.js'
import { makePng } from './pngFixture.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const memory = (limit = Infinity) => { const data = new Map(); return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => { if (String(v).length > limit) throw new Error('QuotaExceededError'); data.set(k, String(v)) }, removeItem: (k) => { data.delete(k) } } }
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0])
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20])
const bytesOf = (type, n) => { const head = { 'image/png': makePng(2, 2), 'image/jpeg': JPEG, 'image/webp': WEBP }[type]; const out = new Uint8Array(Math.max(n, head.length)); out.set(head); return out }

test('only PNG, JPEG and WebP are taken, by their first bytes: a name or a declared type says nothing', () => {
  assert.equal(sniffShotType(makePng(2, 2)), 'image/png'); assert.equal(sniffShotType(JPEG), 'image/jpeg'); assert.equal(sniffShotType(WEBP), 'image/webp')
  for (const junk of ['GIF89a-and-more', '<svg xmlns="http://www.w3.org/2000/svg"/>', 'MZ\u0090\u0000\u0003\u0000\u0000\u0000\u0004', '%PDF-1.7 and some text']) assert.equal(sniffShotType(new TextEncoder().encode(junk)), '', junk)
  assert.deepEqual(checkShotFile(new Uint8Array(0)), { ok: false, reason: 'empty' })
  assert.deepEqual(checkShotFile(new TextEncoder().encode('just a text file named shot.png')), { ok: false, reason: 'type' })
  assert.equal(checkShotFile(makePng(2, 2)).type, 'image/png')
  assert.deepEqual(checkShotFile(bytesOf('image/png', SHOT_LIMITS.inputBytes + 1)), { ok: false, reason: 'input_too_large' }, 'a file over 20 MiB is not opened')
})

test('the size: scaled to the long side, never up, whole pixels; the plan goes PNG, then WebP at falling quality, at three long sides', () => {
  assert.deepEqual(fitSide(3840, 2160, 1920), { width: 1920, height: 1080 })
  assert.deepEqual(fitSide(1120, 700, 1920), { width: 1120, height: 700 })
  assert.deepEqual(fitSide(700, 2800, 1400), { width: 350, height: 1400 })
  const plan = compressPlan(3840, 2160)
  assert.deepEqual(plan.slice(0, 4).map((s) => [s.type, s.quality, s.width]), [['image/png', 1, 1920], ['image/webp', 0.88, 1920], ['image/webp', 0.76, 1920], ['image/webp', 0.62, 1920]])
  assert.deepEqual([...new Set(plan.map((s) => s.width))], [1920, 1500, 1080])
  assert.deepEqual([...new Set(compressPlan(3840, 2160, { formats: ['image/png'] }).map((s) => s.type))], ['image/png'], 'a normalisation that wants PNG only')
  assert.ok(compressPlan(3840, 2160, { formats: ['image/png', 'image/jpeg'] }).some((s) => s.type === 'image/jpeg'), 'JPEG stands in where WebP is not offered')
})

// a codec for the tests: the picture is as large as its pixels times a factor of the type and the quality
const fakeCodec = (width, height, { webp = true, log = [] } = {}) => ({
  decode: async () => ({ width, height, close() { log.push('closed') } }),
  encode: async (_img, step) => {
    log.push(`${step.type}@${step.width}${step.type === 'image/png' ? '' : `q${step.quality}`}`)
    const type = step.type === 'image/webp' && !webp ? 'image/png' : step.type
    const n = Math.round(step.width * step.height * (type === 'image/png' ? 1.5 : type === 'image/webp' ? 0.12 * step.quality : 0.18 * step.quality))
    return { bytes: bytesOf(type, n), type }
  },
})

test('a picture that fits is returned as it is; one that does not is made smaller in as few steps as it takes; one that cannot fit is refused with the reason', async () => {
  const small = makePng(8, 6)
  const same = await compressShot(small, { codec: fakeCodec(1120, 700) })
  assert.deepEqual([same.ok, same.changed, same.bytes === small], [true, false, true], 'a window capture that already fits is not written twice')
  const log = []
  const big = bytesOf('image/png', 4 * 1024 * 1024)
  const fit = await compressShot(big, { codec: fakeCodec(3840, 2160, { log }) })
  assert.equal(fit.ok, true); assert.ok(fit.bytes.length <= SHOT_LIMITS.sendBytes); assert.equal(fit.type, 'image/webp'); assert.equal(fit.width, 1920)
  assert.deepEqual(log.slice(0, 2), ['image/png@1920', 'image/webp@1920q0.88'], 'PNG first, WebP when PNG is too large'); assert.equal(log.at(-1), 'closed')
  const noWebp = await compressShot(big, { codec: fakeCodec(3840, 2160, { webp: false }) })
  assert.deepEqual([noWebp.ok, noWebp.type], [true, 'image/jpeg'], 'a browser that writes no WebP answers PNG to every WebP try (skipped), and JPEG is the way out')
  assert.deepEqual(await compressShot(big, { codec: fakeCodec(30000, 30000), maxBytes: 100 }), { ok: false, reason: 'cannot_fit' })
  assert.deepEqual(await compressShot(new TextEncoder().encode('not a picture at all'), { codec: fakeCodec(1, 1) }), { ok: false, reason: 'unreadable' })
  assert.deepEqual(await compressShot(small, { codec: { decode: async () => { throw new Error('bad') }, encode: async () => null } }), { ok: false, reason: 'unreadable' })
  const png = await compressShot(bytesOf('image/jpeg', 50_000), { codec: fakeCodec(800, 600), maxBytes: Infinity, formats: ['image/png'] })
  assert.deepEqual([png.ok, png.type], [true, 'image/png'], 'a JPEG chosen by the person becomes the PNG the preview and the boxes work on')
})

test('base64 round trip and the size text; the data the event may carry is bounded', () => {
  const b = Uint8Array.from({ length: 70_000 }, (_, i) => (i * 7) % 256)
  assert.deepEqual(base64ToBytes(bytesToBase64(b)), b)
  assert.equal(sizeText(312 * 1024), '312 KB'); assert.equal(sizeText(1.4 * 1024 * 1024), '1.4 MB'); assert.equal(sizeText(10), '1 KB')
  assert.equal(isShotData(bytesToBase64(makePng(4, 4))), true)
  for (const bad of ['', 'short', 'not base64!!!!!!!!!!!!!', 'A'.repeat(SHOT_BASE64_MAX + 1), 12345, null, '../../etc/passwd/aaaaaa']) assert.equal(isShotData(bad), false)
  assert.ok(Math.ceil(SHOT_LIMITS.sendBytes * 4 / 3) + 4 <= SHOT_BASE64_MAX, 'the largest picture that is sent fits the largest base64 the event takes')
})

test('the screenshot rides inside the one user_report event and nowhere else; a page cannot name a reference', () => {
  const shot = bytesToBase64(makePng(4, 4))
  const doc = { ...userReportDocument({ title: 't', description: 'd', product: 'web', page: 'home' }), shot }
  const props = reportToEvent(doc).props
  assert.equal(props.shot, shot); assert.ok(!('shot_ref' in props) && !('attachment' in props))
  assert.ok(!('shot' in reportToEvent({ ...doc, shot: 'x'.repeat(SHOT_BASE64_MAX + 5) }).props), 'an oversized picture is not put in the event')
  assert.ok(!('shot' in reportToEvent({ ...doc, shot: undefined }).props))
  assert.ok(!('shot_ref' in reportToEvent({ ...doc, shot_ref: 'crash-2026-11/ur-shot-aaaaaaaaaaaaaaaaaaaaaaaa.png' }).props))
})

test('offline the picture is kept with the report; the storage that says no costs the picture and not the text; older reports give their pictures up first', async () => {
  const storage = memory()
  const shot = bytesToBase64(makePng(40, 30))
  const doc = (n) => ({ ...userReportDocument({ title: `t${n}`, description: `d${n}`, product: 'web' }), shot })
  const off = await submitReport(doc(1), { storage, online: false, explicit: true, id: 'a' })
  assert.equal(off.state, 'queued'); assert.equal(loadQueue(storage)[0].doc.shot, shot, 'the picture waits in the queue with the report')
  for (const n of [2, 3, 4, 5]) await submitReport(doc(n), { storage, online: false, explicit: true, id: `r${n}` })
  assert.deepEqual(loadQueue(storage).map((e) => !!e.doc.shot), [false, false, true, true, true].slice(-5), 'only the newest few keep a picture')
  assert.equal(QUEUE_SHOTS_MAX, 3)
  assert.ok(loadQueue(storage).every((e) => e.doc.title), 'the text of every report is still there')
  // a window whose storage is nearly full
  const bigShot = bytesToBase64(Uint8Array.from({ length: 20_000 }, (_, i) => (i * 131) % 256))
  const tight = memory(5000)
  const r = await submitReport({ ...doc(9), shot: bigShot }, { storage: tight, online: false, explicit: true, id: 'z' })
  assert.deepEqual([r.state, r.shotLost], ['queued', true]); assert.ok(!loadQueue(tight)[0].doc.shot); assert.equal(loadQueue(tight)[0].doc.title, 't9')
  assert.equal(enqueueReport(doc(10), memory(), 1, { id: 'q' }).shotLost, false)
})

test('what the host says about the picture decides what the panel claims: only "uploaded" is a picture that went', async () => {
  assert.equal(phaseOf({ state: 'sent', shot: 'uploaded' }).shot, 'uploaded')
  assert.equal(phaseOf({ state: 'sent' }).shot, '', 'an older host does not say: the panel does not claim the picture')
  assert.equal(phaseOf({ state: 'queued', shotLost: true }).shotLost, true)
  const sent = await submitReport({ ...userReportDocument({ title: 't', description: 'd', product: 'web' }), shot: bytesToBase64(makePng(4, 4)) }, { storage: memory(), online: true, transport: async () => ({ ok: true, status: 200, json: async () => ({ accepted: 1, shot: 'too_large' }) }) })
  assert.deepEqual([sent.state, sent.shot], ['sent', 'too_large'])
})

test('the redaction selector covers PIN, password and CDK fields, whatever the product calls them', () => {
  for (const s of ['input[type="password"]', 'input[name*="pin" i]', 'input[inputmode="numeric"]', 'input[name*="cdk" i]', 'input[id*="cdk" i]', 'input[autocomplete="one-time-code"]']) assert.ok(SELECTOR.includes(s), s)
})

test('a picture chosen by the person: only the allowed types, normalised to a clean PNG, nothing covered automatically; remove clears it; the capture is retaken with the sheet hidden', async () => {
  const log = []
  const paint = async (bytes, rects) => { log.push(`paint:${rects.length}`); return { bytes: makePng(8, 6), width: 8, height: 6 } }
  registerDevReport({ codec: () => fakeCodec(800, 600), paint, capture: async () => makePng(16, 12), mask: async () => ({ bytes: makePng(16, 12), width: 16, height: 12, regions: [{ x: 1, y: 1, w: 3, h: 3 }] }), logs: () => '', env: () => '' })
  closeDevReport()
  assert.deepEqual(await setDevShot(new TextEncoder().encode('MZ not a picture file at all'), { source: 'file' }), { ok: false, reason: 'type' }); assert.equal(devReport.shotError, 'type')
  assert.deepEqual(await setDevShot(bytesOf('image/png', SHOT_LIMITS.inputBytes + 5)), { ok: false, reason: 'input_too_large' })
  assert.deepEqual(await setDevShot(new Uint8Array(0)), { ok: false, reason: 'unreadable' })
  assert.deepEqual(await setDevShot(bytesOf('image/jpeg', 3000), { source: 'paste' }), { ok: true })
  assert.deepEqual([devReport.shotSource, devReport.shotAuto.length, devReport.shotManual.length, devReport.shotError, !!devReport.shot], ['paste', 0, 0, '', true], 'a picture from outside is not covered automatically')
  assert.deepEqual(devReport.shotSize, { width: 8, height: 6 }); assert.ok(log.includes('paint:0'), 'the picture was written again as PNG without its metadata')
  removeDevShot(); assert.deepEqual([devReport.shot, devReport.shotSource, devReport.shotSize], [null, '', null])
  // the window capture: taken at open, retaken with the sheet hidden
  await openDevReport({ kind: 'feedback' })
  assert.deepEqual([devReport.shotSource, devReport.shotAuto.length], ['window', 1])
  removeDevShot()
  const seen = []
  registerDevReport({ capture: async () => { seen.push(devReport.hidden); return makePng(16, 12) } })
  assert.deepEqual(await retakeDevShot(), { ok: true }); assert.deepEqual(seen, [true], 'the sheet is hidden while the window is taken'); assert.equal(devReport.hidden, false); assert.equal(devReport.shotSource, 'window')
  closeDevReport()
})

test('the panel: the row is shown by `shots`, has the pick, paste, drop, capture, remove and preview, says what is covered, and the words are in both languages without 遥测', () => {
  const panel = read('src/vue/feedback/MFeedbackPanel.vue')
  for (const hook of ['data-fb="shot"', 'data-fb="shot-pick"', 'data-fb="shot-capture"', 'data-fb="shot-remove"', 'data-fb="shot-edit"', 'data-fb="shot-error"', 'data-fb="shot-file"', '@paste="onPaste"', '@drop="onDrop"', 'accept="image/png,image/jpeg,image/webp"']) assert.ok(panel.includes(hook), hook)
  assert.match(panel, /devProviders\(\)\.shots === true/); assert.ok(!/uploadShot/.test(panel), 'no upload step of the page: the picture is part of the report')
  const zh = feedbackTexts('zh'), en = feedbackTexts('en')
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort())
  assert.match(zh.shotHint, /私下发给开发者/); assert.match(zh.shotAuto, /PIN、密码、CDK/); assert.match(zh.shotOwn, /不会自动遮盖/)
  assert.equal(fillText(zh.shotErrInput, { size: '20.0 MB' }), '这个文件超过 20.0 MB，请换一张小一点的图片。')
  for (const t of [zh, en]) for (const [k, v] of Object.entries(t)) if (k.startsWith('shot')) assert.ok(!/遥测|telemetry/i.test(v) && String(v).trim(), k)
  assert.equal(feedbackPlan({ canSendShot: true }).shotRow, true)
  const doc = read('docs/telemetry.md')
  assert.match(doc, /shots: true/); assert.match(doc, /700 KB/)
})
