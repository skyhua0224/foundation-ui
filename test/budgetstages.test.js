import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCatalogue } from '../src/vue/homeCatalogue.js'
import { homeTexts } from '../src/vue/homeModel.js'
import { catalogueTexts } from '../src/vue/homeCatalogueTexts.js'

const T = { ...homeTexts('zh'), ...catalogueTexts('zh') }
const budgetOf = (session) => buildCatalogue({ session, clients: [], now: Date.now() }, T).data.budget
const base = { client_name: 'Pixel 9', uptimeMs: 1000, fps: 120, bitrate: 48000, latencyMs: 6.15 }

test('the stages of the frame budget come in the order a frame goes through them, each with its milliseconds', () => {
  const b = budgetOf({ ...base, pipeCaptureToConvertMs: 0.04, pipeConvertMs: 0.15, pipeEncodeQueueMs: 0.01, pipeEncodeMs: 5.94, pipePacketToBroadcastMs: 0.01, pipeTotalMs: 6.15 })
  assert.deepEqual(b.stages.map((x) => x.title), ['捕获', '转换', '排队', '编码', '发送'])
  assert.deepEqual(b.stages.map((x) => x.value), ['0.04', '0.15', '0.01', '5.94', '0.01'])
  assert.ok(Math.abs(b.frameMs - 1000 / 120) < 1e-9)
})

test('a stage the host has no samples for is not there, and without any stage the tile keeps its numbers and its curve', () => {
  const some = budgetOf({ ...base, pipeConvertMs: 0.8, pipeEncodeMs: 11.6 })
  assert.deepEqual(some.stages.map((x) => x.key), ['pipeConvertMs', 'pipeEncodeMs'])
  const none = budgetOf(base)
  assert.deepEqual(none.stages, []); assert.equal(none.facts.length, 2)
})

test('the host latency is the pipeline total when only the stages come', () => {
  const b = budgetOf({ client_name: 'Pixel 9', uptimeMs: 1000, fps: 120, bitrate: 48000, pipeEncodeMs: 5.9, pipeTotalMs: 6.2 })
  assert.ok(b && Math.abs(b.value - 6.2 / (1000 / 120)) < 1e-9)
})
