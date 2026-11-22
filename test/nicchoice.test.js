import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { autoNic, boundAddress, isVirtualNic, nicChoiceOf, nicChoices, orderedNics, resolveNic, sameNetwork, setNicChoice } from '../src/vue/nicChoice.js'
import { buildCatalogue } from '../src/vue/homeCatalogue.js'
import { homeTexts } from '../src/vue/homeModel.js'
import { createHistory } from '../src/vue/homeHistory.js'
import { CARD_META } from '../src/vue/homeCards.js'
import { sizeKeyOf, sizesOf } from '../src/vue/homeSizes.js'

const nic = (o) => ({ name: 'x', description: '', type: 'ethernet', up: true, link_speed_mbps: 1000, ipv4: ['192.0.2.9'], ipv6: [], is_default_route: false, ...o })
const radmin = nic({ name: 'Radmin VPN', description: 'Famatech Radmin VPN Ethernet Adapter', link_speed_mbps: 100, ipv4: ['203.0.113.26'], is_default_route: true })
const eth = nic({ name: 'Ethernet', description: 'Realtek Gaming 2.5GbE Family Controller', link_speed_mbps: 2500, ipv4: ['192.0.2.10'], is_default_route: true })
const wifi = nic({ name: 'Wi-Fi', description: 'Intel(R) Wi-Fi 6E AX211', type: 'wifi', link_speed_mbps: 1201, ipv4: ['192.0.2.77'] })
const wsl = nic({ name: 'vEthernet (WSL)', description: 'Hyper-V Virtual Ethernet Adapter', type: 'virtual', link_speed_mbps: 10000, ipv4: ['172.24.64.1'] })
const tailscale = nic({ name: 'Tailscale', description: 'WireGuard Tunnel', type: 'mesh', link_speed_mbps: 100, ipv4: ['100.72.128.84'] })
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m } }

test('a VPN adapter that the host calls ethernet is software; physical adapters are not', () => {
  assert.equal(isVirtualNic(radmin), true)
  assert.equal(isVirtualNic(wsl), true); assert.equal(isVirtualNic(tailscale), true)
  assert.equal(isVirtualNic(nic({ name: 'Ethernet 3', description: 'TAP-Windows Adapter V9' })), true)
  assert.equal(isVirtualNic(nic({ name: 'ZeroTier One [8056c2e21c000001]', description: 'ZeroTier Virtual Port' })), true)
  assert.equal(isVirtualNic(eth), false); assert.equal(isVirtualNic(wifi), false)
  assert.equal(isVirtualNic(nic({ name: 'Ethernet', description: 'Intel(R) Ethernet Connection I219-V' })), false)
})

test('without a choice the real adapter wins over a VPN adapter that holds the default route too (the report of feedback #17)', () => {
  const r = autoNic([radmin, eth, wifi, wsl])
  assert.deepEqual([r.nic.name, r.reason], ['Ethernet', 'default'])
  assert.equal(autoNic([radmin, wifi]).nic.name, 'Wi-Fi', 'a wireless adapter is still a real one')
})

test('without a default route: wired before wireless, then the faster link; a virtual adapter only when nothing else is up', () => {
  const a = autoNic([wifi, nic({ name: 'Ethernet', description: 'Realtek', is_default_route: false })])
  assert.deepEqual([a.nic.name, a.reason], ['Ethernet', 'physical'])
  const v = autoNic([radmin, wsl, nic({ name: 'Ethernet', up: false })])
  assert.equal(v.reason, 'virtual'); assert.equal(v.nic.name, 'Radmin VPN', 'the default route breaks the tie among virtual adapters')
  assert.deepEqual(autoNic([nic({ up: false })]), { nic: null, reason: '' })
  assert.deepEqual(autoNic(undefined), { nic: null, reason: '' })
})

test('an adapter with only a link-local address is the last of its kind', () => {
  const lonely = nic({ name: 'Ethernet 2', ipv4: ['169.254.7.7'], link_speed_mbps: 10000 })
  assert.equal(autoNic([lonely, wifi]).nic.name, 'Wi-Fi')
})

test('the address the host is bound to decides first, also when it is a virtual adapter; "any" binds nothing', () => {
  const r = autoNic([eth, wifi, radmin], { bind: '192.0.2.77' })
  assert.deepEqual([r.nic.name, r.reason], ['Wi-Fi', 'bound'])
  assert.equal(autoNic([eth, radmin], { bind: '203.0.113.26' }).nic.name, 'Radmin VPN')
  for (const any of ['', '0.0.0.0', '::', undefined, '  ']) assert.equal(autoNic([eth, wifi], { bind: any }).reason, 'default', JSON.stringify(any))
  assert.equal(autoNic([eth, wifi], { bind: '192.0.2.200' }).reason, 'default', 'an address no adapter holds binds nothing')
  assert.equal(boundAddress('[2001:DB8::1]'), boundAddress('2001:db8:0:0:0:0:0:1'))
})

test('the network of the streaming client picks the adapter that carries the stream', () => {
  const r = autoNic([radmin, eth, wifi], { client: '203.0.113.40' })
  assert.deepEqual([r.nic.name, r.reason], ['Radmin VPN', 'stream'])
  assert.equal(autoNic([eth, wifi], { client: '192.0.2.40' }).nic.name, 'Ethernet', 'the same network on two adapters: the wired one')
  assert.equal(autoNic([eth, wifi], { client: '127.0.0.1' }).reason, 'default', 'a client on this computer is on no network')
  assert.equal(autoNic([eth, wifi], { client: '198.51.100.9' }).reason, 'default')
  assert.equal(autoNic([nic({ name: 'a', ipv4: [], ipv6: ['2001:db8:1:2::5'] }), eth], { client: '2001:db8:1:2::99' }).nic.name, 'a')
})

test('sameNetwork: /24 for IPv4, /64 for IPv6, never a loopback or an unspecified address', () => {
  assert.equal(sameNetwork('192.0.2.10', '192.0.2.200'), true); assert.equal(sameNetwork('192.0.2.10', '192.0.3.10'), false)
  assert.equal(sameNetwork('2001:db8:1:2::1', '2001:db8:1:2:aaaa::2'), true); assert.equal(sameNetwork('2001:db8:1:2::1', '2001:db8:1:3::1'), false)
  assert.equal(sameNetwork('127.0.0.1', '127.0.0.1'), false); assert.equal(sameNetwork('::1', '::1'), false); assert.equal(sameNetwork('0.0.0.0', '0.0.0.0'), false)
  assert.equal(sameNetwork('::ffff:192.0.2.10', '192.0.2.4'), true); assert.equal(sameNetwork('nope', '192.0.2.4'), false)
})

test('the person\'s choice wins while that adapter exists, Auto (empty) is the rule, a vanished adapter falls back and says so', () => {
  const all = [radmin, eth, wifi, wsl]
  const m = resolveNic(all, 'Wi-Fi')
  assert.deepEqual([m.nic.name, m.reason, m.auto.nic.name, m.missing], ['Wi-Fi', 'manual', 'Ethernet', ''])
  assert.equal(resolveNic(all, 'Radmin VPN').nic.name, 'Radmin VPN', 'a virtual adapter can be chosen on purpose')
  assert.equal(resolveNic(all, 'Bluetooth').nic.name, 'Ethernet'); assert.equal(resolveNic(all, 'Bluetooth').missing, 'Bluetooth')
  assert.deepEqual([resolveNic(all, '').reason, resolveNic(all, null).reason], ['default', 'default'])
  assert.equal(resolveNic([nic({ name: 'Ethernet', up: false })], 'Ethernet').nic.up, false, 'a chosen adapter that is down is still shown')
})

test('the list order: the automatic adapter first, the other real ones, the virtual ones, the ones that are down last', () => {
  const down = nic({ name: 'Bluetooth', type: 'other', up: false })
  assert.deepEqual(orderedNics([down, wsl, radmin, wifi, eth, tailscale]).map((n) => n.name), ['Ethernet', 'Wi-Fi', 'Radmin VPN', 'Tailscale', 'vEthernet (WSL)', 'Bluetooth'])
})

test('the choice is kept per host in local storage; Auto removes it; a damaged store is empty', () => {
  const st = mem()
  setNicChoice('Demo-PC', 'Wi-Fi', st); setNicChoice('Other', 'Ethernet', st)
  assert.equal(nicChoiceOf('Demo-PC'), 'Wi-Fi'); assert.equal(nicChoiceOf('Other'), 'Ethernet'); assert.equal(nicChoiceOf('Third'), '')
  assert.deepEqual(JSON.parse(st.getItem('foundation-ui.net-tile.adapter')), { 'Demo-PC': 'Wi-Fi', Other: 'Ethernet' })
  setNicChoice('Demo-PC', '', st)
  assert.equal(nicChoiceOf('Demo-PC'), ''); assert.deepEqual(JSON.parse(st.getItem('foundation-ui.net-tile.adapter')), { Other: 'Ethernet' })
  setNicChoice('Other', null, st)
  assert.equal(st.getItem('foundation-ui.net-tile.adapter'), null, 'the last choice gone: no key left')
  for (let i = 0; i < 40; i++) setNicChoice(`h${i}`, 'x', st)
  assert.ok(Object.keys(nicChoices.value).length <= 24)
  setNicChoice('', '', st)
  setNicChoice('a', 'b', { setItem() { throw new Error('quota') }, removeItem() { throw new Error('quota') } })
  assert.equal(nicChoiceOf('a'), 'b', 'a store that throws still holds the choice for the session')
  for (const k of Object.keys(nicChoices.value)) setNicChoice(k, '', st)
})

const T = { ...homeTexts('en'), __locale: 'en' }
const hist = () => createHistory({ getItem: () => null, setItem() {} }, 't')
const si = (nics, host = 'Demo-PC') => ({ version: 1, nics, host: { name: host }, os: { name: 'Windows 11', version: '24H2', build: '1' } })
const netOf = (x) => buildCatalogue({ now: 0, history: hist(), ...x }, T).data.net

test('the 网卡 tile: the rule picks the adapter, the data carries the list, the reason and the choice', () => {
  const d = netOf({ sysinfo: si([radmin, eth, wifi, wsl, nic({ name: 'Bluetooth', type: 'other', up: false, link_speed_mbps: 3, ipv4: [] })]) })
  assert.deepEqual([d.primary.name, d.primary.kind, d.primary.virtual], ['Ethernet', 'Ethernet', false])
  assert.deepEqual([d.choice.manual, d.choice.reason, d.choice.auto, d.choice.value, d.choice.host], [false, 'default', 'Ethernet', '', 'Demo-PC'])
  assert.deepEqual(d.choice.options.map((o) => [o.id, o.current, o.up]), [['Ethernet', true, true], ['Wi-Fi', false, true], ['Radmin VPN', false, true], ['vEthernet (WSL)', false, true], ['Bluetooth', false, false]])
  assert.ok(d.choice.options.find((o) => o.id === 'Radmin VPN').sub.startsWith('Virtual'), 'a VPN adapter says it is software')
  assert.equal(d.rows.some((r) => r.title === 'Bluetooth'), false, 'the rows are the adapters that are up')
  assert.equal(d.labels.why, 'Carries the default route')
})

test('the 网卡 tile: a chosen adapter is shown, marked manual, and the rule is still told', () => {
  const d = netOf({ sysinfo: si([radmin, eth, wifi]), nicChoice: 'Radmin VPN' })
  assert.deepEqual([d.primary.name, d.primary.virtual, d.choice.manual, d.choice.value, d.choice.auto, d.labels.why], ['Radmin VPN', true, true, 'Radmin VPN', 'Ethernet', 'Your choice'])
  const gone = netOf({ sysinfo: si([eth, wifi]), nicChoice: 'Gone' })
  assert.deepEqual([gone.primary.name, gone.choice.manual, gone.choice.missing, gone.labels.gone.length > 0], ['Ethernet', false, 'Gone', true])
})

test('the 网卡 tile follows the kept choice of its host', () => {
  const st = mem()
  setNicChoice('Demo-PC', 'Wi-Fi', st)
  assert.equal(netOf({ sysinfo: si([eth, wifi]) }).primary.name, 'Wi-Fi')
  assert.equal(netOf({ sysinfo: si([eth, wifi], 'Another-PC') }).primary.name, 'Ethernet', 'another host has its own choice')
  setNicChoice('Demo-PC', '', st)
  assert.equal(netOf({ sysinfo: si([eth, wifi]) }).primary.name, 'Ethernet')
})

test('the 网卡 tile: the host configuration binds, a streaming client\'s network carries; the stream rate belongs to the adapter that carries it', () => {
  assert.equal(netOf({ sysinfo: si([eth, wifi]), config: { bind_address: '192.0.2.77' } }).primary.name, 'Wi-Fi')
  const live = { client_address: '203.0.113.40', bitrate: 40000, measured_bitrate_kbps: 38000 }
  const d = netOf({ sysinfo: si([radmin, eth]), session: live, history: { samples: { bitrate: [30000, 40000, 50000] }, sessions: [], days: {}, last: () => null } })
  assert.deepEqual([d.primary.name, d.choice.reason], ['Radmin VPN', 'stream'])
  assert.deepEqual([d.usage.here, d.usage.series, d.usage.now, d.usage.speed], [true, [30, 40, 50], 50, 100])
  assert.equal(d.usage.ratio, 0.5)
  const other = netOf({ sysinfo: si([radmin, eth]), session: live, nicChoice: 'Ethernet', history: { samples: { bitrate: [30000, 40000] }, sessions: [], days: {}, last: () => null } })
  assert.deepEqual([other.primary.name, other.usage.here, other.usage.series], ['Ethernet', false, []], 'a chosen adapter that is not the stream\'s shows no stream rate')
  assert.deepEqual(netOf({ sysinfo: si([eth]) }).usage.series, [], 'no session, no stream rate')
})

test('the 网卡 tile has no 方形: 中, 大 and 特大 only; a saved 方形 is drawn as 中', () => {
  const meta = CARD_META.net
  assert.deepEqual(Object.keys(sizesOf('net', meta).sizes), ['m', 'l', 'xl'])
  assert.equal(sizesOf('net', meta).size, 'm')
  assert.equal(sizeKeyOf('net', meta, 's'), 'm', 'the preference is kept, the size drawn is the smallest the tile offers')
  assert.equal(sizeKeyOf('net', meta, 'xl'), 'xl'); assert.equal(sizeKeyOf('net', meta, 'l'), 'l')
})

test('an IPv6 bind address is compared by value, and only an ethernet or wifi adapter is a physical one', () => {
  const v6 = nic({ name: 'Wi-Fi', type: 'wifi', ipv4: [], ipv6: ['2001:db8::1'] })
  assert.equal(autoNic([eth, v6], { bind: '2001:0db8:0:0:0:0:0:1' }).nic.name, 'Wi-Fi', 'the same address written long')
  assert.equal(autoNic([eth, v6], { bind: '[2001:DB8::1]' }).reason, 'bound')
  const bridge = nic({ name: 'bridge0', description: 'Network bridge', type: 'other', link_speed_mbps: 10000, is_default_route: true })
  assert.equal(autoNic([bridge, wifi]).nic.name, 'Wi-Fi', 'a type "other" adapter does not beat a wireless one')
  assert.equal(autoNic([bridge]).nic.name, 'bridge0', 'but it is shown when nothing else is up')
})

test('the 网卡 tile draws the stream curve only when the host reports the measured bitrate; the list addresses are marked for the screenshot cover', () => {
  const hist = { samples: { bitrate: [30000, 40000] }, sessions: [], days: {}, last: () => null }
  const budgetOnly = netOf({ sysinfo: si([eth]), session: { client_address: '192.0.2.40', bitrate: 40000 }, history: hist })
  assert.deepEqual(budgetOnly.usage.series, [], 'a configured budget is not a measurement')
  const measured = netOf({ sysinfo: si([eth]), session: { client_address: '192.0.2.40', bitrate: 40000, measured_bitrate_kbps: 38000 }, history: hist })
  assert.deepEqual(measured.usage.series, [30, 40])
  const v = fs.readFileSync(new URL('../src/vue/tiles/TileNet.vue', import.meta.url), 'utf8')
  assert.match(v, /<small data-redact="address">\{\{ o\.sub \}\}<\/small>/)
  assert.match(v, /role="radiogroup"[^>]*@keydown="onKey"/)
})
