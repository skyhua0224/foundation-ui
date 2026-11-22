import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { fitDash, heightOf, sectionLayout, sectionedOf } from '../homeFit.js'
import { packDash } from '../homePack.js'
import { PURPOSES, fillOrder, purposeOf, sectionIndexOf, suggestions } from '../homeSmart.js'
import { clientInUse, clientRecommendation, markClientRec, readClientRec } from '../clientPrompt.js'
import { starClientInUse } from '../starCard.js'
import { slotAhead, slotEnter, slotLeave } from '../promptSlot.js'
import { UNIT_GAP, gridWidthOf, hasNoData, missingInRow, sizesOf } from '../homeSizes.js'
import { effectiveClockSize } from '../../appearance/appearance.js'

/** dashDock: one part of the home overview's setup (MHomeDash.vue); D is the shared scope of the parts, in the order they are made. */
export function useDashDock(D) {
  const { T, allCards, appearance, boxFor, cardById, dockLayout, edit, emit, ghostCards, gridOf, layout, mode, plan, priority, props, replan, rowPxIn, smart, tall, trackTemplate, usage, visibleCards, wide, width, windowClass } = D
  // ---- sections: from 2560 css px or wider than 2.1 : 1 the overview is a row of sections, each its own grid of at most 1000 px
  const rootTop = ref(140)
  // where the grid starts in the window (below the banner), measured: the free height of the smart overview is what is left under it
  const blocksTop = ref(0)
  const measureTop = () => {
    const el = D.root?.value?.querySelector?.('.m-dash__blocks'); if (!el) return
    const sc = el.closest('.m-scene__pane, .m-scene')
    // a card above the grid that is opening or closing: the grid is measured where it will stand when the card has its final height, not where the animation has it in this frame (the fill is laid out once, for the final room)
    const above = D.root?.value?.querySelector(':scope > .m-sprompt')
    const t = Math.round(el.getBoundingClientRect().top + (sc?.scrollTop || 0) + slotAhead(above))
    if (Math.abs(t - blocksTop.value) > 2) blocksTop.value = t
  }
  onMounted(() => nextTick(measureTop))
  // the card at the top opens or closes: the room under it changes by its final height at once, whatever frame the animation is in
  const slotIn = (el, done) => { slotEnter(el, done); measureTop() }
  const slotOut = (el, done) => { slotLeave(el, done); measureTop() }
  // the fill is part of the first drawn plan: the tiles of the plan and the ones that fill around them are laid out in the same frame, as soon as the product knows what decides the page (ctx.pending, the
  // skeleton stands until then). A timer here drew half a screen of tiles for 1.2 s on every visit and then added the rest. The tiles it takes are the ones that
  // have data when the page is drawn; a tile whose data arrives later is added after them and never moves the plan's tiles (fillMemory).
  const fillReady = computed(() => !props.ctx.pending)
  // the tiles taken to fill, in the order they were taken: a later fit takes them first and in the same order, so a tile that arrives or a row that is added puts its tiles after them
  let fillMemory = { scenario: '', ids: [] }
  const availH = computed(() => Math.max(420, tall.value - rootTop.value - 16))
  const sectioned = computed(() => mode.value === 'wide' && sectionedOf(wide.value, tall.value))
  const across = computed(() => sectionLayout(width.value).across)
  const sectionCount = computed(() => (!smart.value && layout.state.sectionCount ? layout.state.sectionCount : Math.min(PURPOSES.length, across.value)))
  const sectionOfCard = (c) => { const manual = layout.state.sectionOf[c.id]; return Number.isInteger(manual) && !smart.value ? Math.min(manual, sectionCount.value - 1) : sectionIndexOf(purposeOf(c.id, c.group), sectionCount.value) }
  const SECTION_TITLES = computed(() => ({ 0: T.value.secLive, 1: T.value.secControls, 2: T.value.secClients, 3: T.value.secSystem }))
  // Empty slots of the window are filled with more real tiles at their standard sizes (never by stretching a tile or giving a cell to a neighbour): the catalogue's tiles that have data, in the order of fillOrder
  // for the state, each at the smallest standard size it offers. A tile is taken when the packer puts it into a free place and the grid stays inside `rows` rows; the list is walked again until no
  // slot of those rows is free or no tile fits (a lone cell takes a 1 x 1). The tiles already placed never move: a tile is only added after them.
  const fillCards = computed(() => {
    if (!smart.value) return []
    const onPage = new Set(visibleCards.value.map((c) => c.id))
    const named = new Set(visibleCards.value.map((c) => String(c.title || '').trim().toLowerCase()))
    const out = []
    for (const id of fillOrder(plan.value.scenario, allCards.value.map((c) => c.id))) {
      const c = cardById.value.get(id)
      if (!c || c.available === false || onPage.has(id) || c.kind === 'stack' || ['strip', 'journey'].includes(c.cls) || id === 'hero' || id === 'table' || hasNoData(c.data)) continue
      if (layout.state.hiddenSuggest.includes(id)) continue
      const name = String(c.title || '').trim().toLowerCase()
      if (name && named.has(name)) continue
      const offered = ['s', 'm', 'l'].filter((k) => sizesOf(c.id, c, windowClass.value, tall.value).sizes[k])
      if (!offered.length) continue
      named.add(name)
      out.push({ ...c, fillSize: offered[0] })
    }
    return out
  })
  // The last resort for a hole: a tile with nothing to show yet (it says so, with the action that gives it something: 添加应用, 开始串流), at its smallest size when that is the square. It comes after every tile with data, so the page is
  // never left with an empty standard slot while the catalogue still has a tile that offers one (a phone's last row used to end with a lone tile and a hole beside it).
  const fillCardsEmpty = computed(() => {
    if (!smart.value) return []
    const onPage = new Set(visibleCards.value.map((c) => c.id))
    const named = new Set(visibleCards.value.map((c) => String(c.title || '').trim().toLowerCase()))
    const out = []
    for (const id of fillOrder(plan.value.scenario, allCards.value.map((c) => c.id))) {
      const c = cardById.value.get(id)
      if (!c || c.available === false || onPage.has(id) || c.kind === 'stack' || ['strip', 'journey'].includes(c.cls) || id === 'hero' || id === 'table' || !hasNoData(c.data)) continue
      if (layout.state.hiddenSuggest.includes(id)) continue
      const name = String(c.title || '').trim().toLowerCase()
      if (name && named.has(name)) continue
      if (!sizesOf(c.id, c, windowClass.value, tall.value).sizes.s) continue
      named.add(name)
      out.push({ ...c, fillSize: 's' })
    }
    return out
  })
  // the free standard slots of the rows that fit under `max` px (a slim strip row is one row of its own height, and is full); rows below the last placed one count as free
  const freeCells = (packed, units, unit, max) => {
    const used = new Set()
    for (const p of packed.placed.values()) for (let r = p.row; r < p.row + p.rows; r++) for (let x = p.col; x < p.col + p.span; x++) used.add(r * units + x)
    const rowPx = rowPxIn(unit)
    let free = 0, y = 0
    for (let r = 0; ; r++) {
      const cls = r < packed.rows.length ? packed.rows[r].cls : 'unit'
      const rh = rowPx(cls)
      if (y + rh > max + 0.5) break
      if (cls === 'unit') for (let x = 0; x < units; x++) if (!used.has(r * units + x)) free++
      y += rh + UNIT_GAP
    }
    return free
  }
  const fillGrid = (boxed0, packed0, units, unit, fill) => {
    let boxed = boxed0, packed = packed0
    if (freeCells(packed, units, unit, fill.max) === 0) return { boxed, packed }
    const scenario = plan.value.scenario
    if (fillMemory.scenario !== scenario) fillMemory = { scenario, ids: [] }
    const pool = fill.pool || fillCards.value
    const byId = new Map(pool.map((c) => [c.id, c]))
    const ordered = [...fillMemory.ids.filter((id) => byId.has(id)).map((id) => byId.get(id)), ...pool.filter((c) => !fillMemory.ids.includes(c.id))]
    const taken = []
    for (let pass = 0; pass < 8; pass++) {
      let took = false
      for (const c of ordered) {
        if (boxed.some((x) => x.id === c.id)) continue
        const bx = { ...c, ...boxFor(c, units) }
        const p = packDash([...boxed, bx], units, { dense: true, exact: true })
        if (heightOf(p, rowPxIn(unit), UNIT_GAP) > fill.max) continue
        boxed = [...boxed, bx]; packed = p; took = true; taken.push(c.id)
        if (freeCells(packed, units, unit, fill.max) === 0) { fillMemory = { scenario, ids: taken }; return { boxed, packed } }
      }
      if (!took) break
    }
    fillMemory = { scenario, ids: taken }
    return { boxed, packed }
  }
  // the empty standard cells inside the rows a plan occupies (the rows below the last tile are not part of the grid)
  const holesOf = (packed, units) => {
    const used = new Set()
    for (const p of packed.placed.values()) for (let r = p.row; r < p.row + p.rows; r++) for (let x = p.col; x < p.col + p.span; x++) used.add(r * units + x)
    let free = 0
    for (let r = 0; r < packed.rows.length; r++) if ((packed.rows[r].cls || 'unit') === 'unit') for (let x = 0; x < units; x++) if (!used.has(r * units + x)) free++
    return free
  }
  const blockOf = (key, list, w, more = {}) => {
    const { light, ghostSection, taken, only, fill, tail, ...rest } = more
    const grid0 = gridOf(w)
    // the suggestions of the section's own purpose come first
    const candidates = light || fill ? [] : (only || ghostCards.value).filter((g) => !list.some((x) => x.id === g.id) && !(taken && taken.has(g.id))).sort((a, b) => Number(ghostSection !== undefined && sectionIndexOf(purposeOf(b.id, b.group), sectionCount.value) === ghostSection) - Number(ghostSection !== undefined && sectionIndexOf(purposeOf(a.id, a.group), sectionCount.value) === ghostSection))
    const build = (columns) => {
      const grid = { ...grid0, columns }
      const f = fitDash(list, w, boxFor, { ...rest, units: grid.columns, caps: false, pack: { dense: true, exact: true }, maxHole: 1, promote: smart.value && !light && windowClass.value !== 'compact', priority, ghosts: candidates })
      const ghosts = new Set(f.ghosts)
      let boxed = f.boxed.map((c) => (ghosts.has(c.id) ? { ...c, ghost: true } : c))
      let packed = f.packed
      if (fill) ({ boxed, packed } = fillGrid(boxed, packed, f.units, grid.unit, fill))
      // the tail (smart overview, any window): a hole inside the rows that are there is filled with standard tiles, tiles with data first; no row is added and no tile is stretched
      if (tail && holesOf(packed, f.units) > 0) {
        const rowPx = rowPxIn(grid.unit)
        const memory0 = fillMemory // the tiles of the tail are not part of the memory of the fill: the order of the fill does not depend on them
        ;({ boxed, packed } = fillGrid(boxed, packed, f.units, grid.unit, { max: heightOf(packed, rowPx, UNIT_GAP) }))
        if (holesOf(packed, f.units) > 0) ({ boxed, packed } = fillGrid(boxed, packed, f.units, grid.unit, { max: heightOf(packed, rowPx, UNIT_GAP), pool: fillCardsEmpty.value }))
        fillMemory = memory0
      }
      return { f, boxed, packed, grid }
    }
    let best = build(grid0.columns)
    // When the tiles with data do not fill the grid (a wide window: the catalogue is limited), the grid takes the column count (up to six less) with the fewest empty cells, the larger on a tie; it stays in the middle of the pane.
    if (fill && holesOf(best.packed, best.f.units) > 0) {
      let holes = holesOf(best.packed, best.f.units)
      const memory = fillMemory
      let bestMemory = fillMemory
      for (let n = grid0.columns - 1; n >= Math.max(6, grid0.columns - 6) && holes > 0; n--) {
        fillMemory = memory
        const t = build(n), h = holesOf(t.packed, t.f.units)
        if (h < holes) { best = t; holes = h; bestMemory = fillMemory }
      }
      fillMemory = bestMemory
    }
    const { f, boxed, packed, grid } = best
    if (typeof window !== 'undefined') (window.__m3eFit ||= {})[key] = { w, units: f.units, trace: f.trace }
    return { key, units: f.units, unit: grid.unit, boxed, packed, natural: heightOf(packed, rowPxIn(grid.unit), UNIT_GAP), template: trackTemplate(packed.rows, grid.unit), ratio: f.ratio }
  }
  // ---- the dock: not the default. A big clock with the date and a short status line in the upper area, every tile in ONE row along the bottom, scrolling sideways when they do not fit.
  // The tiles keep the one size standard (S, M, L, XL: the same boxes as in the grid); editing shows the grid, where the arrangement is made.
  const dockOn = computed(() => dockLayout.value && !edit.value)
  const clockNow = ref(Date.now())
  let clockTimer = 0
  onMounted(() => { clockTimer = setInterval(() => { clockNow.value = Date.now() }, 10000) })
  onBeforeUnmount(() => clearInterval(clockTimer))
  // the products do not pass a locale: a Chinese status line (the words of the dock come with the texts of the page) means a Chinese date
  const clockLocale = computed(() => (/^zh/i.test(String(props.locale)) || /[\u4e00-\u9fff]/.test(T.value.dockIdle || '') ? 'zh-CN' : props.locale || 'en'))
  const clockSizeDrawn = computed(() => effectiveClockSize(appearance.state.clockSize, wide.value))
  // 特大 only where the window has room beside the clock (appearance.js)
  const clockText = computed(() => new Intl.DateTimeFormat(clockLocale.value, { hour: '2-digit', minute: '2-digit', hour12: false }).format(clockNow.value))
  const dateText = computed(() => new Intl.DateTimeFormat(clockLocale.value, { weekday: 'long', month: 'long', day: 'numeric' }).format(clockNow.value))
  const statusText = computed(() => {
    const s = props.ctx.signals || {}
    const parts = [s.streaming ? T.value.dockStreaming : T.value.dockIdle]
    if (Number.isInteger(s.pairedCount) && s.pairedCount > 0) parts.push(T.value.dockPaired.replace('{n}', s.pairedCount))
    return parts.join(' · ')
  })
  // The dock's last row is completed with more real tiles of the catalogue at their standard size (smart mode: the ones that have data, in the order of the state, as the grid fills its holes; never a
  // stretched tile): no row ends with empty cells beside it while the catalogue has a tile to put there.
  const dockCards = computed(() => {
    if (!dockOn.value) return []
    const list = visibleCards.value.map((c) => boxFor(c, 8))
    if (!smart.value) return list
    const need = missingInRow(list.length, dockGrid.value.columns)
    return need ? [...list, ...fillCards.value.slice(0, need).map((c) => boxFor(c, 8))] : list
  })
  // The tiles are the overview's standard squares (s: one unit), wrapped into the same columns as the grid, so they never form a row that scrolls: a row that does not fit goes below and the page scrolls.
  // The grid is as wide as its columns and sits in the middle of the pane, edge to edge in a narrow one (columnsOf), the same on every window.
  const dockGrid = computed(() => gridOf(width.value))
  const dockGridStyle = computed(() => { const g = dockGrid.value; return { gridTemplateColumns: `repeat(${g.columns}, ${g.unit}px)`, gridAutoRows: `${g.unit}px`, width: `${gridWidthOf(g.columns, g.unit)}px` } })
  // The first screen of the dock: the title, the card above, the clock and ONE row of tiles; the clock block takes what is left above that row (measured: the card above is one line or three), so the clock keeps
  // its size however many rows of tiles follow below the fold. A window too short for it keeps the compact clock (the minimum below) and the row goes under it.
  const dockHeadMin = ref(0)
  const measureDockHead = () => {
    const el = D.root?.value?.querySelector?.('.m-dock'); const pane = el?.closest?.('.m-scene__pane')
    if (!el || !pane) return
    const top = el.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop
    const H = typeof window !== 'undefined' ? window.innerHeight : 900
    const gap = H < 480 ? 8 : 24 // the gap between the clock block and the tiles (dash.css, clock.css)
    // a short window: the clock block gives up height (down to 48: the clock alone) so that a whole row of tiles stays on the first screen; a taller one keeps its clock and the row has its room under it
    const next = H < 480
      ? Math.round(Math.max(48, Math.min(112, pane.clientHeight - top - dockGrid.value.unit - gap - 2)))
      : Math.round(Math.max(Math.min(164 + 0.04 * H, Math.max(112, 0.38 * H)), pane.clientHeight - top - (dockGrid.value.unit + UNIT_GAP + 16) - gap - 4)) // a row of tiles, its gap and the room under it
    if (Math.abs(next - dockHeadMin.value) > 1) dockHeadMin.value = next
  }
  let dockObserver = null
  watch([dockOn, () => D.root?.value], async () => {
    dockObserver?.disconnect(); dockObserver = null
    if (!dockOn.value || !D.root?.value || typeof ResizeObserver === 'undefined') return
    await nextTick()
    const pane = D.root.value.closest?.('.m-scene__pane')
    dockObserver = new ResizeObserver(measureDockHead)
    dockObserver.observe(D.root.value); if (pane) dockObserver.observe(pane)
    measureDockHead()
  }, { flush: 'post', immediate: true })
  watch([() => dockGrid.value.unit, () => tall.value], () => nextTick(measureDockHead), { flush: 'post' })
  onBeforeUnmount(() => dockObserver?.disconnect())
  const setOverview = (value) => appearance.set({ overview: value })
  // the ask for a star: while a stream runs the star of the client in use (from the family the host says of the device of the session; the host star when it is not one of ours), when nothing streams the
  // host star and the sponsor entry
  const starStreaming = computed(() => !!props.ctx.live)
  const starClient = computed(() => (starStreaming.value ? starClientInUse({ clients: props.ctx.clientList || [], session: props.ctx.sessionClient || null, names: props.ctx.starNames || [] }) : null))
  // the client the person streams with is not one we recommend: the prompt recommends one for their system (once per client) and takes the place of the star card while it is due, then the star card is what it was
  const recDone = ref(readClientRec(props.storageKey))
  const clientRec = computed(() => {
    if (!props.ctx.star) return null
    return clientRecommendation({ use: clientInUse({ clients: props.ctx.clientList || [], session: props.ctx.sessionClient || null }), done: recDone.value, locale: props.locale })
  })
  // the one button opens the client download page of this application: on the system of the recommendation when there is one, as it opens anywhere when there is none; handled for the device like 以后再说
  const recOpen = (rec) => { emit('action', rec?.platform ? { card: 'client-rec', type: 'download', value: rec.platform } : { card: 'client-rec', type: 'open', value: 'downloads' }); recLater() }
  const recLater = () => { if (clientRec.value) recDone.value = markClientRec(props.storageKey, clientRec.value.key) }
  const starOpen = (url) => { emit('action', { card: 'star', type: 'open-url', value: url }); emit('action', { card: 'star', type: 'star-dismiss' }) }
  const starLater = () => emit('action', { card: 'star', type: 'star-dismiss' })
  const starSponsor = () => emit('action', { card: 'star', type: 'sponsor', value: '' })
  const TAIL_BELOW = 1000
  const blocks = computed(() => {
    const list = visibleCards.value
    if (!sectioned.value) {
      if (!smart.value || edit.value || !fillReady.value) return [blockOf('grid', list, width.value)]
      // a phone-sized window draws the plan as it is, with the last row completed (no rows are added: the first screen is the person's own to scroll)
      if (windowClass.value === 'compact') return [blockOf('grid', list, width.value, { tail: true })]
      // the same cell as manual mode (gridOf); the height left under the banner is measured (the banner is one line or three), and the tiles that fill it are chosen by whole rows in the packer
      const grid = gridOf(width.value)
      const avail = Math.max(2 * grid.unit, tall.value - (blocksTop.value || 212) - 16)
      const rows = Math.max(2, Math.floor((avail + UNIT_GAP) / (grid.unit + UNIT_GAP)))
      // the tail is for the windows of a phone and a small tablet (under 1000 px): a desktop window keeps its columns and its own way of filling (the column count is chosen for the fewest holes)
      return [blockOf('grid', list, width.value, { fill: { rows, max: avail }, tail: width.value < TAIL_BELOW })]
    }
    const per = sectionLayout(width.value)
    const groups = Array.from({ length: sectionCount.value }, () => [])
    for (const c of list) groups[sectionOfCard(c)].push(c)
    const SEC = { minUnits: 6, maxUnits: 8 }
    const meta = (b, i) => ({ ...b, section: i, title: sectionCount.value === 4 ? SECTION_TITLES.value[i] : `${T.value.section} ${i + 1}`, width: per.width })
    if (!smart.value) return groups.map((g, i) => meta(blockOf(`s${i}`, g, per.width, SEC), i))
    // smart: the sections are balanced in height first (a tile moves to the neighbouring section by purpose), then every section grows toward one height that covers
    // 70-90 % of the window: key tiles a size up within their caps, and only when that runs out suggested tiles
    const px = rowPxIn(gridOf(per.width).unit)
    const hOf = (b) => heightOf(b.packed, px, UNIT_GAP)
    const light = (g, i) => blockOf(`s${i}`, g, per.width, { ...SEC, light: true })
    let lights = groups.map(light)
    for (let n = 0; n < 30 && groups.length > 1; n++) {
      const hs = lights.map(hOf)
      const hi = hs.indexOf(Math.max(...hs)), lo = hs.indexOf(Math.min(...hs))
      if ((hs[hi] - hs[lo]) / hs[hi] <= 0.2) break
      // purposes are soft: the shortest section takes from the tallest, whichever it is, a tile whose purpose is nearest to its own first, then the least important
      const near = (c) => Math.abs(sectionIndexOf(purposeOf(c.id, c.group), groups.length) - lo)
      const movable = [...groups[hi]].sort((a, b) => near(a) - near(b) || plan.value.score(a.id) - plan.value.score(b.id)).slice(0, 8)
      let moved = false
      for (const c of movable) {
        const gh = groups[hi].filter((x) => x.id !== c.id), gl = [...groups[lo], c]
        const bh = light(gh, hi), bl = light(gl, lo)
        if (Math.abs(hOf(bh) - hOf(bl)) < Math.abs(hs[hi] - hs[lo]) - 1) { groups[hi] = gh; groups[lo] = gl; lights[hi] = bh; lights[lo] = bl; moved = true; break }
      }
      if (!moved) break
    }
    const hmax = Math.max(...lights.map(hOf))
    const avail = availH.value
    const tmin = Math.max(0.72 * avail, 0.78 * hmax)
    const target = { min: tmin, max: Math.max(tmin, 0.92 * avail, hmax), rowPx: px, gap: UNIT_GAP }
    // every section grows toward the target in turn: promotions first (inside the fit), then suggestions; a suggested tile is suggested in one section only
    const taken = new Set()
    const fits = groups.map((g, i) => { const b = blockOf(`s${i}`, g, per.width, { ...SEC, target, ghostSection: i, taken }); for (const c of b.boxed) if (c.ghost) taken.add(c.id); return b })
    // after the growth the sections are balanced once more, now with the suggested tiles among the tiles that move (a suggestion is the first to go): the shortest takes from the tallest
    const byId = new Map([...list, ...ghostCards.value].map((c) => [c.id, c]))
    const lists = fits.map((b) => b.boxed.map((c) => byId.get(c.id)).filter(Boolean))
    const finals = [...fits]
    const refit = (l, i) => blockOf(`s${i}`, l, per.width, { ...SEC, target, only: [] })
    for (let n = 0; n < 16 && lists.length > 1; n++) {
      const hs = finals.map(hOf)
      const hi = hs.indexOf(Math.max(...hs)), lo = hs.indexOf(Math.min(...hs))
      if ((hs[hi] - hs[lo]) / hs[hi] <= 0.2) break
      const movable = [...lists[hi]].sort((a, b) => Number(!!b.ghost) - Number(!!a.ghost) || plan.value.score(a.id) - plan.value.score(b.id)).slice(0, 8)
      let moved = false
      for (const c of movable) {
        const lh = lists[hi].filter((x) => x.id !== c.id), ll = [...lists[lo], c]
        const bh = refit(lh, hi), bl = refit(ll, lo)
        if (Math.abs(hOf(bh) - hOf(bl)) < Math.abs(hs[hi] - hs[lo]) - 1) { lists[hi] = lh; lists[lo] = ll; finals[hi] = bh; finals[lo] = bl; moved = true; break }
      }
      if (!moved) break
    }
    return finals.map((b, i) => meta(b, i))
  })
  const shown = computed(() => blocks.value.flatMap((b) => b.boxed))
  // what is left of the window under the tallest section: the block is centred in it (equal margins above and below); the shorter sections end at the same baseline, the rest of their height being an even gap between their rows
  const slack = computed(() => (sectioned.value && !edit.value ? Math.max(0, Math.round(availH.value - Math.max(0, ...blocks.value.map((b) => b.natural || 0)))) : 0))
  const shownIds = computed(() => shown.value.filter((c) => !c.ghost).map((c) => c.id))
  const placedOf = (id) => { for (const b of blocks.value) { const p = b.packed.placed.get(id); if (p) return p } return null }
  const cellStyle = (b, id) => { const p = b.packed.placed.get(id); return p ? { gridRow: `${p.row + 1} / span ${p.rows}`, gridColumn: `${p.col + 1} / span ${p.span}` } : {} }
  watch([blocks, width, tall], async () => { await nextTick(); measureTop() }, { flush: 'post' })
  // the grid is as wide as its columns of the fixed unit and sits in the middle of the pane
  const blockStyle = (b) => (b.unit ? { flex: '0 1 auto', width: `${gridWidthOf(b.units, b.unit)}px`, maxWidth: '100%' } : b.width ? { width: `${b.width}px`, maxWidth: '100%' } : undefined)
  const reasonOf = (id) => { const r = plan.value.reasons[id]; return r ? String(T.value[r.key] || '').replace('{n}', r.vars?.n ?? '') : '' }
  const whyRows = computed(() => plan.value.visible.map((id) => ({ id, title: cardById.value.get(id)?.title || id, icon: cardById.value.get(id)?.data?.icon || 'grid_view', reason: reasonOf(id) })))
  const whyOpen = ref(false)
  // editing is the person's own layout: with 智能磁贴 on, what the plan shows is copied into the saved layout first, so nothing moves; a change made while editing is the person's wish, so the switch goes off when
  // they finish (the chip below the title brings the plan back). Without a change the switch stays as it was and the saved layout is as it was.
  let editSnap = ''
  const layoutKey = () => JSON.stringify([layout.state.order, layout.state.overrides, layout.state.sizes, layout.state.pins])
  let editRaw = ''
  // what the smart overview shows, the tiles of the fill too (blocks is read while it is not edited: the last smart drawing stays here when editing begins), so that editing starts from the page that was on the screen
  let lastShown = []
  watch(blocks, (list) => { if (!edit.value) lastShown = list.flatMap((b) => b.boxed).filter((c) => !c.ghost).map((c) => ({ id: c.id, size: c.sizeKey })) }, { immediate: true, flush: 'sync' })
  // the sizes are the ones drawn (the smart plan lifts a tile a size where a row is short), so editing starts from the page as it was
  const withFill = (base) => {
    const extra = lastShown.filter((x) => !base.visible.includes(x.id) && cardById.value.has(x.id))
    return { ...base, visible: [...base.visible, ...extra.map((x) => x.id)], sizes: { ...base.sizes, ...Object.fromEntries(lastShown.filter((x) => cardById.value.has(x.id)).map((x) => [x.id, x.size])) } }
  }
  watch(edit, (on) => {
    if (on) { editRaw = JSON.stringify(layout.state); if (appearance.state.smartTiles && layout.state.mode === 'smart') layout.freeze(withFill(D.seenPlan && Date.now() - D.flushedAt < 1500 ? D.seenPlan : plan.value)); D.seenPlan = null; editSnap = layoutKey(); return }
    if (appearance.state.smartTiles && layoutKey() !== editSnap) { appearance.set({ smartTiles: false }); return }
    // nothing was changed: the saved layout is as it was before editing began (what was copied into it to keep the tiles in place goes again)
    if (editRaw && layoutKey() === editSnap) Object.assign(layout.state, JSON.parse(editRaw))
  })
  const restoreSmart = () => { appearance.set({ smartTiles: true }); layout.setMode('smart'); replan(); D.say(T.value.smartOn) }
  const acceptGhost = (id) => { layout.accept(id); layout.setVisible(id, true); replan() }
  const hideGhost = (id) => { layout.hideSuggestion(id) }
  const addable = computed(() => layout.addable(allCards.value, props.ctx).filter((c) => !c.id.startsWith('pin:')))
  // ---- details sheet ----
  const detailId = ref('')
  const detail = computed(() => (detailId.value ? props.details?.[detailId.value] : null))
  function onAct(a) {
    if (a.type === 'star-accept') return
    if (a.card && !edit.value) usage.bump(a.card, a.type === 'detail' ? 'opens' : 'controls')
    if (a.type === 'journey-dismiss') { layout.setVisible('journey', false); return }
    if (edit.value) return
    if (a.type === 'detail') {
      const d = props.details?.[a.card]
      if (!d) return
      if (d.external) emit('action', { card: a.card, type: 'detail-external' }); else detailId.value = a.card
      return
    }
    emit('action', a)
  }
  Object.assign(D, { availH, measureTop, slotIn, slotOut, starSponsor, starStreaming, acceptGhost, addable, blockStyle, blocks, cellStyle, clientRec, clockLocale, clockSizeDrawn, dateText, detail, detailId, dockCards, dockGridStyle, dockHeadMin, dockOn, hideGhost, onAct, placedOf, recLater, recOpen, restoreSmart, rootTop, sectionCount, sectioned, setOverview, shown, shownIds, slack, starClient, starLater, starOpen, statusText, whyOpen, whyRows })
}
