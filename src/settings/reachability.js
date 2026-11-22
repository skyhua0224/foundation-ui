// The reachability report of the host (GET /api/network/reachability, JSON v1) as the screens show it: one verdict per path (the public internet, a mesh network), the
// evidence behind it, each reason as a plain sentence with the action that fixes it, the address a client should enter, the public endpoints with the result of each, and the port table. Pure: no DOM, no Vue.
//
// Nothing here decides a verdict: it is the host's. "verified" is shown only where the host says "verified"; a missing, malformed or older answer is `null`, and the screens say
// the check is not available on this host instead of guessing.
import { reachTexts } from './reachTexts.js'

export const REACH_VERSION = 1
export const PUBLIC_VERDICTS = Object.freeze(['verified', 'likely', 'unknown', 'unreachable'])
export const MESH_VERDICTS = Object.freeze(['verified', 'likely', 'unknown', 'none'])

/** How a verdict looks: the status tone (ok | info | neutral | error, as MBanner/MChip tones) and the icon. */
export const VERDICT_LOOK = Object.freeze({
  verified: { tone: 'ok', icon: 'check_circle' },
  likely: { tone: 'info', icon: 'info' },
  unknown: { tone: 'neutral', icon: 'help' },
  unreachable: { tone: 'error', icon: 'error' },
  none: { tone: 'neutral', icon: 'help' },
})

/**
 * What each reason code is fixed with: `upnp` (turn UPnP on), `forward` (forward the ports by hand), `firewall` (add a firewall rule), `restart` (restart the host),
 * `origin` (change who may open the Web UI), `mesh` (use a mesh network instead), `outside` (test from outside by hand). A code the UI does not know has no action.
 */
export const REASON_FIX = Object.freeze({
  cgnat: 'mesh', private_wan: 'mesh', no_wan_ip: 'forward', no_igd: 'forward', mapping_missing: 'upnp', firewall_blocked: 'firewall', not_listening: 'restart', not_listening_on_mesh: 'restart',
  hairpin_unsupported: 'outside', loopback_unverifiable: 'outside', not_reached_from_outside: 'forward', origin_blocks_mesh: 'origin', mesh_adapter_down: 'mesh', no_mesh_adapter: 'mesh',
  address_mismatch: 'use-wan', address_private: 'address', dns_failed: 'address', unset: 'address',
})

/** What a reason is: a problem (a warning with its fix), good news the host reports (a tick), or a note (neutral: what was not possible to know). */
export const REASON_KIND = Object.freeze({
  session_evidence: 'good', hairpin_verified: 'good', host_public_ip: 'good', mappings_complete: 'good', mesh_adapter_up: 'good',
  hairpin_not_tried: 'note', firewall_unknown: 'note', unset: 'note', loopback_unverifiable: 'note', udp_unverified: 'note', udp_unverified_forwarded: 'note', outside_unavailable: 'note', outside_router_proxy: 'note', outside_budget: 'note', outside_verified: 'good',
})

/** `mapping_missing:udp/47998` -> { code: 'mapping_missing', arg: 'udp/47998', proto: 'udp', port: 47998 }. */
export function parseReason(value) {
  const text = String(value ?? '').trim()
  const at = text.indexOf(':')
  const code = at < 0 ? text : text.slice(0, at)
  const arg = at < 0 ? '' : text.slice(at + 1)
  const m = /^(tcp|udp)\/(\d+)$/i.exec(arg)
  return { code, arg, proto: m ? m[1].toLowerCase() : '', port: m ? Number(m[2]) : 0 }
}

const str = (v) => (v === undefined || v === null ? '' : String(v).trim())
const list = (v) => (Array.isArray(v) ? v : [])
const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback)

/** The public address set in the configuration (`external_ip`) as the host checked it: an IP or a host name, what it resolved to, whether it is the router's WAN address. null when the host sends none. */
function configuredOf(raw) {
  if (!raw || typeof raw !== 'object') return null
  const kind = pick(str(raw.kind), ['ip', 'hostname', 'empty'], str(raw.value) ? 'hostname' : 'empty')
  return { value: str(raw.value), kind, resolved: list(raw.resolved).map(str).filter(Boolean), matchesWan: raw.matches_wan === true ? true : raw.matches_wan === false ? false : null, reasons: list(raw.reasons).map(str).filter(Boolean) }
}

export const OUTSIDE_STATES = Object.freeze(['reachable', 'another_host', 'closed', 'timeout', 'unknown', 'unavailable'])
export const ENDPOINT_SCOPES = Object.freeze(['public', 'lan', 'mesh', 'loopback', 'unknown'])
export const ENDPOINT_ERRORS = Object.freeze(['dns_failed', 'refused', 'timeout', 'unreachable', 'tls_failed', 'identity_mismatch', 'not_tried', 'failed'])

/** One public endpoint of the configuration as the host checked it (public.endpoints[]). `tested` is the attempt that decided the state; null when none was made. */
function endpointOf(raw) {
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  const tested = raw.tested && typeof raw.tested === 'object' ? { address: str(raw.tested.address), port: num(raw.tested.port), latencyMs: num(raw.tested.latency_ms) } : null
  const error = str(raw.error)
  return {
    input: str(raw.input), host: str(raw.host), kind: pick(str(raw.kind), ['ip', 'hostname'], 'hostname'), port: num(raw.port), portExplicit: raw.port_explicit === true, httpsPort: num(raw.https_port),
    resolved: list(raw.resolved).map(str).filter(Boolean), scope: pick(str(raw.scope), ENDPOINT_SCOPES, 'unknown'), matchesWan: raw.matches_wan === true,
    reached: str(raw.state) === 'reached', inconclusive: raw.inconclusive === true, outside: raw.outside && typeof raw.outside === 'object' ? { state: pick(str(raw.outside.state), OUTSIDE_STATES, 'unavailable'), reason: str(raw.outside.reason), caller: str(raw.outside.caller) } : null, error: ENDPOINT_ERRORS.includes(error) ? error : error ? 'failed' : '', tested,
    attempts: list(raw.attempts).filter((a) => a && typeof a === 'object').map((a) => ({ address: str(a.address), port: num(a.port), connected: a.connected === true, identityMatch: a.identity_match === true, error: str(a.error), latencyMs: num(a.latency_ms) })),
    reasons: list(raw.reasons).map(str).filter(Boolean),
  }
}

/**
 * What the report cannot say, as notes: a public address this computer cannot reach itself (the host marks it `inconclusive`), and UDP, which nothing proves from this computer: only a session from the
 * internet or an outside test does. Neither is a failure, so neither is red.
 */
function publicNotes(pub) {
  const notes = []
  const outsideOk = pub.endpoints.some((e) => e.outside?.state === 'reachable')
  if (pub.endpoints.some((e) => e.inconclusive && !e.reached && e.outside?.state !== 'reachable')) notes.push('loopback_unverifiable')
  // the outside check was on and its service did not answer: the screen says what the result rests on
  // A proxy on the router (the service saw its exit) and a service that is out of budget for the day have a sentence of their own, because the person can do something about the first and only wait for the second.
  const unavailable = pub.endpoints.filter((e) => e.outside?.state === 'unavailable')
  // each kind of reason has its sentence, and a mix of endpoints with different reasons gets each of them; the general one is for a reason that has none of its own
  if (unavailable.some((e) => e.outside.reason === 'router_proxy') && !pub.reasons.includes('outside_router_proxy')) notes.push('outside_router_proxy')
  if (unavailable.some((e) => e.outside.reason === 'budget')) notes.push('outside_budget')
  if (unavailable.some((e) => e.outside.reason !== 'router_proxy' && e.outside.reason !== 'budget')) notes.push('outside_unavailable')
  if (pub.verdict !== 'unreachable' && !pub.evidence.length && !pub.reasons.includes('session_evidence')) notes.push(outsideOk && pub.reasons.includes('mappings_complete') ? 'udp_unverified_forwarded' : 'udp_unverified')
  return notes
}

/** The report from the host's answer, or null when it is not a v1 report (an older host answers 404, a bad answer has no verdicts). */
export function normalizeReport(raw) {
  if (!raw || typeof raw !== 'object' || Number(raw.version) !== REACH_VERSION) return null
  if (!raw.public && !raw.mesh) return null
  const pub = raw.public || {}
  const mesh = raw.mesh || {}
  const evidence = (items) => list(items).filter((e) => e && typeof e === 'object').map((e) => ({ kind: str(e.kind), address: str(e.address), at: str(e.at) }))
  return {
    checkedAt: str(raw.checked_at),
    ports: list(raw.ports).filter((p) => p && Number.isInteger(Number(p.port))).map((p) => ({
      proto: str(p.proto).toLowerCase(), port: Number(p.port), role: str(p.role), listening: p.listening === true ? true : p.listening === false ? false : null, onDemand: p.on_demand === true, firewall: pick(str(p.firewall), ['allowed', 'blocked', 'unknown'], 'unknown'),
    })),
    public: {
      verdict: pick(pub.verdict, PUBLIC_VERDICTS, 'unknown'),
      reasons: list(pub.reasons).map(str).filter(Boolean),
      hostPublicIp: str(pub.host_public_ip),
      router: { protocol: str(pub.router?.protocol) || 'none', wanIp: str(pub.router?.wan_ip), wanClass: pick(str(pub.router?.wan_ip_class), ['public', 'private', 'cgnat', 'unknown'], 'unknown'), mappings: list(pub.router?.mappings) },
      hairpin: pub.hairpin && typeof pub.hairpin === 'object' ? { tried: pub.hairpin.tried === true, ok: pub.hairpin.ok === true, identityMatch: pub.hairpin.identity_match === true } : { tried: false, ok: false, identityMatch: false },
      evidence: evidence(pub.evidence),
      configured: configuredOf(pub.configured_address),
      endpoints: list(pub.endpoints).filter((e) => e && typeof e === 'object' && str(e.input)).map(endpointOf),
    },
    mesh: {
      verdict: pick(mesh.verdict, MESH_VERDICTS, 'unknown'),
      reasons: list(mesh.reasons).map(str).filter(Boolean),
      adapters: list(mesh.adapters).filter((a) => a && typeof a === 'object').map((a) => ({ kind: str(a.kind) || 'other', name: str(a.name), addresses: list(a.addresses).map(str).filter(Boolean), up: a.up === true })),
      listeningOnMesh: mesh.listening_on_mesh === true,
      originAllowsMesh: mesh.web_ui_origin_allows_mesh !== false,
      evidence: evidence(mesh.evidence),
    },
  }
}

/**
 * The address a client should enter for the public path, as `host` or `host:port` (the HTTP port, never a stream port): the first endpoint the host reached through its own certificate, else the first
 * public endpoint that has no known fault; with none configured, the router's WAN address when it is public, else an interface of this computer that holds a public address; '' when there is none.
 */
export function publicAddress(report) {
  const p = report?.public
  if (!p) return ''
  const endpoints = p.endpoints || []
  if (endpoints.length) {
    const reached = endpoints.find((e) => e.reached && e.scope === 'public')
    if (reached) return reached.input
    const usable = endpoints.find((e) => e.scope === 'public' && e.error !== 'dns_failed' && e.error !== 'identity_mismatch' && !e.reasons.includes('address_mismatch'))
    if (usable) return usable.input
  }
  // the address the person set is the one to enter when it checks out: set, not private, it resolves, and it is the router's WAN address (or the host cannot say it is not)
  const c = p.configured
  if (!endpoints.length && c && c.value && c.kind !== 'empty') {
    const bad = [...c.reasons, ...p.reasons].some((r) => ['address_mismatch', 'address_private', 'dns_failed'].includes(parseReason(r).code))
    if (!bad && c.matchesWan !== false) return c.value
  }
  if (p.router.wanClass === 'public' && p.router.wanIp) return p.router.wanIp
  return p.hostPublicIp || ''
}

/** The address a client should enter for the mesh path: the first address of the first adapter that is up. */
export function meshAddress(report) {
  const adapter = report?.mesh?.adapters.find((a) => a.up && a.addresses.length)
  return adapter ? adapter.addresses[0] : ''
}

const pad = (n) => String(n).padStart(2, '0')
/** `2026-11-03 14:20` in the person's own time (the host sends an ISO time); '' when it does not parse. */
export function clockText(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const evidenceLine = (e, T, kindText) => {
  const when = clockText(e.at)
  return [kindText || e.kind, when, e.address].filter(Boolean).join(' · ')
}

/** `video UDP 57998`: a port named by what it is for, so a reason never offers a stream port as if it were the address. */
export function portLabel(proto, port, ports, T) {
  const entry = (ports || []).find((p) => p.proto === proto && p.port === port)
  const role = entry && T.roles[entry.role] ? T.roles[entry.role].name : ''
  return [role, `${String(proto).toUpperCase()} ${port}`].filter(Boolean).join(' ')
}

function reasonRow(value, T, ports) {
  const r = parseReason(value)
  const text = T.reasons[r.code]
  const where = r.port ? portLabel(r.proto, r.port, ports, T) : ''
  const sentence = text ? text.replace('{proto} {port}', where || `${r.proto.toUpperCase()} ${r.port || ''}`.trim()).replace('{proto}', r.proto.toUpperCase()).replace('{port}', String(r.port || '')).replace('{arg}', r.arg) : `${T.unknownReason} (${value})`
  const action = REASON_FIX[r.code] || ''
  return { code: value, text: sentence, kind: REASON_KIND[r.code] || 'problem', action, actionLabel: action ? T.actions[action] : '', port: r.port, proto: r.proto }
}

/** One endpoint as a row: the state word (the failure when it failed), the port that was tested and the time it took, the scope and the addresses it resolved to. Numbers and states only. */
export function endpointRow(e, T) {
  const reachedAt = e.tested
  // A public address this computer cannot reach itself says nothing about the internet (a router without NAT loopback): neutral, never red.
  // A connection from the internet (the outside check) outranks what this computer could see of its own address: it reached this host, or it did not.
  const out = e.outside?.state || ''
  const outsideOk = out === 'reachable'
  const outsideBad = out === 'closed' || out === 'timeout' || out === 'another_host'
  const tone = outsideOk ? 'ok' : outsideBad ? 'error' : e.reached ? 'ok' : e.inconclusive || e.error === 'dns_failed' || e.error === 'not_tried' ? 'neutral' : 'error'
  return {
    input: e.input, tone, icon: tone === 'ok' ? 'check_circle' : tone === 'neutral' ? 'help' : 'error', reached: outsideOk || (e.reached && !outsideBad), inconclusive: e.inconclusive,
    word: outsideOk ? T.endpoint.outsideReached : outsideBad ? T.endpoint.outsideErrors[out] : e.reached ? T.endpoint.reached : e.inconclusive ? T.endpoint.loopback : T.endpoint.errors[e.error] || T.endpoint.errors.failed,
    port: reachedAt ? reachedAt.port : e.httpsPort, portText: e.httpsPort && e.attempts.length ? T.endpoint.https.replace('{port}', String(reachedAt ? reachedAt.port : e.httpsPort)) : '',
    latencyText: reachedAt && reachedAt.latencyMs >= 0 && e.attempts.length ? `${reachedAt.latencyMs} ms` : '',
    scope: e.scope, scopeWord: T.endpoint.scopes[e.scope] || '', resolved: e.resolved, address: reachedAt ? reachedAt.address : '',
    mismatch: e.reasons.includes('address_mismatch'),
  }
}

/** The ports table by role: the ports as configured on this computer (internal), in the order a person meets them. Never offers a stream port as the address for clients. */
export function portRows(ports, T) {
  const order = ['http', 'https', 'web', 'rtsp', 'video', 'control', 'audio', 'microphone']
  return [...(ports || [])].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role)).map((p) => {
    const role = T.roles[p.role] || { name: p.role, note: '' }
    const state = p.listening === true ? 'listening' : p.onDemand ? 'on-session' : p.listening === false ? 'closed' : 'unknown'
    return { role: p.role, name: role.name, note: role.note, proto: p.proto.toUpperCase(), port: p.port, state, stateWord: T.portState[state], firewall: p.firewall, firewallWord: T.firewall[p.firewall] }
  })
}

/**
 * What a screen shows: { checkedAt, paths: [{ id, title, verdict, word, tone, icon, headline, evidence: [text], reasons: [{ code, text, action, actionLabel }], address, addressLabel,
 * adapters? }], ports } for a normalized report; null for none. `locale`: zh or anything else (English).
 */
export function reachView(report, locale = 'en') {
  if (!report) return null
  const T = reachTexts(locale)
  const pub = report.public
  const mesh = report.mesh
  const pubEvidence = pub.evidence.map((e) => evidenceLine(e, T, T.evidence[e.kind]))
  // the host's own test through the WAN address counts as evidence only when it says so (identity of our certificate matched)
  if (pub.hairpin.tried && pub.hairpin.ok && pub.hairpin.identityMatch) pubEvidence.push(T.evidence.hairpin)
  const meshEvidence = mesh.evidence.map((e) => evidenceLine(e, T, T.evidence[e.kind]))
  const paths = [
    {
      id: 'public', title: T.paths.public, verdict: pub.verdict, word: T.verdicts[pub.verdict], ...VERDICT_LOOK[pub.verdict], headline: T.headline.public[pub.verdict],
      evidence: pubEvidence, reasons: [...new Set([...pub.reasons, ...(pub.endpoints.length ? [] : pub.configured?.reasons || []), ...publicNotes(pub)])].map((r) => reasonRow(r, T, report.ports)), address: publicAddress(report), addressLabel: T.addressPublic,
      endpoints: pub.endpoints.map((e) => endpointRow(e, T)),
      configured: pub.configured ? { value: pub.configured.value, kind: pub.configured.kind, resolved: pub.configured.resolved, matchesWan: pub.configured.matchesWan, kindWord: T.addressKinds[pub.configured.kind] || '' } : null,
    },
    {
      id: 'mesh', title: T.paths.mesh, verdict: mesh.verdict, word: T.verdicts[mesh.verdict], ...VERDICT_LOOK[mesh.verdict], headline: T.headline.mesh[mesh.verdict],
      evidence: meshEvidence, reasons: [...mesh.reasons.map((r) => reasonRow(r, T, report.ports)), ...(mesh.originAllowsMesh || mesh.adapters.length === 0 || mesh.reasons.includes('origin_blocks_mesh') ? [] : [reasonRow('origin_blocks_mesh', T, report.ports)])],
      address: meshAddress(report), addressLabel: T.addressMesh, adapters: mesh.adapters.map((a) => ({ name: [T.meshKinds[a.kind] || a.kind, a.name].filter(Boolean).join(' · '), up: a.up, address: a.addresses[0] || '' })),
    },
  ]
  return { checkedAt: clockText(report.checkedAt), paths, ports: report.ports, portRows: portRows(report.ports, T) }
}

/** One line for a small tile or a header: the verdict of each path, e.g. `公网 已验证 · 组网 没有组网`. */
export function reachSummary(report, locale = 'en') {
  const view = reachView(report, locale)
  return view ? view.paths.map((p) => `${p.title} ${p.word}`).join(' · ') : ''
}

/** The Windows or Linux command that opens the ports the report says the firewall blocks (copied by the person, run with administrator rights). */
export function firewallCommand(report, platform = 'windows') {
  const blocked = (report?.ports || []).filter((p) => p.firewall === 'blocked')
  const ports = (proto) => [...new Set(blocked.filter((p) => p.proto === proto).map((p) => p.port))].sort((a, b) => a - b)
  const tcp = ports('tcp')
  const udp = ports('udp')
  if (!tcp.length && !udp.length) return ''
  const win = (proto, list) => (list.length ? [`netsh advfirewall firewall add rule name="Foundation Sunshine ${proto.toUpperCase()}" dir=in action=allow protocol=${proto.toUpperCase()} localport=${list.join(',')}`] : [])
  if (platform === 'windows') return [...win('tcp', tcp), ...win('udp', udp)].join('\n')
  const ufw = (proto, list) => (list.length ? [`sudo ufw allow ${list.join(',')}/${proto}`] : [])
  return [...ufw('tcp', tcp), ...ufw('udp', udp)].join('\n')
}

export const MAX_ENDPOINTS = 8
const HTTPS_OFFSET = 5

/**
 * One public endpoint as a person types it, the way a host is added in Moonlight: `host`, `host:port`, `a.b.c.d[:port]`, `[v6]:port` or a bare IPv6 address. The port is optional (the base port).
 * The rules are the host's (public_address::parse_endpoint). -> { ok, host, port (0 = not given), kind: 'ip' | 'hostname' | '', error: '' | 'empty' | 'scheme' | 'format' | 'host' | 'port', warn: '' | 'private', text: canonical }
 */
export function validateEndpoint(input) {
  const value = String(input ?? '').trim()
  const fail = (error) => ({ ok: false, host: '', port: 0, kind: '', error, warn: '', text: '' })
  if (!value) return fail('empty')
  if (value.includes('://')) return fail('scheme')
  if (/[/?#@\s]/.test(value)) return fail('format')
  let hostPart = value
  let portPart = null
  if (value.startsWith('[')) {
    const close = value.indexOf(']')
    if (close < 0) return fail('format')
    hostPart = value.slice(1, close)
    const rest = value.slice(close + 1)
    if (rest) { if (!rest.startsWith(':')) return fail('format'); portPart = rest.slice(1) }
    if (!isIpv6(hostPart)) return fail('host')
  } else {
    const colons = (value.match(/:/g) || []).length
    if (colons === 1) { [hostPart, portPart] = value.split(':') } else if (colons >= 2 && !isIpv6(value)) return fail('host')
  }
  let port = 0
  if (portPart !== null) {
    if (!/^\d{1,5}$/.test(portPart)) return fail('port')
    port = Number(portPart)
    if (port <= HTTPS_OFFSET || port > 65535) return fail('port')
  }
  const bare = hostPart.replace(/\.$/, '')
  const v6 = isIpv6(bare)
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(bare)
  let kind = 'hostname'
  let warn = ''
  if (v4) {
    const o = v4.slice(1).map(Number)
    if (o.some((n) => n > 255) || /\.$/.test(hostPart)) return fail('host')
    kind = 'ip'
    const [a, b] = o
    // 0.0.0.0 (and the rest of 0.0.0.0/8) is what a socket binds to and what a router answers when it has no address: nothing a client can connect to
    if (a === 0) return fail('unspecified')
    // LAN, loopback and link-local addresses are fine to keep (the host reports them) but cannot serve the internet; the mesh range (100.64/10) is a legitimate endpoint
    if (a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) warn = 'private'
  } else if (v6) {
    if (/^[0:]+$/.test(bare)) return fail('unspecified')
    kind = 'ip'
    if (/^(fe80|fc|fd|::1$)/i.test(bare) && !/^fd7a:115c:a1e0/i.test(bare)) warn = 'private'
  } else {
    const labels = bare.split('.')
    const good = bare.length > 0 && bare.length <= 253 && labels.every((l) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(l)) && !/^\d+$/.test(labels[labels.length - 1])
    if (!good) return fail('host')
  }
  const host = v6 ? bare.toLowerCase() : kind === 'hostname' ? bare.toLowerCase() : bare
  const text = `${v6 ? `[${host}]` : host}${port ? `:${port}` : ''}`
  return { ok: true, host, port, kind, error: '', warn, text }
}

function isIpv6(text) {
  if (!text.includes(':') || /[^0-9a-f:.]/i.test(text) || text.includes(':::')) return false
  const groups = text.split('::')
  if (groups.length > 2) return false
  const parts = (g) => (g ? g.split(':') : [])
  const [head, tail] = [parts(groups[0]), groups.length === 2 ? parts(groups[1]) : []]
  const all = [...head, ...tail]
  const lastV4 = all.length && all[all.length - 1].includes('.')
  const count = all.length + (lastV4 ? 1 : 0)
  if (all.some((g, i) => (lastV4 && i === all.length - 1 ? !/^(\d{1,3})(\.\d{1,3}){3}$/.test(g) : !/^[0-9a-f]{1,4}$/i.test(g)))) return false
  return groups.length === 2 ? count <= 7 : count === 8
}

/** The endpoints in a configuration value (`a.example.net:60000, [2001:db8::1]:57989`): the valid ones in canonical form, de-duplicated, at most MAX_ENDPOINTS. Separators: comma, semicolon, space, new line. */
function endpointTokens(raw) {
  const split = (value) => {
    const out = []
    let depth = 0
    let current = ''
    for (const ch of value) {
      if (ch === '[') depth += 1
      if (ch === ']' && depth > 0) depth -= 1
      if (depth === 0 && /[,;\s]/.test(ch)) { if (current) out.push(current); current = ''; continue }
      current += ch
    }
    if (current) out.push(current)
    return out
  }
  const tokens = split(raw)
  if (tokens.some((t) => !validateEndpoint(t).ok) && raw.startsWith('[') && raw.endsWith(']')) {
    const inner = split(raw.slice(1, -1))
    if (inner.every((t) => validateEndpoint(t).ok)) return inner
  }
  return tokens
}

export function parseEndpoints(text) {
  const raw = String(text ?? '').trim()
  const tokens = endpointTokens(raw)
  const seen = new Set()
  const out = []
  for (const token of tokens) {
    const v = validateEndpoint(token)
    if (!v.ok || seen.has(v.text) || out.length >= MAX_ENDPOINTS) continue
    seen.add(v.text); out.push(v.text)
  }
  return out
}

/** The endpoints in force from a configuration: `external_endpoints`, or the single legacy `external_ip` when the list is empty. */
export function endpointsOfConfig(config) {
  const list = parseEndpoints(config?.external_endpoints)
  return list.length ? list : parseEndpoints(config?.external_ip)
}

/**
 * What a configuration holds that is not an address: the entries of `external_endpoints` (or the legacy `external_ip`) that no client could use, each with the reason
 * (`unspecified`: 0.0.0.0 or ::, `host`, `port`, `format`, `scheme`). [] when every entry is valid or none is set. A tile must not draw such an entry as the address.
 */
export function rejectedEndpointsOfConfig(config) {
  const text = String(config?.external_endpoints ?? '').trim() ? config.external_endpoints : config?.external_ip
  return endpointTokens(String(text ?? '').trim()).map((t) => ({ text: t, error: validateEndpoint(t).error })).filter((r) => r.error)
}

/** The value to store for a list of rows: canonical, de-duplicated, empty rows dropped. '' for none. */
export function serializeEndpoints(rows) {
  return parseEndpoints((rows || []).map((r) => String(r ?? '').trim()).filter(Boolean).join(', ')).join(', ')
}

const DEFAULT_HTTP_PORT = 47989
const isPrivateV4 = (a) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a)
const isMeshV4 = (a) => /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(a)
const isLocalOnly = (a) => /^(127\.|169\.254\.|::1$|fe80:)/i.test(a)

/**
 * The local network as a path beside the internet and the mesh, from GET /api/network/listeners (`info`) and the configuration: the address this computer listens on, the adapter it
 * belongs to, the port and whether LAN discovery (mDNS) is on. It says only what the host says: "listening" (the listener in use), never "verified". `error` is the text of a failed request.
 * -> { id: 'lan', title, verdict: listening | pending | unknown | loading, word, tone, icon, fact, address, addressLabel }
 */
export function lanView(info, config = {}, locale = 'en', error = '') {
  const T = reachTexts(locale)
  const L = T.lan
  const base = { id: 'lan', title: L.title, addressLabel: L.address, address: '' }
  if (error) return { ...base, verdict: 'unknown', word: L.verdicts.unknown, tone: 'neutral', icon: 'help', fact: L.failed }
  if (!info || !info.active) return { ...base, verdict: 'loading', word: L.verdicts.loading, tone: 'neutral', icon: 'more_horiz', fact: '' }
  const active = info.active
  const saved = info.saved
  const pending = !!saved && ['bind_address', 'address_family', 'port', 'upnp'].some((k) => String(active[k]) !== String(saved[k]))
  const addresses = list(info.addresses).filter((a) => a && str(a.address))
  const bind = str(active.bind_address)
  const chosen = bind ? addresses.find((a) => a.address === bind) || { name: '', address: bind }
    : addresses.find((a) => isPrivateV4(a.address)) || addresses.find((a) => !isMeshV4(a.address) && !isLocalOnly(a.address) && !a.address.includes(':')) || null
  const port = Number(active.port) || DEFAULT_HTTP_PORT
  const host = chosen ? (chosen.address.includes(':') ? `[${chosen.address}]` : chosen.address) : ''
  const address = host ? (port !== DEFAULT_HTTP_PORT || chosen.address.includes(':') ? `${host}:${port}` : host) : ''
  const mdns = String(config?.mdns_broadcast ?? 'enabled') !== 'disabled'
  const fact = pending ? L.pending : [chosen?.name || (bind ? '' : L.allAddresses), L.port.replace('{port}', String(port)), mdns ? L.mdnsOn : L.mdnsOff].filter(Boolean).join(' · ')
  return pending
    ? { ...base, verdict: 'pending', word: L.verdicts.pending, tone: 'info', icon: 'restart_alt', fact, address }
    : { ...base, verdict: 'listening', word: L.verdicts.listening, tone: 'ok', icon: 'check_circle', fact, address }
}

/**
 * The overview of the 网络 page: one line per path (public, mesh) with the one fact that matters, and under it each thing the host said exactly once. The first piece of evidence is the
 * line's fact (the time and the source of the last connection); with no evidence the verdict's sentence is. A reason that only repeats what is already shown is dropped: the own-certificate
 * test when it is evidence, a recent connection when one is listed, the mesh being up when its adapter is listed. -> [{ ...path, fact, notes: [{ kind: evidence | adapter | good | note | problem, text, action?, actionLabel?, code? }] }]
 */
export function reachOverview(report, locale = 'en') {
  const view = reachView(report, locale)
  if (!view) return []
  const T = reachTexts(locale)
  return view.paths.map((path) => {
    const evidence = [...path.evidence]
    const fact = evidence.length ? evidence.shift() : path.headline
    const shown = new Set()
    if (path.evidence.includes(T.evidence.hairpin)) shown.add('hairpin_verified')
    if (path.evidence.length) shown.add('session_evidence')
    const adapters = (path.adapters || []).map((a) => ({ kind: 'adapter', up: a.up, text: [a.name, a.up ? T.up : T.down, a.address].filter(Boolean).join(' · ') }))
    if (adapters.some((a) => a.up) || path.verdict === 'likely' || path.verdict === 'verified') shown.add('mesh_adapter_up')
    const reasons = path.reasons.filter((r) => !shown.has(parseReason(r.code).code))
    const order = { problem: 0, note: 1, good: 2 }
    const notes = [
      ...reasons.filter((r) => r.kind === 'problem').map((r) => ({ kind: 'problem', ...r })),
      ...evidence.map((text) => ({ kind: 'evidence', text })),
      ...adapters,
      ...reasons.filter((r) => r.kind !== 'problem').sort((a, b) => order[a.kind] - order[b.kind]).map((r) => ({ kind: r.kind, ...r })),
    ]
    return { ...path, fact, notes }
  })
}
