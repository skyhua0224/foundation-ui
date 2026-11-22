import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { isPlaceholderName, isSessionClient, onlineClients, realSession, sessionUuid, withStreaming } from '../src/vue/clientsLive.js'
import { buildCatalogue } from '../src/vue/homeCatalogue.js'
import { homeTexts } from '../src/vue/homeModel.js'

// The host's client list has no `streaming` flag: who streams is what the session says (the same source as 本主机 and the hero).
const clients = [{ name: 'Pixel 9', uuid: 'U-1', enabled: true }, { name: 'iPad Air', uuid: 'U-2', enabled: true }]
const session = { client_name: 'Pixel 9', client_cert_uuid: 'u-1', app_name: 'Elden Ring', state: 'RUNNING' }

test('the session names the client that streams: by the uuid of its certificate (any case), else by name; a flag a host does send still counts', () => {
  assert.equal(sessionUuid(session), 'u-1')
  assert.equal(isSessionClient(clients[0], session), true); assert.equal(isSessionClient(clients[1], session), false)
  assert.equal(isSessionClient({ name: 'Pixel 9' }, { client_name: 'Pixel 9' }), true, 'by name when there is no uuid')
  assert.equal(isSessionClient({ name: 'Other', uuid: 'U-9' }, { client_name: 'Other', client_cert_uuid: 'U-1' }), false, 'a uuid that differs wins over a name that is the same')
  assert.deepEqual(withStreaming(clients, session).map((c) => !!c.streaming), [true, false])
  assert.deepEqual(withStreaming([{ name: 'A', streaming: true }], null).map((c) => c.streaming), [true])
  assert.equal(withStreaming(null, session), null)
})

test('当前在线 says who streams while the session runs, and the client of the session even when the list does not have it yet', () => {
  assert.deepEqual(onlineClients(clients, session).map((c) => c.name), ['Pixel 9'])
  assert.deepEqual(onlineClients(clients, null), [], 'nothing runs: nobody is online')
  assert.deepEqual(onlineClients([], session).map((c) => c.name), ['Pixel 9'], 'the list is a moment behind: the session still names its client')
  assert.equal(onlineClients(null, session), null)
  const T = homeTexts('zh')
  const d = buildCatalogue({ session, clients, now: Date.now() }, T).data
  assert.equal(d['clients-online'].count, 1); assert.equal(d['clients-online'].items[0].name, 'Pixel 9')
  const idle = buildCatalogue({ session: null, clients, now: Date.now() }, T).data
  assert.equal(idle['clients-online'].count, 0)
})

test('the curve tile does not stay an empty card for the first seconds of a stream: one sample (or only the value) is drawn as a line that does not move', () => {
  const v = fs.readFileSync(new URL('../src/vue/MDashCurve.vue', import.meta.url), 'utf8')
  assert.match(v, /const samples = computed\(\(\) => \{ const p = drawn\.value\.filter/)
  assert.match(v, /const paths = computed\(\(\) => curvePaths\(samples\.value,/)
})

test("the host's 'unknown' is not a client name: the paired client of the certificate names it, else the tile shows nothing", () => {
  assert.equal(isPlaceholderName('unknown'), true); assert.equal(isPlaceholderName(' Unknown '), true); assert.equal(isPlaceholderName(''), true); assert.equal(isPlaceholderName('Pixel 9'), false)
  const raw = { client_name: 'unknown', client_uuid: 'u-1', uptimeMs: 18000 }
  assert.equal(realSession(raw, clients).client_name, 'Pixel 9', 'the paired client of the uuid')
  assert.equal(realSession({ ...raw, client_uuid: 'u-9' }, clients).client_name, '', 'no match: nothing, not an English word')
  assert.equal(realSession({ ...raw, client_name: 'iPad Air' }, clients).client_name, 'iPad Air')
  assert.equal(realSession(null, clients), null)
  const T = homeTexts('zh')
  assert.equal(buildCatalogue({ session: raw, clients, now: Date.now() }, T).data['session-time'].caption, 'Pixel 9')
  assert.equal(buildCatalogue({ session: { ...raw, client_uuid: '' }, clients, now: Date.now() }, T).data['session-time'].caption, '')
  assert.ok(!JSON.stringify(buildCatalogue({ session: { ...raw, client_uuid: '' }, clients, now: Date.now() }, T).data['stream-client'] ?? {}).includes('unknown'))
})

test('the 串流时长 tile is the time itself in large digits: no ring, no fake progress; the 帧率 tile is a curve, not a ring', () => {
  const v = fs.readFileSync(new URL('../src/vue/tiles/TileGauge.vue', import.meta.url), 'utf8')
  const time = /<template v-else-if="isTime">[\s\S]*?<\/template>/.exec(v)[0]
  assert.match(time, /<MTileNumeral\b[^>]*width="condensed"/); assert.doesNotMatch(time, /MTileRing/); assert.doesNotMatch(v, /HOUR_FLOOR|const hour\b/)
  const cat = fs.readFileSync(new URL('../src/vue/homeCatalogue.js', import.meta.url), 'utf8')
  assert.doesNotMatch(cat, /sweep:/)
  const st = fs.readFileSync(new URL('../src/vue/tiles/TileStream.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(st, /id === 'stream-fps'[^\n]*MTileRing|sfTarget/); assert.match(st, /isFps && target \? target \* 1\.1/)
  const more = fs.readFileSync(new URL('../src/vue/homeCatalogueMore.js', import.meta.url), 'utf8')
  assert.match(more, /points: fpsHistory, target: s\.fps/)
  const small = fs.readFileSync(new URL('../src/vue/homeSmall.js', import.meta.url), 'utf8')
  assert.match(small, /case 'ring': return \{ \.\.\.base, value: String\(first\(d\.centre, ''\)\), secondary: d\.caption \|\| '' \}/, 'an elapsed time has no progress')
})
