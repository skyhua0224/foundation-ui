import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildCatalogue } from '../src/vue/homeCatalogue.js'
import { homeTexts } from '../src/vue/homeModel.js'
import { hasNoData } from '../src/vue/homeSizes.js'
import { smallOf } from '../src/vue/homeSmall.js'
import { createHistory } from '../src/vue/homeHistory.js'
import { normalizeReport, parseEndpoints, rejectedEndpointsOfConfig, validateEndpoint } from '../src/settings/reachability.js'

// 公网地址: every state the card can be in names itself; an address that no client can use (0.0.0.0, ::) is never drawn as the address.
const fixture = (name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))
const T = homeTexts('zh')
const history = createHistory({ getItem: () => null, setItem() {} }, 't')
const view = (x) => buildCatalogue({ now: 0, history, canAct: true, ...x }, T).data['public-address']
const verified = () => fixture('reachability-public-verified')
const reportWith = (fn) => { const r = verified(); fn(r); return normalizeReport(r) }

test('0.0.0.0 and :: are no address: the field refuses them, a configuration that holds one reports it', () => {
  for (const wild of ['0.0.0.0', '0.0.0.0:57989', '0.1.2.3', '::', '[::]:57989', '0:0:0:0:0:0:0:0']) assert.equal(validateEndpoint(wild).error, 'unspecified', wild)
  assert.equal(validateEndpoint('127.0.0.1').warn, 'private', 'loopback stays a warning')
  assert.deepEqual(parseEndpoints('0.0.0.0, home.example.net'), ['home.example.net'])
  assert.deepEqual(rejectedEndpointsOfConfig({ external_ip: '0.0.0.0' }), [{ text: '0.0.0.0', error: 'unspecified' }])
  assert.deepEqual(rejectedEndpointsOfConfig({ external_endpoints: 'bad_name.example, home.example.net', external_ip: '0.0.0.0' }).map((r) => r.error), ['host'], 'external_endpoints wins over the legacy value')
  assert.deepEqual(rejectedEndpointsOfConfig({ external_ip: 'home.example.net' }), [])
  assert.deepEqual(rejectedEndpointsOfConfig({}), [])
})

test('a saved 0.0.0.0 is an invalid address, not the address, whatever the host answered', () => {
  const bad = reportWith((r) => { r.public.verdict = 'unreachable'; r.public.configured_address = { value: '0.0.0.0', kind: 'ip', resolved: [], matches_wan: null, reasons: ['address_private'] } })
  const d = view({ config: { external_ip: '0.0.0.0' }, reach: bad })
  assert.equal(d.saved, '')
  assert.deepEqual([d.view.state, d.view.value, d.view.tone, d.view.address], ['invalid', T.addrInvalid, 'bad', false])
  assert.equal(d.view.word, T.addrWildcard)
  assert.ok(!JSON.stringify(d.view).includes('0.0.0.0'))
  assert.equal(hasNoData(d), false, 'it is a state to show, not an empty tile')
  const s = smallOf({ id: 'public-address', title: 'x', data: d }, T)
  assert.deepEqual([s.value, s.secondary, s.tone], [T.addrInvalid, T.addrWildcard, 'warn'])
})

test('the set address shows with the verdict of the host; an address that was never checked says so; a check in progress says so', () => {
  const ok = view({ config: { external_ip: 'home.example.net' }, reach: normalizeReport(verified()) })
  assert.deepEqual([ok.view.state, ok.view.value, ok.view.tone, ok.view.address], ['saved', 'home.example.net', 'ok', true])
  const down = view({ config: { external_ip: 'home.example.net' }, reach: reportWith((r) => { r.public.verdict = 'unreachable'; r.public.configured_address = { value: 'home.example.net', kind: 'hostname', resolved: [], matches_wan: null, reasons: ['dns_failed'] } }) })
  assert.deepEqual([down.view.state, down.view.tone], ['saved', 'bad'])
  const never = view({ config: { external_ip: 'home.example.net' }, reach: null })
  assert.deepEqual([never.view.state, never.view.word], ['unchecked', T.addrNotChecked])
  const busy = view({ config: { external_ip: 'home.example.net' }, reach: null, reachChecking: true })
  assert.deepEqual([busy.view.state, busy.view.word], ['checking', T.addrStChecking])
  const busyUnset = view({ config: {}, reach: null, reachStatus: 'loading' })
  assert.deepEqual([busyUnset.view.state, busyUnset.view.value, busyUnset.view.address], ['checking', T.addrStChecking, false])
})

test('nothing set: the public address of the router when there is one; no public IPv4 behind a carrier NAT, a private WAN or a router that answers 0.0.0.0', () => {
  const found = view({ config: {}, reach: normalizeReport(verified()) })
  assert.deepEqual([found.view.state, found.view.value, found.view.address], ['found', '203.0.113.45', true])
  const cg = view({ config: {}, reach: normalizeReport(fixture('reachability-cgnat')) })
  assert.deepEqual([cg.view.state, cg.view.value, cg.view.word, cg.view.address], ['no-ipv4', T.addrNoV4, T.addrCgnat, false])
  const priv = view({ config: {}, reach: reportWith((r) => { r.public.router.wan_ip = '192.168.8.2'; r.public.router.wan_ip_class = 'private' }) })
  assert.deepEqual([priv.view.state, priv.view.word], ['no-ipv4', T.addrPrivateWan])
  const none = view({ config: {}, reach: reportWith((r) => { r.public.router.wan_ip = '0.0.0.0'; r.public.router.wan_ip_class = 'public' }) })
  assert.deepEqual([none.view.state, none.view.value, none.view.word], ['no-ipv4', T.addrNoV4, T.addrNoWan])
  assert.ok(!JSON.stringify(none.view).includes('0.0.0.0'), 'the answer of the router is not drawn as an address')
})

test('the check that did not come back is a failure with its reason; nothing known is the empty tile', () => {
  const offline = view({ config: {}, reach: null, reachStatus: 'error', reachCause: 'offline' })
  assert.deepEqual([offline.view.state, offline.view.value, offline.view.word], ['failed', T.addrFailed, T.addrFailOffline])
  const http = view({ config: {}, reach: null, reachStatus: 'error', reachCause: '', reachHttp: 502 })
  assert.equal(http.view.word, T.addrFailHttp.replace('{code}', '502'))
  const unknown = view({ config: {}, reach: reportWith((r) => { r.public.router = { protocol: 'none', wan_ip: '', wan_ip_class: 'unknown', mappings: [] } }) })
  assert.equal(unknown.view.state, 'unset')
  assert.equal(hasNoData(unknown), true)
  assert.equal(hasNoData(view({ config: {}, reach: null })), true)
})

test('the tile of the address: no state is drawn twice, every text wraps instead of being cut, and the plate says what the state is', () => {
  const tile = fs.readFileSync(new URL('../src/vue/tiles/TileHost.vue', import.meta.url), 'utf8')
  assert.match(tile, /v-if="size !== 's'" class="m-b2glyph"/, 'the head has the globe at 方形')
  assert.match(tile, /:data-redact="av\.address \? 'address' : null"/, 'only a real address is redacted in a screenshot')
  assert.ok(!/reachable/.test(tile), 'the plate tone follows the state, not a guess at the verdict')
  const css = fs.readFileSync(new URL('../src/css/tilefit-real.css', import.meta.url), 'utf8')
  assert.match(css, /\.m-b2addr \.m-b2plate b \{[^}]*white-space: normal !important/)
  assert.match(css, /\.m-b2addr \.m-b2plate small \{[^}]*white-space: normal !important/)
})

test('a check that failed is shown on the tile with its reason, whatever report is still there; a run shows how far it is', () => {
  const d = view({ config: { external_endpoints: 'home.example.net:57989' }, reach: normalizeReport(verified()), reachStatus: 'error', reachCause: 'timeout', reachHttp: 0 })
  assert.deepEqual([d.view.state, d.view.word, d.view.tone, d.view.address], ['failed', T.addrFailTimeout, 'bad', true])
  assert.equal(d.view.value, 'home.example.net:57989')
  const http = view({ config: {}, reach: normalizeReport(verified()), reachStatus: 'error', reachCause: '', reachHttp: 500 })
  assert.deepEqual([http.view.state, http.view.word], ['failed', T.addrFailHttp.replace('{code}', '500')])
  const going = view({ config: { external_endpoints: 'home.example.net:57989' }, reach: normalizeReport(verified()), reachChecking: true, reachStatus: 'loading', reachProgress: { text: '2/6' } })
  assert.equal(going.view.state, 'checking')
  assert.equal(going.progress, '2/6')
})

test('a failed check on an address that is not saved still shows what the router said last time, beside the reason', () => {
  const found = view({ config: {}, reach: normalizeReport(verified()), reachStatus: 'error', reachCause: 'timeout', reachHttp: 0 })
  assert.equal(found.view.state, 'failed')
  assert.equal(found.view.word, T.addrFailTimeout)
  assert.equal(found.view.address, true)
  assert.match(found.view.value, /\d+\.\d+\.\d+\.\d+/, 'the router address of the last report')
  const cgnat = view({ config: {}, reach: reportWith((r) => { r.public.router = { protocol: 'upnp', wan_ip: '100.64.1.2', wan_ip_class: 'cgnat', mappings: [] } }), reachStatus: 'error', reachCause: 'offline' })
  assert.deepEqual([cgnat.view.state, cgnat.view.value, cgnat.view.word, cgnat.view.address], ['failed', T.addrNoV4, T.addrFailOffline, false])
  const nothing = view({ config: {}, reach: null, reachStatus: 'error', reachCause: 'offline' })
  assert.equal(nothing.view.value, T.addrFailed)
})
