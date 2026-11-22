// The data of the settings area that a product supplies at runtime: the search index of its settings and the text tables of its interface languages.
// foundation-ui carries no settings text of any product. The product (the Web UI of Foundation Sunshine, the control panel) calls
// provideSettingsData() once at start, before anything is drawn, with the two tables it owns; everything that reads them (the list pane, the search,
// the recent list, the pins) asks this module, so a product that supplies other data gets other rows and other words from the same components.
//
// Until data is supplied the index is empty and labelOf answers the key itself, so a page that is drawn too early shows keys instead of failing.

/**
 * One setting of the index.
 * @typedef {Object} SearchEntry
 * @property {string} id                   the configuration key (`hevc_mode`)
 * @property {string} title                the label key of the setting (a key of the label tables)
 * @property {string[]} path               the label keys of the places above it, outermost first
 * @property {string} icon                 icon name
 * @property {string} [keywords]           extra words that find the row
 * @property {string} route                the route that opens it
 * @property {{ tab: string, sub?: string, focus: string }} params  where the row is on that route
 */
/**
 * The text tables: interface language (`zh`, `en`, `zh_TW`, ...) -> label key -> text. A language may lack a key; English fills it.
 * @typedef {Record<string, Record<string, string>>} LabelTables
 */
/**
 * @typedef {Object} SettingsData
 * @property {ReadonlyArray<SearchEntry>} searchIndex
 * @property {LabelTables} labels
 * @property {Record<string, string | string[]>} [aliases]   what people call a setting instead, by its id, in any language (`audio_sink: ['喇叭', 'headphones']`): the search finds the row by them
 */

/** @type {{ searchIndex: ReadonlyArray<SearchEntry>, labels: LabelTables }} */
let current = Object.freeze({ searchIndex: Object.freeze([]), labels: Object.freeze({}), aliases: Object.freeze({}) })
let version = 0
const listeners = new Set()

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** The problems of a SettingsData value, as readable lines; an empty list means it can be supplied. */
export function settingsDataProblems(data) {
  const problems = []
  if (!isObject(data)) return ['the data is not an object']
  if (!Array.isArray(data.searchIndex)) problems.push('searchIndex is not an array')
  else {
    const seen = new Set()
    data.searchIndex.forEach((e, i) => {
      const at = `searchIndex[${i}]`
      if (!isObject(e)) { problems.push(`${at} is not an object`); return }
      if (typeof e.id !== 'string' || !e.id) problems.push(`${at}.id is not a non-empty string`)
      else if (seen.has(e.id)) problems.push(`${at}.id ${e.id} is listed twice`)
      else seen.add(e.id)
      if (typeof e.title !== 'string' || !e.title) problems.push(`${at}.title is not a non-empty string`)
      if (!Array.isArray(e.path) || e.path.some((p) => typeof p !== 'string')) problems.push(`${at}.path is not an array of strings`)
      if (typeof e.route !== 'string' || !e.route) problems.push(`${at}.route is not a non-empty string`)
      if (!isObject(e.params) || typeof e.params.tab !== 'string' || typeof e.params.focus !== 'string') problems.push(`${at}.params needs a tab and a focus`)
    })
  }
  if (data.aliases !== undefined) {
    if (!isObject(data.aliases)) problems.push('aliases is not an object')
    else for (const [id, v] of Object.entries(data.aliases)) if (!(typeof v === 'string' || (Array.isArray(v) && v.every((x) => typeof x === 'string')))) problems.push(`aliases.${id} is not a string or a list of strings`)
  }
  if (!isObject(data.labels)) problems.push('labels is not an object')
  else {
    for (const [locale, table] of Object.entries(data.labels)) {
      if (!isObject(table) || Object.values(table).some((t) => typeof t !== 'string')) problems.push(`labels.${locale} is not a table of strings`)
    }
    if (!isObject(data.labels.en)) problems.push('labels.en is missing: it fills the gaps of the other languages')
  }
  return problems
}

/**
 * Supplies the data. Throws when the data is malformed (a product that supplies a broken table should fail at start, not show keys to people).
 * Calling it again replaces the data and tells the subscribers.
 * @param {SettingsData} data
 */
export function provideSettingsData(data) {
  const problems = settingsDataProblems(data)
  if (problems.length) throw new TypeError(`provideSettingsData: ${problems.slice(0, 5).join('; ')}${problems.length > 5 ? `; and ${problems.length - 5} more` : ''}`)
  current = Object.freeze({ searchIndex: Object.freeze([...data.searchIndex]), labels: data.labels, aliases: data.aliases || Object.freeze({}) })
  version += 1
  for (const fn of [...listeners]) fn(version)
}

/** Whether data has been supplied. */
export const hasSettingsData = () => version > 0
/** Bumps on every provideSettingsData: a cache of something built from the data is valid while this is the same number. */
export const settingsDataVersion = () => version
/** Calls fn(version) after every provideSettingsData; returns the function that stops it. */
export function onSettingsData(fn) { listeners.add(fn); return () => listeners.delete(fn) }

/** The search index of the settings: SearchEntry[] (empty until data is supplied). */
export const getSearchIndex = () => current.searchIndex
/** The label tables: locale -> key -> text. */
export const getLabels = () => current.labels
/** What people call each setting instead, by id: `{ audio_sink: ['喇叭', 'headphones'] }`; empty when the product supplies none. */
export const getAliases = () => current.aliases

const fallbackOf = (locale) => {
  const labels = current.labels
  return (locale && labels[locale]) || labels[String(locale || '').replace(/-/g, '_')] || labels[String(locale || '').split(/[_-]/)[0]] || labels.en || {}
}
/** The text table of an interface language (English when the language has none). */
export const labelsFor = (locale) => fallbackOf(locale)
/** The text of a label key in a language, English when the language lacks it, the key itself when nobody has it. */
export const labelOf = (locale, key) => fallbackOf(locale)[key] ?? current.labels.en?.[key] ?? key
