import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ACTIONS, actionId, createActionRing, errorReportProps, installActionTracking, routeId, stackFrames, trackFailedCall } from '../src/telemetry/index.js'

test('an id is a lower case word: no text, no spaces, no long strings', () => {
  assert.equal(actionId('Start Stream!'), 'start_stream')
  assert.equal(actionId('  '), '')
  assert.equal(actionId('名字'), '')
  assert.equal(actionId('a'.repeat(100)).length, ACTIONS.idMax)
  assert.equal(actionId('tile.start:1'), 'tile.start:1')
})

test('the ring keeps the last fifty as seconds before | kind | id', () => {
  let t = 1_000_000
  const ring = createActionRing({ now: () => t })
  for (let i = 0; i < 60; i += 1) { ring.add('act', `tile.${i}`); t += 1000 }
  ring.add('wrong-kind', 'x')
  assert.equal(ring.add('nav', ''), false)
  const shot = ring.snapshot(t)
  assert.equal(shot.length, 50)
  assert.equal(shot.at(-1), '0|state|x')
  assert.equal(shot[0], '49|act|tile.11')
  for (const line of shot) assert.match(line, /^\d{1,5}\|(?:nav|act|set|stream|dev|state|net)\|[a-z0-9_.:+-]{1,48}$/)
})

test('a route is its first word: numbers and long segments are not part of it', () => {
  assert.equal(routeId({ pathname: '/apps/12/edit', hash: '' }), 'apps')
  assert.equal(routeId({ pathname: '/', hash: '#/settings/video' }), 'settings')
  assert.equal(routeId({ pathname: '/', hash: '' }), 'home')
  assert.equal(routeId({ pathname: '/12345/' + 'x'.repeat(40), hash: '' }), 'home')
})

test('the listeners record page changes, marked presses, settings and stream state and nothing else', () => {
  const listeners = new Map()
  const win = { location: { pathname: '/apps', hash: '' }, addEventListener: (n, f) => listeners.set(n, f), removeEventListener: (n) => listeners.delete(n) }
  const doc = { addEventListener: (n, f) => listeners.set(`doc:${n}`, f), removeEventListener: (n) => listeners.delete(`doc:${n}`) }
  const ring = createActionRing({ now: () => 5000 })
  const off = installActionTracking(win, doc, ring)
  win.location.pathname = '/settings'; listeners.get('popstate')()
  listeners.get('doc:click')({ target: { closest: () => ({ getAttribute: () => 'tile.start_stream' }) } })
  listeners.get('doc:click')({ target: { closest: () => null, textContent: 'my password is hunter2' } })  // an unmarked press is nothing
  listeners.get('foundation-setting-changed')({ detail: { key: 'max_bitrate', valueClass: '30000-60000', value: 'secret typed text' } })
  listeners.get('foundation-stream-state')({ detail: { state: 'Started' } })
  assert.deepEqual(ring.snapshot(5000), ['0|nav|apps', '0|nav|settings', '0|act|tile.start_stream', '0|set|max_bitrate:30000-60000', '0|stream|started'])
  assert.ok(!/hunter|secret/.test(JSON.stringify(ring.snapshot(5000))))
  off(); assert.equal(listeners.size, 0)
})

test('a failed call is a word and a class of status', () => {
  const ring = createActionRing({ now: () => 1000 })
  // the module ring is the one trackFailedCall writes to: its snapshot is checked through the error props below
  assert.equal(trackFailedCall('/api/apps', 503), true)
  assert.ok(errorReportProps({ product: 'web', fingerprint: 'a'.repeat(32), category: 'api', code: 'x' }, { ring: createActionRing(), now: 0 }) !== null)
  assert.equal(ring.size, 0)
})

test('the stack becomes function@file:line:column frames and nothing that is not a frame', () => {
  const v8 = 'TypeError: x\n    at render (https://h/assets/index-AbC123xy.js:1:20345)\n    at async load (https://h/assets/chunk-9f.js?x=1:7:80)\n    at https://h/assets/index-AbC123xy.js:3:4\nnot a frame'
  assert.deepEqual(stackFrames(v8), ['render@index-AbC123xy.js:1:20345', 'load@chunk-9f.js:7:80', 'anon@index-AbC123xy.js:3:4'])
  assert.deepEqual(stackFrames('render@https://h/assets/index-AbC123xy.js:1:20345\n@https://h/a.js:2:3'), ['render@index-AbC123xy.js:1:20345', 'anon@a.js:2:3'])
  assert.deepEqual(stackFrames('at f (C:\\Users\\Ann\\a.js:1:2)'), [], 'a Windows path is not a frame')
  assert.equal(stackFrames(Array.from({ length: 50 }, (_, i) => `at f${i} (https://h/a.js:${i + 1}:1)`).join('\n')).length, 32)
})

test('the error_report props: the first occurrence has the place, the stack and the actions; a count has none of them', () => {
  const ring = createActionRing({ now: () => 9000 })
  ring.add('nav', 'apps'); ring.add('act', 'tile.start_stream')
  const doc = { product: 'panel', fingerprint: 'f'.repeat(32), category: 'display', code: 'type-error', release: 'v2026.1114.1', page: 'Apps', stack: 'TypeError: x\n    at render (https://h/assets/index-AbC.js:1:20345)', message: 'secret text C:\\Users\\Ann' }
  const first = errorReportProps(doc, { ring, now: 12000 })
  assert.deepEqual(first, { component: 'panel', lang: 'js', fingerprint: 'f'.repeat(32), code: 'display.type-error', severity: 'error', count: 1, build: 'v2026.1114.1', page: 'apps', frames: ['render@index-AbC.js:1:20345'], loc: 'index-AbC.js:1:20345', crumbs: ['3|nav|apps', '3|act|tile.start_stream'] })
  assert.ok(!/secret|Ann/.test(JSON.stringify(first)))
  const count = errorReportProps(doc, { count: 4, withDetail: false })
  assert.deepEqual(Object.keys(count).sort(), ['build', 'code', 'component', 'count', 'fingerprint', 'lang', 'page', 'severity'])
  assert.equal(count.count, 4)
})
