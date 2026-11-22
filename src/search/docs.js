// Docs of the unified search from what a product already has: the settings model (entries of buildSettingsEntries), its pages, the host's clients and
// applications, and the tiles of the overview. A doc keeps what the product needs to open it.
import { CARD_META, DEFAULT_ORDER } from '../vue/homeCards.js'
import { homeTexts } from '../vue/homeModel.js'
import { COMPONENT_IDS } from '../status/model.js'
import { statusTexts } from '../status/texts.js'
import { pinSpecForSetting } from '../pins/registry.js'

/** Settings (and the category pages of the settings) from the entries of buildSettingsEntries / useSettingsList().searchItems. */
export function settingDocs(entries, { prefix = '', locale = 'en' } = {}) {
  // prefix: the place of the settings (a function of the entry where the settings are in more than one: 主机设置, or a rail of their own)
  const placeOf = (e) => (typeof prefix === 'function' ? prefix(e) : prefix)
  return entries.map((e) => ({
    id: e.keyName ? `setting:${e.keyName}` : `page:${e.id}`,
    type: e.keyName ? 'setting' : 'page',
    title: e.title, path: e.keyName && placeOf(e) ? `${placeOf(e)} › ${e.path}` : (e.path || ''), icon: e.icon, keywords: e.keywords || '', key: e.keyName || '', ...(e.aliases ? { aliases: e.aliases } : {}), ...(e.pathAlt ? { pathAlt: e.pathAlt } : {}),
    route: e.route, params: e.params, entry: e,
    ...(e.availability ? { availability: e.availability } : {}),
    // what the result can be pinned to the overview as: a tile with the live control, or (tier 3) a link to its page
    ...(e.keyName ? { pin: pinSpecForSetting(e.keyName, { title: e.title, icon: e.icon, locale }) } : {}),
  }))
}

/** Pages: [{ id, title, path?, icon?, route, keywords? }]. */
export const pageDocs = (pages) => pages.map((p) => ({ id: `page:${p.id}`, type: 'page', title: p.title, path: p.path || '', icon: p.icon || 'tune', keywords: p.keywords || '', ...(p.aliases ? { aliases: p.aliases } : {}), route: p.route || p.id, params: p.params, entry: p }))

/** Clients of the host (named certificates): [{ name, uuid? }]. */
export const clientDocs = (clients, { place = '', icon = 'devices' } = {}) => (clients || []).filter((c) => c?.name).map((c) => ({ id: `client:${c.uuid || c.name}`, type: 'client', title: c.name, path: place, icon, keywords: 'client device paired', client: c }))

/** Applications of the host: [{ name }]. */
export const appDocs = (apps, { place = '', icon = 'apps' } = {}) => (apps || []).filter((a) => a?.name).map((a) => ({ id: `app:${a.name}`, type: 'app', title: a.name, path: place, icon, keywords: 'application app game', app: a }))

/** The tiles of the overview (every card of the catalogue): choosing one adds it to the overview. `exclude`: ids of tiles this product cannot offer (the big screen in a browser on another machine). */
export function tileDocs(locale = 'en', { exclude = [] } = {}) {
  const T = homeTexts(locale)
  const comp = statusTexts(locale)
  const seen = new Set()
  return DEFAULT_ORDER.filter((id) => !exclude.includes(id)).map((id) => {
    const meta = CARD_META[id] || {}
    const title = id.startsWith('comp:') && COMPONENT_IDS.includes(id.slice(5)) ? comp.cardTitle.replace('{name}', comp.names[id.slice(5)]) : (T[meta.title] || T[`c_${id}`] || '')
    const group = T[`gGroup_${meta.group}`] || ''
    // two cards of one name in one group are one place to look for
    if (!title || seen.has(`${title}|${group}`)) return null
    seen.add(`${title}|${group}`)
    return { id: `tile:${id}`, type: 'tile', title, path: T[`gGroup_${meta.group}`] || '', icon: 'grid_view', keywords: T[meta.source] || '', tile: id }
  }).filter(Boolean)
}
