// Which network adapter the 网卡 tile shows (card nic-tile-1120). The host lists its adapters (GET /api/system/info `nics`: name, description, type, up, link_speed_mbps,
// ipv4, ipv6, is_default_route) and nothing says which one carries the stream, so the tile decides, and the person can overrule it on the tile.
//
// The rule without a choice of the person (`autoNic`), the first that holds wins:
//   1 bound      the adapter that holds the address the host is bound to (`bind_address` of the host configuration; empty and "any" mean no binding)
//   2 stream     the adapter on the network of the client that streams now (`client_address` of the running session): the same /24 for IPv4, the same /64 for IPv6
//   3 default    a physical adapter that carries the default route; wired before wireless
//   4 physical   the other physical adapters that are up and hold an address; wired before wireless, the faster link first
//   5 virtual    VPN, overlay, bridge, container, hypervisor and tunnel adapters, only when no physical adapter is up
// "Physical" is the host's own classification (`type` is ethernet or wifi) minus the adapters that the host calls ethernet but that are software (Radmin VPN, Hamachi, TAP, Hyper-V,
// VMware, VirtualBox, WSL, Docker and the like: their name or description says so).
// The /24 is a ranking hint, not a routing fact: the host does not report prefix lengths. It never overrules the bound address and is only used while a client streams.
import { ref } from 'vue'

const VIRTUAL_WORDS = /radmin|hamachi|zerotier|tailscale|wireguard|wintun|openvpn|tap-windows|\btap\b|\btun\d*\b|npcap|vethernet|hyper-v|vmware|vmnet|virtualbox|vbox|\bvpn\b|\bwsl\b|docker|\bveth|^br-|virbr|bluetooth|isatap|teredo|6to4|miniport|anyconnect|nordlynx|cloudflare warp|loopback|pseudo-interface/i

const lower = (v) => String(v ?? '').trim().toLowerCase()
const num = (v) => { const n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) ? n : 0 }
// an address by its value: the same IPv6 address written as 2001:db8::1 and as 2001:0db8:0:0:0:0:0:1 is one address
const canon = (a) => { const t = lower(a).replace(/^\[|\]$/g, '').replace(/%.*$/, ''); const g = t.includes(':') ? v6Groups(t) : null; return g ? g.map((x) => x.toString(16)).join(':') : t }
const addressesOf = (n) => [...(Array.isArray(n?.ipv4) ? n.ipv4 : []), ...(Array.isArray(n?.ipv6) ? n.ipv6 : [])].map(canon).filter(Boolean)
const linkLocal = (a) => /^169\.254\./.test(a) || /^fe80:/.test(a)
const usable = (n) => addressesOf(n).some((a) => !linkLocal(a))

/** An adapter that is software: the host says mesh or virtual, or the name or description of a physical-looking adapter names a VPN, tunnel, bridge, container or hypervisor. */
export function isVirtualNic(n) {
  if (!n) return false
  if (n.type === 'mesh' || n.type === 'virtual') return true
  return VIRTUAL_WORDS.test(`${n.name || ''} ${n.description || ''}`)
}
/** The adapters that can be the answer: not loopback (the host leaves those out), and up or carrying the default route. */
export const isLive = (n) => !!n && (n.up === true || n.is_default_route === true)

/** The address the host is bound to, or '' (nothing set, any address). */
export function boundAddress(bind) {
  const a = canon(bind)
  return !a || a === '0.0.0.0' || a === '::' || a === '*' ? '' : a
}

const v4 = (a) => (/^\d{1,3}(\.\d{1,3}){3}$/.test(a) ? a.split('.').map(Number) : null)
function v6Groups(a) {
  if (!a.includes(':') || a.split('::').length > 2) return null
  const [head, tail = ''] = a.split('::')
  const h = head ? head.split(':') : []
  const t = tail ? tail.split(':') : []
  const fill = a.includes('::') ? 8 - h.length - t.length : 0
  if (fill < 0 || (!a.includes('::') && h.length !== 8)) return null
  const all = [...h, ...Array(fill).fill('0'), ...t].map((g) => parseInt(g || '0', 16))
  return all.length === 8 && all.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? all : null
}
/** Whether two addresses are on the same /24 (IPv4) or /64 (IPv6) network. A loopback or unspecified address is on no network. */
export function sameNetwork(a, b) {
  const x = lower(a).replace(/%.*$/, ''), y = lower(b).replace(/%.*$/, '')
  const mapped = (s) => s.replace(/^::ffff:/, '')
  const [p, q] = [v4(mapped(x)), v4(mapped(y))]
  if (p && q) return p[0] !== 127 && p[0] !== 0 && p[0] === q[0] && p[1] === q[1] && p[2] === q[2]
  const [r, s] = [v6Groups(x), v6Groups(y)]
  if (r && s) return !(r.every((g) => g === 0) || (r.slice(0, 7).every((g) => g === 0) && r[7] === 1)) && r.slice(0, 4).every((g, i) => g === s[i])
  return false
}

const kindOrder = (n) => ({ ethernet: 0, wifi: 1, mesh: 2, virtual: 3 }[n.type] ?? 4)
/** The tie-break inside a tier: the default route, wired before wireless, the faster link, the one with an address. */
function tie(a, b) {
  return Number(!!b.is_default_route) - Number(!!a.is_default_route) || kindOrder(a) - kindOrder(b) || num(b.link_speed_mbps) - num(a.link_speed_mbps) || Number(usable(b)) - Number(usable(a)) || String(a.name).localeCompare(String(b.name))
}

/**
 * The adapter without a choice of the person: { nic, reason } with reason one of bound, stream, default, physical, virtual; nic is null when no adapter is live.
 * @param ctx { bind: the bind_address of the host configuration, client: the client_address of the running session (or '') }
 */
export function autoNic(nics, ctx = {}) {
  const live = (Array.isArray(nics) ? nics : []).filter((n) => n && isLive(n))
  if (!live.length) return { nic: null, reason: '' }
  const bound = boundAddress(ctx.bind)
  if (bound) {
    const hit = live.filter((n) => addressesOf(n).includes(bound)).sort(tie)[0]
    if (hit) return { nic: hit, reason: 'bound' }
  }
  const client = lower(ctx.client).replace(/^\[|\]$/g, '')
  if (client) {
    const hit = live.filter((n) => usable(n) && addressesOf(n).some((a) => !linkLocal(a) && sameNetwork(a, client))).sort((a, b) => Number(isVirtualNic(a)) - Number(isVirtualNic(b)) || tie(a, b))[0]
    if (hit) return { nic: hit, reason: 'stream' }
  }
  const physical = live.filter((n) => !isVirtualNic(n) && usable(n) && (n.type === 'ethernet' || n.type === 'wifi'))
  const onRoute = physical.filter((n) => n.is_default_route).sort(tie)[0]
  if (onRoute) return { nic: onRoute, reason: 'default' }
  const other = [...physical].sort(tie)[0]
  if (other) return { nic: other, reason: 'physical' }
  return { nic: [...live].sort((a, b) => Number(usable(b)) - Number(usable(a)) || tie(a, b))[0], reason: 'virtual' }
}

/**
 * The adapter the tile shows: the one the person chose (by name) while it is still there, else the automatic one.
 * @returns { nic, reason: 'manual' | bound | stream | default | physical | virtual | '', auto: the automatic result, missing: the chosen name when that adapter is gone }
 */
export function resolveNic(nics, choice, ctx = {}) {
  const auto = autoNic(nics, ctx)
  const name = String(choice || '')
  if (!name) return { ...auto, auto, missing: '' }
  const chosen = (Array.isArray(nics) ? nics : []).find((n) => n && n.name === name)
  if (chosen) return { nic: chosen, reason: 'manual', auto, missing: '' }
  return { ...auto, auto, missing: name }
}

/** Every adapter in the order the list shows: the live ones first by the same ranking as the automatic choice, then the ones that are down. */
export function orderedNics(nics, ctx = {}) {
  const list = (Array.isArray(nics) ? nics : []).filter(Boolean)
  const first = autoNic(list, ctx).nic
  const rank = (n) => (n === first ? 0 : isLive(n) ? (isVirtualNic(n) ? 2 : 1) : 3)
  return [...list].sort((a, b) => rank(a) - rank(b) || tie(a, b))
}

// The choice of the person, kept per host in this interface's local storage: { [host name]: adapter name }. No choice (or "Auto") is no entry.
const KEY = 'foundation-ui.net-tile.adapter'
const MAX_HOSTS = 24
const readStore = (storage) => {
  try {
    const v = JSON.parse(storage?.getItem(KEY) || 'null')
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    return Object.fromEntries(Object.entries(v).filter(([h, n]) => typeof h === 'string' && typeof n === 'string' && n).slice(-MAX_HOSTS))
  } catch { return {} }
}
const defaultStorage = () => { try { return globalThis.localStorage } catch { return null } }
/** { [host key]: adapter name }; reactive, so a tile that reads it redraws when the choice changes. */
export const nicChoices = ref(readStore(defaultStorage()))
/** The adapter the person chose on this host, or '' (Auto). */
export const nicChoiceOf = (hostKey) => nicChoices.value[String(hostKey || '')] || ''
/** Remember the choice ('' or null: back to Auto) for the host. */
export function setNicChoice(hostKey, name, storage = defaultStorage()) {
  const key = String(hostKey || '')
  const next = { ...nicChoices.value }
  delete next[key]
  if (name) next[key] = String(name).slice(0, 200)
  const kept = Object.fromEntries(Object.entries(next).slice(-MAX_HOSTS))
  nicChoices.value = kept
  try { if (Object.keys(kept).length) storage?.setItem(KEY, JSON.stringify(kept)); else storage?.removeItem(KEY) } catch { /* storage unavailable: the choice holds for this session */ }
}
