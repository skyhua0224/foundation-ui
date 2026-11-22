// The reading side of the driver guard, without Vue: the Panel and the Web UI each give it their way to call the host (`api.get()`, `api.post(body)`), it keeps the state
// and says how long to wait before the next look. A host without the route (an older one) leaves the state null, which draws nothing.

const FAST_MS = 3000
const SLOW_MS = 30000

export function createDriverGuardClient(api, onState) {
  let state = null
  let latest = 0
  const set = (next) => {
    state = next && typeof next === 'object' && !Array.isArray(next) && next.v === 1 ? next : null
    onState(state)
    return state
  }
  // a response that comes back after a later call was made is old: it does not overwrite the newer state
  const swallow = async (call) => {
    const mine = ++latest
    try {
      const next = await call()
      return mine === latest ? set(next) : state
    } catch {
      return mine === latest ? set(null) : state
    }
  }
  return {
    refresh: () => swallow(() => api.get()),
    dismiss: (key) => swallow(() => api.post({ action: 'dismiss', key })),
    retry: () => swallow(() => api.post({ action: 'retry' })),
    /** How long to wait before the next look: soon while the encoders are being checked, rarely otherwise. */
    nextDelay: () => (state && (state.probe === 'pending' || state.probe === 'running') ? FAST_MS : SLOW_MS),
  }
}
