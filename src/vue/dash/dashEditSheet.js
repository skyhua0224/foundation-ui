import { computed, nextTick, ref, watch } from 'vue'
import { useNotify } from '../../notify/store.js'
import { GROUPS } from '../homeCards.js'
import { UNIT_GAP, effectiveSize, sizesOf } from '../homeSizes.js'
import { isStackId } from '../stackModel.js'
import { useFlip } from '../flipGroup.js'
import { reducedMotion } from '../../appearance/motion.js'
import { resizedWithin } from '../../nav/resizing.js'

/** dashEditSheet: one part of the home overview's setup (MHomeDash.vue); D is the shared scope of the parts, in the order they are made. */
export function useDashEditSheet(D) {
  const { T, addable, allCards, blocks, boxIn, dockBox, dockLayout, edit, grid, gridOf, hasDetailOf, layout, planMoving, resizing, root, rowPxIn, shownIds, sizeKeysOf, stacks, tall, units, width, windowClass } = D
  // ---- the edit sheet and the live region ----
  const group = ref('all')
  const sheetEl = ref(null)
  const groupsInSheet = computed(() => GROUPS.filter((g) => pickerCards.value.some((c) => c.group === g)))
  const query = ref('')
  const pickerOpen = ref(false)
  watch(edit, (on) => { if (!on) { pickerOpen.value = false; query.value = '' } })
  // the status cards of the components are one entry of the picker with a choice of the component (each added card is still the card of one component)
  const compChoice = ref('')
  const compName = (c) => String(c.title || c.id.slice(5)).replace(/\s*(状态|status)$/i, '')
  const compCards = computed(() => addable.value.filter((c) => c.id.startsWith('comp:')))
  const compPick = computed(() => compCards.value.find((c) => c.id === compChoice.value) || compCards.value[0])
  const pickerCards = computed(() => { const rest = addable.value.filter((c) => !c.id.startsWith('comp:')); return compCards.value.length ? [...rest, { ...compPick.value, merged: true, title: T.value.compStatus || 'Component status' }] : rest })
  const textOf = (c) => `${c.title} ${c.source || ''} ${T.value['gGroup_' + c.group] || c.group}`.toLowerCase()
  const sheetCards = computed(() => { const q = query.value.trim().toLowerCase(); return pickerCards.value.filter((c) => (group.value === 'all' || c.group === group.value) && (!q || textOf(c).includes(q))) })
  const countOf = (g) => pickerCards.value.filter((c) => g === 'all' || c.group === g).length
  const sheetSections = computed(() => GROUPS.map((g) => ({ id: g, title: T.value['gGroup_' + g] || g, cards: sheetCards.value.filter((c) => c.group === g) })).filter((x) => x.cards.length))
  const GROUP_ICON = { host: 'dns', stream: 'cast_connected', perf: 'speed', device: 'devices', control: 'tune', start: 'rocket_launch', resources: 'public', personal: 'palette' }
  const sheetSize = ref({})
  // The bitrate control starts as a strip; the other previews start at the small size.
  const sheetKeyOf = (c) => sheetSize.value[c.id] || (c.id === 'ctl-bitrate' ? sizesOf(c.id, c, windowClass.value, tall.value).size : 's')
  const sheetBox = (card) => { const c = { ...card, hasDetail: hasDetailOf(card) }; if (dockLayout.value) return dockBox(c, units.value); const key = effectiveSize(c, sheetKeyOf(c), windowClass.value, 'manual', { height: tall.value }); return { ...c, ...boxIn(c, key, units.value), size: key, sizeKey: key, sizeKeys: sizeKeysOf(c) } }
  // previews are drawn at the real size the card has on this page (a unit of the grid and the row heights of this density), then scaled down
  const ROW_PX = computed(() => rowPxIn(gridOf(width.value).unit))
  // The tiles slide to their places (FLIP, flipGroup.js) only when the arrangement changes while it is edited, never while the window is resized. It is not a TransitionGroup: a TransitionGroup reads the
  // position of every child and clones its first child into the grid on EVERY update of the page, so an overview with live values added and removed the hero cell twice a second, with a layout pass each time.
  const flipSig = computed(() => blocks.value.map((b) => `${b.key}:${b.units}:${b.template}:${b.boxed.map((c) => { const p = b.packed.placed.get(c.id); return p ? `${c.id}@${p.row},${p.col},${p.span},${p.rows}` : c.id }).join(',')}`).join('|'))
  useFlip({ root, select: '.m-dash__cell', keyOf: (el) => el.dataset.card, signature: () => flipSig.value, enabled: () => (edit.value || planMoving.value) && !resizing.value && !resizedWithin(300), skip: (el) => el.classList.contains('is-dragging'), clean: () => !edit.value })
  // a preview is the card at the size chosen on it, in a grid of the page's columns that fills the width of the sheet: the card is drawn at the size it has on the page and scaled to its column span
  const stripEl = ref(null)
  const stripW = ref(1100)
  const sheetUnit = computed(() => (Math.max(240, stripW.value - 4) - (units.value - 1) * UNIT_GAP) / units.value)
  const previewW = (c) => { const n = Math.min(units.value, sheetBox(c).span); return n * sheetUnit.value + (n - 1) * UNIT_GAP }
  const previewScale = (c) => previewW(c) / Math.max(1, prevBox(c).w)
  watch(stripEl, (el, _old, onCleanup) => { if (!el) return; const o = new ResizeObserver(() => { stripW.value = el.clientWidth }); o.observe(el); stripW.value = el.clientWidth; onCleanup(() => o.disconnect()) })
  const prevBox = (c) => { if (dockLayout.value) return { w: 176, h: 176 }; const b = sheetBox(c); const g = gridOf(Math.max(480, width.value)); const px = ROW_PX.value(b.cls); return { w: Math.round(b.span * g.unit + (b.span - 1) * UNIT_GAP), h: Math.round(px * b.rows + (b.rows - 1) * UNIT_GAP) } }
  // ---- the gallery: every tile the overview can show (those on it are marked 已添加), by category, each with its sizes
  const gallerySource = computed(() => {
    const all = allCards.value.filter((c) => c.available && !c.id.startsWith('pin:'))
    const rest = all.filter((c) => !c.id.startsWith('comp:'))
    const comps = all.filter((c) => c.id.startsWith('comp:'))
    const pick = comps.find((c) => c.id === compChoice.value) || comps.find((c) => !shownIds.value.includes(c.id)) || comps[0]
    return comps.length ? [...rest, { ...pick, merged: true, title: T.value.compStatus || 'Component status' }] : rest
  })
  // how a card shows a size that is wider than its column (round22t, measured per frame at 1440: 'grow' moves ten cards by up to 83 px a frame, 'scale' leaves XL at 0.36, 'auto' keeps S, M and L in the column at 0.73 and grows only XL, to 0.76)
  const GALLERY_FIT = 'auto'
  const galleryEntries = computed(() => {
    const q = query.value.trim().toLowerCase()
    return gallerySource.value.filter((c) => (group.value === 'all' || c.group === group.value) && (!q || textOf(c).includes(q))).map((c) => {
      const b = sheetBox(c); const pb = prevBox(c)
      return { id: c.id, card: b, title: c.title, group: c.group, merged: !!c.merged, added: shownIds.value.includes(c.id), sizeKeys: b.sizeKeys, sizeKey: b.sizeKey, size: b.size, w: pb.w, h: pb.h }
    })
  })
  const galleryGroups = computed(() => [{ id: 'all', title: T.value.all || 'All', icon: 'apps', count: gallerySource.value.length }, ...GROUPS.filter((g) => gallerySource.value.some((c) => c.group === g)).map((g) => ({ id: g, title: T.value['gGroup_' + g] || g, icon: GROUP_ICON[g] || 'apps', count: gallerySource.value.filter((c) => c.group === g).length }))])
  const galleryVariants = computed(() => allCards.value.filter((c) => c.id.startsWith('comp:') && c.available).map((v) => ({ id: v.id, label: compName(v), on: v.id === (gallerySource.value.find((c) => c.merged)?.id) })))
  const sheetAway = ref(false)
  const notify = useNotify()
  const landing = ref('')
  let landTimer = 0
  // the card is placed: it arrives on the spring, the overview is shown, and the snackbar offers the way back
  function placed(id, before) {
    pickerOpen.value = false; sheetAway.value = false
    landing.value = id; clearTimeout(landTimer); landTimer = setTimeout(() => { landing.value = '' }, 900)
    nextTick(() => { const el = grid.value?.querySelector(`[data-card="${CSS.escape(id)}"]`) || root.value?.querySelector(`[data-card="${CSS.escape(id)}"]`); el?.scrollIntoView?.({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' }) })
    notify.snack((T.value.galSnack || 'Added: {name}').replace('{name}', titleOf(id)), { action: T.value.galUndo || 'Undo', timeout: 6000, onAction: () => { layout.restore(before); say(`${titleOf(id)}: ${T.value.hide}`) } })
  }
  // 添加: the tile takes the first free place of the arrangement (the packer fills the first hole it fits), the gallery slides away and the tile arrives on the spring
  function addFromGallery(id) {
    const before = layout.snapshot()
    addCard(id)
    sheetAway.value = true
    setTimeout(() => placed(id, before), reducedMotion() ? 0 : 280)
  }
  const live = ref('')
  const say = (text) => { live.value = ''; nextTick(() => { live.value = text }) }
  const titleOf = (id) => allCards.value.find((c) => c.id === id)?.title || id
  function addCard(id) {
    layout.setVisible(id, true)
    const card = allCards.value.find((c) => c.id === id)
    if (card) layout.setSize(id, sheetKeyOf(card))
    const last = shownIds.value[shownIds.value.length - 1]
    if (last && last !== id) layout.moveTo(id, last)
    say(`${T.value.addCard}: ${titleOf(id)}`)
  }
  function setCardSize(id, size) { if (isStackId(id)) { stacks.setFlags(id, { size }); say(`${titleOf(id)}: ${T.value['sizeName' + size.toUpperCase()]}`); return } layout.setSize(id, size); say(`${titleOf(id)}: ${T.value['sizeName' + size.toUpperCase()]}`) }
  function removeCard(id) { if (D.sel.value === id) D.sel.value = ''; if (isStackId(id)) { stacks.dissolve(id); say(`${T.value.stackDissolve || '拆散轮换组'}`); return } if (id.startsWith('pin:')) layout.removePin(id); else layout.setVisible(id, false); say(`${T.value.hide}: ${titleOf(id)}`) }
  function resize(id, step = 1) {
    const c = allCards.value.find((x) => x.id === id)
    if (!c) return
    const keys = sizeKeysOf(c)
    if (keys.length < 2) return
    const now = effectiveSize(c, layout.state.sizes[id], windowClass.value, 'manual', { height: tall.value })
    setCardSize(id, keys[(keys.indexOf(now) + step + keys.length) % keys.length])
  }
  Object.assign(D, { GALLERY_FIT, ROW_PX, addCard, addFromGallery, compChoice, galleryEntries, galleryGroups, galleryVariants, group, landing, live, pickerOpen, placed, query, removeCard, resize, say, setCardSize, sheetAway, sheetEl, sheetSize, titleOf })
}
