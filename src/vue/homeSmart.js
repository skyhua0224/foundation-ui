// The smart overview: which tiles are on the page, in what order and at what size, from what this host is doing. One deterministic scoring function with a reason for every tile,
// kept in this module so that it can be replaced by a model later: the contract is `smartPlan(input) -> { scenario, tiles, order, sizes, reasons, visible }`. Everything it reads
// is local (the host's own state, counts of the tiles the person opened); nothing leaves the machine.
//
// input.signals:
//   pairedCount   number of paired clients (null while unknown)
//   streaming     a stream is running now
//   lastStreamAt  ms since epoch of the last stream, 0 if none
//   problems      number of startup problems; problemComponents: ids of components that have an issue (comp:<id> tiles)
//   recentErrors  errors in the host log lately
//   vdd           'on' | 'off' | 'missing' | undefined   mic: 'on'|'off'|'missing'   pad: a gamepad is attached
//   wifiHost      the host's default route is a Wi-Fi adapter     linkSlowMbps  the default link's speed when it is under 1000
//   reachBad      the reachability check found a problem with the public address
//   isNew         a new setup (the guide card)
//   updateAvailable  a newer version of the host is there (the 更新 tile comes forward when nothing else is going on)
//   now           ms since epoch, for the 30 minutes after a stream (Date.now() when absent: a plan made from a snapshot of the signals carries its own)
// input.usage: { [tileId]: { opens, controls } }   input.pins: ids of the tiles the person pinned (always kept)
// input.sizeClass: the window's class (homeSizes.js windowClassOf: 'compact' | 'medium' | 'expanded' | 'large' | 'extra'); the older 'medium' of sizeClassOf reads as a desktop
// input.cards: [{ id, available, sizes: ['s','m','l'] }]   input.capacity: the budget in grid cells of the tiles that are shown (units * rows)
export const SMART_VERSION = 1
const AREA = { s: 2, m: 4, l: 8, xl: 16, xlp: 16, strip: 4 }
export const HERO_FIRST = 5000

const comp = (id) => id.startsWith('comp:')
// the base score of each tile in each scenario: [score, reason key, preferred size]
const NEW = { journey: [100, 'rNewClient', 'l'], guide: [0, 'rNewGuide', 'm'], pair: [90, 'rNewClient', 'm'], hero: [88, 'rHost', 'm'], download: [70, 'rNewDownload', 'm'], announcements: [60, 'rNewsPinned', 'm'], 'public-address': [46, 'rAddress', 's'] }
// Idle, in this order: the host, pairing, the public address (only when one is set), the last session, the quick actions, the announcements; then the load of the CPU, the GPU and
// the memory, which take the room that is left. What is not in a list is not in the smart set: the tiles of MANUAL below are the person's to add.
const IDLE = { hero: [94, 'rIdleHost', 'm'], pair: [86, 'rIdlePair', 's'], 'public-address': [80, 'rAddress', 's'], 'last-session': [76, 'rIdleRecent', 's'], quick: [70, 'rQuick', 'm'], 'recent-actions': [67, 'rIdleActions', 'm'], announcements: [64, 'rIdleNews', 'm'], cpu: [36, 'rIdlePerf', 's'], gpu: [35, 'rIdlePerf', 's'], memory: [34, 'rIdlePerf', 's'] }
// Live, in this order: the host, who is on it, the application, how long, the bitrate and the frame rate (大 on a large window), the loss and the latency, the load, the stop.
// A tile whose data the host does not give is not available, so it is not in the plan: nothing is invented.
const LIVE = { hero: [100, 'rLiveHost', 'm'], 'clients-online': [96, 'rLiveClients', 's'], 'current-app': [94, 'rLiveApp', 's'], 'session-time': [92, 'rLiveTime', 's'], bitrate: [90, 'rLiveCurve', 'm'], fps: [88, 'rLiveCurve', 'm'], loss: [86, 'rLiveCurve', 's'], latency: [84, 'rLiveCurve', 's'], cpu: [76, 'rLivePerf', 's'], gpu: [75, 'rLivePerf', 's'], 'act-stop': [70, 'rLiveStop', 's'], announcements: [69, 'rLiveNews', 'm'], 'live-bitrate': [78, 'rLiveBitrate', 'm'], 'live-audio': [77, 'rLiveAudio', 's'], 'live-ds5': [74, 'rLiveDs5', 'm'] }
// The 30 minutes after a stream, when nothing is going on: the last session large, the session heat, then the idle list; an available update stays, next to the host.
const AFTER = { ...IDLE, 'last-session': [95, 'rAfterLast', 'l'], 'session-heat': [90, 'rAfterHeat', 'm'] }
// The lists are closed: in idle, live, after and update only the tiles they name are on the page, with what the person's own use, a pin or an accepted tile brings in and what the
// rules bring forward (the network on Wi-Fi or a slow link, a bad public address, the components that have a problem). There is no fill from the catalogue (rOther, below) there: an empty
// area is better than tiles nobody asked for. The first-run and problem lists keep it.
// MANUAL: the tiles that were in the smart set and are the person's to add now; they are not named, so they come in the same ways.
const MANUAL = new Set(['gamepad-type', 'encoder', 'sw:mic', 'vdd', 'devices', 'sys', 'apps', 'recent-games', 'download'])
// The announcements are on the smart page before, during and after a stream, whatever the budget is and whether anything is unread: the plan takes the tile in even when the room is used,
// after every tile it scores above, so it never pushes a primary tile off the first screen. In the first-run and problem lists it comes after the tiles of those lists.
export const ALWAYS = Object.freeze(['announcements'])
export const AFTER_STREAM_MS = 30 * 60 * 1000
/**
 * The four places that serve the people who use the host and the community, in this order: 添加应用, 下载客户端, 社区, 文档. In idle, update and after they come last, after every named tile,
 * all at 方形, in the room that is left: they never go before a real tile and never push one out. Not while streaming. Not the other action tiles (应用, 客户端, 诊断, 导出诊断包, 日志, 二维码配对, 重启, 主机设置).
 */
export const CURATED = Object.freeze(['act-add-app', 'act-downloads', 'act-community', 'act-docs'])
/** When the 30 minutes after the last stream end (ms since epoch), 0 when there is no stream to be after. The page plans again at that moment (dash/dashPlan.js). */
export const afterEndsAt = (s = {}) => ((s.lastStreamAt || 0) > 0 ? s.lastStreamAt + AFTER_STREAM_MS : 0)
// the idle table before the lists above: the problem scenario shows what the host would show, from this one
const IDLE_OLD = { hero: [94, 'rIdleHost', 'm'], pair: [86, 'rIdlePair', 's'], apps: [82, 'rIdleApps', 's'], 'recent-games': [76, 'rIdleRecent', 's'], vdd: [72, 'rIdleVdd', 's'], quick: [64, 'rQuick', 'm'], download: [48, 'rIdleDownload', 's'], encoder: [44, 'rIdleEncoder', 's'], 'public-address': [42, 'rAddress', 's'], cpu: [36, 'rIdlePerf', 's'], gpu: [35, 'rIdlePerf', 's'], memory: [34, 'rIdlePerf', 's'], 'gamepad-type': [58, 'rIdleControl', 'm'], 'sw:mic': [52, 'rIdleControl', 's'], sys: [28, 'rIdleSystem', 's'], net: [28, 'rNetwork', 's'], announcements: [55, 'rNewsPinned', 'm'], star: [90, 'rStar', 'm'], sponsor: [20, 'rIdleSponsor', 's'] }
// an update is there and nothing else is going on: the idle page with the 更新 tile next to the host card
const UPDATE = { ...IDLE, update: [93, 'rUpdate', 'm'] }
const AFTER_UPDATE = { ...AFTER, update: [97, 'rUpdate', 'm'] }
// the 错误 tile is not on the page by itself, whatever the host log says: the tiles of the components that have an issue and the logs tile say it, and the tile is one tap away in the catalogue
const PROBLEM = { errors: [0, 'rProblem', 'm'], logs: [88, 'rProblemLogs', 's'], 'act-diagnostics': [86, 'rProblemDiag', 's'], hero: [92, 'rHost', 'm'], quick: [66, 'rQuick', 'm'] }

// The size the plan asks for in a window class (the tile's own range and the class's room clamp it again, homeSizes.js effectiveSize):
//  - a phone (compact): two columns. The tiles of a stream are 中 so the numbers stay readable; what is 大 elsewhere is 中 (the journey keeps its one view); the rest square, two side by side.
//  - a tablet (medium, expanded): the plan's sizes.
//  - a desktop (large, extra): the host card is 大, and 特大 on an extra-large window; while streaming the bitrate and frame-rate curves are 大. Only where the packer draws
//    square-unit rows (`unitRows`): in the grid of row classes a 大 sits in a row of its own class and leaves half the row empty (round27-xl, tile-classes.mjs)
const LIVE_TILES = new Set(['hero', 'bitrate', 'fps', 'current-app', 'act-stop', 'live-bitrate'])
const offers = (c, k) => !c?.sizes || c.sizes.includes(k)
const LADDER = ['s', 'm', 'l', 'xl']
/** the largest of the offered sizes that is not larger than `size` (undefined when there is none) */
const below = (offered = [], size) => LADDER.slice(0, LADDER.indexOf(size) + 1).reverse().find((k) => offered.includes(k))
function sizeForClass(id, size, scenario, cls, c) {
  if (size === 'strip' || id === 'journey') return size
  if (cls === 'compact') return scenario === 'live' && LIVE_TILES.has(id) && offers(c, 'm') ? 'm' : size === 'l' && offers(c, 'm') ? 'm' : size
  if (cls === 'large' || cls === 'extra' || cls === 'medium-legacy') {
    if (id === 'hero') return cls === 'extra' && offers(c, 'xl') ? 'xl' : offers(c, 'l') ? 'l' : size
    if (scenario === 'live' && (id === 'bitrate' || id === 'fps') && offers(c, 'l')) return 'l'
  }
  return size
}

/** Which scenario the signals describe: a problem, a stream, a host with no client, the 30 minutes after a stream, an update that is there, else an idle host with clients. */
export function scenarioOf(s = {}, now = s.now ?? Date.now()) {
  if ((s.problems || 0) > 0 || (s.problemComponents || []).length > 0) return 'problem'
  if (s.streaming) return 'live'
  if ((s.pairedCount ?? 1) === 0) return 'new'
  if ((s.lastStreamAt || 0) > 0 && now >= s.lastStreamAt && now - s.lastStreamAt < AFTER_STREAM_MS) return 'after'
  if (s.updateAvailable) return 'update'
  return 'idle'
}

// Time of day (a smart stack only, relevanceOf below): a tile that suits the part of the day gets a lift in the calm scenarios (idle, update, after), never while streaming, in a problem or on a new setup.
// A tile the scenario does not name starts at 30 (the line of the tiles worth showing) with it, so a games tile in a stack is the one to show in the evening.
const TIME_OF_DAY = Object.freeze({
  morning: Object.freeze({ hero: 8, update: 12, announcements: 12, 'public-address': 6 }),
  evening: Object.freeze({ 'recent-games': 22, 'last-session': 12, 'session-heat': 8, apps: 10, covers: 10 }),
})
export const dayPartOf = (hour) => (hour >= 5 && hour < 12 ? 'morning' : hour >= 18 && hour < 24 ? 'evening' : 'day')
/** What the scenario's table says about a tile: [score, reason key, size] or undefined (the plan's own tables, without the budget and the person's use). */
const tableOf = (scenario, s) => (scenario === 'new' ? NEW : scenario === 'live' ? LIVE : scenario === 'after' ? (s.updateAvailable ? AFTER_UPDATE : AFTER) : scenario === 'update' ? UPDATE : scenario === 'problem' ? IDLE_OLD : IDLE)
/**
 * How relevant a tile is now, 0 to 100, from the same signals and tables as the plan (WidgetKit's TimelineEntryRelevance has the same shape: a score on a scale of your own, zero or less means not relevant):
 * the scenario's score of the tile, the components that have a problem, the network on Wi-Fi or a slow link, a bad public address, and the part of the day in the calm scenarios.
 * A stack turns to the member with the highest relevance (stackModel.js rotationPick); the host card's first place on the page (HERO_FIRST) is a place, not a relevance, so it is not read here.
 */
export function relevanceOf(id, signals = {}, { now = signals.now ?? Date.now(), hour = new Date(now).getHours() } = {}) {
  const scenario = scenarioOf(signals, now)
  let score = 0
  if (id.startsWith('comp:')) score = (signals.problemComponents || []).includes(id.slice(5)) ? 94 : 0
  else if (scenario === 'problem') score = PROBLEM[id] ? PROBLEM[id][0] : Math.min(IDLE_OLD[id]?.[0] || 0, 70)
  else score = Math.min(100, tableOf(scenario, signals)[id]?.[0] || 0)
  if (id === 'net' && (signals.wifiHost || signals.linkSlowMbps) && (scenario === 'live' || signals.linkSlowMbps)) score = scenario === 'live' ? 92 : 66
  if (id === 'public-address' && signals.reachBad) score = 78
  if (scenario === 'idle' || scenario === 'update' || scenario === 'after') {
    const lift = TIME_OF_DAY[dayPartOf(hour)]?.[id]
    if (lift) score = score > 0 ? Math.min(100, score + lift) : 30 + lift
  }
  return score
}

const usageBoost = (u) => (u ? Math.min(28, 7 * Math.log2(1 + (u.opens || 0)) + 4 * Math.log2(1 + (u.controls || 0))) : 0)

/**
 * The plan: every available tile with its score, the reason and the size it wants, the visible ones (the best until the budget is used, the pins always), in order of score.
 * `reasons[id]` = { key, vars } where key is a text key of the home texts (r...).
 */
export function smartPlan({ signals = {}, usage = {}, pins = [], accepted = [], cards = [], capacity = 40, sizeClass = 'medium', unitRows = false } = {}) {
  const scenario = scenarioOf(signals)
  const base = scenario === 'new' ? NEW : scenario === 'live' ? LIVE : scenario === 'after' ? (signals.updateAvailable ? AFTER_UPDATE : AFTER) : scenario === 'update' ? UPDATE : scenario === 'problem' ? IDLE_OLD : IDLE
  const extra = scenario === 'problem' ? PROBLEM : null
  const reasons = {}
  const want = {}
  const tiles = []
  const pinSet = new Set(pins)
  const takenSet = new Set(accepted)
  for (const c of cards) {
    if (!c.available) continue
    // a closed list: a tile it does not name has no score; the fallback (rOther: 24, or 28 while streaming, a tile of the catalogue that fills the room that is left) is for the first-run and problem lists only
    const closed = scenario !== 'new' && scenario !== 'problem'
    const manual = closed && (MANUAL.has(c.id) || !((extra && extra[c.id]) || base[c.id]))
    let [score, key, size] = manual ? [0, 'rOther', 's'] : (extra && extra[c.id]) || base[c.id] || (scenario === 'live' ? [28, 'rOther', 's'] : [24, 'rOther', 's'])
    // the four places: last, in their order, below the lowest named tile (34) and above the line of the tiles worth showing (30); use does not lift them over a real tile
    const curatedAt = scenario === 'idle' || scenario === 'update' || scenario === 'after' ? CURATED.indexOf(c.id) : -1
    if (curatedAt >= 0) [score, key, size] = [33 - curatedAt * 0.5, 'rCurated', 's']
    // a problem: the component tiles that have an issue come next, whatever else is going on
    if (comp(c.id)) { const id = c.id.slice(5); if ((signals.problemComponents || []).includes(id)) [score, key, size] = [94, 'rComponent', 'm']; else if (scenario !== 'problem') score = 0 }
    // the idle scenarios under a problem still show what the host would show
    if (scenario === 'problem' && !extra[c.id] && !comp(c.id)) { const alt = IDLE_OLD[c.id]; if (alt) [score, key, size] = [Math.min(alt[0], 70), alt[1], alt[2]] }
    // signals that bring a tile forward in any scenario
    if (c.id === 'net' && (signals.wifiHost || signals.linkSlowMbps) && (scenario === 'live' || signals.linkSlowMbps)) [score, key, size] = [scenario === 'live' ? 92 : 66, signals.wifiHost ? 'rNetWifi' : 'rNetSlow', 'm']
    if (c.id === 'public-address' && signals.reachBad) [score, key, size] = [78, 'rAddressBad', 'm']
    // no address set: the tile has nothing to say and does not appear (a bad address is another matter: it is set); the first-run list keeps it as it was
    else if (c.id === 'public-address' && c.empty && scenario !== 'new' && scenario !== 'problem') score = 0
    if (c.id === 'vdd' && signals.vdd === 'missing') score = Math.min(score, 30)
    if (c.id === 'sw:mic' && signals.mic === 'missing') score = Math.min(score, 30)
    const boost = usageBoost(usage[c.id])
    let vars = {}
    // the person's own use lifts a tile (6 or more of boost: one open). One that no list names starts from nothing, so it needs 14 (about three opens or ten uses of its control), and then stands above the line of the tiles worth showing (30)
    if (boost >= (manual ? 14 : 6) && score < 90 && curatedAt < 0) { score = manual ? 30 + boost : Math.min(99, score + boost); key = 'rUsage'; vars = { n: (usage[c.id].opens || 0) + (usage[c.id].controls || 0) } }
    if (takenSet.has(c.id)) { score = Math.max(score, 200); key = 'rAccepted' }
    if (pinSet.has(c.id)) { score = 1000; key = 'rPinned'; size = 's' }
    // 本主机 is always the first tile of the smart overview, before the pinned ones and the first-run card
    if (c.id === 'hero') { score = HERO_FIRST; key = pinSet.has(c.id) ? 'rPinned' : key }
    if (score <= 0) continue
    reasons[c.id] = { key, vars }
    // a tile with nothing to show yet is small, and below every tile that has data (the host tile, the pins and what the person accepted keep their place)
    const empty = !!c.empty && score < 200 && c.id !== 'hero'
    want[c.id] = empty ? 's' : c.sizes?.includes(size) ? size : below(c.sizes, size) || c.sizes?.[0] || 's'
    tiles.push({ id: c.id, score, empty, size: want[c.id], reason: reasons[c.id], curated: curatedAt >= 0 && score < 200 })
  }
  tiles.sort((a, b) => Number(a.curated) - Number(b.curated) || Number(a.empty) - Number(b.empty) || b.score - a.score || a.id.localeCompare(b.id))
  // the best tiles until the budget is used; a tile that is not worth showing (under 30) falls out, still in the catalogue; the pins are always in
  const visible = []
  let used = 0
  for (const t of tiles) {
    const area = AREA[t.size] || 2
    // a tile worth showing (30) while the budget lasts; a wide window with room left also takes the next ones of the catalogue (24)
    if (t.score >= 1000 || ALWAYS.includes(t.id) || ((t.score >= 30 || (t.score >= 24 && used < capacity * 0.7)) && used + area <= capacity)) { visible.push(t.id); used += area }
  }
  const sizes = {}
  for (const id of visible) sizes[id] = sizeForClass(id, want[id], scenario, unitRows || sizeClass === 'compact' ? sizeClass : 'medium', cards.find((x) => x.id === id))
  // a phone: the important tiles first, one or two columns; a desktop: the richer sizes of the tiles that lead (the packer clamps each to what the tile and the class allow)
  const byScore = new Map(tiles.map((t) => [t.id, t.score]))
  return { version: SMART_VERSION, scenario, tiles, visible, order: visible, sizes, reasons: Object.fromEntries(visible.map((id) => [id, reasons[id]])), score: (id) => byScore.get(id) || 0 }
}

/** The tiles worth suggesting to fill a short row: available, hidden, ranked by their score in the scenario (none of the ones already planned). */
export function suggestions(plan, limit = 8) {
  return plan.tiles.filter((t) => !plan.visible.includes(t.id) && t.score >= 24).slice(0, limit).map((t) => t.id)
}

/** The four purposes a very wide window splits the overview into: the live session and the performance, controls and devices, clients, apps and downloads, the system and the announcements. */
export const PURPOSES = Object.freeze(['live', 'controls', 'clients', 'system'])
const LIVE_IDS = new Set(['live-bitrate', 'hero', 'bitrate', 'fps', 'cpu', 'gpu', 'memory', 'net', 'load', 'budget', 'current-app', 'last-session', 'temperature', 'memory-trend', 'act-stop', 'session-time', 'session-heat', 'stream-resolution', 'stream-client', 'stream-fps', 'stream-bitrate', 'stream-mic', 'stream-vdd'])
const CLIENT_IDS = new Set(['journey', 'pair', 'star', 'download', 'guide', 'table', 'apps', 'recent-games', 'covers', 'clients-paired', 'clients-online', 'act-pair', 'act-pair-qr', 'act-add-app', 'act-downloads', 'act-clients', 'act-apps'])
const CONTROL_IDS = new Set(['recent-actions', 'live-audio', 'live-ds5', 'gamepad-type', 'sw:mic', 'vdd', 'encoder', 'display', 'devices', 'gamepad-status', 'usb-devices', 'audio-out', 'codecs', 'hdr'])
/** The purpose (an index of PURPOSES) of a tile: by its id, else by its group in the catalogue; a pinned setting is a control. */
export function purposeOf(id, group = '') {
  if (id.startsWith('pin:') || id.startsWith('ctl-')) return 1
  if (LIVE_IDS.has(id)) return 0
  if (CONTROL_IDS.has(id)) return 1
  if (CLIENT_IDS.has(id)) return 2
  if (id.startsWith('comp:')) return 3
  return { stream: 0, perf: 0, control: 1, device: 1, start: 2, host: 3, resources: 3, personal: 3 }[group] ?? 3
}
/** The sections of `count` places for the purposes: with fewer places than purposes, neighbours share one (two places: live and controls | clients and system). */
export const sectionIndexOf = (purpose, count) => (count >= 4 ? Math.min(purpose, count - 1) : count === 3 ? Math.min(purpose, 2) : count === 2 ? (purpose < 2 ? 0 : 1) : 0)

// The tiles that fill the empty slots of a window (dashDock: fillCards): the catalogue's tiles that have data and are not on the page yet, the ones that say most about the state first.
// Streaming: the stream's own numbers, the host's load, the network and the encoder. Idle: the host and the system, the applications, the devices. Every one is drawn at a standard size.
const FILL_LIVE = ['frame-supply', 'link-margin', 'mic-health', 'capture-method', 'encode-budget', 'ports-check', 'file-maps', 'web-access', 'loss', 'dropped', 'latency', 'budget', 'cpu', 'gpu', 'memory', 'net', 'encoder', 'load', 'temperature', 'memory-trend', 'stream-resolution', 'stream-client', 'stream-fps', 'stream-bitrate', 'stream-vdd', 'stream-mic', 'vdd', 'sw:mic', 'devices', 'sys', 'clients-online', 'clients-paired', 'codecs', 'hdr', 'audio-out']
const FILL_IDLE = ['mic-health', 'capture-method', 'ports-check', 'file-maps', 'web-access', 'encode-budget', 'cpu', 'gpu', 'memory', 'net', 'sys', 'encoder', 'vdd', 'sw:mic', 'apps', 'recent-games', 'devices', 'clients-paired', 'download', 'last-session', 'session-heat', 'load', 'temperature', 'memory-trend', 'host-ports', 'host-name', 'host-adapter', 'host-encryption', 'codecs', 'hdr', 'audio-out', 'gamepad-status', 'usb-devices', 'covers', 'public-address', 'reach']
/** The ids in the order they fill slots in `scenario`; ids the lists do not name come after them, in the catalogue's order. */
export function fillOrder(scenario, ids = []) {
  const named = scenario === 'live' ? FILL_LIVE : FILL_IDLE
  const rank = new Map(named.map((id, i) => [id, i]))
  return [...ids].sort((a, c) => (rank.has(a) ? rank.get(a) : 1000 + ids.indexOf(a)) - (rank.has(c) ? rank.get(c) : 1000 + ids.indexOf(c)))
}
