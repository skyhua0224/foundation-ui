// Fitting the cards of the home into the width of a window without stretching any of them. Pure functions (no Vue, no DOM).
//
// A tile has a size (S, M, L) and every size has a cap: a tile never grows beyond it. So a wide window does not get wider tiles, it gets more columns (about one per 160 px);
// the packer fills the rows with tiles at sizes up to their caps; when that still leaves a row short, the number of columns is tried again, then (smart mode) the most important
// tiles are promoted one size, then suggested tiles from the catalogue are added as ghosts; what is still short is centred, never stretched.
//
// Above about 2560 css px, or when the window is wider than 2.1 : 1, the dashboard is a row of sections side by side, each its own grid of at most `SECTION_MAX` px.
import { packDash } from './homePack.js'

export const UNIT_PX = 160 // the width of a column the grid aims at (a small tile is two of them: 320 px; the least a small tile is is about 200 x 100)
export const GAP = 14
export const SECTION_MIN = 880
export const SECTION_MAX = 1000
export const SECTION_GAP = 28
/** The estimated height of a packed grid in px: the row heights of its classes plus the gaps (`rowPx(cls)`). */
export function heightOf(packed, rowPx, gap = GAP) {
  const rows = packed.rows
  return rows.reduce((n, r) => n + rowPx(r.cls), 0) + gap * Math.max(0, rows.length - 1)
}
export const MIN_UNITS = 8
export const MAX_UNITS = 24
export const ULTRAWIDE = 2.1
export const SECTIONS_FROM = 2560
/** The widest a tile of a size may be in css px: a small tile about 460, a medium one 780, a large one 1060 (or the whole grid while it has nine columns or fewer). */
export const CAPS_PX = Object.freeze({ s: 460, m: 780, l: 1060 })

/** The columns a grid of `width` px has: about one per UNIT_PX, at least eight (a window narrower than 860 px has its own modes). */
export const unitsFor = (width) => Math.max(MIN_UNITS, Math.min(MAX_UNITS, Math.floor((width + GAP) / (UNIT_PX + GAP))))

/** Whether the window shows the dashboard as sections: wider than 2560 css px, or wider than 2.1 : 1. */
// The sections were the answer to a grid wider than the catalogue could fill; the grid now has at most MAX_COLUMNS columns of the fixed unit, centred, so a very wide or ultrawide window is the same grid with wider margins.
export const sectionedOf = () => false

/** How many sections stand side by side in `width` px, and how wide each is (capped). */
export function sectionLayout(width) {
  const across = Math.max(1, Math.floor((width + SECTION_GAP) / (SECTION_MIN + SECTION_GAP)))
  const each = Math.min(SECTION_MAX, Math.floor((width - SECTION_GAP * (across - 1)) / across))
  return { across, width: each }
}

/** The share of the grid that stays empty after packing, and the emptiest row: { ratio, worst, rows }. Cells of two rows count in both. */
export function emptiness(packed, units) {
  const used = []
  for (const p of packed.placed.values()) for (let r = p.row; r < p.row + p.rows; r++) used[r] = (used[r] || 0) + p.span
  const rows = used.length
  if (!rows) return { ratio: 0, worst: 0, rows: 0 }
  let free = 0, worst = 0
  for (let r = 0; r < rows; r++) { const f = Math.max(0, units - (used[r] || 0)); free += f; worst = Math.max(worst, f / units) }
  return { ratio: free / (rows * units), worst, rows }
}

/**
 * Pack `cards` into the most complete grid for `width`: every number of columns the width allows is tried (each card is boxed again for it), the one that leaves the least
 * empty wins, the wider on a tie. `box(card, units, lift)` gives { span, rows, cls, max } of a card; `lift` is how many sizes it is promoted by (0 or 1).
 * `options.promote` (smart mode): promote the cards with the highest `priority` where a row is short. `options.ghosts`: boxed candidates that may fill what is still short.
 * Returns { units, boxed, packed, ratio, worst, lifted: Set, ghosts: [ids] }.
 */
export function fitDash(cards, width, box, { units: fixed = 0, caps = true, target = null, promote = false, priority = () => 0, ghosts = [], minUnits = MIN_UNITS, maxUnits = 0, pack = {}, maxHole = 0 } = {}) {
  // the widest tile of a candidate, against the cap of its size: a grid of too few columns would make its tiles too wide, however full it is
  // (a bar has no cap in pixels: it takes the width the row has)
  const overCap = (boxed, u) => {
    const grid = Math.min(width, u * (UNIT_PX + 20) + (u - 1) * GAP)
    const col = (grid - (u - 1) * GAP) / u
    return boxed.some((c) => { const key = c.size; if (!key || !CAPS_PX[key] || c.cls === 'strip') return false; const px = c.span * col + (c.span - 1) * GAP; return px > (key === 'l' && u <= 9 ? grid + 1 : CAPS_PX[key]) })
  }
  const tryUnits = (u, list, lift) => {
    const col = (Math.min(width, u * (UNIT_PX + 20) + (u - 1) * GAP) - (u - 1) * GAP) / u
    // a tile may not grow into more columns than its cap in pixels allows at this column width
    const boxed = list.map((c) => {
      const b = { ...c, ...box(c, u, lift.get(c.id) || 0) }
      if (b.cls === 'strip') b.max = u // a bar grows to what is left of its row, so a row of bars has no hole
      else if (caps && b.size && b.size !== 'l' && CAPS_PX[b.size]) b.max = Math.max(b.span, Math.min(b.max ?? b.span, Math.floor((CAPS_PX[b.size] + GAP) / (col + GAP))))
      return b
    })
    const packed = packDash(boxed, u, pack)
    return { units: u, boxed, packed, ...emptiness(packed, u), over: caps && overCap(boxed, u) }
  }
  // a candidate within the caps beats one that is over them; then the emptier one
  // a candidate is good enough when it is within the caps, at most a tenth empty and no row more than a quarter empty
  // `maxHole` (columns): no row is short by more than that (a grid of square units has no stretching to close a hole)
  const good = (t) => !t.over && t.ratio <= 0.1 && t.worst <= 0.2 && (!maxHole || t.worst * t.units <= maxHole + 1e-9)
  const better = (a, b) => (a.over !== b.over ? !a.over : a.ratio < b.ratio - 1e-9 || (Math.abs(a.ratio - b.ratio) <= 1e-9 && a.worst < b.worst - 1e-9))
  const range = fixed ? [fixed] : []
  if (!fixed) for (let u = Math.min(maxUnits || MAX_UNITS, Math.max(unitsFor(width), minUnits)); u >= minUnits; u--) range.push(u)
  // smart mode: from a candidate, a card goes one size up or down while the grid gets fuller (within the caps); the most important cards are tried first
  const order = [...cards].sort((a, b) => priority(b) - priority(a))
  const improve = (start) => {
    let cur = start
    const lift = new Map()
    for (let round = 0; round < 12 && !good(cur); round++) {
      let step = null
      for (const c of order) for (const d of [1, -1]) {
        const now = lift.get(c.id) || 0
        if (now + d > 2 || now + d < -2) continue
        const t = tryUnits(cur.units, cards, new Map([...lift, [c.id, now + d]]))
        if (better(t, step || cur)) step = { ...t, id: c.id, to: now + d }
      }
      if (!step) break
      lift.set(step.id, step.to); cur = step
    }
    return { cur, lift }
  }
  // from a candidate: the smart promotions, then suggested tiles (ghosts) where it is still short
  const complete = (t0, u) => {
    let t = t0, l = new Map(), list = cards
    if (promote && !good(t)) ({ cur: t, lift: l } = improve(t))
    const added = []
    if (!good(t) && ghosts.length) {
      for (const g of ghosts) {
        if ((good(t) && t.ratio <= 0.04) || added.length >= 14) break
        const t2 = tryUnits(u, [...list, g], l)
        if (better(t2, t)) { list = [...list, g]; added.push(g.id); t = t2 }
      }
    }
    return { t, l, added }
  }
  // the most columns that leave at most a tenth empty (the grid then fills the window); else the fullest one
  let best = null
  let lift = new Map()
  let added = []
  const trace = []
  for (const u of range) {
    const t0 = tryUnits(u, cards, new Map())
    const { t, l, added: g } = complete(t0, u)
    trace.push({ u, before: +t0.ratio.toFixed(2), after: +t.ratio.toFixed(2), over: t.over, ghosts: g.length })
    if (good(t)) { best = t; lift = l; added = g; break }
    if (!best || better(t, best)) { best = t; lift = l; added = g }
  }
  // the second dimension (smart mode, sections): below the target height the key tiles go a size up within their caps, and only when that runs out are suggested tiles added.
  // A promotion must leave every row complete; ghosts are added one at a time (the row they start may be short until the next one) and the last state in which every row is
  // complete is the one kept; a section never grows past the largest height
  if (target && best.packed) {
    let list = [...cards, ...ghosts.filter((g) => added.includes(g.id))]
    const hOf = (t) => heightOf(t.packed, target.rowPx, target.gap)
    let kept = { best, list, added: [...added], lift: new Map(lift) }
    for (let guard = 0; guard < 40; guard++) {
      if (good(best)) kept = { best, list, added: [...added], lift: new Map(lift) }
      if (hOf(best) >= target.min && good(best)) break
      let pick = null
      for (const c of order) {
        const now = lift.get(c.id) || 0
        if (now >= 2) continue
        const t = tryUnits(best.units, list, new Map([...lift, [c.id, now + 1]]))
        if (!t.over && good(t) && hOf(t) > hOf(best) && hOf(t) <= target.max) { pick = { t, id: c.id, to: now + 1 }; break }
      }
      if (pick) { lift.set(pick.id, pick.to); best = pick.t; continue }
      if (added.length >= (target.maxGhosts ?? 99)) break
      let g = null
      for (const gc of ghosts) {
        if (list.includes(gc) || added.includes(gc.id)) continue
        const t = tryUnits(best.units, [...list, gc], lift)
        if (t.over || hOf(t) > target.max) continue
        if (!g || t.ratio < g.t.ratio - 1e-9) g = { t, gc }
      }
      if (!g) break
      list = [...list, g.gc]; added.push(g.gc.id); best = g.t
    }
    if (!good(best)) { best = kept.best; list = kept.list; lift.clear(); for (const [k, v] of kept.lift) lift.set(k, v); added.length = 0; added.push(...kept.added) }
    // still short somewhere: the suggestions added last go again, one by one, until the rows are complete
    while (!good(best) && added.length && added.length > kept.added.length - 1) {
      const last = added.pop()
      list = list.filter((x) => x.id !== last)
      best = tryUnits(best.units, list, lift)
    }
  }
  return { ...best, trace, lifted: new Set([...lift].filter(([, v]) => v).map(([id]) => id)), ghosts: added }
}
