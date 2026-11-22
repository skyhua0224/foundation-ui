// The tiles that read the host's system information (GET /api/system/info) and its public address: 网卡, 系统, 公网地址. Nothing is invented: a tile is `null` while its source is not there.
// Sources are listed in docs/home-tiles.md.
import { endpointsOfConfig, rejectedEndpointsOfConfig, reachView, validateEndpoint } from '../settings/reachability.js'
import { isLive, isVirtualNic, nicChoiceOf, orderedNics, resolveNic } from './nicChoice.js'

export const SYSTEM_META = { net: ['host', 'off', 4, 'card', 'widget'], sys: ['host', 'off', 2, 'card', 'widget'], 'public-address': ['host', 'off', 4, 'card', 'widget'] }
export const SYSTEM_SIZES = { net: { m: [4, 1], l: [4, 2], xl: [8, 2] }, sys: { s: [2, 1], m: [4, 1] }, 'public-address': { s: [2, 1], m: [4, 1], l: [4, 2] } }

const KIND_ICON = { ethernet: 'settings_ethernet', wifi: 'wifi', mesh: 'hub', virtual: 'dns', other: 'lan' }
export const speedText = (mbps) => (!mbps ? '' : mbps >= 1000 ? `${+(mbps / 1000).toFixed(mbps % 1000 ? 1 : 0)} Gbps` : `${mbps} Mbps`)
const kindWord = (T, kind) => T[`nic_${kind}`] || T.nic_other
// the word for an adapter: a VPN or hypervisor adapter that the host calls ethernet is still software, and says so
const kindOf = (T, n) => kindWord(T, isVirtualNic(n) && n.type !== 'mesh' && n.type !== 'virtual' ? 'virtual' : n.type)

/** Whether the host's check found a problem with the public address that was set (an unset address is not a problem; clients then use the address that is found). */
/** The public address has a fault the person can fix: a name that does not resolve, an address that is not the router's, another device answering, or only private addresses. */
export const reachProblemOf = (report) => {
  const eps = report?.public?.endpoints || []
  if (eps.length) return eps.some((e) => e.error === 'dns_failed' || e.error === 'identity_mismatch' || e.reasons.includes('address_mismatch')) || eps.every((e) => e.scope === 'lan' || e.scope === 'loopback')
  const c = report?.public?.configured
  return !!c && (c.reasons || []).some((r) => r !== 'unset')
}

/**
 * What the 公网地址 card says, in one state: { state, value, word, tone, address }. `value` is an address only where `address` is true (it is then redacted in a screenshot); every other state names itself.
 * The states: unset (nothing is known: the card's empty text), checking, unchecked (an address is set, the check has not run), saved (the set address with the verdict of the host), found (nothing is set; the router's
 * public address), invalid (the configuration holds an entry no client can use, 0.0.0.0 for one), no-ipv4 (behind a carrier NAT or a router without a public address), failed (the check did not come back).
 * The tone is ok, quiet or bad. A wildcard address is never drawn as an address, wherever it came from (the configuration, the router).
 */
export function addressView(x, T, { saved, rejected, path }) {
  const checking = !!x.reachChecking || x.reachStatus === 'loading'
  // the check did not come back: the reason, whatever report is still there from before
  const failed = (value, address) => ({ state: 'failed', value, word: x.reachCause === 'timeout' ? T.addrFailTimeout : x.reachCause === 'offline' ? T.addrFailOffline : x.reachHttp ? T.addrFailHttp.replace('{code}', String(x.reachHttp)) : T.addrFailOffline, tone: 'bad', address })
  // what the router said the last time (the report that is still there): an address to show beside the reason, or the reason it has none
  const routerResult = () => {
    const router = x.reach?.public?.router
    if (!x.reach || !router) return null
    if (router.wanClass === 'cgnat' || router.wanClass === 'private') return { value: T.addrNoV4, address: false }
    if (router.wanIp) {
      const found = validateEndpoint(router.wanIp)
      return found.ok && router.wanClass === 'public' ? { value: found.text, address: true } : { value: T.addrNoV4, address: false }
    }
    return null
  }
  const tone = path ? ({ ok: 'ok', info: 'ok', error: 'bad' }[path.tone] || 'quiet') : 'quiet'
  if (saved) {
    if (checking) return { state: 'checking', value: saved, word: T.addrStChecking, tone: 'quiet', address: true }
    if (x.reachStatus === 'error') return failed(saved, true)
    return path ? { state: 'saved', value: saved, word: path.word, tone, address: true } : { state: 'unchecked', value: saved, word: T.addrNotChecked, tone: 'quiet', address: true }
  }
  if (rejected.length) return { state: 'invalid', value: T.addrInvalid, word: rejected[0].error === 'unspecified' ? T.addrWildcard : T.addrBad, tone: 'bad', address: false }
  if (checking) return { state: 'checking', value: T.addrStChecking, word: '', tone: 'quiet', address: false }
  if (x.reachStatus === 'error') { const last = routerResult(); return last ? failed(last.value, last.address) : failed(T.addrFailed, false) }
  const router = x.reach?.public?.router
  if (x.reach && router) {
    const noV4 = (word) => ({ state: 'no-ipv4', value: T.addrNoV4, word, tone: 'bad', address: false })
    if (router.wanClass === 'cgnat') return noV4(T.addrCgnat)
    if (router.wanClass === 'private') return noV4(T.addrPrivateWan)
    if (router.wanIp) {
      const found = validateEndpoint(router.wanIp)
      return found.ok && router.wanClass === 'public' ? { state: 'found', value: found.text, word: path?.word || T.addrFound, tone, address: true } : noV4(T.addrNoWan)
    }
  }
  return { state: 'unset', value: '', word: '', tone: 'quiet', address: false }
}

export function systemCatalogue(x, T) {
  const d = { net: null, sys: null, 'public-address': null }
  const si = x.sysinfo
  if (si && Array.isArray(si.nics)) {
    const hostKey = si.host?.name || ''
    // the adapter the person chose on this host (x.nicChoice overrides the kept choice: tests and previews), else the rule of nicChoice.js
    const choice = x.nicChoice !== undefined ? x.nicChoice : nicChoiceOf(hostKey)
    const ctx = { bind: x.config?.bind_address, client: x.session?.client_address }
    const res = resolveNic(si.nics, choice, ctx)
    const main = res.nic
    if (main) {
      const ordered = orderedNics(si.nics, ctx)
      const sub = (n) => [kindOf(T, n), speedText(n.link_speed_mbps), (n.ipv4 || [])[0]].filter(Boolean).join(' · ')
      const row = (n) => ({ icon: KIND_ICON[n.type] || 'lan', title: n.name, sub: sub(n), tone: n.up ? '' : 'warn', main: n === main })
      const option = (n) => ({ id: n.name, title: n.name, sub: n.up ? sub(n) : [kindOf(T, n), T.nicDown].join(' · '), icon: KIND_ICON[n.type] || 'lan', up: !!n.up, virtual: isVirtualNic(n), current: n === main, auto: n === res.auto.nic })
      // the stream leaves by the adapter the rule finds (or the one the person chose when it is that one): only then does the host's measured bitrate belong to this tile
      const streamHere = !!x.session && (res.reason !== 'manual' || res.auto.nic === main)
      // the curve is the host's measured bitrate: a host that reports only the configured budget (no measured_bitrate_kbps) draws none
      const measured = streamHere && Number.isFinite(x.session?.measured_bitrate_kbps)
      const sent = measured ? (x.series?.bitrate?.length ? x.series.bitrate : x.history?.samples?.bitrate || []).map((v) => v / 1000).filter(Number.isFinite).slice(-120) : []
      const speed = Number.isFinite(main.link_speed_mbps) ? main.link_speed_mbps : 0
      d.net = {
        type: 'nics', icon: 'lan', title: T.c_net, empty: T.netNone,
        primary: { icon: KIND_ICON[main.type] || 'lan', name: main.name, description: main.description && main.description !== main.name ? main.description : '', kind: kindOf(T, main), speed: speedText(main.link_speed_mbps), ipv4: (main.ipv4 || [])[0] || '', signal: main.wifi && Number.isFinite(main.wifi.signal) ? main.wifi.signal : null, ssid: main.wifi?.ssid_masked || '', isDefault: !!main.is_default_route, wifi: main.type === 'wifi', virtual: isVirtualNic(main), up: !!main.up },
        rows: ordered.filter((n) => n === main || isLive(n)).map(row),
        facts: [...(main.ipv6?.length ? [{ label: 'IPv6', value: main.ipv6[0] }] : []), ...(main.mac ? [{ label: T.nicMac, value: `${main.mac}:••:••:••` }] : []), { label: T.nicDefault, value: main.is_default_route ? T.yes : T.no }],
        labels: { signal: T.nicSignal, default: T.nicDefault, auto: T.nicAuto, adapter: T.nicAdapter, down: T.nicDown, sent: T.nicSent, others: T.nicOthers, headroom: T.nicHeadroom, mbps: T.mbps, why: T[`nicWhy_${res.reason}`] || '', gone: res.missing ? T.nicGone : '' },
        choice: { host: hostKey, value: res.reason === 'manual' ? main.name : '', manual: res.reason === 'manual', reason: res.reason, auto: res.auto.nic?.name || '', missing: res.missing, options: ordered.map(option) },
        usage: { here: streamHere, series: sent, now: sent.length ? sent[sent.length - 1] : null, speed, ratio: sent.length && speed > 0 ? Math.min(1, sent[sent.length - 1] / speed) : null },
      }
    }
  }
  if (si && si.os) d.sys = { type: 'rows', icon: 'computer', title: T.c_sys, big: si.os.name || '', rows: [{ icon: 'info', title: T.sysVersion, value: si.os.version || '–' }, { icon: 'tag', title: T.sysBuild, value: si.os.build || '–' }, { icon: 'dns', title: T.sysHost, value: si.host?.name || '–' }] }
  const view = x.reach ? reachView(x.reach, T.__locale || 'en') : null
  if (view || x.config) {
    const path = view?.paths.find((p) => p.id === 'public') || null
    const saved = endpointsOfConfig(x.config).join(', ')
    const view2 = addressView(x, T, { saved, rejected: saved ? [] : rejectedEndpointsOfConfig(x.config), path })
    d['public-address'] = { type: 'address', icon: 'public', title: T['c_public-address'], saved, view: view2, path, locale: T.__locale || 'en', texts: { edit: T.addrEdit, detect: T.addrCheck, checking: T.addrChecking, cancel: T.addrCancel, unset: T.addrUnset }, checking: view2.state === 'checking', progress: x.reachProgress?.text || '', canAct: x.canAct !== false }
  }
  return d
}
