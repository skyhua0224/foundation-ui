import { CLIENTS, clientsForOs } from '../clients/catalogue.js'
import { sessionClientLabel } from './clientLabel.js'
import { formatOf, hdrOf, modesFor } from '../settings/codecFormat.js'
// Pure model of the guided first run (MGuideFlow): the steps, the progress that survives a restart, the rule that opens the guide on
// its own, and the small decisions of single steps (device and client, LAN address, pairing, sessions). No DOM and no Vue, so it can
// be tested on its own. Nothing here talks to the host: the product passes the real data in and receives the actions out.

// The first-run flow of both products: six steps and a done page (owner 2026-11-16). `intro` is the first screen (the project, the plain open-source notice, the one-time notice about what is sent and where to
// turn it off, the language and the look; nothing is asked about usage statistics). `account` is only offered where the product has no account yet (the control panel on a host without credentials).
// `channel` is the update channel, 稳定版 or 测试版, a step of its own with a plain sentence for each (stable is the default; a person who chose before keeps the choice and an upgrade skips the step).
// `install` is one recommended download with its code; `pair` finds this computer by itself first and has the PIN and the code for the rest; `connect` is the first stream check. `done` ends it: the game
// library found in the background, 「开始使用」, and the optional pages (`GUIDE_OPTIONAL`) as buttons that open one of the old pages and come back. An upgrade is `whatsnew`, then `channel` when it was never
// chosen, then `done`. The ids of the old flow stay valid: progress saved by an older version maps onto the new flow (`legacyStepOf`).
export const GUIDE_STEP_IDS = Object.freeze(['whatsnew', 'intro', 'account', 'channel', 'appearance', 'motion', 'setup', 'webaccess', 'remote', 'update', 'hostdone', 'install', 'address', 'pair', 'connect', 'apps', 'done'])
export const GUIDE_FLOW = Object.freeze(['intro', 'account', 'channel', 'install', 'pair', 'connect', 'done'])
export const GUIDE_FLOW_UPGRADE = Object.freeze(['whatsnew', 'channel', 'done'])
/** The pages the done page offers, in the order it lists them. Each is a page of the old guide, opened as a sub-flow. `advanced` ones are marked and not pushed. */
export const GUIDE_OPTIONAL = Object.freeze([
  { id: 'appearance', icon: 'palette', advanced: false },
  { id: 'motion', icon: 'slow_motion_video', advanced: false },
  { id: 'setup', icon: 'hdr_on', advanced: false },
  { id: 'webaccess', icon: 'language', advanced: true },
  { id: 'remote', icon: 'public', advanced: true },
])

/** The update channels: 稳定版 (the default) and 测试版 (`prerelease` in the release data). Anything else is the default. */
export const UPDATE_CHANNELS = Object.freeze(['stable', 'prerelease'])
export const channelOf = (value) => (value === 'prerelease' || value === true ? 'prerelease' : 'stable')

const STEP_ICONS = Object.freeze({ whatsnew: 'new_releases', intro: 'language', account: 'account_circle', channel: 'system_update_alt', appearance: 'palette', motion: 'slow_motion_video', setup: 'tune', install: 'download', address: 'lan', pair: 'link', webaccess: 'smartphone', remote: 'public', connect: 'desktop_windows', apps: 'sports_esports', update: 'system_update_alt', hostdone: 'task_alt', done: 'task_alt' })

/**
 * Where a person who stopped at a step of the old flow continues in the new one: the first step that is still to do. The host part of the old flow (look, animations, display, the optional pages) is over or
 * is an optional page now, so those continue at the install step; the games are on the done page.
 */
export const LEGACY_STEP = Object.freeze({ appearance: 'intro', motion: 'install', setup: 'install', webaccess: 'install', remote: 'install', update: 'install', hostdone: 'install', address: 'pair', apps: 'done' })
export const legacyStepOf = (id) => LEGACY_STEP[id] || id

/**
 * The steps of the flow in order. `skip` drops steps that make no sense for this host (the account step when credentials exist, the update channel step of an upgrade that already has a choice; `update` drops the update page of the done page).
 * Every step can be skipped by the person; `skip` is only about steps that are not offered at all.
 */
export function buildGuideSteps({ skip = [], mode = 'fresh' } = {}) {
  // an upgrade is what is new, then the done page. `skip` names the steps of this flow only; an id of the old flow (hostdone, address, appearance, setup …) has no step of its own any more and drops nothing
  const drop = new Set(skip)
  return (mode === 'upgrade' ? GUIDE_FLOW_UPGRADE : GUIDE_FLOW).filter((id) => !drop.has(id)).map((id) => ({ id, icon: STEP_ICONS[id], skippable: id !== 'done', ...(id === 'done' ? { optional: optionalPages({ skip }).map((page) => page.id) } : {}), ...(id === 'channel' ? { source: !skip.includes('update') } : {}) }))
}

/**
 * The optional pages the host cannot offer now, { id: true }: no display was read (显示与 HDR; only once the setup was read), and the host has no network check (远程串流与组网). The done page lists them apart.
 */
export const unavailablePages = ({ setup, reach, setupRead = false } = {}) => ({
  ...(setupRead && !(setup?.adapters || []).length && !(setup?.displayDevices || []).length ? { setup: true } : {}),
  ...(reach?.status === 'unavailable' ? { remote: true } : {}),
})

/** The optional pages of the done page, minus the ones this product does not have (a product without an update source passes `skip: ['update']`: its channel step has no source part). */
export const optionalPages = ({ skip = [] } = {}) => GUIDE_OPTIONAL.filter((page) => !skip.includes(page.id))

/* ---- progress ---- */

export const GUIDE_STORAGE_VERSION = 1
const EMPTY = Object.freeze({ step: null, finished: false, device: null, visited: [], done: [], closed: '', version: '', mode: '' })

const storageOf = (storage) => {
  if (storage) return storage
  try { return globalThis.localStorage || null } catch { return null }
}

/** Reads the saved progress. A missing, unreadable or malformed value gives the empty progress. */
export function readProgress(storage, key) {
  try {
    const raw = storageOf(storage)?.getItem(key)
    if (!raw) return { ...EMPTY, visited: [] }
    const value = JSON.parse(raw)
    if (!value || typeof value !== 'object' || value.v !== GUIDE_STORAGE_VERSION) return { ...EMPTY, visited: [] }
    return {
      step: GUIDE_STEP_IDS.includes(value.step) ? value.step : null,
      finished: value.finished === true,
      device: typeof value.device === 'string' ? value.device : null,
      visited: Array.isArray(value.visited) ? value.visited.filter((id) => GUIDE_STEP_IDS.includes(id)) : [],
      // the steps the person went past (next, 跳过 this step), and the version the guide was closed for with the X: only that stops it from opening on its own again
      done: Array.isArray(value.done) ? value.done.filter((id) => GUIDE_STEP_IDS.includes(id)) : [],
      closed: typeof value.closed === 'string' ? value.closed : '',
      // the version of the product the flow was last shown for (closed, skipped or finished) and how it was shown; absent in what an older version stored
      version: typeof value.version === 'string' ? value.version : '',
      mode: value.mode === 'upgrade' || value.mode === 'fresh' ? value.mode : '',
    }
  } catch {
    return { ...EMPTY, visited: [] }
  }
}

/** Saves the progress; a storage that refuses (private mode, quota) is ignored: the guide then simply starts over next time. */
export function writeProgress(storage, key, progress) {
  try {
    storageOf(storage)?.setItem(key, JSON.stringify({ v: GUIDE_STORAGE_VERSION, step: progress.step ?? null, finished: progress.finished === true, device: progress.device ?? null, visited: progress.visited || [], done: progress.done || [], closed: progress.closed || '', version: progress.version || '', mode: progress.mode || '' }))
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent('foundation-guide-progress', { detail: { key } }))
    return true
  } catch {
    return false
  }
}

export function clearProgress(storage, key) {
  try { storageOf(storage)?.removeItem(key) } catch { /* nothing to clear */ }
}

/** Index of the step to show when the guide opens: the saved one while it is still part of the flow, else the first. */
export function startIndex(steps, progress) {
  if (!progress || progress.finished) return 0
  const at = steps.findIndex((step) => step.id === progress.step || step.id === legacyStepOf(progress.step))
  return at < 0 ? 0 : at
}

export const stepIndexOf = (steps, id) => steps.findIndex((step) => step.id === id)
export const nextIndex = (steps, index) => Math.min(steps.length - 1, index + 1)
export const prevIndex = (index) => Math.max(0, index - 1)
export const isLast = (steps, index) => index >= steps.length - 1

/* ---- when the guide opens on its own ---- */

const truthy = (value) => value === true || value === 'true' || value === 1 || value === '1'

/** `setup_wizard_completed` of the host config. Anything but a clear yes counts as not completed. */
export const isSetupCompleted = (config) => truthy(config?.setup_wizard_completed)

/**
 * First run: the host reports that setup is not completed AND no client is paired AND the person has not finished the guide; or the guide was started and not finished.
 * An unknown answer (host not reached, malformed list) never opens it.
 */
export function shouldAutoOpen({ setupCompleted, pairedCount, finished = false, resuming = false } = {}) {
  if (finished) return false
  // the person is in the middle of the guide (the setup step already saved, or the page reloaded for the language): it opens again where they were
  if (resuming && setupCompleted !== undefined) return true
  if (setupCompleted !== false) return false
  return Number.isInteger(pairedCount) && pairedCount === 0
}

/* ---- account ---- */

/** Same rules as the host's welcome form: a user name, a password and the same password twice. Returns '' or a key of the texts. */
export function validateAccount({ username = '', password = '', confirm = '' } = {}) {
  if (!String(username).trim()) return 'accountMissing'
  if (!password || !confirm) return 'accountMissing'
  if (password !== confirm) return 'accountMismatch'
  return ''
}

/* ---- devices and clients ---- */

/** The clients we recommend. One copy for both products; the Web UI test keeps it in line with config/resources.js. */
export const GUIDE_CLIENTS = Object.freeze(Object.fromEntries(CLIENTS.filter((c) => c.guide).map((c) => [c.guide, Object.freeze({ name: c.guideName || c.name, url: c.url, ...(c.zhUrl ? { zhUrl: c.zhUrl } : {}), ...(c.project ? { project: c.project } : {}) })])))

// each device offers the first client of the list for its system (the team's first); only the icon and the LAN note are the guide's own
const firstFor = (os) => clientsForOs(os)[0].client.guide
export const GUIDE_DEVICES = Object.freeze([
  { id: 'windows', icon: 'desktop_windows', client: firstFor('windows'), lanNote: false },
  { id: 'macos', icon: 'laptop_mac', client: firstFor('macos'), lanNote: true },
  { id: 'linux', icon: 'terminal', client: firstFor('linux'), lanNote: false },
  { id: 'android', icon: 'android', client: firstFor('android'), lanNote: true },
  { id: 'ios', icon: 'mobile', client: firstFor('ios'), lanNote: true },
  { id: 'harmony', icon: 'devices_other', client: firstFor('harmony'), lanNote: false },
  { id: 'tv', icon: 'tv', client: firstFor('tv'), lanNote: true },
])

export const deviceOf = (id) => GUIDE_DEVICES.find((device) => device.id === id) || null

/** The recommended client of a device: { id, name, url, project? } with the link that fits the language (VoidLink has a store per region). */
export function clientFor(deviceId, locale = 'en') {
  const device = deviceOf(deviceId)
  const client = device && GUIDE_CLIENTS[device.client]
  if (!client) return null
  const zh = /^zh/i.test(String(locale))
  return { id: device.client, name: client.name, url: zh && client.zhUrl ? client.zhUrl : client.url, project: client.project || '' }
}

/* ---- LAN address ---- */

const octets = (text) => {
  const parts = String(text).split('.')
  if (parts.length !== 4 || !parts.every((part) => /^(0|[1-9]\d{0,2})$/.test(part))) return null
  const numbers = parts.map(Number)
  return numbers.every((n) => n <= 255) ? numbers : null
}

/** 0 private LAN (10/8, 172.16/12, 192.168/16), 1 shared address space (100.64/10), 2 other public; null = not usable (loopback, link-local, benchmarking 198.18/15, any, not IPv4). */
export function lanRank(address) {
  const o = octets(address)
  if (!o) return null
  const [a, b] = o
  if (a === 0 || a === 127 || a >= 224) return null
  if (a === 169 && b === 254) return null
  // 198.18.0.0/15 is the benchmarking range (RFC 2544): a TUN of a proxy tool (Mihomo, Clash) puts its fake-IP gateway there; no phone on the network can be reached through it
  if (a === 198 && (b === 18 || b === 19)) return null
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return 0
  if (a === 100 && b >= 64 && b <= 127) return 1
  return 2
}

/** Adapters that are not the local network: a mesh network (ZeroTier, Tailscale, EasyTier, WireGuard), a virtual switch or a container bridge. Their addresses are no target for a router. */
const NOT_LAN = /zerotier|tailscale|easytier|wireguard|wintun|\bwg\d|\bzt[0-9a-z]{4,}|\btun\d|\btap\b|vethernet|vmware|vmnet|virtualbox|vboxnet|hyper-v|docker|\bveth|\bbr-|\blxc|\bvirbr|loopback/i

/**
 * The listener route answer `addresses` -> addresses a client can use, private LAN first. IPv6 is left out: the clients take an IPv4 address.
 * With `lanOnly` (the target of a router's port forward): the addresses in `exclude` (the mesh adapters of the reachability report) and an adapter whose name says mesh, virtual or
 * container are left out; when nothing else is left they are all kept, so a computer that only has such an address still gets one. Without it a phone on the mesh may use them too.
 */
export function pickLanAddresses(addresses, { exclude = [], lanOnly = false } = {}) {
  if (!Array.isArray(addresses)) return []
  const seen = new Set()
  const out = []
  const skip = new Set((exclude || []).map(String))
  for (const entry of addresses) {
    const address = typeof entry === 'string' ? entry : entry?.address
    const rank = lanRank(address)
    if (rank === null || seen.has(address)) continue
    seen.add(address)
    const name = typeof entry === 'string' ? '' : String(entry?.name || '')
    out.push({ name, address, rank, lan: !skip.has(address) && !NOT_LAN.test(name) })
  }
  const lan = lanOnly ? out.filter((a) => a.lan) : []
  return (lan.length ? lan : out).sort((x, y) => x.rank - y.rank)
}

/** True for what the person must not type into a client: localhost, loopback, an empty value. */
export const isLoopbackHost = (text) => /^(localhost|127\.|0\.0\.0\.0|::1|\[::1\])/i.test(String(text).trim())

/* ---- pairing ---- */

export const PIN_LENGTH = 4

export function canPair(pin, name, length = PIN_LENGTH) {
  return /^[0-9]+$/.test(String(pin)) && String(pin).length === length && String(name ?? '').trim().length > 0
}

/** The paired clients out of the client list answer, or null when the answer is not a client list (malformed, failed). */
export function normalizeClients(answer) {
  if (!answer || typeof answer !== 'object' || !Array.isArray(answer.named_certs)) return null
  if ('status' in answer && !truthy(answer.status)) return null
  return answer.named_certs.filter((client) => client && typeof client === 'object').map((client) => ({ name: String(client.name ?? ''), uuid: String(client.uuid ?? ''), enabled: client.enabled !== false, streaming: client.streaming === true }))
}

/** A client that is in `current` but not in the list taken when the pairing started; null when there is none (or no list). */
export function findNewClient(baseline, current) {
  if (!Array.isArray(baseline) || !Array.isArray(current)) return null
  const known = new Set(baseline.map((client) => client.uuid))
  return current.find((client) => client.uuid && !known.has(client.uuid)) || null
}

/* ---- sessions ---- */

/** The sessions out of the runtime answer, or null when the host does not give them (older host, remote browser: local only). */
export function normalizeSessions(answer) {
  if (!answer || typeof answer !== 'object' || !Array.isArray(answer.sessions)) return null
  return answer.sessions.filter((s) => s && typeof s === 'object').map((s) => ({
    client_name: String(s.client_name ?? ''), client_family: String(s.client_family ?? ''), client_os: String(s.client_os ?? ''), app_name: String(s.app_name ?? ''),
    width: Number(s.width) || 0, height: Number(s.height) || 0, fps: Number(s.fps) || 0,
  }))
}

/** The session to talk about: the one that runs the desktop if any, else the first. */
export function pickSession(sessions) {
  if (!Array.isArray(sessions) || !sessions.length) return null
  return sessions.find((s) => /desktop|桌面/i.test(s.app_name)) || sessions[0]
}

export function sessionLine(session) {
  if (!session) return ''
  const size = session.width && session.height ? `${session.width}×${session.height}` : ''
  return [sessionClientLabel(session), size && (session.fps ? `${size} @ ${session.fps}` : size)].filter(Boolean).join(' · ')
}

/* ---- the connect check ---- */

export const CONNECT_CHECKS = Object.freeze([
  { id: 'picture', icon: 'visibility' },
  { id: 'mouse', icon: 'mouse' },
  { id: 'keyboard', icon: 'keyboard' },
  { id: 'sound', icon: 'volume_up' },
])

/* ---- QR code ---- */

/**
 * Turns a QR matrix into one SVG path. Accepts what the `qrcode` package returns (`{ size, get(row, col) }`) or an array of rows of
 * booleans. `quiet` is the width of the blank border in modules (the standard asks for 4; the white card around the code adds more).
 * Horizontal runs are merged, so a code stays a few kilobytes.
 */
export function qrPath(matrix, quiet = 2) {
  let size = 0
  let at = () => false
  if (Array.isArray(matrix)) {
    size = matrix.length
    at = (row, col) => !!matrix[row]?.[col]
  } else if (matrix && Number.isInteger(matrix.size) && typeof matrix.get === 'function') {
    size = matrix.size
    at = (row, col) => !!matrix.get(row, col)
  }
  if (size <= 0) return { size: 0, d: '' }
  let d = ''
  for (let row = 0; row < size; row += 1) {
    let col = 0
    while (col < size) {
      if (!at(row, col)) { col += 1; continue }
      const start = col
      while (col < size && at(row, col)) col += 1
      d += `M${start + quiet} ${row + quiet}h${col - start}v1h${start - col}z`
    }
  }
  return { size: size + quiet * 2, d }
}

/* ---- mascot shapes ---- */

/** Points of a scalloped outline (cookie-like) on a 100x100 box: `lobes` bumps of depth `depth` around a radius `radius`. */
export function scallopPoints(lobes = 8, depth = 5, radius = 42, samples = 96, cx = 50, cy = 50) {
  const points = []
  for (let i = 0; i < samples; i += 1) {
    const angle = (i / samples) * Math.PI * 2
    const r = radius + depth * Math.cos(lobes * angle)
    points.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`)
  }
  return points.join(' ')
}

/* ---- the setup choices (language, graphics card, display) ---- */

/** The setup part of the guide state out of the host config (`/api/config`). `showLanguage` overrides the default rule of the product. */
export function setupStateFromConfig(config, { showLanguage } = {}) {
  const c = config && typeof config === 'object' ? config : {}
  return {
    completed: isSetupCompleted(c),
    locale: c.locale || '',
    showLanguage: showLanguage ?? (!c.locale || c.locale === 'zh' || c.locale === 'en'),
    adapters: Array.isArray(c.adapters) ? c.adapters : [],
    displayDevices: Array.isArray(c.display_devices) ? c.display_devices : [],
    adapter: c.adapter_name || '',
    display: c.output_name || '',
    prep: c.display_device_prep || 'ensure_only_display',
    hdr: hdrOf(c),
    // Windows build of the host (windows_build of the host configuration): the base virtual display has no HDR on Windows 10, whose newest build is 19045 (IddCx 1.5); Windows 11 starts at 22000
    windowsBuild: Number(c.windows_build) || 0,
    win10: Number(c.windows_build) > 0 && Number(c.windows_build) < 22000,
    virtual: String(c.platform || 'windows').toLowerCase() === 'windows',
  }
}

/**
 * The config to write back after the setup choices. The host replaces the whole configuration on a write, so the current one is the
 * base; only what was chosen changes, and the setup flag is set (`completed`). Used by the setup wizard and by the guide.
 */
export function mergeSetupConfig(current, { locale, adapter, display, prep, hdr, completed = true } = {}) {
  const config = { ...(current && typeof current === 'object' ? current : {}), setup_wizard_completed: completed }
  if (locale) config.locale = locale
  if (adapter !== undefined) config.adapter_name = adapter || ''
  if (display !== undefined) config.output_name = display
  if (prep !== undefined) config.display_device_prep = prep
  // allow HDR: the codec modes carry it (an offered codec with HDR is mode 3), the video format stays as it is
  if (hdr !== undefined && formatOf(config) !== 'h264') Object.assign(config, modesFor(formatOf(config), !!hdr))
  return config
}

export * from './guideRemote.js'
