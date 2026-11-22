// The sizes of every tile, from its content (docs/home-tiles.md, "Sizes"; round27-xl). A tile offers a size only when it has a layout of its own there that shows more real
// data than the size below (or, going down, still says what the tile is for, nothing cut into uselessness). The ladder, in square units (one unit = the dock's square):
//   s 方形 1 x 1 (Apple systemSmall) · m 中 2 x 1 (systemMedium) · l 大 2 x 2 (systemLarge) · xl 特大 4 x 2 (systemExtraLarge) · xlp 特大竖 2 x 4 (systemExtraLargePortrait)
// and the strip 条, a kind of its own (one row of controls, 2 or 4 units wide, less than a unit high), not a step of the ladder.
// id -> [min, max] of the ladder (null: the tile is a strip only), { strip: 2 | 4, size: the default, classes: { compact: [min, max], ... } }

const R = (min, max, more = {}) => ({ min, max, ...more })
const each = (ids, r) => Object.fromEntries(ids.map((id) => [id, r]))

export const TILE_RANGES = Object.freeze({
  // the flow of the first pairing is not a widget: a banner the width of the row, as tall as its step (a new setup only, it goes once a client is paired)
  journey: R('xl', 'xl', { banner: true }),
  // 本主机: its status, version and what it serves; smaller than 中 it is not the host card any more. 大 adds the session and the clients, 特大 the encoder and the network
  // 方形: the name, the state and one fact; 中 the status, the name, the chips and two pairs; 大 and 特大 add the facts
  hero: R('s', 'xl', { size: 'm' }),
  // the PIN and the QR code need 中; 方形 is the paired count and the way to pair
  pair: R('s', 'm', { size: 'm' }),
  // the recommended client, its three steps and the way to the page at 中; the two clients side by side need more than a square (a 大 of its own: later)
  // on a phone its 中 does not hold the file line: the square (the recommended client, a tap opens the page)
  download: R('s', 'm', { size: 'm', classes: { compact: ['s', 's'] } }),
  // a load value works at 方形; 大 adds the lowest, mean and highest of the curve and the model, the cores or the driver and memory, the temperature. No 特大: it would need the
  // load per core or per process, which the host does not report (a proposal, round27-xl)
  cpu: R('s', 'l'), gpu: R('s', 'l'),
  // the curve at 中; 大 adds its lowest, mean and highest; the host gives nothing more to show
  bitrate: R('s', 'l'), fps: R('s', 'l'),
  ...each(['latency', 'loss', 'memory-trend', 'budget', 'temperature'], R('s', 'm')),
  // the dropped frames: a count and its trend, the square says both (中 drew the same numbers larger)
  dropped: R('s', 's'),
  // two series do not fit a square
  load: R('m', 'm'),
  'gamepad-type': R('s', 'l', { strip: 4, size: 'strip' }), 'sw:mic': R('s', 's', { strip: 2, size: 'strip' }), quick: R(null, null, { strip: 4 }),
    // the memory bar and its legend need more than a phone's 中
  memory: R('s', 'm', { classes: { compact: ['s', 's'] } }),
  ...each(['vdd', 'encoder', 'display', 'sys', 'stream-resolution', 'stream-bitrate', 'host-ports', 'host-name', 'host-encryption', 'host-adapter', 'reach', 'last-session', 'clients-online', 'public-address'], R('s', 'm')),
  // 中 of 加密 says what each mode means for the path; 中 of the session bitrate draws its curve under the gauge (a size is not dropped to pass a gate)
  // 大: the covers of the latest games as a grid of six with their names (from five games on, see `largestOf`)
  'recent-games': R('s', 'l'),
  // 网卡: the adapter, its link and its address need more than a square: 中 is the adapter with the chooser; 大 adds the adapters as a list that chooses; 特大 the stream's rate against the link, the details and the other adapters
  net: R('m', 'xl'),
  // 正在玩: the cover at 方形, beside the name at 中; 大 the shape-masked cover large with the name and the client
  'current-app': R('s', 'l'),
  // three states (gamepad, microphone, USB) or three codecs cannot be read in a square without cutting them
  devices: R('m', 'm'), codecs: R('m', 'm'),
  // one value or one state: the square says it all, 中 would only add a line of static text
  ...each(['hdr', 'audio-out', 'gamepad-status', 'usb-devices', 'update', 'session-time', 'stream-client', 'stream-fps', 'stream-mic', 'stream-vdd', 'vivi'], R('s', 's')),
  // a list: 中 shows a few rows, 大 the long list (from five rows on, see `largestOf`)
  // on a phone the tabs and a row do not fit a column's height: the full-width square
  table: R('m', 'l', { size: 'm', classes: { compact: ['l', 'l'] } }), logs: R('s', 'l'), announcements: R('s', 'xl'),
  // the count and the way to add one at 方形, four covers at 中; the whole library is the 游戏库 tile
  apps: R('s', 'm'),
  // the devices with when each streamed last and its share of the time: 特大
  'clients-paired': R('s', 'xl'),
  // 特大: the whole library as covers
  covers: R('m', 'xl'),
  // the 24 hours as bars at 中, with the newest lines of the log at 大 and 特大
  errors: R('m', 'xl'),
  // the total and the last fourteen days at 方形, thirty days at 中 (not on a phone: the strip needs the width)
  'session-heat': R('s', 'm', { classes: { compact: ['s', 's'] } }),
  // the developers to sponsor and the star: a row of actions
  sponsor: R(null, null, { strip: 4 }), guide: R('m', 'm'), 'pers-wallpaper': R('m', 'm'),
  // one sentence: a strip
  tip: R(null, null, { strip: 4 }),
  // the virtual display control (mode, when, the resolution) needs a square of its own
  'ctl-vdd': R('l', 'l'),
  // the frame-rate presets and their 添加: a strip
  'ctl-fps': R(null, null, { strip: 4 }),
  // 最近操作: one row at 方形, two at 中, four at 大 and eight at 特大, each row with its control; the live controls of a running stream: 码率 and DualSense
  'recent-actions': R('s', 'xl', { size: 'm' }), 'live-bitrate': R('m', 'm'), 'live-ds5': R('m', 'l', { size: 'm' }),
  // one setting with a few options: its current value at 方形, the options as a strip
  'ctl-encoder': R('s', 's', { strip: 4, size: 'strip' }), 'ctl-bitrate': R('s', 's', { strip: 4, size: 'strip' }), 'pers-theme': R('s', 's', { strip: 4, size: 'strip' }),
  'pers-colour': R(null, null, { strip: 4 }),
  // one switch or one action: a square
  // the catalogue growth round (homeGrowth.js): a closed ring or a shape at every size; the access choice has no 大
  ...each(['ports-check', 'file-maps', 'encode-budget'], R('s', 'l')), 'web-access': R('s', 'm'),
  // the second round (homeGrowth2.js): a hero at every size; the two with a choice on the tile (麦克风, 捕获方式) keep it at 中 and 大
  ...each(['link-margin', 'frame-supply', 'mic-health', 'capture-method'], R('s', 'l')),
  ...each(['ctl-controller', 'ctl-keyboard', 'ctl-mouse', 'ctl-cursor', 'ctl-audio', 'live-audio', 'act-stop'], R('s', 's')),
})
const COMPONENT = R('s', 'm')
const ACTION = R('s', 's')

/** The declaration of a tile: its own, the one of its family (the component and action tiles, a pinned setting), else one derived from its old sizes. */
export function rangeOf(id, meta = {}) {
  if (TILE_RANGES[id]) return TILE_RANGES[id]
  if (id.startsWith('comp:')) return COMPONENT
  if (id.startsWith('act-') || meta?.data?.type === 'action') return ACTION
  if (meta?.data?.type === 'pin-switch') return ACTION
  if (meta?.data?.type === 'pin-slider') return R('s', 's', { strip: 2, size: 'strip' })
  const old = meta?.sizes || {}
  const keys = ['s', 'm', 'l'].filter((k) => old[k])
  return keys.length ? R(keys[0], keys[keys.length - 1]) : R('s', 'm')
}
