import { GUIDE_STEP_IDS } from './guideModel.js'
// The part of the guide's progress that lives on the host, so every device reads the same one: which steps are done, whether the guide was finished or closed, and which device is
// running it right now. The host keeps these as plain keys of its configuration (like telemetry_consent): `guide_done` (step ids, comma separated), `guide_finished`, `guide_closed`
// (the version the guide was closed for) and `guide_active` (`<device>@<epoch seconds>` of the last step taken). No DOM and no Vue: the product passes the transport in.

export const HOST_GUIDE_KEYS = Object.freeze({ done: 'guide_done', finished: 'guide_finished', closed: 'guide_closed', active: 'guide_active' })

/** Seconds a guide counts as running on a device after its last step: other devices do not open their own meanwhile. */
export const ACTIVE_WINDOW_S = 600

/** Seconds between the beats of a guide that stays on one step (a client to install, a router to set up): `active` stays fresh, so another device does not open its own in the middle. Well under the window. */
export const HEARTBEAT_S = 120
/** Beats in a row without a step (half an hour): then the window is left alone and stops claiming the guide. */
export const HEARTBEAT_MAX = 15

const truthy = (value) => value === true || value === 'true' || value === 1 || value === '1'

/** Step ids out of a comma separated string or an array, in flow order, known ids only. */
export function parseDone(value) {
  const list = Array.isArray(value) ? value : String(value ?? '').split(',')
  const set = new Set(list.map((id) => String(id).trim()))
  return GUIDE_STEP_IDS.filter((id) => set.has(id))
}

/** The union of lists of step ids, in flow order. */
export const unionDone = (...lists) => parseDone(lists.flat())

/** The guide state out of the host configuration: { done: [ids], finished, closed (version or ''), active: { device, at } | null }. A missing or malformed value is "nothing recorded". */
export function hostProgressOf(config) {
  const c = config && typeof config === 'object' ? config : {}
  const m = /^([^@]+)@(\d+)$/.exec(String(c[HOST_GUIDE_KEYS.active] ?? ''))
  return { done: parseDone(c[HOST_GUIDE_KEYS.done]), finished: truthy(c[HOST_GUIDE_KEYS.finished]), closed: String(c[HOST_GUIDE_KEYS.closed] ?? ''), active: m ? { device: m[1], at: Number(m[2]) } : null }
}

/** The configuration keys to write for a progress change ({ done?, finished?, closed?, active?: { device, at } | null }); only what is given. */
export function hostPatchOf({ done, finished, closed, active } = {}) {
  const patch = {}
  if (done !== undefined) patch[HOST_GUIDE_KEYS.done] = parseDone(done).join(',')
  if (finished !== undefined) patch[HOST_GUIDE_KEYS.finished] = finished ? 'true' : 'false'
  if (closed !== undefined) patch[HOST_GUIDE_KEYS.closed] = String(closed || '')
  if (active !== undefined) patch[HOST_GUIDE_KEYS.active] = active ? `${active.device}@${Math.floor(active.at)}` : ''
  return patch
}

/**
 * The keys one save of the guide writes to the host. `finished` goes out only when it is true: the flow also resets it in its own window (an upgrade starts at the top, so
 * the flag is false there until the end), and writing that false back would take back what the person finished before, so the installer and every other device would
 * start the whole guide over. Starting over on purpose is an explicit write (hostPatchOf with finished: false). `ended` (finished or closed): the guide no longer claims the host.
 */
export function progressSavePatch({ done, finished, closed, ended, device, now }) {
  return { done, ...(finished ? { finished: true } : {}), closed, active: ended ? null : { device, at: now } }
}

/** True when another device took a step of the guide within the last ACTIVE_WINDOW_S seconds: this one must not open its own. */
export function activeElsewhere(host, device, nowMs = Date.now()) {
  const a = host?.active
  if (!a || !a.device || a.device === device) return false
  const age = nowMs / 1000 - a.at
  return age >= 0 ? age < ACTIVE_WINDOW_S : false
}

/** Writes the patch into the host configuration (read, change, write back: the host replaces the whole configuration on a write). `api` is { getJson, postJson }. -> { ok } */
export async function saveGuideHost(api, patch) {
  try {
    const config = await api.getJson('/api/config')
    if (!config || typeof config !== 'object') return { ok: false }
    const result = await api.postJson('/api/config', { ...config, ...patch })
    return { ok: !!result && (result.status === true || result.status === 'true') }
  } catch {
    return { ok: false }
  }
}

const DEVICE_KEY = 'foundation.guide.device'

/** The id of this browser or window, made once and kept: it tells the host which device runs the guide. */
export function deviceId(storage) {
  let store = storage
  if (!store) { try { store = globalThis.localStorage } catch { store = null } }
  try {
    const have = store?.getItem(DEVICE_KEY)
    if (have) return have
  } catch { /* a new one below */ }
  const id = `d${Math.random().toString(36).slice(2, 10)}`
  try { store?.setItem(DEVICE_KEY, id) } catch { /* not remembered: the next page load is another device, which only costs a second guide */ }
  return id
}

/** The step to open: the first one not done; every step done = the last one. A stale position kept in a window never sends the person ahead of what was done. */
export function resumeIndex(steps, done) {
  const have = new Set(done || [])
  const at = steps.findIndex((step) => !have.has(step.id))
  return at < 0 ? Math.max(0, steps.length - 1) : at
}

/** A phone or small touch screen: the person cannot scan a code shown on the screen they hold. */
export function isPhoneLike({ userAgent = '', coarse = false, width = 1024 } = {}) {
  return /Android.*Mobile|iPhone|iPod|Mobile.*Safari|HarmonyOS.*Mobile/i.test(String(userAgent)) || (!!coarse && Number(width) <= 600)
}

/**
 * A saver for the guide's host keys that never runs two writes at once (each one reads and replaces the whole configuration): changes that arrive while one is running are merged
 * into one more write. `api` is { getJson, postJson }; the returned function takes a patch of hostPatchOf's input.
 */
export function createHostSaver(api) {
  let pending = null
  let running = false
  const run = async () => {
    if (running) return
    running = true
    try {
      while (pending) {
        const patch = pending
        pending = null
        await saveGuideHost(api, hostPatchOf(patch))
      }
    } finally { running = false }
  }
  return (patch) => { pending = { ...(pending || {}), ...patch }; return run() }
}
