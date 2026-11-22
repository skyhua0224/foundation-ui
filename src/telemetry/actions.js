// The last things the person did, as short ids: a page opened, a button or a tile pressed, a setting changed, a stream started or stopped, a device connected, a call that failed. A ring of 50 in memory; the last ones go
// along with an error report (error_report.crumbs) as `<seconds before>|<kind>|<id>`. Only ids that the page itself names are recorded: never the text of a button, never what was typed, never a field's content.
export const ACTION_KINDS = Object.freeze(['nav', 'act', 'set', 'stream', 'dev', 'state', 'net'])
export const ACTIONS = Object.freeze({ capacity: 50, idMax: 48 })

/** An id: lower case letters, digits and . _ : + -, other characters become `_`, at most 48. Empty when nothing is left. */
export const actionId = (value, max = ACTIONS.idMax) => String(value ?? '').toLowerCase().replace(/[^a-z0-9_.:+-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, max).replace(/_+$/, '')

export function createActionRing({ capacity = ACTIONS.capacity, now = () => Date.now() } = {}) {
  const ring = []
  const add = (kind, id) => {
    const k = ACTION_KINDS.includes(kind) ? kind : 'state'
    const word = actionId(id)
    if (!word) return false
    ring.push({ t: now(), kind: k, id: word })
    if (ring.length > capacity) ring.splice(0, ring.length - capacity)
    return true
  }
  const snapshot = (at = now()) => ring.map((a) => `${Math.min(99999, Math.max(0, Math.round((at - a.t) / 1000)))}|${a.kind}|${a.id}`)
  return { add, snapshot, clear: () => { ring.length = 0 }, get size() { return ring.length } }
}

/** The one ring of this window. */
export const actions = createActionRing()
export const trackAction = (kind, id) => actions.add(kind, id)
/** A call that failed: the id names the call (a route word), the status is a class (4xx, 5xx, timeout, network). */
export const trackFailedCall = (callId, status) => actions.add('net', `${actionId(callId, 32)}:${typeof status === 'number' ? (status >= 500 ? '5xx' : status >= 400 ? '4xx' : 'other') : actionId(status, 12) || 'failed'}`)

/** `/apps/12/edit?x=1#y` -> `apps`; `#/settings/video` -> `settings`; digits-only and long segments are not part of an id. */
export function routeId(location = globalThis.location) {
  const hash = String(location?.hash || '').replace(/^#!?/, '')
  const path = hash.startsWith('/') ? hash : String(location?.pathname || '')
  const segment = path.split(/[?#]/)[0].split('/').filter((s) => s && !/^\d+$/.test(s) && s.length <= 24)[0]
  return actionId(segment || 'home')
}

/**
 * The listeners that fill the ring: a page change (popstate, hashchange), a press on an element that carries `data-track="id"` (the id is all that is read), the events `foundation-setting-changed`
 * ({ key, valueClass }) and `foundation-stream-state` ({ state }). Returns the function that takes them off.
 */
export function installActionTracking(win = globalThis.window, doc = globalThis.document, ring = actions) {
  if (!win || typeof win.addEventListener !== 'function') return () => {}
  const offs = []
  const on = (target, name, fn, options) => { target.addEventListener(name, fn, options); offs.push(() => target.removeEventListener?.(name, fn, options)) }
  let page = ''
  const nav = () => { const id = routeId(win.location); if (id && id !== page) { page = id; ring.add('nav', id) } }
  on(win, 'popstate', nav)
  on(win, 'hashchange', nav)
  nav()
  if (doc && typeof doc.addEventListener === 'function') {
    on(doc, 'click', (event) => {
      const el = event?.target && typeof event.target.closest === 'function' ? event.target.closest('[data-track]') : null
      const id = el && typeof el.getAttribute === 'function' ? el.getAttribute('data-track') : ''
      if (id) ring.add('act', id)
    }, true)
  }
  on(win, 'foundation-setting-changed', (event) => { const d = event?.detail || {}; ring.add('set', `${actionId(d.key, 28)}:${actionId(d.valueClass, 16)}`) })
  on(win, 'foundation-stream-state', (event) => { ring.add('stream', event?.detail?.state) })
  return () => offs.forEach((off) => off())
}
