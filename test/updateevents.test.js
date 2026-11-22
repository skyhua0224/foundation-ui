import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createEventSender, updateErrorClassOf, updateResultProps, updateStageOf } from '../src/telemetry/index.js'

test('the steps of the update sheet map onto the five stages of the contract', () => {
  assert.deepEqual(['checking', 'available', 'downloading', 'verifying', 'installing', 'ready', 'restarting', 'nothing'].map(updateStageOf), ['check', 'check', 'download', 'verify', 'apply', 'apply', 'restart', 'apply'])
})

test('a failure is a class from the status or the error name, never its text', () => {
  assert.equal(updateErrorClassOf({ status: 503 }), 'http_5xx')
  assert.equal(updateErrorClassOf({ status: 404 }), 'http_4xx')
  assert.equal(updateErrorClassOf({ name: 'AbortError' }), 'cancelled')
  assert.equal(updateErrorClassOf({ code: 'ERR_HASH_MISMATCH' }), 'hash_mismatch')
  assert.equal(updateErrorClassOf({ code: 'ENOSPC' }), 'disk')
  assert.equal(updateErrorClassOf({ code: 'EACCES' }), 'permission')
  assert.equal(updateErrorClassOf({ name: 'TypeError', code: 'ECONNRESET' }), 'network')
  assert.equal(updateErrorClassOf({ message: 'C:\\Users\\someone\\x failed' }), 'other')
})

test('an update_result has the source, the stage, the result and for a failure the class', () => {
  assert.deepEqual(updateResultProps({ source: 'mirror', step: 'downloading', ok: true, fromVersion: 'v2026.1114.1', toVersion: 'v2026.1115.2', durMs: 1234.4 }), {
    source: 'mirror', stage: 'download', result: 'ok', from_version: 'v2026.1114.1', to_version: 'v2026.1115.2', dur_ms: 1234,
  })
  assert.deepEqual(updateResultProps({ source: 'github', step: 'verify', ok: false, code: 'hash', rebootNeeded: true }), { source: 'github', stage: 'verify', result: 'failed', error_class: 'hash_mismatch', reboot_needed: true })
  assert.equal(updateResultProps({ source: 'somewhere', step: 'check', ok: true }).source, 'other')
})

test('the sender queues the result as an error-kind event, so the error-report choice governs it', async () => {
  const sent = []
  const sender = createEventSender({ product: 'panel', post: async (body) => { sent.push(...body.events); return { ok: true, status: 200 } }, usageOn: () => false, errorsOn: () => true, schedule: () => 0, cancel: () => {} })
  sender.track.updateResult({ source: 'mirror', step: 'installing', ok: false, status: 500 })
  await sender.flush()
  assert.equal(sent.length, 1)
  assert.equal(sent[0].kind, 'error')
  assert.equal(sent[0].name, 'update_result')
  assert.deepEqual(sent[0].props, { source: 'mirror', stage: 'apply', result: 'failed', error_class: 'http_5xx' })
  const off = createEventSender({ product: 'panel', post: async () => ({ ok: true, status: 200 }), usageOn: () => true, errorsOn: () => false, schedule: () => 0, cancel: () => {} })
  off.track.updateResult({ source: 'github', step: 'check', ok: true })
  assert.equal(off.pending, 0)
})
