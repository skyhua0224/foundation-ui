import { onBeforeUnmount, onMounted } from 'vue'

// Fit-to-room for the values of a tile (fs52-tiles-real-fit). A value that is wider than the room its tile gives it (`3840×2160`, `2160p`, `home.sky-hua.xyz`, `Moonlight macOS Enhanced`) is not cut with an
// ellipsis: its font shrinks to fit, down to 60 %, and below that it wraps (`data-fit-wrap`, tilefit.css). The text of the person's host decides the width, so the tile reads it as it is drawn.
export const FIT_SELECTOR = '.m-calm__title, .m-b2empty .m-b2__btn, .m-b2plate b, .m-b2item b, .m-calh__blocks b, .m-calh__now b, .m-dsmall__value > span, .m-b3v__value, .m-b3d__mode, .m-b2__name, .m-caln__name, .m-tnet__name, .m-daddr__value b, .m-tnet__ip, .m-calh__pairs dd, .m-calh__line, .m-caln__sub, .m-b2__line, .m-b2__cap'
export const FIT_MIN = 0.6
export const MIN_PX = 11

/** The scale an element of `need` px content needs to fit `room` px: 1 when it fits, FIT_MIN..1 when shrinking is enough, null when it needs the wrap. */
export function fitScale(need, room, min = FIT_MIN) {
  if (!(room > 8) || !(need > room + 0.5)) return 1
  const k = (room - 0.5) / need
  return k >= min ? k : null
}

/** A label with a detail (`版本 · 2026.1107.232322`, `网络 · 以太网 11`): one line; when it is wider than its room it tries MIN_PX, then says only its first words (`data-fit-short`: the full text stays in the pill's title). Never wraps, an ellipsis is the last resort of a room that cannot hold even those. */
export function fitDetail(el) {
  el.removeAttribute('data-fit-short'); el.style.removeProperty('font-size')
  const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return
  const size = parseFloat(cs.fontSize), room = el.clientWidth
  if (!(size > 0) || !(room > 8) || !(el.scrollWidth > room + 0.5)) return
  if (size > MIN_PX) { el.style.fontSize = `${MIN_PX}px`; if (el.scrollWidth <= room + 0.5) return; el.style.removeProperty('font-size') }
  el.setAttribute('data-fit-short', '')
  if (size > MIN_PX && el.scrollWidth > room + 0.5) el.style.fontSize = `${MIN_PX}px`
}

export function fitElement(el) {
  el.style.removeProperty('font-size'); el.removeAttribute('data-fit-wrap')
  const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return
  const size = parseFloat(cs.fontSize); if (!(size > 0)) return
  let room = el.clientWidth
  const tile = el.closest('.m-b2plate') || el.closest('.m-tile, .m-dcard, .m-dsmall') // the inner plate of a tile is the room, not the whole tile
  if (tile) { const t = tile.getBoundingClientRect(), pc = getComputedStyle(tile), lim = t.right - (parseFloat(pc.paddingRight) || 0) - el.getBoundingClientRect().left; room = room > 0 ? Math.min(room, lim) : lim }
  // a padded value (the button of an empty state) shrinks its text only: the padding stays, so it is not part of what is measured
  const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) + (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0)
  const k = fitScale(el.scrollWidth - pad, room - pad, Math.max(FIT_MIN, Math.min(1, MIN_PX / size))) // never below 11 px: a value that would need less wraps at its own size
  if (k === 1) return
  if (k === null) { el.setAttribute('data-fit-wrap', ''); return }
  el.style.fontSize = `${(size * k).toFixed(2)}px`
}

/** Fits every value of the tiles under `rootRef` after it is drawn, when a tile or the window changes size, and when a value changes (one pass per frame). */
export function useFitText(rootRef) {
  let raf = 0, ro = null, mo = null
  const seen = new WeakSet()
  // every tile is observed on its own box (a tile can change size while the grid does not: the plan gives it another size, a neighbour is added), and a font that arrives late changes every width: one more pass
  const pass = () => { raf = 0; const root = rootRef.value; if (!root) return; for (const el of root.querySelectorAll(FIT_SELECTOR)) { const t = el.closest('.m-tile, .m-dcard, .m-dsmall'); if (t && ro && !seen.has(t)) { seen.add(t); ro.observe(t) } fitElement(el) }; for (const el of root.querySelectorAll('[data-fit-detail]')) fitDetail(el) }
  const queue = () => { if (!raf) raf = requestAnimationFrame(pass) }
  onMounted(() => {
    queue()
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(queue); ro.observe(rootRef.value) }
    if (typeof MutationObserver !== 'undefined') { mo = new MutationObserver(queue); mo.observe(rootRef.value, { childList: true, characterData: true, subtree: true }) }
    if (typeof document !== 'undefined' && document.fonts) { document.fonts.ready?.then(queue); document.fonts.addEventListener?.('loadingdone', queue) }
  })
  onBeforeUnmount(() => { ro?.disconnect(); mo?.disconnect(); if (typeof document !== 'undefined') document.fonts?.removeEventListener?.('loadingdone', queue); if (raf) cancelAnimationFrame(raf) })
}
