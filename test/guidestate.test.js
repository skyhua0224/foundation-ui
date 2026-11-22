import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildGuideSteps, readProgress, writeProgress } from '../src/vue/guideModel.js'
import { guideEntry } from '../src/vue/guideEntry.js'
import { ACTIVE_WINDOW_S, HEARTBEAT_MAX, HEARTBEAT_S, activeElsewhere, createHostSaver, hostPatchOf, hostProgressOf, isPhoneLike, progressSavePatch, resumeIndex, saveGuideHost } from '../src/vue/guideHost.js'

const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) } }
const NOW = 1_800_000_000_000

test('over-install: a stale position of an older run on an installed host opens the upgrade flow from the top, not the old step', () => {
  // the older build left a fresh run unfinished at the first stream; the host is set up and has a paired client
  const stale = { step: 'connect', finished: false, visited: ['intro', 'setup', 'pair', 'connect'], version: '1.3.8', mode: 'fresh' }
  assert.deepEqual(guideEntry({ progress: stale, version: '1.3.9', setupCompleted: true, pairedCount: 2 }), { mode: 'upgrade' })
  // the same version, nobody paired yet: the run that was left continues
  assert.deepEqual(guideEntry({ progress: { ...stale, version: '1.3.9' }, version: '1.3.9', setupCompleted: true, pairedCount: 0 }), { mode: 'fresh' })
  // the upgrade flow leaves the done client steps out and the host-done page with them
  const skip = ['hostdone', 'install', 'address', 'pair']
  for (const id of skip) assert.ok(!buildGuideSteps({ mode: 'upgrade', skip }).some((s) => s.id === id), id)
})

test('cross-device: the steps done on any device are the progress; a stored position never goes ahead of them', () => {
  const steps = buildGuideSteps()
  const host = hostProgressOf({ guide_done: 'intro,consent,account,appearance,motion' })
  assert.deepEqual(host.done, ['intro', 'account', 'appearance', 'motion'], 'the retired consent step of an older run is left out')
  assert.equal(steps[resumeIndex(steps, host.done)].id, 'channel', 'a second device opens at the first step not done; what an older run did in the host part (look, animations) is not a step of the new flow')
  assert.equal(steps[resumeIndex(steps, [])].id, 'intro')
  assert.equal(resumeIndex(steps, steps.map((s) => s.id)), steps.length - 1, 'everything done: the last step')
  // the steps the phone did make this device continue the run even though this one stored nothing
  assert.deepEqual(guideEntry({ progress: null, version: '1.3.9', setupCompleted: false, pairedCount: 0, host }), { mode: 'fresh' })
  // the host record survives a round trip through the configuration keys
  assert.deepEqual(hostProgressOf(hostPatchOf({ done: ['setup', 'intro'], finished: true, closed: '1.3.9', active: { device: 'dphone', at: 1_800_000_000.7 } })), { done: ['intro', 'setup'], finished: true, closed: '1.3.9', active: { device: 'dphone', at: 1_800_000_000 } })
  assert.deepEqual(hostProgressOf(null), { done: [], finished: false, closed: '', active: null })
  assert.deepEqual(hostProgressOf({ guide_done: 'bogus,pair', guide_active: 'x' }), { done: ['pair'], finished: false, closed: '', active: null })
})

test('trigger: a device opens the guide on its own only when it should', () => {
  const base = { version: '1.3.9', setupCompleted: false, pairedCount: 0 }
  const phoneRunning = { done: ['intro'], finished: false, closed: '', active: { device: 'phone', at: NOW / 1000 - 30 } }
  assert.equal(guideEntry({ ...base, host: phoneRunning, device: 'pc', now: NOW }), null, 'the phone runs the guide: the PC stays closed')
  assert.deepEqual(guideEntry({ ...base, host: phoneRunning, device: 'phone', now: NOW }), { mode: 'fresh' }, 'the phone itself continues')
  const stale = { ...phoneRunning, active: { device: 'phone', at: NOW / 1000 - ACTIVE_WINDOW_S - 1 } }
  assert.deepEqual(guideEntry({ ...base, host: stale, device: 'pc', now: NOW }), { mode: 'fresh' }, 'a phone that went quiet for ten minutes blocks nobody')
  assert.equal(guideEntry({ ...base, host: { done: [], finished: true, closed: '1.3.9', active: null }, device: 'pc', now: NOW }), null, 'finished on another device: this version was seen')
  assert.ok(!activeElsewhere(null, 'pc') && !activeElsewhere({ active: null }, 'pc'))
})

test('closed with the X on one device stays closed on every device until the version changes (the prompt that kept coming back)', () => {
  const base = { setupCompleted: false, pairedCount: 0 }
  const resuming = { visited: ['intro', 'account'], finished: false, version: '1.3.9', mode: 'fresh' }
  assert.deepEqual(guideEntry({ ...base, progress: resuming, version: '1.3.9' }), { mode: 'fresh' }, 'without the mark the run that was left opens again')
  assert.equal(guideEntry({ ...base, progress: { ...resuming, closed: '1.3.9' }, version: '1.3.9' }), null, 'closed here')
  assert.equal(guideEntry({ ...base, progress: resuming, version: '1.3.9', host: { done: [], finished: false, closed: '1.3.9', active: null } }), null, 'closed on the other device')
  assert.deepEqual(guideEntry({ setupCompleted: true, pairedCount: 1, progress: { ...resuming, closed: '1.3.9' }, version: '1.4.0' }), { mode: 'upgrade' }, 'a new version is shown once more')
  assert.equal(guideEntry({ ...base, progress: { closed: '-' }, version: '' }), null, 'also without a product version')
  // the mark and the steps done are stored with the progress
  const storage = memory()
  writeProgress(storage, 'k', { step: 'pair', done: ['intro', 'bogus'], closed: '1.3.9', visited: ['intro'] })
  const back = readProgress(storage, 'k')
  assert.deepEqual([back.done, back.closed], [['intro'], '1.3.9'])
})

test('the host writes are one at a time and merge what arrives meanwhile', async () => {
  const posts = []
  let config = { port: 47989, guide_done: '' }
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const api = { getJson: async () => ({ ...config }), postJson: async (path, body) => { posts.push(body); await gate; config = body; return { status: true } } }
  const save = createHostSaver(api)
  const first = save({ done: ['intro'], active: { device: 'd1', at: 10 } })
  save({ done: ['intro', 'account'] })
  save({ finished: true })
  release()
  await first
  await new Promise((resolve) => setTimeout(resolve, 5))
  assert.equal(posts.length, 2, 'the first write, then one more with the rest merged')
  assert.equal(posts[1].guide_done, 'intro,account')
  assert.equal(posts[1].guide_finished, 'true')
  assert.equal(posts[1].port, 47989, 'the rest of the configuration is kept')
  assert.deepEqual(await saveGuideHost({ getJson: async () => { throw new Error('down') }, postJson: async () => ({}) }, {}), { ok: false })
})

test('a phone is told from a desktop by the browser and by a small touch screen', () => {
  assert.ok(isPhoneLike({ userAgent: 'Mozilla/5.0 (Linux; Android 14; V2338A) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' }))
  assert.ok(isPhoneLike({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Mobile/15E148' }))
  assert.ok(isPhoneLike({ userAgent: 'x', coarse: true, width: 390 }))
  assert.ok(!isPhoneLike({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', coarse: false, width: 1280 }))
  assert.ok(!isPhoneLike({ userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120', coarse: true, width: 1366 }), 'a touch laptop is not a phone')
})

test('cross-device: a guide that stays on one step keeps its claim on the host, so the computer does not open its own while the phone installs the client', () => {
  assert.ok(HEARTBEAT_S * 2 < ACTIVE_WINDOW_S, 'at least two beats fit in the window a claim counts')
  const flow = readFileSync(new URL('../src/vue/MGuideFlow.vue', import.meta.url), 'utf8')
  assert.match(flow, /setInterval\(beatNow, HEARTBEAT_S \* 1000\)/)
  assert.match(flow, /clearInterval\(beat\)/)
  assert.match(flow, /beats < HEARTBEAT_MAX/)
  assert.ok(HEARTBEAT_MAX * HEARTBEAT_S <= 3600, 'a forgotten window stops beating within the hour')
  // a beat fresh at 9 minutes still holds the computer back; the same claim without beats is forgotten at 10
  const claim = (ageS) => ({ active: { device: 'phone', at: NOW / 1000 - ageS } })
  assert.equal(activeElsewhere(claim(HEARTBEAT_S + 5), 'pc', NOW), true)
  assert.equal(activeElsewhere(claim(ACTIVE_WINDOW_S + 1), 'pc', NOW), false)
})

test('an upgrade pass never takes back "finished" on the host (the installer and the other devices started the whole guide again)', async () => {
  // the host says the guide was finished on an earlier version; the upgrade flow resets its own copy of the flag and then saves a step and a close
  const written = []
  const api = { getJson: async () => ({ guide_finished: 'true', guide_closed: '1.3.8', sunshine_name: 'PC' }), postJson: async (_path, body) => { written.push(body); return { status: true } } }
  const save = createHostSaver(api)
  await save(progressSavePatch({ done: ['intro'], finished: false, closed: '', ended: false, device: 'pc', now: 1_800_000_000 }))
  await save(progressSavePatch({ done: ['intro'], finished: false, closed: '1.3.9', ended: true, device: 'pc', now: 1_800_000_001 }))
  assert.equal(written.length, 2)
  for (const body of written) assert.equal(body.guide_finished, 'true', 'what was finished stays finished')
  assert.equal(written[1].guide_closed, '1.3.9')
  assert.equal(written[1].guide_active, '', 'a closed guide no longer claims the host')
  // finishing is written, and so is a deliberate start over
  assert.equal(hostPatchOf(progressSavePatch({ done: [], finished: true, closed: '1.3.9', ended: true, device: 'pc', now: 1 })).guide_finished, 'true')
  assert.equal(hostPatchOf({ finished: false }).guide_finished, 'false')
  assert.ok(!('finished' in progressSavePatch({ done: [], finished: false, closed: '', ended: false, device: 'pc', now: 1 })))
  assert.deepEqual(progressSavePatch({ done: ['intro'], finished: false, closed: '', ended: false, device: 'pc', now: 5 }).active, { device: 'pc', at: 5 })
  // the flow saves through it, and nowhere writes the flag by hand
  const flow = readFileSync(new URL('../src/vue/MGuideFlow.vue', import.meta.url), 'utf8')
  assert.match(flow, /saveGuideProgress\?\.\(progressSavePatch\(/)
  assert.doesNotMatch(flow, /saveGuideProgress\?\.\(\{[^}]*finished: progress\.finished/)
})
