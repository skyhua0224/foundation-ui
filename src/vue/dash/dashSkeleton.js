import { STRIP_PX } from '../homeSizes.js'

/**
 * dashSkeleton: the home grid before its tiles are there. The last arrangement the page drew is kept (per storage key); the skeleton draws it again, tile for tile, at the
 * size each tile will have, so nothing moves when the tiles arrive. Without a kept arrangement (the first start, another window width) it draws a plausible one at the
 * column count of the window.
 */
const KEY = 'foundation-ui.dash-skeleton.'
// the first-start arrangement: the plan a new user gets (homeSmart.js NEW), as the page lays it out when measured at 1440 px: the journey large, two medium tiles, five small ones, and the guide
// as a strip across the whole width under them. The tiles are packed by the columns of the window (a size wider than the window is clipped to it); the strip takes the row after them.
const FIRST_START = Object.freeze([[2, 2], [2, 1], [2, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1]])
const firstStart = (columns) => FIRST_START.map(([c, r]) => [Math.min(c, columns), r])

/** the arrangement on the page as a plain object, or null while it has no tiles. `top` is the height (px, margin included) of the card above the grid (the star, the recommendation) the page had: the skeleton keeps its place. */
export function snapshotOf({ blocks, cellStyle, sectioned, width, top = 0 }) {
  const out = blocks.filter((b) => b.boxed.length).map((b) => ({
    units: b.units, width: b.width || 0, template: b.template || '', natural: b.natural || 0,
    cells: b.boxed.map((c) => ({ style: cellStyle(b, c.id), cls: c.cls || 'unit', big: (c.span || 1) * (c.rows || 1) >= 4 })),
  }))
  return out.length ? { sectioned: !!sectioned, width, top: Math.max(0, Math.round(top)), blocks: out } : null
}

export function readSkeleton(storageKey) {
  try { const v = JSON.parse(localStorage.getItem(KEY + storageKey) || 'null'); return v && Array.isArray(v.blocks) ? v : null } catch { return null }
}
export function writeSkeleton(storageKey, snap) {
  try { const s = JSON.stringify(snap); if (localStorage.getItem(KEY + storageKey) !== s) localStorage.setItem(KEY + storageKey, s) } catch { /* storage unavailable */ }
}

/** the template of rows with the pixel side of a square unit put back: a ladder row is one unit, a strip row STRIP_PX, the banner row its own minimum */
const retemplate = (template, unit) => template.split(/\s+(?![^(]*\))/).filter(Boolean).map((t) => (t.startsWith('minmax(') || t === `${STRIP_PX}px` ? t : `${unit}px`)).join(' ')

/**
 * What to draw: the kept arrangement when it was made for the same kind of window (sections or not, the same width of the page for sections, the same column count for the
 * single grid), else the first-start arrangement. `columnsOf(w)` gives { columns, unit } for a width.
 */
const fits = (saved, { sectioned, width, columnsOf, sectionCount = 1 }) => !!saved && saved.sectioned === !!sectioned && (sectioned ? saved.blocks.length === sectionCount && Math.abs(saved.width - width) < 2 : saved.blocks.length === 1 && saved.blocks[0].units === columnsOf(width).columns)

/** The height the card above the grid had in the kept arrangement (0: none, or no kept arrangement for this kind of window): the skeleton leaves its place free, so the tiles do not move down when the card comes. */
export const skeletonTop = (saved, opts) => (fits(saved, opts) ? saved.top || 0 : 0)

export function skeletonOf(saved, { sectioned, width, columnsOf, sectionCount = 1 }) {
  const here = columnsOf(width)
  const ok = fits(saved, { sectioned, width, columnsOf, sectionCount })
  if (ok) return saved.blocks.map((b, i) => { const u = columnsOf(b.width || width).unit; return { key: i, width: b.width, unit: u, units: b.units, template: b.template ? retemplate(b.template, u) : '', autoRows: `${u}px`, natural: b.natural || 0, cells: b.cells } })
  const tiles = firstStart(here.columns)
  const rows = Math.max(2, Math.ceil(tiles.reduce((a, [c, r]) => a + c * r, 0) / here.columns))
  const cells = tiles.map(([c, r]) => ({ style: { gridColumn: `span ${c}`, gridRow: `span ${r}` }, cls: 'unit', big: c * r >= 4 }))
  cells.push({ style: { gridColumn: '1 / -1', gridRow: `${rows + 1}` }, cls: 'strip', big: false })
  return [{ key: 0, width: 0, unit: here.unit, units: here.columns, template: `${here.unit}px `.repeat(rows) + `${STRIP_PX}px`, autoRows: `${here.unit}px`, natural: 0, cells }]
}
