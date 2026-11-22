import { computed, ref, shallowRef, watch } from 'vue'

/**
 * The app-wide history of jumps between areas: 体检 → 打开设置 (网络), a home tile → its settings. One stack of the places a person left by a jump, shared by every way back to them
 * (the caption bar's back button, the chip at the top of the page, Alt+Left, the system back gesture).
 *
 *   A jump is a move the product makes for the person (`jump(() => open…)`): the place left is pushed. A move the person makes (the rail, a row of a list, the page's own back arrow, a
 *   search result) is not: the stack is cleared, there is nothing to go back to that the person did not choose. The page's own sub-page back (the arrow of a pushed page) keeps its
 *   place and is not this stack's business.
 *   Back goes to the place on top and takes it off; the system's Back (a popstate that brings the place on top) is the same step. Going to a place that is already in the stack
 *   (A → B → A) takes the stack down to under it instead of growing a loop; a jump that goes nowhere pushes nothing, and a move to the same page with other parameters (a tab of the
 *   settings) is a move inside the page: nothing is pushed and nothing is cleared.
 *
 * locate() -> the current place { id, params?, rail? } (read from the navigation)
 * restore(place) opens a place (the product's own opener: a Web page also needs its frame told)
 * same(a, b) -> boolean; the default compares id and params without the keys named in `ephemeral` (a stamp that is not part of where a person was)
 */
const PLAIN = (params, ephemeral) => {
  if (!params || typeof params !== 'object') return ''
  const keys = Object.keys(params).filter((k) => !ephemeral.includes(k) && params[k] !== undefined).sort()
  return keys.length ? JSON.stringify(keys.map((k) => [k, params[k]])) : ''
}

export function createJumpHistory({ locate, restore, ephemeral = [], same = null, max = 20 }) {
  const equal = same || ((a, b) => !!a && !!b && a.id === b.id && PLAIN(a.params, ephemeral) === PLAIN(b.params, ephemeral))
  const stack = shallowRef([])
  let depth = 0 // a jump in progress
  let restoring = false
  let returned = false
  let seen = null // the place the stack knows the person is at

  const clean = (place) => {
    const kept = place.params ? Object.entries(place.params).filter(([k]) => !ephemeral.includes(k)) : []
    return { id: place.id, rail: place.rail, params: kept.length ? Object.fromEntries(kept) : undefined }
  }
  const top = computed(() => stack.value[stack.value.length - 1] || null)

  function clear() { if (stack.value.length) stack.value = [] }
  function push(place) {
    const at = stack.value.findIndex((p) => equal(p, place))
    const base = at >= 0 ? stack.value.slice(0, at) : stack.value
    stack.value = [...base, clean(place)].slice(-max)
  }
  /** a move was made: `from` to `to`. `own`: the product made it (a jump) */
  function moved(from, to, own) {
    if (!to) return
    // the same page with other parameters (a tab of the settings, a new health check) is a move inside the page: not a jump, and not the person leaving either
    if (from && from.id === to.id) { seen = to; return }
    if (own) {
      const at = stack.value.findIndex((p) => equal(p, to))
      if (at >= 0) stack.value = stack.value.slice(0, at) // back to a place that is in the stack: no loop
      else if (from) push(from)
    } else if (top.value && equal(top.value, to)) {
      stack.value = stack.value.slice(0, -1) // the system's Back led to the place on top: it is the same step
    } else clear()
    seen = to
  }

  return {
    stack,
    top,
    canBack: computed(() => stack.value.length > 0),
    /** run an opener as a jump: the place it leaves is pushed (only when it moved somewhere else, in the same turn) */
    jump(open) {
      if (restoring) return open()
      const from = depth === 0 ? locate() : null
      depth++
      let result
      try { result = open() } finally { depth-- }
      if (depth === 0) moved(from, locate(), true)
      return result
    },
    /** go back to the place on top; false when there is none */
    back() {
      const place = top.value
      if (!place) return false
      stack.value = stack.value.slice(0, -1)
      restoring = true
      returned = true
      queueMicrotask(() => queueMicrotask(() => { returned = false })) // after the render that shows the place has been scheduled and run
      try { restore(place) } finally { restoring = false }
      seen = locate()
      return true
    },
    /** true while the page that the last back opened is being drawn: it is a return to a place, not a new page (the page then opens where it was scrolled to) */
    returning: () => returned,
    clear,
    /** watch the navigation: a move that is not a jump and not a back is the person's own */
    attach(source) {
      seen = locate()
      return watch(source, () => {
        if (depth > 0 || restoring) return
        const to = locate()
        moved(seen, to, false)
      }, { flush: 'sync' })
    },
  }
}

/** The variants of the global back: A the button in the caption bar, B the chip at the top of the page after a jump, C both. */
export const BACK_VARIANTS = ['A', 'B', 'C']
export const BACK_KEY = 'foundation.back.variant'
/** B was chosen: the chip 「← 返回<page>」 at the top of the destination page after a cross-area jump.
 *  The address and the old developer option no longer switch it; the arguments stay so older callers still work. */
export function backVariant() { return 'B' }
export const showsButton = (variant) => variant === 'A' || variant === 'C'
export const showsChip = (variant) => variant === 'B' || variant === 'C'

// one variant for the window, shared by the product's shell and the developer option that changes it
let current = null
export function useBackVariant() {
  if (!current) {
    current = ref(backVariant())
  }
  return {
    variant: current,
    set() { /* fixed to B since it was chosen */ },
  }
}
