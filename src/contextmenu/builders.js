// The context menu, as plain functions (SPEC-context-menu): what the pointer is on (`describeTarget`), the groups of items that go with it (`buildGroups`) and the one list the menu shows
// (`flattenGroups`). The element is only asked for what the DOM gives every element (closest, getAttribute, parentElement, tagName, value, selectionStart ...), so the rules are tested on plain objects.
// General groups first for the thing under the pointer (a field, a selection, a link, an image), after the groups the team of an element adds (tile, client, setting ...) and before the page's own.
// No item that does nothing: an item whose action the product does not give is not there; one that cannot be used now is shown disabled, with the reason as its tooltip. About twelve items, then a submenu.
import { contextItemsOf } from './registry.js'

export const MAX_ITEMS = 12
const NOT_FIELDS = new Set(['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'color', 'file', 'image', 'hidden'])
const editable = (el) => {
  if (!el || !el.tagName) return null
  const tag = String(el.tagName).toUpperCase()
  if (tag === 'TEXTAREA') return el
  if (tag === 'INPUT') return NOT_FIELDS.has(String(el.type || 'text').toLowerCase()) ? null : el
  return el.isContentEditable ? el : null
}
const fieldOf = (el) => { for (let n = el; n; n = n.parentElement) { const f = editable(n); if (f) return f } return null }
const isMac = (platform = '') => /mac|iphone|ipad/i.test(String(platform))

/** What the pointer is on: { field, selection, link, image, owners: [{ kind, id, el }] (nearest first), blank }. `selection` is the text selected outside a field. */
export function describeTarget(el, { selection = '' } = {}) {
  const field = fieldOf(el)
  let fieldText = ''
  if (field && typeof field.value === 'string' && Number.isInteger(field.selectionStart) && Number.isInteger(field.selectionEnd)) fieldText = field.value.slice(field.selectionStart, field.selectionEnd)
  else if (field) fieldText = selection
  const closest = (sel) => (typeof el?.closest === 'function' ? el.closest(sel) : null)
  const link = closest('a[href]')
  const img = String(el?.tagName).toUpperCase() === 'IMG' ? el : closest('img')
  const owners = []
  for (let n = el; n; n = n.parentElement) {
    const ctx = n.getAttribute?.('data-ctx')
    if (ctx) { const at = ctx.indexOf(':'); owners.push({ kind: at < 0 ? ctx : ctx.slice(0, at), id: at < 0 ? '' : ctx.slice(at + 1), el: n }); continue }
    const key = n.getAttribute?.('data-cfg')
    if (key) owners.push({ kind: 'setting', id: key, el: n })
  }
  const target = {
    field: field ? { el: field, readOnly: !!(field.readOnly || field.disabled || field.getAttribute?.('aria-readonly') === 'true'), password: String(field.type) === 'password', selected: fieldText, hasValue: typeof field.value === 'string' ? field.value.length > 0 : true } : null,
    selection: field ? '' : String(selection || ''),
    link: link ? String(link.href || link.getAttribute?.('href') || '') : '',
    image: img ? String(img.currentSrc || img.src || '') : '',
    owners,
  }
  target.blank = !target.field && !target.selection && !target.link && !target.image && !owners.length
  return target
}

const it = (id, label, extra = {}) => ({ id, label, ...extra })
const clip = (text, n = 24) => { const t = String(text).replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t }

/**
 * The groups of items for a target. ctx: { T (texts), cb (the product's actions: search, explain, openLink, openExternal, openSearch, connect, doctor, refresh, openDevtools, restartHost, openWebUi, pet,
 * saveImage), caps ({ product: 'panel' | 'web', print, devtools, canCopyImage, canGoBack }), platform, mode (the appearance mode now) }.
 */
export function buildGroups(target, ctx) {
  const { T, cb = {}, caps = {}, platform = '', mode = 'system' } = ctx
  const mod = isMac(platform) ? '⌘' : 'Ctrl+'
  const groups = []
  const danger = []
  // the owners of the elements under the pointer: what each adds to the menu
  for (const o of target.owners) {
    const items = contextItemsOf(o.kind, { id: o.id, el: o.el, T, cb, caps })
    const safe = items.filter((i) => !i.danger); const bad = items.filter((i) => i.danger)
    if (safe.length) groups.push(safe)
    danger.push(...bad)
  }
  if (danger.length) groups.push(danger)
  if (target.field) {
    const f = target.field; const hasSel = !!f.selected; const ro = f.readOnly
    const cmd = (name) => { try { return typeof document !== 'undefined' && document.queryCommandEnabled(name) } catch { return true } }
    const edit = [
      ...(ro ? [] : [it('undo', T.undo, { icon: 'undo', shortcut: `${mod}Z`, disabled: !cmd('undo') }), it('redo', T.redo, { icon: 'redo', shortcut: isMac(platform) ? '⇧⌘Z' : 'Ctrl+Y', disabled: !cmd('redo') }), { divider: true, id: 'e-d1' }]),
      ...(ro ? [] : [it('cut', T.cut, { icon: 'content_cut', shortcut: `${mod}X`, disabled: !hasSel || f.password })]),
      it('copy', T.copy, { icon: 'content_copy', shortcut: `${mod}C`, disabled: !hasSel || f.password }),
      ...(ro ? [] : [it('paste', T.paste, { icon: 'content_paste', shortcut: `${mod}V` }), it('paste-plain', T.pastePlain, { shortcut: isMac(platform) ? '⌥⇧⌘V' : 'Ctrl+Shift+V' }), it('delete', T.delete, { icon: 'delete', disabled: !hasSel })]),
      { divider: true, id: 'e-d2' }, it('select-all', T.selectAll, { icon: 'select_all', shortcut: `${mod}A`, disabled: !f.hasValue }),
    ]
    groups.push(edit)
    if (hasSel && !f.password && cb.search) groups.push([it('search-selection', T.searchSelection.replace('{text}', clip(f.selected)), { icon: 'search', text: undefined })])
  } else if (target.selection) {
    groups.push([
      it('copy', T.copy, { icon: 'content_copy', shortcut: `${mod}C` }),
      ...(cb.search ? [it('search-selection', T.searchSelection.replace('{text}', clip(target.selection)), { icon: 'search' })] : []),
      ...(cb.explain ? [it('explain', T.explain, { icon: 'smart_toy' })] : []),
      it('select-all', T.selectAll, { icon: 'select_all', shortcut: `${mod}A` }),
    ])
  }
  if (target.link) {
    groups.push([
      it('open-link', T.open, { icon: 'open_in_new' }),
      ...(cb.openExternal ? [it('open-external', T.openBrowser, { icon: 'language' })] : []),
      it('copy-link', T.copyLink, { icon: 'link' }),
    ])
  }
  if (target.image) {
    groups.push([
      ...(caps.canCopyImage ? [it('copy-image', T.copyImage, { icon: 'image' })] : []),
      it('copy-image-url', T.copyImageUrl, { icon: 'link' }),
      ...(cb.saveImage ? [it('save-image', T.saveImage, { icon: 'download' })] : []),
    ])
  }
  if (target.blank) {
    const blank = [
      ...(cb.openSearch !== false ? [it('search', T.search, { icon: 'search', shortcut: `${mod}K` })] : []),
      ...(cb.connect ? [it('connect', T.connect, { icon: 'person_add' })] : []),
      ...(cb.doctor ? [it('doctor', T.doctor, { icon: 'health_and_safety' })] : []),
      it('appearance', T.appearance, { icon: 'palette', children: [it('mode:system', T.system, { icon: 'contrast', selected: mode === 'system' }), it('mode:light', T.light, { icon: 'light_mode', selected: mode === 'light' }), it('mode:dark', T.dark, { icon: 'dark_mode', selected: mode === 'dark' })] }),
    ]
    groups.push(blank)
    const own = [
      // one entry of the pet is the item itself; two or more are a submenu
      ...(cb.pet?.length ? [cb.pet.length === 1 ? it('pet', cb.pet[0].label || T.pet, { icon: cb.pet[0].icon || 'pets', run: cb.pet[0].run }) : it('pet', T.pet, { icon: 'pets', children: cb.pet })] : []),
      ...(cb.restartHost ? [it('restart-host', T.restartHost, { icon: 'restart_alt', danger: true, confirm: T.restartConfirm })] : []),
      ...(cb.openWebUi ? [it('open-webui', T.openWebUi, { icon: 'open_in_browser' })] : []),
    ]
    if (own.length) groups.push(own)
  }
  // the page
  // 反馈此处的问题 opens the one feedback panel with the page and what was under the pointer: first in the page group, for every user
  const page = [
    ...(cb.reportHere ? [it('dev-report', T.feedbackHere, { icon: 'feedback' })] : []),
    it('back', T.back, { icon: 'arrow_back', disabled: caps.canGoBack === false, reason: caps.canGoBack === false ? T.noHistory : undefined }),
    it('forward', T.forward, { icon: 'arrow_forward' }),
    it('reload', T.reload, { icon: 'refresh', shortcut: 'F5' }),
    ...(caps.print ? [it('print', T.print, { icon: 'print', shortcut: `${mod}P` })] : []),
    ...(caps.devtools && !caps.developer && cb.openDevtools ? [it('inspect', T.inspect, { icon: 'code' })] : []),
    ...(caps.devtools && !caps.developer ? [it('copy-route', T.copyRoute, { icon: 'content_copy' })] : []),
  ]
  groups.push(page)
  groups.at(-1).page = true
  // with developer mode on, a 「开发者」 section closes the menu: the developer tools (the Panel opens WebView2's; the Web UI says which key), a report in an issue about the place, the route
  if (caps.developer) {
    const dev = [
      { section: true, id: 'dev-head', label: T.developer },
      ...(caps.product === 'web' || !cb.openDevtools ? [it('dev-tools-hint', T.devTools, { icon: 'code', shortcut: 'F12', text: T.devToolsHint })] : [it('dev-tools', T.devTools, { icon: 'code', shortcut: 'F12' })]),
      it('copy-route', T.copyRoute, { icon: 'content_copy' }),
    ]
    dev.dev = true
    groups.push(dev)
  }
  return groups.filter((g) => g.length)
}

/** The one list of the menu: groups apart by a divider; past MAX_ITEMS the page's own group is one submenu, so the thing under the pointer keeps the first place. */
export function flattenGroups(groups, T, max = MAX_ITEMS) {
  const count = (gs) => gs.reduce((n, g) => n + g.filter((i) => !i.divider).length, 0)
  let list = groups
  const at = list.findIndex((g) => g.page)
  if (count(list) > max && list.length > 1 && at >= 0) {
    list = list.map((g, i) => (i === at ? [{ id: 'page', label: T.page, icon: 'more_horiz', children: g }] : g))
  }
  const out = []
  list.forEach((g, i) => { if (i) out.push({ divider: true, id: `d${i}` }); out.push(...g) })
  return out
}
