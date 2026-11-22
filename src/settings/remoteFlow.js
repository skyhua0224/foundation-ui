// The remote access flow as pure logic (no DOM, no Vue): detecting that the host really restarted, what UPnP did, what an address test proves, and why a check could not run.
// The host's words stay the host's: nothing here says "reachable" where the host did not say it.
import { parseReason } from './reachability.js'

const str = (v) => (v === undefined || v === null ? '' : String(v).trim())

export const RESTART_TIMEOUT_MS = 90000
export const RESTART_INTERVAL_MS = 1500

/**
 * Wait for the host to restart, and prove it. `probe()` reads something cheap from the host and answers { ok, startedAt? } (it may throw: the host is away). `before` is the start time
 * of the process that was running when the restart was asked for ('' when the host does not report one).
 *   back:    a probe answers with another start time than `before` (proof: 'start-time'), or answers again after one probe failed (proof: 'went-away')
 *   timeout: no proof in time; `reason` is 'not-back' (it went away and did not come back), 'same-process' (it answered all the time with the same start time) or 'never-left'
 * A failed probe followed by an answer with the same start time is a network blip, not a restart.
 */
export async function watchRestart({ probe, before = '', sleep, now = Date.now, timeoutMs = RESTART_TIMEOUT_MS, intervalMs = RESTART_INTERVAL_MS, onPhase = () => {}, cancelled = () => false }) {
  const t0 = now()
  let sawDown = false
  let sameProcess = false
  const first = str(before)
  while (now() - t0 < timeoutMs) {
    await sleep(intervalMs)
    if (cancelled()) return { phase: 'cancelled', sawDown, waitedMs: now() - t0 }
    let r
    try { r = await probe() } catch { r = { ok: false } }
    if (!r || !r.ok) {
      if (!sawDown) { sawDown = true; onPhase('away') }
      continue
    }
    const startedAt = str(r.startedAt)
    if (first && startedAt) {
      if (startedAt !== first) return { phase: 'back', proof: 'start-time', sawDown, startedAt, waitedMs: now() - t0 }
      sameProcess = true
      continue
    }
    if (sawDown) return { phase: 'back', proof: 'went-away', sawDown, startedAt, waitedMs: now() - t0 }
  }
  return { phase: 'timeout', reason: sameProcess ? 'same-process' : sawDown ? 'not-back' : 'never-left', sawDown, waitedMs: now() - t0 }
}

/** The mappings of the router out of the report: `{ proto, port, present, internal }`, in the report's order. */
export function mappingsOf(report) {
  return (report?.public?.router?.mappings || [])
    .filter((m) => m && typeof m === 'object' && Number.isInteger(Number(m.port)))
    .map((m) => ({ proto: str(m.proto).toLowerCase(), port: Number(m.port), present: m.present === true, internal: str(m.internal) }))
}

/**
 * What UPnP did, from the host's report of the router:
 *   mapped      every port that is needed has a mapping
 *   partial     some have, some have not
 *   none        the router answered UPnP but holds no mapping for the ports
 *   no-answer   the router did not answer UPnP (off, or not supported): the person forwards the ports by hand
 *   unknown     no report
 * `wan` is the router's outside address and `wanClass` what it is (public, private, cgnat): a mapping behind a private or shared address cannot be reached from the internet.
 */
export function upnpOutcome(report) {
  const pub = report?.public
  if (!pub) return { kind: 'unknown', mapped: [], missing: [], wan: '', wanClass: 'unknown', protocol: 'none' }
  const router = pub.router
  const codes = (pub.reasons || []).map((r) => parseReason(r).code)
  const roles = new Map((report.ports || []).map((p) => [`${p.proto}/${p.port}`, p.role]))
  const all = mappingsOf(report).filter((m) => roles.get(`${m.proto}/${m.port}`) !== 'web')
  const mapped = all.filter((m) => m.present)
  const missing = all.filter((m) => !m.present)
  const base = { mapped, missing, wan: router.wanIp, wanClass: router.wanClass, protocol: router.protocol }
  if (router.protocol === 'none' || codes.includes('no_igd')) return { ...base, kind: 'no-answer', mapped: [], missing: [] }
  if (!all.length) return { ...base, kind: 'unknown' }
  if (!missing.length) return { ...base, kind: 'mapped' }
  return { ...base, kind: mapped.length ? 'partial' : 'none' }
}

/** `47998-48000` for a run of ports of the same protocol, else the port. */
export function portRun(ports) {
  const sorted = [...new Set(ports)].sort((a, b) => a - b)
  const out = []
  for (let i = 0; i < sorted.length;) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++
    out.push(j - i >= 2 ? `${sorted[i]}-${sorted[j]}` : sorted.slice(i, j + 1).join(', '))
    i = j + 1
  }
  return out.join(', ')
}

/** The endpoint result for what was typed (the host canonicalises: case, default port); null when the host has none for it. */
export function endpointFor(report, text) {
  const wanted = str(text).toLowerCase()
  if (!wanted) return null
  const hostOf = (e) => e.input.toLowerCase()
  const list = report?.public?.endpoints || []
  return list.find((e) => hostOf(e) === wanted) || list.find((e) => e.host.toLowerCase() === wanted && !e.portExplicit) || null
}

/**
 * What an address test shows, and what it proves. The host tests with a TLS handshake from this computer to the address on the HTTPS port: it proves that this port reaches this
 * host's own certificate through that address. It cannot test UDP, and it cannot tell a port forward from the router's loop-back (hairpin NAT): many routers do not loop a connection
 * from inside the network back in, so a failure from inside does not prove the internet cannot connect.
 *   kind: 'reached' (public address, proves the forward) | 'reached-inside' (answered through a LAN or this computer's own address: proves nothing about the internet) |
 *         'failed' (with `error`) | 'unresolved' (the name does not resolve) | 'other-device' (a certificate that is not this host's) | 'not-run'
 */
export function testOutcome(endpoint) {
  if (!endpoint) return { kind: 'not-run', error: '', hairpinLimit: false }
  if (endpoint.reached) {
    return { kind: endpoint.scope === 'public' ? 'reached' : 'reached-inside', error: '', hairpinLimit: false, scope: endpoint.scope, port: endpoint.tested?.port || endpoint.httpsPort, latencyMs: endpoint.tested?.latencyMs ?? 0, address: endpoint.tested?.address || '' }
  }
  const error = endpoint.error || 'failed'
  if (error === 'dns_failed') return { kind: 'unresolved', error, hairpinLimit: false }
  if (error === 'identity_mismatch') return { kind: 'other-device', error, hairpinLimit: false, port: endpoint.httpsPort }
  if (error === 'not_tried') return { kind: 'not-run', error, hairpinLimit: false }
  // refused, timeout, unreachable, tls_failed, failed: from inside, these can also be the router that does not loop back
  return { kind: 'failed', error, hairpinLimit: endpoint.scope === 'public' && (error === 'timeout' || error === 'unreachable' || error === 'refused'), port: endpoint.tested?.port || endpoint.httpsPort }
}

/**
 * The ports as the host sees them, one row each, for the result table: the port as it is on this computer, whether it listens, whether the router forwards it (null when the router said nothing),
 * the firewall, and, on the HTTPS port only, the result of the address test. A UDP port has no test: the host cannot send a UDP probe through your own router and read the answer.
 */
export function portResults(report, outcome) {
  const maps = mappingsOf(report)
  const test = outcome && outcome.kind !== 'not-run' ? outcome : null
  const order = ['https', 'http', 'rtsp', 'video', 'control', 'audio', 'microphone', 'web']
  return [...(report?.ports || [])].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role)).map((p) => {
    const map = maps.find((m) => m.proto === p.proto && m.port === p.port)
    const testable = p.proto === 'tcp' && p.role === 'https'
    return {
      key: `${p.proto}/${p.port}`, role: p.role, proto: p.proto, port: p.port, needed: p.role !== 'web',
      listening: p.listening, onDemand: p.onDemand, firewall: p.firewall,
      mapped: map ? map.present : null,
      test: testable ? test : null, testable,
    }
  })
}

/**
 * Why a check could not run, from the status of useReachability: an older host (no such route: 404, or 444 where the host closes the connection) is not a failed run.
 *   { kind: 'old-host' | 'failed-run' | 'ok', http, reason }; `reason` is 'auth' | 'server' | 'offline' | 'timeout' | 'bad-answer' | 'other' for a failed run.
 */
export function failureOf(view) {
  if (!view) return { kind: 'ok', http: 0, reason: '' }
  if (view.status === 'unavailable') return { kind: 'old-host', http: view.http || 0, reason: '' }
  if (view.status !== 'error') return { kind: 'ok', http: 0, reason: '' }
  const http = Number(view.http) || 0
  // an answer that is not a check result is 'bad-answer' even when its HTTP status was 200; the refusals (401, 403) and the host's own failures (5xx) keep their kind
  const reason = http === 401 || http === 403 ? 'auth' : http >= 500 ? 'server' : view.cause === 'bad-answer' ? 'bad-answer' : http ? 'other' : view.cause === 'timeout' ? 'timeout' : 'offline'
  return { kind: 'failed-run', http, reason }
}
