import { reactive } from 'vue'

// The game libraries of the host as the done page of the guide shows them: scanned once in the background when the guide opens, every game found ticked, and the ticked ones added with one press.
// `callbacks()` gives the product's callbacks (scanGames(sources) -> { ok, games, unsupported? }, addGames(games) -> { ok, added? }); a product without them shows nothing.
export const LIBRARY_SOURCES = Object.freeze(['steam', 'epic', 'gog'])

export function useGuideLibrary(callbacks) {
  const library = reactive({ status: 'idle', games: [], picked: [], busy: false, added: 0 })
  async function scanLibrary() {
    const cb = callbacks()
    if (!cb.scanGames) { library.status = 'unsupported'; return }
    library.status = 'scanning'
    try {
      const r = (await cb.scanGames([...LIBRARY_SOURCES])) || { ok: false }
      if (r.ok) { library.games = r.games || []; library.picked = library.games.map((g) => g.key); library.status = library.games.length ? 'ready' : 'none' }
      else library.status = r.unsupported ? 'unsupported' : 'failed'
    } catch { library.status = 'failed' }
  }
  async function addLibrary() {
    const cb = callbacks()
    if (library.busy || !library.picked.length || !cb.addGames) return
    library.busy = true
    try {
      const chosen = library.games.filter((g) => library.picked.includes(g.key))
      const r = (await cb.addGames(chosen)) || { ok: false }
      if (r.ok) { library.added += r.added ?? chosen.length; library.games = library.games.filter((g) => !library.picked.includes(g.key)); library.picked = []; if (!library.games.length) library.status = 'none' }
    } finally { library.busy = false }
  }
  const toggleGame = (key) => { library.picked = library.picked.includes(key) ? library.picked.filter((k) => k !== key) : [...library.picked, key] }
  return { library, scanLibrary, addLibrary, toggleGame }
}
