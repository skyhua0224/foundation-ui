import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createReachability } from '../src/vue/useReachability.js'

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/reachability-public-verified.json', import.meta.url), 'utf8'))

test('a v1 answer is the report; refresh(true) asks the host to run the check again', async () => {
  const paths = []
  const r = createReachability({ request: async (path) => { paths.push(path); return { ok: true, status: 200, json: fixture } } })
  await r.refresh()
  assert.equal(r.view.status, 'ready'); assert.equal(r.view.report.public.verdict, 'verified')
  // the host has no step-by-step run (404): the one blocking request does it
  const older = createReachability({ request: async (path) => { paths.push(path); return path.startsWith('/api/network/check') ? { ok: false, status: 404, json: null } : { ok: true, status: 200, json: fixture } } })
  await older.refresh(true)
  assert.equal(older.view.status, 'ready')
  assert.deepEqual(paths, ['/api/network/reachability', '/api/network/check', '/api/network/reachability?refresh=1'])
})

test('a host without the API (404) or an answer that is not v1 is "unavailable", never a verdict', async () => {
  const a = createReachability({ request: async () => ({ ok: false, status: 404, json: null }) })
  await a.refresh(); assert.equal(a.view.status, 'unavailable'); assert.equal(a.view.report, null)
  const b = createReachability({ request: async () => ({ ok: true, status: 200, json: { version: 9 } }) })
  await b.refresh(); assert.equal(b.view.status, 'unavailable')
})

test('the real host closes the connection with 444 on a route it does not have: that is "unavailable" too, not an error', async () => {
  const a = createReachability({ request: async () => ({ ok: false, status: 444, json: null }) })
  await a.refresh(); assert.equal(a.view.status, 'unavailable'); assert.equal(a.view.report, null)
})

test('a failure is an error and keeps the last report beside it, so the screen can say why', async () => {
  let fail = false
  const r = createReachability({ request: async () => { if (fail) throw new Error('down'); return { ok: true, status: 200, json: fixture } } })
  await r.refresh(); fail = true; await r.refresh(true)
  assert.equal(r.view.status, 'error'); assert.equal(r.view.cause, 'offline'); assert.ok(r.view.report)
  const e = createReachability({ request: async () => { throw new Error('down') } })
  await e.refresh(); assert.equal(e.view.status, 'error')
})
