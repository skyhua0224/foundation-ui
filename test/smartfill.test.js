import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fillOrder } from '../src/vue/homeSmart.js'

test('the tiles that fill the empty slots are ranked by the state: streaming numbers first while a stream runs, the host and the system when idle', () => {
  const ids = ['sys', 'cpu', 'loss', 'net', 'apps', 'unknown-a', 'dropped', 'encoder', 'unknown-b', 'devices']
  const live = fillOrder('live', ids)
  assert.ok(live.indexOf('loss') < live.indexOf('cpu') && live.indexOf('dropped') < live.indexOf('net') && live.indexOf('encoder') < live.indexOf('sys'), live.join())
  const idle = fillOrder('idle', ids)
  assert.ok(idle.indexOf('cpu') < idle.indexOf('net') && idle.indexOf('sys') < idle.indexOf('apps') && idle.indexOf('apps') < idle.indexOf('devices'), idle.join())
  assert.ok(idle.indexOf('devices') < idle.indexOf('loss'), 'a tile the idle list does not name comes after the named ones')
  assert.deepEqual(fillOrder('live', ['unknown-b', 'unknown-a']), ['unknown-b', 'unknown-a'], 'unnamed tiles keep the catalogue order')
  assert.deepEqual(fillOrder('idle', []), [])
})

test('the smart overview fills its empty slots with more standard tiles; it never stretches a row or gives a cell to a neighbour', () => {
  const dock = fs.readFileSync(new URL('../src/vue/dash/dashDock.js', import.meta.url), 'utf8')
  const vue = fs.readFileSync(new URL('../src/vue/MHomeDash.vue', import.meta.url), 'utf8')
  assert.match(dock, /packDash\(\[\.\.\.boxed, bx\], units, \{ dense: true, exact: true \}\)/, 'a tile is taken where the exact packer puts it')
  assert.match(dock, /fillSize: offered\[0\]/, 'the smallest standard size the tile offers')
  assert.match(dock, /const grid = gridOf\(width\.value\)/, 'the same cell as manual mode')
  assert.doesNotMatch(dock, /fillK|fillTemplate|closeRowEnds|\.span \+= /, 'no stretching, no cell given to a neighbour')
  assert.doesNotMatch(vue, /is-fill|fillTemplate/)
  assert.match(dock, /fillReady/, 'the fill waits until the page has settled, so the plan never jumps')
  assert.match(dock, /fillMemory/, 'tiles taken before are taken first, in the same order')
})
