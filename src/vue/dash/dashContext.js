// What the overview adds to the context menu (SPEC-context-menu, "Overview tile", "Stack", "Client row", "Application"): a tile carries data-ctx="tile:<id>", a stack's cell the same with the stack's id, a client row of
// the clients table "client:<uuid>" and an application of the library tiles "app:<name>". Every item runs what the control of the same name runs: the resize and the edit mode of the edit sheet, the join of the
// join sheet, the stack sheet's own store calls, the tile's own `act`.
import { onBeforeUnmount } from 'vue'
import { copyWithNotice, registerContext } from '../../contextmenu/registry.js'
import { isStackId } from '../stackModel.js'

export function useDashContext(D) {
  const stackItems = (id, texts) => {
    const st = D.stacks?.state.stacks[id]
    if (!st) return []
    const t = D.T.value
    const card = D.shown.value.find((c) => c.id === id)
    const members = (card?.stackMembers || []).map((m) => ({ id: m.id, title: m.title, icon: D.ghostIconOf?.(m) || 'apps', index: st.members.indexOf(m.id) })).filter((m) => m.index >= 0)
    return [
      { id: 'stack-edit', label: t.stackEdit || texts.editStack, icon: 'edit', run: () => D.openStackSheet(id) },
      ...(members.length > 1 ? [{ id: 'stack-switch', label: texts.switchTo, icon: 'swap_horiz', children: members.map((m) => ({ id: `to:${m.id}`, label: m.title, icon: m.icon, selected: st.active === m.index, run: () => D.onStackRotate({ id, index: m.index, source: 'manual' }) })) }] : []),
      { id: 'stack-smart', label: t.stackSmart || texts.smartRotate, icon: 'sync', selected: st.smartRotate, run: () => D.stacks.setFlags(id, { smartRotate: !st.smartRotate }) },
      { id: 'stack-dissolve', label: t.stackDissolve || texts.dissolveStack, icon: 'layers', danger: true, confirm: texts.dissolveConfirm, run: () => { D.stacks.dissolve(id); if (D.stackSheetId?.value === id) D.stackSheetId.value = '' } },
    ]
  }
  const off = registerContext('tile', ({ id, el, T: texts }) => {
    if (isStackId(id)) return stackItems(id, texts)
    const c = D.allCards.value.find((x) => x.id === id)
    if (!c) return []
    const t = D.T.value
    const keys = D.sizeKeysOf(c)
    const now = el?.querySelector?.('[data-size]')?.dataset?.size || ''
    const me = D.stacksOn ? D.shown.value.find((x) => x.id === id && !x.ghost) : null
    const targets = me ? D.joinTargetsOf(me) : []
    const items = []
    if (keys.length > 1) items.push({ id: 'resize', label: texts.resize, icon: 'aspect_ratio', children: keys.map((k) => ({ id: `size:${k}`, label: t[`size${k.toUpperCase()}`] || texts[`size${k.toUpperCase()}`] || k, selected: now === k, run: () => D.setCardSize(id, k) })) })
    if (targets.length) items.push({ id: 'add-to-stack', label: texts.addToStack, icon: 'library_add', children: targets.map((target) => ({ id: `join:${target.id}`, label: D.joinTitle(target), icon: D.joinIcon(target), run: () => { D.joinFor.value = id; D.joinInto(target) } })) })
    items.push({ id: 'edit-overview', label: texts.editOverview, icon: 'edit', run: () => { D.edit.value = true } })
    items.push({ id: 'remove-tile', label: texts.removeTile, icon: 'remove', danger: true, confirm: texts.removeTileConfirm, run: () => D.removeCard(id) })
    return items
  })
  // a row of the clients table that carries the device id the host gave it: the click opens the clients page
  const offClient = registerContext('client', ({ id, T: texts, cb }) => [
    { id: 'open-client', label: texts.open, icon: 'open_in_new', run: () => D.onAct({ type: 'table-row', value: { id, tab: 'clients' } }) },
    { id: 'copy-device-id', label: texts.copyDeviceId, icon: 'content_copy', run: () => copyWithNotice(id, cb, texts) },
  ])
  // an application of the library tiles: the click opens the applications page
  const offApp = registerContext('app', ({ id, T: texts }) => [{ id: 'open-app', label: texts.open, icon: 'open_in_new', run: () => D.onAct({ type: 'app', value: { name: id } }) }])
  const offAll = () => { off(); offClient(); offApp() }
  onBeforeUnmount(offAll)
  return offAll
}
