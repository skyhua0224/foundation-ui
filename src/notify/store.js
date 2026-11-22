import { computed, reactive } from 'vue'

/**
 * The one notification system of a window. Three places, no other:
 *   snack(message, { action, onAction, timeout })  a short result that passes (MNotifyHost, one at a time, bottom centre)
 *   banner(page, { id, tone, icon, title, text, actions })  a standing problem of one page, shown under the title of that page (MPageBanners)
 *   system(id, { tone, icon, title, text, actions, dismissible, revision, onDismiss })  a state of the host or the app that stays until it is solved, in the status button of the caption bar (MStatusBell); onDismiss(id) runs when the person closes a dismissible one
 * Nothing is drawn above the caption bar.
 */
export function createNotifyStore() {
  const state = reactive({ queue: [], banners: {}, systems: {}, dismissed: {}, seq: 0 })

  function snack(message, { action = '', onAction = null, timeout = 5000, id = '' } = {}) {
    if (!message) return ''
    const key = id || `snack-${++state.seq}`
    // the same id replaces its own message (a progress sentence that changes), a new one waits for the one on screen
    const at = state.queue.findIndex((s) => s.id === key)
    const item = { id: key, message, action, onAction, timeout }
    if (at >= 0) state.queue[at] = item
    else state.queue.push(item)
    return key
  }
  const current = computed(() => state.queue[0] || null)
  function dismissSnack(id) { state.queue = state.queue.filter((s) => s.id !== id) }
  function runSnackAction(id) {
    const item = state.queue.find((s) => s.id === id)
    dismissSnack(id)
    item?.onAction?.()
  }

  function banner(page, item) {
    if (!page || !item?.id) return
    state.banners[page] = [...(state.banners[page] || []).filter((b) => b.id !== item.id), { tone: 'warn', ...item }]
  }
  function clearBanner(page, id) {
    const rest = (state.banners[page] || []).filter((b) => b.id !== id)
    if (rest.length) state.banners[page] = rest
    else delete state.banners[page]
  }
  const bannersOf = (page) => state.banners[page] || []

  // a state is one of two groups: a status (a problem that stays until it is solved) or a notice (something to know, which the person can dismiss). A dismissed
  // notice stays away until it changes (`revision`) or is solved (clearSystem).
  const keyOf = (id, item) => `${id}:${item?.revision ?? ''}`
  function system(id, item) {
    if (!id) return
    if (item?.dismissible && state.dismissed[id] === keyOf(id, item)) return
    state.systems[id] = { tone: 'warn', ...item, id, group: item.group || (item.dismissible ? 'notice' : 'status') }
  }
  function clearSystem(id) { delete state.systems[id]; delete state.dismissed[id] }
  function dismissSystem(id) {
    const item = state.systems[id]
    if (!item?.dismissible) return
    state.dismissed[id] = keyOf(id, item)
    delete state.systems[id]
    // a notice that outlives the window (an answer of the developers) is told that the person closed it
    try { item.onDismiss?.(id) } catch { /* the notice is gone either way */ }
  }
  const TONE_RANK = { error: 0, warn: 1, info: 2 }
  const systems = computed(() => Object.values(state.systems).sort((a, b) => (TONE_RANK[a.tone] ?? 3) - (TONE_RANK[b.tone] ?? 3)))
  const systemGroups = computed(() => ['status', 'notice'].map((id) => ({ id, items: systems.value.filter((s) => s.group === id) })).filter((g) => g.items.length))
  const clearable = computed(() => systems.value.filter((s) => s.dismissible))
  const systemCount = computed(() => systems.value.length)
  const systemTone = computed(() => systems.value[0]?.tone || '')

  return { state, snack, current, dismissSnack, runSnackAction, banner, clearBanner, bannersOf, system, clearSystem, dismissSystem, systems, systemGroups, clearable, systemCount, systemTone }
}

let shared = null
export function useNotify() {
  if (!shared) {
    shared = createNotifyStore()
    // a handle for the QA robot and the console of a developer
    if (typeof window !== 'undefined') (window.__foundationUi ||= {}).notify = shared
  }
  return shared
}
export function resetNotify() { shared = null }
