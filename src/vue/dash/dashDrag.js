import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { liftOffset } from '../dragLift.js'
import { UNIT_GAP, effectiveSize } from '../homeSizes.js'
import { isStackId } from '../stackModel.js'

/** dashDrag: one part of the home overview's setup (MHomeDash.vue); D is the shared scope of the parts, in the order they are made. */
export function useDashDrag(D) {
  const { MERGE_HOLD_MS, ROW_PX, SWAP_DWELL_MS, T, addCard, boxIn, clearMerge, clearSwap, edit, grid, gridOf, laid, layout, mergeInto, mergeable, placed, removeCard, resize, root, say, sectioned, setCardSize, sheetAway, sheetEl, shownIds, stackSizeFor, stacksOn, tall, titleOf, units, width, windowClass } = D
  // ---- sorting: pointer. The card lifts, its slot shows a placeholder, the others move aside on springs; it springs into the slot on release ----
  const drag = ref(null)
  // { id, gx, gy, dx, dy, pid, over, sx, sy, moved }
  const sel = ref('')
  // the selected card (edit mode): it shows the resize handles and the size selector
  let pressTimer = 0
  const settling = ref('')
  D.settleTimer = 0
  // Touch: the page must stay scrollable under a finger that lands on a tile, so a tile is picked up by a press that holds still (LIFT_MS), as on the home screens of phones, and only then follows the finger
  // (a finger that moves first is a scroll: the browser takes it over and the press ends without selecting anything). The page's own scroll is stopped for a lifted tile by a touchmove listener that
  // is there from the start (a listener added after the finger landed is too late for the first move).
  const LIFT_MS = 320
  const onTouchMove = (ev) => { if (drag.value?.touch && drag.value.lifted && ev.cancelable) ev.preventDefault() }
  onMounted(() => document.addEventListener('touchmove', onTouchMove, { passive: false }))
  onBeforeUnmount(() => document.removeEventListener('touchmove', onTouchMove))
  const dragVars = (id) => (drag.value?.id === id ? { '--dx': `${drag.value.dx}px`, '--dy': `${drag.value.dy}px` } : undefined)
  function down(e, id) {
    if (!edit.value || e.button > 0 || e.target.closest('.m-dash__remove, .m-dash__sizes, .m-dash__handle')) return
    const cell = e.currentTarget
    const r = cell.getBoundingClientRect()
    const touch = e.pointerType === 'touch'
    drag.value = { id, gx: e.clientX - r.left, gy: e.clientY - r.top, dx: 0, dy: 0, pid: e.pointerId, over: false, sx: e.clientX, sy: e.clientY, moved: false, touch, lifted: !touch }
    docDrag(e.pointerId)
    // a long press selects the card at once, a tap selects it on release
    clearTimeout(pressTimer)
    if (touch) pressTimer = setTimeout(() => { const d = drag.value; if (d && d.id === id && !d.moved) { d.lifted = true; select(id); try { navigator.vibrate?.(12) } catch { /* no haptics */ } } }, LIFT_MS)
    else pressTimer = setTimeout(() => { if (drag.value && !drag.value.moved) select(id) }, 450)
  }
  function select(id) { sel.value = id; if (id) say(`${titleOf(id)}: ${T.value.selected || 'selected, choose a size'}`) }
  const inside = (el, x, y) => { if (!el) return false; const r = el.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom }
  let lastX = 0
  let lastY = 0
  // follows the pointer: the card's offset from its slot, whether it is over the sheet, the place it takes among the others
  function track(x, y) {
    const d = drag.value
    if (!d) return
    lastX = x; lastY = y
    if (!d.moved) {
      if (Math.hypot(x - d.sx, y - d.sy) < 6) return
      // a finger that moved before the tile was lifted is scrolling the page, not carrying the tile
      if (d.touch && !d.lifted) { clearTimeout(pressTimer); drag.value = null; stopScroll(); return }
      d.moved = true
      clearTimeout(pressTimer)
      say(`${titleOf(d.id)}: ${T.value.picked || 'picked up'}`)
    }
    const cell = root.value.querySelector(`[data-card="${CSS.escape(d.id)}"]`)
    if (!cell) return
    // the slot of the card is where it would be without the lift (the cells are in one grid, or in the grids of several sections)
    const cr = cell.getBoundingClientRect()
    // the lift is a translation of the card's body: the cell stays in its slot, so the offset is the pointer less the grab point less the slot
    const off = liftOffset(x, y, { x: d.gx, y: d.gy }, cr); d.dx = off.dx; d.dy = off.dy
    d.over = !d.fromGallery && inside(sheetEl.value, x, y) // a tile that came out of the gallery is never dropped back on it
    if (d.over) return
    // behind the flag: the centre of a tile of the same size, held for a moment, is a stack; while over it the cards do not shuffle
    if (stacksOn && !d.fromGallery && !isStackId(d.id)) {
      d.size = cell.dataset.size
      let cand = ''
      for (const other of root.value.querySelectorAll('[data-card]:not(.is-ghost)')) {
        const id = other.dataset.card; if (id === d.id || other.dataset.size !== d.size) continue
        const r = other.getBoundingClientRect(); const mx = r.width * 0.3, my = r.height * 0.3
        if (x >= r.left + mx && x <= r.right - mx && y >= r.top + my && y <= r.bottom - my && mergeable(d.id, id)) { cand = id; break }
      }
      if (cand) {
        if (d.mergeCand !== cand) { clearMerge(); d.mergeCand = cand; D.mergeTimer = setTimeout(() => { if (drag.value && drag.value.mergeCand === cand) drag.value.merge = cand }, MERGE_HOLD_MS) }
        return
      }
      if (d.mergeCand) clearMerge()
    }
    // the card whose middle part is under the pointer takes the dragged card's place
    let inZone = false
    for (const other of root.value.querySelectorAll('[data-card]:not(.is-ghost)')) {
      const id = other.dataset.card
      if (id === d.id) continue
      const r = other.getBoundingClientRect()
      const mx = r.width * 0.2, my = r.height * 0.2
      if (x >= r.left + mx && x <= r.right - mx && y >= r.top + my && y <= r.bottom - my) {
        inZone = true
        const take = () => { layout.moveTo(laid(d.id), laid(id)); if (sectioned.value) layout.setSection(laid(d.id), Number(other.dataset.section) || 0) }
        // a tile of the same size can be joined as well as passed: on the way to its middle the places are not swapped at once, the pointer is given a moment to arrive (and rest there)
        if (stacksOn && !d.fromGallery && !isStackId(d.id) && other.dataset.size === d.size && mergeable(d.id, id)) {
          if (d.swapCand !== id) { clearSwap(); d.swapCand = id; D.swapTimer = setTimeout(() => { const ok = drag.value && drag.value.swapCand === id && !drag.value.mergeCand; clearSwap(); if (ok) take() }, SWAP_DWELL_MS) }
          break
        }
        take(); break
      }
    }
    if (!inZone && d.swapCand) clearSwap()
  }
  function move(e) {
    const d = drag.value
    if (!d || e.pointerId !== d.pid) return
    track(e.clientX, e.clientY)
    scrollNear(e.clientY)
  }
  function up(e) {
    const d = drag.value
    if (!d || e.pointerId !== d.pid) return
    clearTimeout(D.swapTimer); D.swapTimer = 0
    drag.value = null
    clearTimeout(pressTimer)
    stopScroll()
    if (!d.moved) { sel.value = sel.value === d.id ? '' : d.id; if (sel.value) say(`${titleOf(d.id)}: ${T.value.selected || 'selected, choose a size'}`); return }
    if (d.merge && mergeInto(d.id, d.merge, d.size)) { clearMerge(); settling.value = d.merge; clearTimeout(D.settleTimer); D.settleTimer = setTimeout(() => { settling.value = '' }, 520); return }
    clearMerge()
    if (d.over) { removeCard(d.id); return }
    settling.value = d.id
    clearTimeout(D.settleTimer)
    D.settleTimer = setTimeout(() => { settling.value = '' }, 520)
    say(`${titleOf(d.id)}: ${(T.value.droppedAt || 'dropped at position')} ${shownIds.value.indexOf(d.id) + 1}`)
    if (d.fromGallery) placed(d.id, d.before)
  }
  // ---- resizing the selected card: a corner handle snaps to the sizes the card offers, nearest to where the corner is; the page reflows as it goes ----
  const sizing = ref('')
  const CORNER = { tr: [1, -1], bl: [-1, 1], br: [1, 1] }
  // how far the corner moves the card's width and height
  function handleDown(e, c, corner) {
    if (e.button > 0) return
    const [kx, ky] = CORNER[corner]
    const pid = e.pointerId, sx = e.clientX, sy = e.clientY
    const gridW = Math.max(480, width.value)
    const unit = gridOf(gridW).unit
    const dims = (k) => { const b = boxIn(c, k, units.value); return { w: b.span * unit + (b.span - 1) * UNIT_GAP, h: ROW_PX.value(b.cls) * b.rows + (b.rows - 1) * UNIT_GAP } }
    const keys = c.sizeKeys
    const asked = () => (c.kind === 'stack' ? stackSizeFor(c) : effectiveSize(c, layout.state.sizes[c.id], windowClass.value, 'manual', { height: tall.value }))
    const from = dims(asked())
    sizing.value = c.id
    const m = (ev) => {
      if (ev.pointerId !== pid) return
      const W = from.w + kx * (ev.clientX - sx), H = from.h + ky * (ev.clientY - sy)
      let best = keys[0], dist = Infinity
      for (const k of keys) { const d = dims(k); const v = Math.abs(d.w - W) / unit + Math.abs(d.h - H) / unit; if (v < dist) { dist = v; best = k } }
      if (best !== asked()) setCardSize(c.id, best)
    }
    const u = (ev) => { if (ev.pointerId !== pid) return; document.removeEventListener('pointermove', m); document.removeEventListener('pointerup', u); document.removeEventListener('pointercancel', u); sizing.value = '' }
    document.addEventListener('pointermove', m); document.addEventListener('pointerup', u); document.addEventListener('pointercancel', u)
  }
  // a press outside every card and outside the size selector deselects; so does Esc, leaving edit mode and removing the card
  const outside = (e) => { if (sel.value && !e.target.closest('.m-dash__cell, .m-dedit, .m-dedit__fab, .m-dedit__selbar')) sel.value = '' }
  onMounted(() => document.addEventListener('pointerdown', outside, true))
  onBeforeUnmount(() => { document.removeEventListener('pointerdown', outside, true); clearTimeout(pressTimer) })
  watch(edit, (on) => { if (!on) sel.value = '' })
  // ---- the page scrolls while a card is held near its top or bottom edge ----
  let scrollRaf = 0
  let scrollDir = 0
  const scroller = () => { for (let el = grid.value?.parentElement; el; el = el.parentElement) { const o = getComputedStyle(el).overflowY; if ((o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight) return el } return null }
  function scrollNear(y) {
    const el = scroller()
    if (!el) return
    const r = el.getBoundingClientRect()
    const sheetTop = sheetEl.value ? sheetEl.value.getBoundingClientRect().top : r.bottom
    const bottom = Math.min(r.bottom, sheetTop)
    scrollDir = y < r.top + 64 ? -1 : y > bottom - 48 && y < sheetTop + 4 ? 1 : 0
    if (scrollDir && !scrollRaf) { const tick = () => { if (!scrollDir) { scrollRaf = 0; return } el.scrollBy(0, scrollDir * 14); track(lastX, lastY); scrollRaf = requestAnimationFrame(tick) }; scrollRaf = requestAnimationFrame(tick) }
  }
  function stopScroll() { scrollDir = 0; if (scrollRaf) cancelAnimationFrame(scrollRaf); scrollRaf = 0 }
  // ---- dragging a preview out of the sheet: the card is added at the end and picked up straight away ----
  async function galleryPick(e, id) {
    const pid = e.pointerId, sx = e.clientX, sy = e.clientY
    let moved = false
    const onMoveDoc = async (ev) => {
      if (moved || Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return
      moved = true
      document.removeEventListener('pointermove', onMoveDoc)
      const before = layout.snapshot()
      addCard(id)
      sheetAway.value = true // the gallery slides away: the overview is what the tile is placed on
      await nextTick(); await nextTick()
      const cell = grid.value?.querySelector(`[data-card="${CSS.escape(id)}"]`)
      if (!cell) return
      const r = cell.getBoundingClientRect()
      drag.value = { id, gx: r.width / 2, gy: Math.min(40, r.height / 2), dx: 0, dy: 0, pid, over: false, sx: sx, sy: sy, moved: true, fromGallery: true, before }
      docDrag(pid)
      move(ev)
    }
    const onUpDoc = () => { document.removeEventListener('pointermove', onMoveDoc); document.removeEventListener('pointerup', onUpDoc) }
    document.addEventListener('pointermove', onMoveDoc); document.addEventListener('pointerup', onUpDoc)
  }
  // A drag follows its pointer on the document: reordering moves the card's element in the page, which would end a pointer capture on it
  function docDrag(pid) {
    const m = (ev) => { if (ev.pointerId === pid) move(ev) }
    const u = (ev) => {
      if (ev.pointerId !== pid) return
      document.removeEventListener('pointermove', m); document.removeEventListener('pointerup', u); document.removeEventListener('pointercancel', u)
      // the browser took the finger over (the page scrolls): not a tap, nothing is selected; a tile that was being carried is dropped where it is
      if (ev.type === 'pointercancel' && drag.value && !drag.value.moved) { clearTimeout(pressTimer); clearTimeout(D.swapTimer); D.swapTimer = 0; drag.value = null; stopScroll(); return }
      up(ev)
    }
    document.addEventListener('pointermove', m); document.addEventListener('pointerup', u); document.addEventListener('pointercancel', u)
  }
  function sheetKey(e, id) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addCard(id) }
  }
  // ---- sorting: keyboard ----
  const picked = ref('')
  let snap = ''
  function key(e, id) {
    if (!edit.value) return
    if (e.key === 'Escape' && sel.value && picked.value !== id) { e.preventDefault(); sel.value = ''; return }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (picked.value === id) { picked.value = ''; say(`${titleOf(id)}: ${(T.value.droppedAt || 'dropped at position')} ${shownIds.value.indexOf(id) + 1}`) } else { picked.value = id; snap = layout.snapshot(); say(`${titleOf(id)}: ${T.value.picked || 'picked up'}`) }
    } else if (picked.value === id && ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(e.key)) {
      e.preventDefault()
      layout.step(laid(id), e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1, shownIds.value.map(laid))
      say(`${titleOf(id)} ${shownIds.value.indexOf(id) + 1}`)
    } else if (picked.value === id && (e.key === '+' || e.key === '=' || e.key === '-')) {
      e.preventDefault(); resize(id, e.key === '-' ? -1 : 1)
    } else if (picked.value === id && e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation(); layout.restore(snap); picked.value = ''; say(`${titleOf(id)}: ${T.value.cancelled || 'cancelled'}`)
    }
  }
  Object.assign(D, { down, drag, dragVars, galleryPick, handleDown, inside, key, picked, sel, settling, sizing, stopScroll })
}
