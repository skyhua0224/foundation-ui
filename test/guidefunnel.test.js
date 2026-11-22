import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GUIDE_FLOW, GUIDE_FLOW_UPGRADE, GUIDE_OPTIONAL } from '../src/vue/guideModel.js'
import { GUIDE_FUNNEL_OPTIONAL, GUIDE_FUNNEL_PHASES, GUIDE_FUNNEL_STEPS, createEventSender, createGuideFunnel, guideFunnelProps } from '../src/telemetry/index.js'

test('the funnel names every step of the flow and every optional page, with the fixed phases', () => {
  for (const id of [...GUIDE_FLOW, ...GUIDE_FLOW_UPGRADE]) assert.ok(GUIDE_FUNNEL_STEPS.includes(id), id)
  for (const page of GUIDE_OPTIONAL) assert.ok(GUIDE_FUNNEL_OPTIONAL.includes(page.id), page.id)
  assert.deepEqual([...GUIDE_FUNNEL_PHASES], ['reached', 'skipped', 'finished', 'closed', 'optional_opened'])
})

test('an event is fixed words and numbers: anything else is dropped, a time is a whole number of milliseconds and at most an hour', () => {
  assert.deepEqual(guideFunnelProps({ phase: 'reached', step: 'pair', timeMs: 1234.6, mode: 'fresh' }), { phase: 'reached', step: 'pair', mode: 'fresh', time_ms: 1235 })
  assert.deepEqual(guideFunnelProps({ phase: 'optional_opened', step: 'done', optional: 'remote', timeMs: 5 }), { phase: 'optional_opened', step: 'done', mode: 'fresh', optional: 'remote', time_ms: 5 })
  assert.equal(guideFunnelProps({ phase: 'reached', step: 'pair', timeMs: 9e9 }).time_ms, 3_600_000)
  assert.equal(guideFunnelProps({ phase: 'reached', step: 'pair', timeMs: -3 }).time_ms, undefined)
  assert.equal(guideFunnelProps({ phase: 'reached', step: 'pair', mode: 'whatever' }).mode, 'fresh')
  assert.equal(guideFunnelProps({ phase: 'viewed', step: 'pair' }), null)
  assert.equal(guideFunnelProps({ phase: 'reached', step: 'hostdone' }), null, 'a step of the old flow is not counted')
  assert.equal(guideFunnelProps({ phase: 'optional_opened', step: 'done', optional: 'update' }), null, 'the update source is on the channel step now, not an optional page')
  assert.equal(guideFunnelProps({ phase: 'optional_opened', step: 'done' }), null)
  assert.deepEqual(Object.keys(guideFunnelProps({ phase: 'reached', step: 'intro', name: 'Living room PC', address: '192.0.2.2', text: 'typed' })).sort(), ['mode', 'phase', 'step'], 'no other field gets through')
})

test('a run of the guide: each step reached with the time on the one before, then skip, finish or close on the open step, and the pages opened', () => {
  const sent = []
  let t = 1000
  const funnel = createGuideFunnel({ send: (p) => sent.push(p), mode: 'fresh', now: () => t })
  funnel.enter('intro'); t += 4000
  funnel.enter('intro')                       // a re-render is not a visit
  funnel.enter('account'); t += 9000
  funnel.enter('done'); t += 2500
  funnel.optional('remote'); t += 100
  funnel.finish()
  assert.deepEqual(sent, [
    { phase: 'reached', step: 'intro', mode: 'fresh', time_ms: 0 },
    { phase: 'reached', step: 'account', mode: 'fresh', time_ms: 4000 },
    { phase: 'reached', step: 'done', mode: 'fresh', time_ms: 9000 },
    { phase: 'optional_opened', step: 'done', mode: 'fresh', optional: 'remote', time_ms: 2500 },
    { phase: 'finished', step: 'done', mode: 'fresh', time_ms: 2600 },
  ])
  const second = []
  const f = createGuideFunnel({ send: (p) => second.push(p), mode: 'upgrade', now: () => t })
  f.enter('whatsnew'); f.skip(); f.close()
  assert.deepEqual(second.map((p) => [p.phase, p.mode]), [['reached', 'upgrade'], ['skipped', 'upgrade'], ['closed', 'upgrade']])
  assert.doesNotThrow(() => createGuideFunnel({}).enter('intro'), 'a product that sends nothing is fine')
  assert.doesNotThrow(() => createGuideFunnel({ send: () => { throw new Error('down') } }).enter('intro'), 'a statistic never breaks the guide')
})

test('the sender queues it as a usage event, so the choice about anonymous usage statistics governs it', async () => {
  const sent = []
  const sender = createEventSender({ product: 'panel', post: async (body) => { sent.push(...body.events); return { ok: true, status: 200 } }, usageOn: () => true, errorsOn: () => false, schedule: () => 0, cancel: () => {} })
  sender.track.guideFunnel({ phase: 'reached', step: 'channel', time_ms: 800, mode: 'fresh', text: 'typed' })
  sender.track.guideFunnel({ phase: 'nonsense', step: 'channel' })
  await sender.flush()
  assert.deepEqual(sent, [{ kind: 'usage', name: 'guide_funnel', props: { phase: 'reached', step: 'channel', mode: 'fresh', time_ms: 800 } }])
  const off = createEventSender({ product: 'web', post: async () => ({ ok: true, status: 200 }), usageOn: () => false, errorsOn: () => true, schedule: () => 0, cancel: () => {} })
  off.track.guideFunnel({ phase: 'finished', step: 'done' })
  assert.equal(off.pending, 0)
})
