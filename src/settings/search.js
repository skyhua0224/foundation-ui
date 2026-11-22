
// Ranking and search of settings, shared by both products. An entry: { id, title, path?, keywords?, keyName? }.
// keyName is the setting's configuration key (`hevc_mode`): typing it finds the row as well as typing its label.

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFKC')
const keyForm = (s) => norm(s).trim().replace(/[\s.-]+/g, '_')

/** Score of an entry for a query (lower is better), or -1 when it does not match. Every word must be found. */
export function scoreEntry(entry, query) {
  const q = norm(query).trim()
  if (!q) return -1
  const title = norm(entry.title)
  const key = keyForm(entry.keyName || '')
  const hay = norm(`${entry.title} ${entry.path || ''} ${entry.keywords || ''} ${entry.keyName || ''}`)
  const words = q.split(/\s+/)
  if (!words.every((w) => hay.includes(w) || (key && key.includes(keyForm(w))))) return -1
  const k = keyForm(q)
  if (title === q || (key && key === k)) return 0
  if (title.startsWith(q) || (key && key.startsWith(k))) return 1
  if (title.includes(q) || (key && key.includes(k))) return 2
  if (norm(entry.keywords).includes(q)) return 3
  return 4
}

/** The entries that match, best first (stable: the list order breaks ties), at most `max`. */
export function searchEntries(entries, query, max = 12) {
  return entries
    .map((entry, order) => ({ entry, order, score: scoreEntry(entry, query) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .slice(0, max)
    .map((r) => r.entry)
}

/**
 * Search entries of the settings: pages (the categories) and every setting of the index.
 * index: the search index the product supplies (getSearchIndex()); label(key, locale?) -> text; altLabel: the label in the other language (English
 * finds a row of the Chinese interface and the other way round); aliases: { id: string | string[] } what people call a row instead (getAliases()).
 */
export function buildSettingsEntries({ index, label, altLabel = null, aliases = null, categories = [], extra = [] }) {
  const lbl = (k) => label(k)
  const path = (e) => e.path.map(lbl).join(' › ')
  const rows = index.map((e) => ({
    id: e.id,
    keyName: e.id,
    title: lbl(e.title),
    path: path(e),
    icon: e.icon,
    keywords: [e.keywords, altLabel ? altLabel(e.title) : ''].filter(Boolean).join(' '),
    // the places above it in the other language: searched like the path, after the words of the row itself
    ...(altLabel ? { pathAlt: e.path.map((p) => altLabel(p)).filter(Boolean).join(' ') } : {}),
    ...(aliases?.[e.id] ? { aliases: aliases[e.id] } : {}),
    route: e.route,
    params: e.params,
  }))
  return [...categories, ...rows, ...extra]
}
