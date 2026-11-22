// Tile sizes of the home, like widgets on a phone and a tablet (round27-xl; docs/home-tiles.md, "Sizes"). The ladder in square units, one unit = GRID_UNIT_PX (148 px at
// the standard density, scaled by it; the same on every window, see columnsOf):
//   s 方形 1 x 1 (Apple WidgetKit systemSmall) · m 中 2 x 1 (systemMedium) · l 大 2 x 2 (systemLarge) · xl 特大 4 x 2 (systemExtraLarge, iPadOS and macOS)
//   · xlp 特大竖 2 x 4 (systemExtraLargePortrait, iOS/iPadOS/macOS 27), and the strip 条: one row of controls, 2 or 4 units wide and less than a unit high, a kind of its own.
// Each tile declares its own range from its content (homeRanges.js); the size the person chose is a preference, the size drawn is `effectiveSize`: the preference clamped to
// what the tile offers in the window's class (Material 3 window size classes). The preference is never rewritten: a wider window brings it back.
import { TILE_RANGES, rangeOf } from './homeRanges.js'

/** The ladder, smallest first (xlp is a peer of xl: as much room, standing up). */
export const SIZE_KEYS = Object.freeze(['s', 'm', 'l', 'xl', 'xlp'])
/** Every size a tile can have: the ladder and the strip. */
export const ALL_SIZE_KEYS = Object.freeze([...SIZE_KEYS, 'strip'])
const RANK = { s: 0, m: 1, l: 2, xl: 3, xlp: 3 }
/** [columns, rows] in square units. */
export const SIZE_UNITS = Object.freeze({ s: Object.freeze([1, 1]), m: Object.freeze([2, 1]), l: Object.freeze([2, 2]), xl: Object.freeze([4, 2]), xlp: Object.freeze([2, 4]) })
/** The unit of the overview grid: one square, in CSS px at the standard density. It is the same on every window and every screen (the same size at the same OS scale): a bigger window holds more
 *  columns and rows of standard tiles, a smaller one fewer, never a bigger or smaller tile. 148 px (a column pitch of 160 px with the 12 px gap) is the square the tiles were drawn, fitted and shown to the owner at (149.7 px at 1280 x 800), and it packs the common windows flush: the
 *  content widths of a 1280, 1440, 1920 and 2560 px window are 7, 8, 11 and 15 columns of it with 12 px to spare. The small views are drawn for 140 px and up; a 2 x 1 tile is 308 px. The strip's height, the gap between tiles. */
export const UNIT_PX = 148
/** The most columns the overview grid has. A wider pane keeps the tiles at their size and gets wider margins on both sides: the grid sits in the middle (the catalogue has a limited number of tiles with data, and a grid wider than that
 *  would show holes instead of tiles). 12 columns are 12 x 148 + 11 x 12 = 1908 px. */
export const MAX_COLUMNS = 12
export const STRIP_PX = 56
export const UNIT_GAP = 12
const DENSITY = { smaller: 0.875, standard: 1, larger: 1.125 }
/** How many square columns a content width holds at a density, and the side of one: always the fixed unit (scaled by the density the person chose); only a pane narrower than two units and a gap
 *  (a phone) gets a smaller one, so two columns still fit. The grid is as wide as its columns and sits in the middle of the pane. */
export function columnsOf(width, density = 'standard') {
  const u = Math.round(UNIT_PX * (DENSITY[density] || 1))
  const n = Math.max(2, Math.min(MAX_COLUMNS, Math.floor((width + UNIT_GAP) / (u + UNIT_GAP))))
  const fit = Math.floor(((width - (n - 1) * UNIT_GAP) / n) * 100) / 100
  // A narrow pane (a phone, a small window, a tablet standing up) is filled edge to edge: the columns share the whole width, so the grid's edges are the other cards' edges and the margins are the
  // same on both sides (a fixed unit left a strip of up to a column's width, and the grid sat narrower than the card above it). The unit stays within [the standard, FLEX_MAX]; a wider pane keeps the standard unit.
  if (width < FLEX_BELOW) return { columns: n, unit: Math.min(Math.round(UNIT_FLEX_MAX * (DENSITY[density] || 1)), fit) }
  return { columns: n, unit: Math.min(u, fit) }
}
/** Below this pane width (px) the columns share the whole width; from it on the unit is the standard one and the grid sits in the middle. */
export const FLEX_BELOW = 800
/** The largest a unit gets while a narrow pane is filled (px at the standard density). */
export const UNIT_FLEX_MAX = 200
/** How many standard tiles complete the last row of a grid of `columns` columns holding `count` tiles (0 when the row is full or there are none). */
export const missingInRow = (count, columns) => (count > 0 && columns > 0 ? (columns - (count % columns)) % columns : 0)
/** The width of a grid of `columns` units. */
export const gridWidthOf = (columns, unit) => columns * unit + (columns - 1) * UNIT_GAP
export const unitPx = (width, density = 'standard') => columnsOf(width, density).unit
/** The box of a size in pixels for a unit: [width, height]. */
export function sizePx(key, unit, strip = 4) {
  if (key === 'strip') return [strip * unit + (strip - 1) * UNIT_GAP, STRIP_PX]
  const [c, r] = SIZE_UNITS[key] || SIZE_UNITS.s
  return [c * unit + (c - 1) * UNIT_GAP, r * unit + (r - 1) * UNIT_GAP]
}

// The window size classes of Material 3 (m3.material.io, Foundations > Layout > Window size classes): compact < 600 dp, medium 600-839, expanded 840-1199, large 1200-1599,
// extra-large 1600 and up. Apple's horizontal size class is compact on a phone in portrait and regular on an iPad full screen: compact here, regular from medium on.
// The class is read from the WINDOW's width (not the content's, which a scroll bar changes by its own width and would make a size flip back and forth at a boundary).
export const WINDOW_CLASSES = Object.freeze(['compact', 'medium', 'expanded', 'large', 'extra'])
const CLASS_FROM = { medium: 600, expanded: 840, large: 1200, extra: 1600 }
export function windowClassOf(width) {
  return width >= CLASS_FROM.extra ? 'extra' : width >= CLASS_FROM.large ? 'large' : width >= CLASS_FROM.expanded ? 'expanded' : width >= CLASS_FROM.medium ? 'medium' : 'compact'
}
// The largest size of each class: a phone has two columns (a 大 or 特大 would fill the screen and hide everything else: 中, the width of the phone), a tablet four to six
// (特大 would be a whole row: 大 instead), a desktop all of them. A tile whose content needs more than its class's largest (its minimum is above it) keeps its minimum.
// 特大竖 needs four units of height and the window chrome: from medium on, and only in a window that tall.
const CLASS_TOP = { compact: 'm', medium: 'l', expanded: 'l', large: 'xl', extra: 'xl' }
export const XLP_MIN_HEIGHT = 4 * UNIT_PX + 3 * UNIT_GAP + 180

// The box of each size in the grid the packer draws today (columns of eight, a row height per class), until it works in square units (SIZE_UNITS): one box per size name.
export const SIZE_BOX = Object.freeze({ s: Object.freeze([2, 1]), m: Object.freeze([4, 1]), l: Object.freeze([4, 2]), xl: Object.freeze([8, 2]), xlp: Object.freeze([4, 4]) })
/** The declared sizes of the tiles that have a declaration, as boxes (homeRanges.js is the source): { id: { sizes: { key: box }, size } }. */
export const SIZE_TABLE = Object.freeze(Object.fromEntries(Object.keys(TILE_RANGES).map((id) => {
  const r = TILE_RANGES[id]
  const keys = r.min ? ['s', 'm', 'l', 'xl'].filter((k) => RANK[k] >= RANK[r.min] && RANK[k] <= RANK[r.max]) : []
  const sizes = Object.fromEntries([...keys.map((k) => [k, SIZE_BOX[k]]), ...(r.strip ? [['strip', Object.freeze([r.strip, 1])]] : [])])
  return [id, Object.freeze({ sizes, size: r.size && sizes[r.size] ? r.size : Object.keys(sizes)[0] })]
})))
/** The key a tile's view is drawn for: the size itself (特大 has views of its own; a tile without one does not offer it). */
export const viewKeyOf = (key) => key

// The number of rows or items a list-like tile has now (null: not a list). A list shows many rows: with a few it is a tall card with a few lines, so what it offers follows its data.
const itemsOf = (meta) => {
  const d = meta?.data
  if (!d || typeof d !== 'object') return null
  if (meta.kind === 'table') return d.tabs?.[0]?.rows?.length ?? null
  if (meta.kind === 'apps') return d.items?.length ?? d.count ?? null
  if (d.type === 'news' && d.quiet) return null
  if (['clients', 'covers', 'apps', 'news'].includes(d.type)) return d.items?.length ?? null
  if (d.type === 'lines') return d.rows?.length ?? null
  return null
}
/** The largest size the tile's data fills now (before its range and the window): nothing yet is the smallest, a list of under five rows stops at 中. */
export function largestOf(id, meta = {}) {
  if (hasNoData(meta?.data) || itemsOf(meta) === 0) return 's'
  if (meta?.data?.type === 'rows' && !meta.data.big && (meta.data.rows?.length ?? 0) <= 1) return 's'
  // 资讯 with a post: its hero (the banner, or the generated gradient / 薇薇) fills the large tile whatever the number of posts; the list under it is as long as the list is
  if (meta?.data?.type === 'news' && !meta.data.quiet && itemsOf(meta) >= 1) return 'xl'
  const n = itemsOf(meta)
  // 远程访问 has two paths at most (public, mesh): its 中 is those rows, so the count of rows does not hold it at 方形
  if (id === 'reach' && n >= 1) return 'm'
  // one or two items: the square says them (the count and the first); a few more: 中
  if (n !== null && n < 3) return 's'
  if (n !== null && n < 5) return 'm'
  const d = meta?.data
  // 特大 shows more than 大 only with the data it adds: more covers than the eight of 大, the facts of the host beyond 大's, the lines of the log beside the errors
  if (d?.type === 'covers' && n !== null && n <= 8) return 'l'
  // a curve's 大 adds the lowest, mean and highest of its samples and the facts of the hardware: with neither (one sample, no system information) it would only be a taller chart
  // A curve that has its value now (a stream runs, the host reports the load) is not held at 中 for want of a second sample: the tile would grow by itself when the next poll came, a few seconds after it was drawn.
  if (meta?.kind === 'curve' && !(d?.facts?.length) && (d?.points?.length || 0) < 2 && !(d?.value !== undefined && d.value !== '')) return 'm'
  if (meta?.kind === 'hero' && Array.isArray(d?.facts) && !d.facts.some((f) => f.tier === 'xl')) return 'l'
  if (d?.type === 'bars' && Array.isArray(d.lines)) return d.lines.length > 3 ? 'xl' : d.lines.length ? 'l' : 'm'
  if (d?.type === 'clients' && Array.isArray(d.items) && !d.items.some((c) => c.time && c.time !== '–')) return 'l'
  return 'xl'
}

/**
 * The sizes a tile offers in a window class (default: large, a desktop), smallest first: the ladder from its minimum to its maximum (its own range for the class when it declares
 * one), no larger than its data fills or the class allows; the strip when it has one. A tile whose data is empty offers its minimum only (the empty strip), whatever was chosen.
 */
export function offeredOf(id, meta = {}, cls = 'large', height = Infinity) {
  const r = rangeOf(id, meta)
  // a banner (the first pairing's flow) is the width of the row and as tall as its content in every class: the packer draws it so, it is not a step of the ladder
  if (r.banner) return [r.max]
  const [min, max] = r.classes?.[cls] || [r.min, r.max]
  const out = []
  if (min) {
    const data = RANK[largestOf(id, meta)]
    const top = Math.max(RANK[min], Math.min(RANK[max], RANK[CLASS_TOP[cls] || 'xl'], data))
    for (const k of ['s', 'm', 'l', 'xl']) if (RANK[k] >= RANK[min] && RANK[k] <= top) out.push(k)
    if (r.portrait && cls !== 'compact' && height >= XLP_MIN_HEIGHT && data >= RANK.xl) out.push('xlp')
  }
  if (r.strip) out.push('strip')
  return out
}
/** The tile's default size: its declaration's, else its smallest. */
const defaultOf = (id, meta, offered) => { const d = rangeOf(id, meta).size; return offered.includes(d) ? d : offered[0] }

/** { sizes: { key: box }, size: default } of a tile (the boxes of the grid of today, see SIZE_BOX). */
export function sizesOf(id, meta = {}, cls = 'large', height = Infinity) {
  const offered = offeredOf(id, meta, cls, height)
  const strip = rangeOf(id, meta).strip || 4
  const sizes = Object.fromEntries(offered.map((k) => [k, k === 'strip' ? Object.freeze([strip, 1]) : SIZE_BOX[k]]))
  return { sizes, size: defaultOf(id, meta, offered) }
}
/** Whether the tile has a layout of its own at this size: the size is in its declared range. */
export const hasOwnLayout = (id, meta, key) => { const r = rangeOf(id, meta); return key === 'strip' ? !!r.strip : !!r.min && RANK[key] >= RANK[r.min] && RANK[key] <= RANK[r.max] }

/**
 * The size a tile is drawn at: the preference when the tile offers it, else the nearest offered size below it (a size the tile no longer has, or one the window has no room for,
 * falls back to the largest one left), else its smallest; no preference: its default. A pure function of its inputs: the same window always draws the same layout.
 */
export function sizeKeyOf(id, meta, chosen, cls = 'large', height = Infinity) {
  const offered = offeredOf(id, meta, cls, height)
  if (!offered.length) return 's'
  if (chosen && offered.includes(chosen)) return chosen
  if (chosen === 'strip' || !(chosen in RANK)) return defaultOf(id, meta, offered)
  // a tile that has a strip: a size above its ladder was its control row in the builds before the ladder (the gamepad type at M), so it is the strip
  const r = rangeOf(id, meta)
  if (r.strip && offered.includes('strip') && (!r.max || RANK[chosen] > RANK[r.max])) return 'strip'
  const ladder = offered.filter((k) => k !== 'strip' && k !== 'xlp')
  if (!ladder.length) return offered[0]
  const below = ladder.filter((k) => RANK[k] <= RANK[chosen])
  return below.length ? below[below.length - 1] : ladder[0]
}
/**
 * effectiveSize(tile, chosen, windowClass, mode): the size drawn. `tile` is the card ({ id, data, ... }); `chosen` the saved preference (manual) or the smart plan's size for
 * the class (smart, homeSmart.js); `windowClass` from `windowClassOf`; `height` the window's, for 特大竖.
 */
export function effectiveSize(tile, chosen, windowClass = 'large', mode = 'manual', { height = Infinity } = {}) {
  void mode // the same clamp in both modes: smart mode differs in what it chooses, not in what a class allows
  return sizeKeyOf(tile.id, tile, chosen, windowClass, height)
}

// The cards whose small view is not the square of homeSmall.js: none. The square (方形) is one view for every tile, in the grid and in the dock (MDashSmall, square).
export const genericAtS = (meta) => !!(meta?.kind || meta?.data)

/**
 * The window's size class: compact under 600 wide (a phone), extra-wide from 1600 or when the window is wider than about 2.1 : 1 (an ultrawide
 * screen), else medium (medium and expanded show the saved sizes).
 */
export function sizeClassOf(width, height = 0) {
  if (width < 600) return 'compact'
  if (width >= 1600 || (height > 0 && width / height > 2.1)) return 'extra'
  return 'medium'
}

export const TILE_MODES = Object.freeze(['auto', 'fixed'])
export const TILE_DENSITIES = Object.freeze(['smaller', 'standard', 'larger'])

/**
 * How many sizes every tile is moved from its saved size when it is drawn (the saved layout itself never changes). Adaptive (the default): one
 * smaller in a compact window, one larger in an extra-wide one; fixed: none. The density step (smaller, standard, larger) adds one either way.
 */
export function sizeShift({ sizeClass = 'medium', tiles = 'auto', density = 'standard' } = {}) {
  const adaptive = tiles === 'fixed' ? 0 : { compact: -1, extra: 1 }[sizeClass] || 0
  const step = { smaller: -1, larger: 1 }[density] || 0
  return Math.max(-2, Math.min(2, adaptive + step))
}

/** The size a card is drawn at: the saved one moved by `shift` sizes, limited to the sizes the card offers (the nearest one on the way back). */
export function shownSizeKey(id, meta, chosen, shift = 0) {
  const { sizes } = sizesOf(id, meta)
  const saved = sizeKeyOf(id, meta, chosen)
  // a strip (the gamepad type, the microphone) is one slim row whatever the window: its options stay in reach, a shift does not turn it into a square
  if (!shift || saved === 'strip') return saved
  const from = SIZE_KEYS.indexOf(saved)
  // a shift (the adaptive size of a wide window, the density, a promotion) never reaches XL: that size is only the person's choice
  const top = Math.max(from, SIZE_KEYS.indexOf('l'))
  const to = Math.max(0, Math.min(top, from + shift))
  for (let i = to; i !== from; i += from > to ? 1 : -1) if (sizes[SIZE_KEYS[i]]) return SIZE_KEYS[i]
  return saved
}

/** The grid of the home for a container width: its mode and its columns (eight units wide; four in the middle and in a narrow window, where a small tile is half the width and two of them sit side by side). */
export function gridModeOf(width) {
  const mode = width >= 860 ? 'wide' : width >= 640 ? 'mid' : 'narrow'
  return { mode, units: { wide: 8, mid: 4, narrow: 4 }[mode] }
}

/** A card whose data holds nothing yet (a list without rows, no covers, no clients, no big value): at small and medium it is a slim strip with its empty text, not a tall tile with a sentence in it. */
export function hasNoData(d) {
  if (!d || typeof d !== 'object') return false
  switch (d.type) {
    case 'rows': return !d.big && !(d.rows && d.rows.length)
    case 'apps': case 'covers': case 'clients': return !(d.items && d.items.length)
    case 'lines': return !(d.rows && d.rows.length)
    // 最近操作 with no setting used yet says so in its smallest size, at the end
    case 'recent': return !(d.rows && d.rows.length)
    case 'news': return !d.quiet && !(d.items && d.items.length)
    // the public address not set: the card's point (the address clients reach) is missing; its smallest size says 未设置 and leads to setting it
    case 'address': return !d.saved && (!d.view || d.view.state === 'unset')
    default: return false
  }
}

// the widget kinds of the catalogue with a short content (a value and a few rows, chips, a control, a few covers): their tiles take the tile row height
// (the content sets it) instead of the 190 px card row, which would leave most of the tile empty
const COMPACT_TYPES = new Set(['rows', 'apps', 'chips', 'control', 'appearance', 'tip', 'vivi', 'pair', 'covers', 'lines', 'heat', 'clients', 'now'])

/**
 * { span, rows, cls } of a card at a size (`shift` moves every card by that many sizes, see sizeShift). The generic small tile (icon and one value) is a
 * slim strip, not a tall card with a lot of empty space: it takes the strip row height instead of its own class.
 */
/**
 * A span of the table (in the units of an eight column grid) for a grid of `units` columns: a small tile stays two columns and a medium one four; a large one of the whole
 * width (8) is the whole width up to nine columns and six columns (about 960 px) beyond: a tile of a size never grows past its cap, a wide window has more columns instead.
 */
export const spanFor = (base, units) => (base >= 8 ? (units <= 9 ? Math.min(base, units) : 6) : Math.min(base, units))
/** The most columns a tile of a size may take: one more than its own for a small and a medium tile (they share a short row), exactly its own for a large one. */
export const maxSpanOf = (key, span, units) => (key === 'l' || key === 'xl' ? span : Math.min(units, span + 1))

export function boxOf(id, meta, chosen, shift = 0, units = 8) {
  const { sizes } = sizesOf(id, meta)
  const key = shownSizeKey(id, meta, chosen, shift)
  let [span, rows] = sizes[key]
  const compact = COMPACT_TYPES.has(meta.data?.type) && (meta.cls === 'card' || (meta.cls === 'hero' && key === 's'))
  const empty = (key === 's' || key === 'm') && hasNoData(meta.data)
  const wideDetail = key === 'l' && !hasOwnLayout(id, meta, 'l') && meta.hasDetail
  // the grid of row classes (until the packer draws square units): a 方形 of a tile whose class is a strip (an action, a switch) stays in the slim strip row
  // and a tile with nothing to show yet is a slim strip with its empty text (an icon and one line), not a tall tile with a sentence in it
  const cls = key === 'strip' || (key === 's' && meta.cls === 'strip') || empty ? 'strip' : wideDetail ? 'list' : empty || key === 's' ? 'tile' : compact ? 'tile' : meta.cls === 'strip' ? 'card' : meta.cls
  span = spanFor(span, units)
  const max = maxSpanOf(key, span, units)
  return cls ? { span, rows, cls, max } : { span, rows, max }
}

/** Next size in the offered ones (wraps round); `step` is 1 or -1. */
export function nextSize(id, meta, current, step = 1) {
  const keys = ALL_SIZE_KEYS.filter((k) => sizesOf(id, meta).sizes[k])
  if (keys.length < 2) return current
  const i = keys.indexOf(sizeKeyOf(id, meta, current))
  return keys[(i + step + keys.length) % keys.length]
}
