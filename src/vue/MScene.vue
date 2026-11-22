<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { barSideOf, calculateScene, canExpand, layoutOf, listDetailStrategy, navigationOf, railWidthOf, settledWidth, supportingPaneStrategy } from '../nav/scenes.js'
import MRail from './MRail.vue'
import MSheet from './MSheet.vue'
import { watchPixelRatio } from '../nav/dpr.js'
import { playPageEnter } from '../nav/pageEnter.js'
import { createPaneScroll, placeOf } from '../nav/paneScroll.js'
import { noteResize, trackWindowResize, watchResizing } from '../nav/resizing.js'
import { useFabLift } from './useFabLift.js'
import { bottomStack } from '../notify/stack.js'
import { MODAL_CLOSE, MODAL_FRAME, MODAL_OPEN, modalsAfter, modalsAfterFrameGone } from './useModalBridge.js'

/**
 * Renders the scene that the strategies calculate from the back stack and the width of this element (not the window:
 * the Web UI can sit inside the panel's frame). The persistent rail (a bottom bar when narrow) wraps every scene.
 * The three panes stay mounted, so a resize never reloads a page or loses scroll position or an unsaved edit; crossing a
 * breakpoint animates the columns with a spatial spring. Keyboard: Esc back, ? the shortcut sheet (the search keys belong to the product's search bar).
 */
const props = defineProps({
  nav: { type: Object, required: true },
  railItems: { type: Array, required: true },
  /** the destinations of the bottom bar of a narrow window (the Material navigation bar takes three to five), and the one of them that is current; the rail's own list when not given */
  barItems: { type: Array, default: null },
  barCurrent: { type: String, default: '' },
  strategies: { type: Array, default: null },
  storageKey: { type: String, default: 'foundation-ui.list-width' },
  texts: { type: Object, default: () => ({}) },
  shortcuts: { type: Array, default: () => [] },
  /** selector of the product's own bar over the top of the window (it sits outside the scene): it is not reachable while a modal of an embedded page is open */
  captionSelector: { type: String, default: '.panel-caption, .web-caption' },
  /** show the `overlay` slot over the detail pane (content that must stay mounted, such as an embedded frame) */
  overlay: { type: Boolean, default: false },
  /** the host cannot be used: the list and the detail are inert and give way, the `overlay` slot is the whole content area (the rail and the caption stay); everything stays mounted, so an unsaved edit is there when the host is back */
  status: { type: Boolean, default: false },
  /** height of a caption bar the product draws over the top of the window beside the rail (the rail itself runs the full height) */
  captionHeight: { type: Number, default: 0 },
  /** the app-wide history of jumps (createJumpHistory): Alt+Left goes back through it when the page has no back of its own */
  jumps: { type: Object, default: null },
  /** the chip of the global back (variant B) is shown: the `back-chip` slot is drawn at the top of the detail pane and the page starts under it */
  chip: { type: Boolean, default: false },
})
const emit = defineEmits(['rail'])
const T = computed(() => ({ resize: 'Resize list', main: 'Main', shortcuts: 'Keyboard shortcuts', back: 'Back', search: 'Search', help: 'Show this list', section: 'Go to section', close: 'Close', expand: 'Expand navigation', collapse: 'Collapse navigation', ...props.texts }))
const root = ref(null)
const size = ref({ width: 1024, height: 768, bar: 0 })
const animating = ref(false)
// the width the pane that fills the space has once the columns have slid (px; null = no slide on): see `style`
const settleWidth = ref(null)
const dragging = ref(false)
const resizing = ref(false)
let stopPixelRatio = () => {}
let stopResizing = () => {}
const help = ref(false)
const preferred = ref(null)
try { const v = Number(localStorage.getItem(props.storageKey)); if (v > 0) preferred.value = v } catch { /* storage unavailable */ }
// the expanded rail is the person's choice, kept per interface (the same key as the list width, with .rail)
const railKey = `${props.storageKey}.rail`
const expandedChoice = ref(false)
try { expandedChoice.value = localStorage.getItem(railKey) === 'expanded' } catch { /* storage unavailable */ }
const toggleRail = () => { expandedChoice.value = !expandedChoice.value; try { localStorage.setItem(railKey, expandedChoice.value ? 'expanded' : 'collapsed') } catch { /* storage unavailable */ } }

let observer = null
let barObserver = null
let observedBar = null
let readSize = null
onMounted(() => {
  const read = () => {
    const r = root.value.getBoundingClientRect()
    const next = { width: Math.round(r.width), height: Math.round(r.height), bar: root.value.classList.contains('m-scene--side') ? 0 : root.value.querySelector('.m-scene__bar')?.offsetHeight || 0 }
    // a window that is being resized is not animated: the columns are what the size says in the same frame, and the spring only moves what the person asked for (the rail, the list)
    if (next.width !== size.value.width || next.height !== size.value.height) { noteResize(); animating.value = false; settleWidth.value = null }
    size.value = next
    bottomStack.setBarRoom(next.bar)
    // the bar can change its own height (a label, a badge, the font) without the scene changing its size
    const barEl = root.value.classList.contains('m-scene--side') ? null : root.value.querySelector('.m-scene__bar')
    if (barEl !== observedBar) { barObserver?.disconnect(); observedBar = barEl; if (barEl) barObserver?.observe(barEl) }
  }
  readSize = read
  barObserver = new ResizeObserver(read)
  read()
  observer = new ResizeObserver(read)
  observer.observe(root.value)
  // a move to a monitor with another scale, a change of the Windows scale: the size is read again at once, whatever resize events do or do not come
  stopPixelRatio = watchPixelRatio(() => { noteResize(); read() })
  trackWindowResize()
  stopResizing = watchResizing((v) => { resizing.value = v })
})
// the shortcuts also work while nothing has the focus (right after the page opened): then the key arrives at the body
// (and from the product's own bar over the window, where a button that was just pressed, the bell or the connect button, keeps the focus)
const onWindowKey = (event) => { if (root.value && (event.target === document.body || event.target.closest?.(props.captionSelector))) keydown(event) }
onMounted(() => window.addEventListener('keydown', onWindowKey))
onBeforeUnmount(() => { bottomStack.setBarRoom(0); observer?.disconnect(); barObserver?.disconnect(); stopPixelRatio(); stopResizing(); window.removeEventListener('keydown', onWindowKey) })

// The shell fills the window exactly (html.m-shell, layout.css): only the panes scroll. Nothing else may ever move, whatever asks for it:
// a scrollIntoView or a focus reaches every ancestor, and an element with overflow hidden can be scrolled by a script, so the frame is
// clipped (not hidden) and, as the last guard, a pane never scrolls sideways and the document never scrolls at all.
const keepDocument = () => { if (window.scrollX || window.scrollY) window.scrollTo(0, 0) }
const keepSide = (event) => { if (event.target.scrollLeft) event.target.scrollLeft = 0 }
onMounted(() => { document.documentElement.classList.add('m-shell'); window.addEventListener('scroll', keepDocument, { passive: true }) })
onBeforeUnmount(() => { document.documentElement.classList.remove('m-shell'); window.removeEventListener('scroll', keepDocument) })

// the choice stays; the rail only shows collapsed while the window is too narrow to keep list and detail usable
const mode = computed(() => navigationOf(size.value.width, expandedChoice.value, size.value.height))
// the compact navigation of a short window stands beside the content (a narrow rail) and takes no height; in a tall narrow one it is the bar at the bottom
const side = computed(() => mode.value === 'bar' && barSideOf(size.value.width, size.value.height))
const bottomBar = computed(() => mode.value === 'bar' && !side.value)
// the bar's height is read again once the bar is there (it is not in the page while the window is wide)
watch([mode, side], () => nextTick(() => readSize?.()))
const toggleable = computed(() => canExpand(size.value.width) && mode.value !== 'bar')
const railWidth = computed(() => railWidthOf(mode.value, side.value))
const space = computed(() => size.value.width - railWidth.value)
// the compact navigation has the phone's flow: one pane, the hubs of the bar, whatever the width of the window
const strategies = computed(() => (mode.value === 'bar' ? [] : props.strategies || [supportingPaneStrategy(), listDetailStrategy()]))
const scene = computed(() => calculateScene(strategies.value, props.nav.entries.value, { width: size.value.width, height: size.value.height, defaultDetailOf: props.nav.defaultDetailOf, railWidth: railWidth.value }))
// A page that is being read (an open issue) asks for the whole width: `focus` (provided as `scene.focus`) folds the list pane away while it is on, and the page lets go of it when it closes. The rail, the caption and a
// single pane scene are not touched; a rail click or another page ends it.
const focus = ref(false)
const layout = computed(() => layoutOf(scene.value, space.value, { listPreferred: preferred.value, focus: focus.value }))
watch(() => props.nav.top.value?.key, () => { focus.value = false })

// The detail pane keeps showing the last detail entry while the list covers it (single pane), so its state survives.
const lastDetail = ref(null)
const detailEntry = computed(() => scene.value.panes.detail || props.nav.detail.value || lastDetail.value)
watch(detailEntry, (e) => { if (e) lastDetail.value = e }, { immediate: true })
// Every change of the destination plays the one page enter on the detail pane (nav/pageEnter.js), whether or not the page draws an MPage; pages in a frame (the `overlay` slot) are the product's.
const detailInner = ref(null)
watch(() => detailEntry.value?.key, (key, before) => { if (key && before !== undefined && key !== before) nextTick(() => playPageEnter(detailInner.value)) })
// The detail pane is one scroll box whose content is swapped: a page that is opened starts at the top, and a page that is reached again by going back (the page's own back, or the global back of
// a jump) opens where it was left (nav/paneScroll.js). The watcher runs before the DOM is patched, so the pane still has the height of the page being left.
const detailPane = ref(null)
const paneScroll = createPaneScroll()
const shown = new Set() // the entries that were on show: one that comes again was reached by going back
watch(() => detailEntry.value, (entry, before) => {
  if (!entry || !before || entry.key === before.key || !detailPane.value) return
  const back = shown.has(entry.key) || !!props.jumps?.returning?.()
  shown.add(before.key)
  if (shown.size > 64) shown.delete(shown.values().next().value)
  paneScroll.leave(placeOf(before), detailPane.value.scrollTop)
  nextTick(() => { if (detailPane.value) detailPane.value.scrollTop = paneScroll.enter(placeOf(entry), back) })
}, { flush: 'pre' })
const listEntry = computed(() => scene.value.panes.list || props.nav.list.value)
const supportingEntry = computed(() => scene.value.panes.supporting || null)

let timer = 0
watch(() => [scene.value.kind, scene.value.visible, mode.value, focus.value], () => {
  if (resizing.value) return
  // Plan on the final width: the watcher runs before the DOM is patched, so the pane still shows what it shows now and its scrollbar can be read; the width it ends at is the column's target less that
  // scrollbar. The page that fills the space lays out at that width for the whole slide (`style`): a page that is opened from another one (the overview from the apps page, where the list folds away) is
  // planned once, at the width it keeps, and the sliding column only shows more or less of it. Nothing is measured on the way, so nothing is arranged twice.
  const pane = root.value?.querySelectorAll(':scope > .m-scene__pane')[fillOf.value]
  settleWidth.value = settledWidth(layout.value, fillOf.value, pane ? pane.offsetWidth - pane.clientWidth : 0)
  animating.value = true
  clearTimeout(timer)
  timer = setTimeout(() => { animating.value = false; settleWidth.value = null }, 520)
})
onBeforeUnmount(() => clearTimeout(timer))

const single = computed(() => scene.value.kind === 'single')
const hasList = computed(() => scene.value.kind !== 'single' || scene.value.visible === 'list')
const fabHost = ref(null)
const { count: fabCount, lift: fabLiftPx } = useFabLift(fabHost)
provide('m-scene', {
  fabHost,
  single,
  mode,
  kind: computed(() => scene.value.kind),
  width: computed(() => size.value.width),
  focus,
  // a page above a hub page (a phone: the list pages of the rails are the hubs, there is no list entry under it) has the arrow too
  canBack: computed(() => (single.value && props.nav.top.value.role !== 'list' && (!!props.nav.list.value || props.nav.depth.value > 1)) || props.nav.pushed.value),
  back: () => props.nav.pop(),
})

// the product's caption bar starts right of the rail: it reads the rail's width from the document
// (the side navigation of a short window starts below the caption bar: the caption has the whole width)
watch([railWidth, side], ([w, s]) => document.documentElement.style.setProperty('--m-rail-w', `${s ? 0 : w}px`), { immediate: true })
// the wallpaper lies in the content panel only (the frame, the rail and the caption bar, is solid): it starts below the caption bar, beside the rail
watch(() => props.captionHeight, (h) => document.documentElement.style.setProperty('--m-caption-h', `${h}px`), { immediate: true })
onBeforeUnmount(() => { document.documentElement.style.removeProperty('--m-rail-w'); document.documentElement.style.removeProperty('--m-caption-h') })
// with a caption bar and a rail the two are one L-shaped frame and the content is an inset panel with a rounded corner where it meets the frame
const framed = computed(() => props.captionHeight > 0 && !bottomBar.value)
// The window's material: the frame (the rail and the caption bar as one L, the bar at the bottom) is the most solid, the list pane fades from nearly the frame's tone
// to the content panel's across its width, the content panel (detail and supporting panes) is the lightest. The frame is drawn as the whole window less a hole, a clip path
// (layout.css); the panel is a box whose top-left corner is rounded where it meets the frame, with a hairline and a soft shadow along the seam.
// the outside of a scrim clip: larger than any window, so a width that was measured a moment ago can never leave a strip of the window undimmed
const OUTER = 'M-4000 -4000H24000V24000H-4000Z'
const regions = computed(() => {
  const W = size.value.width, H = size.value.height
  if (!W || !H) return {}
  const x = bottomBar.value ? 0 : railWidth.value, cx = railWidth.value + (bottomBar.value ? 0 : layout.value.cols[0]), y = props.captionHeight, bar = bottomBar.value ? size.value.bar : 0, bottom = H - bar, r = framed.value ? 24 : 0
  const modalHole = `M${cx} ${y}H${W}V${bottom}H${cx}Z`
  return { '--m-modal-clip': `path(evenodd, '${OUTER}${modalHole}')`, '--m-content-x': `${cx}px`, '--m-content-y': `${y}px`, '--m-content-b': `${bar}px`, '--m-seam-r': `${r}px`, '--m-content-r': `${layout.value.cols[0] === 0 || bottomBar.value ? r : 0}px` }
})

// ---- a modal of an embedded page (the overlay slot): the page cannot dim the window around its frame, so it tells the shell (useModalBridge) and the shell lays the same scrim
// over the rail, the list and the caption bar. A click on that scrim or Esc closes the modal on top, as the page's own scrim does; the shell is inert meanwhile (the focus stays in the modal).
const modals = ref(new Set())
const modalOpen = computed(() => modals.value.size > 0)
const frameOf = (source) => [...document.querySelectorAll('iframe')].find((f) => f.contentWindow === source) || null
const frameRect = ref(null)
// the scrim leaves the frame's own rectangle bare (the page dims that part with its own scrim); measured, not calculated: on a narrow window the product puts a bar above the frame
const measure = (frame) => { const r = frame?.getBoundingClientRect(); frameRect.value = r && r.width && r.height ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null }
let measured = null
const modalClip = computed(() => {
  const W = size.value.width || window.innerWidth, H = size.value.height || window.innerHeight, r = frameRect.value
  return r ? `path(evenodd, '${OUTER} M${r.l} ${r.t}H${r.r}V${r.b}H${r.l}Z')` : regions.value['--m-modal-clip']
})
function onModalMessage(event) {
  const d = event.data
  const frame = d && d.type === MODAL_OPEN ? frameOf(event.source) : null
  if (!frame || typeof d.id !== 'string') return
  measured = frame
  measure(frame)
  tellFrame(event.source)
  modals.value = modalsAfter(modals.value, d)
}
// where the window's centre is, seen from the frame: a centred dialog of the page moves by this much, so it stands in the middle of the whole window and not of the frame
function tellFrame(target) {
  const r = frameRect.value
  if (!r || !target) return
  const W = size.value.width || window.innerWidth, H = size.value.height || window.innerHeight
  target.postMessage({ type: MODAL_FRAME, dx: Math.round(W / 2 - (r.l + r.r) / 2), dy: Math.round(H / 2 - (r.t + r.b) / 2) }, '*')
}
function closeFrameModal() { for (const f of document.querySelectorAll('iframe')) f.contentWindow?.postMessage({ type: MODAL_CLOSE }, '*') }
// A modal open in the frame must not outlive the frame's page: when the person goes to a page of the shell (the frame is hidden) or the frame loads another page, the modals are closed
// (every one that is open: the frame closes the one on top for each message) and the shell forgets them, so no scrim can be left behind with nothing to close it.
function dropFrameModals() {
  if (!modals.value.size) return
  for (let i = 0; i < 4; i += 1) closeFrameModal()
  modals.value = modalsAfterFrameGone()
}
watch(() => props.overlay, (on) => { if (!on) dropFrameModals() })
const onFrameLoad = (event) => { if (event.target instanceof HTMLIFrameElement && modals.value.size) modals.value = modalsAfterFrameGone() }
function onModalKey(event) { if (event.key === 'Escape' && modalOpen.value) { event.preventDefault(); event.stopPropagation(); closeFrameModal() } }
const onModalResize = () => { if (modalOpen.value) { measure(measured); tellFrame(measured?.contentWindow) } }
watch(modalOpen, (on) => {
  // the window around a frame that has a modal open is held to the rules of a modal (src/a11y/modalLayer.js: no window menu, no wheel)
  document.documentElement.toggleAttribute('data-modal-frame', on)
  for (const el of document.querySelectorAll(props.captionSelector)) { if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert') }
})
onMounted(() => { window.addEventListener('message', onModalMessage); window.addEventListener('keydown', onModalKey, true); window.addEventListener('resize', onModalResize); document.addEventListener('load', onFrameLoad, true) })
onBeforeUnmount(() => { document.documentElement.removeAttribute('data-modal-frame'); window.removeEventListener('message', onModalMessage); window.removeEventListener('keydown', onModalKey, true); window.removeEventListener('resize', onModalResize); document.removeEventListener('load', onFrameLoad, true); for (const el of document.querySelectorAll(props.captionSelector)) el.removeAttribute('inert') })

const hidden = (index) => layout.value.cols[index] === 0
// RZ2: the width of the page is never a number that was measured a frame ago. The pane that fills the space (the visible one of a single scene, the detail of the others) is a CSS track
// (minmax(0, 1fr)) and its content lays out at 100% of it, so the layout pass of the frame itself decides its width, whatever the observer has delivered yet; the numbers measured from the
// window only choose the fixed panes (the list, the supporting pane), and those are clamped to the room that is left (min(), calc()), so a stale number can shrink the page for a frame but
// never push anything past the window. A pane that is hidden keeps the width it lays out at (it stays mounted), it has no column.
const fillOf = computed(() => (scene.value.kind === 'single' && scene.value.visible === 'list' ? 0 : 1))
const style = computed(() => {
  const L = layout.value, fill = fillOf.value, rail = railWidth.value
  const fixed = L.cols.reduce((n, w, i) => n + (i === fill ? 0 : w), 0)
  const col = (i) => (i === fill ? 'minmax(0, 1fr)' : `max(0px, min(${L.cols[i]}px, calc(100% - ${rail}px - ${fixed - L.cols[i]}px)))`)
  // while the columns slide the fill pane's page keeps the width it will have (settleWidth); at rest, and while the list is dragged or the window resized, it is the track itself (100%)
  const fillInner = animating.value && !dragging.value && !resizing.value && settleWidth.value !== null ? `${settleWidth.value}px` : '100%'
  const inner = (i) => (i === fill ? fillInner : `${L.inner[i]}px`)
  return {
    '--m-caption': `${props.captionHeight}px`,
    '--c-rail': `${rail}px`,
    ...regions.value,
    '--c-list': `${L.cols[0]}px`, '--c-detail': `${L.cols[1]}px`, '--c-sup': `${L.cols[2]}px`, // the numbers (the list's fill, the overlay and the buttons are placed with them)
    '--t-list': col(0), '--t-detail': col(1), '--t-sup': col(2), // the tracks of the scene's grid
    '--w-list': inner(0), '--w-detail': inner(1), '--w-sup': inner(2),
  }
})

function startDrag(event) {
  dragging.value = true
  const startX = event.clientX
  const start = layout.value.cols[0]
  const el = event.currentTarget
  el.setPointerCapture(event.pointerId)
  const move = (e) => { preferred.value = start + (e.clientX - startX) }
  const up = () => { dragging.value = false; el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); persist() }
  el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
}
function persist() { try { preferred.value == null ? localStorage.removeItem(props.storageKey) : localStorage.setItem(props.storageKey, String(Math.round(layout.value.cols[0]))) } catch { /* ignore */ } }
const nudge = (delta) => { preferred.value = layout.value.cols[0] + delta; persist() }
const reset = () => { preferred.value = null; persist() }

const typing = (t) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.tagName.startsWith('MD-'))
function keydown(event) {
  if (event.defaultPrevented || event.altKey && event.key !== 'ArrowLeft') return
  const t = event.target
  if (event.key === 'Escape' && !typing(t) && props.nav.canPop.value && !document.querySelector('dialog[open]')) { props.nav.pop(); event.preventDefault() }
  else if (event.key === 'ArrowLeft' && event.altKey) {
    if (props.nav.canPop.value) props.nav.pop()
    else if (props.jumps && props.jumps.canBack.value) props.jumps.back()
    else props.nav.pop()
    event.preventDefault()
  }
  else if (event.key === '?' && !typing(t)) { help.value = true; event.preventDefault() }
  else if ((event.ctrlKey || event.metaKey) && /^[1-9]$/.test(event.key)) {
    const item = props.railItems[Number(event.key) - 1]
    if (item) { emit('rail', item); event.preventDefault() }
  }
}
const allShortcuts = computed(() => [
  { keys: ['Esc'], label: T.value.back },
  { keys: ['/'], label: T.value.search }, { keys: ['Ctrl', 'K'], label: T.value.search },
  { keys: ['Ctrl', '1…9'], label: T.value.section },
  { keys: ['?'], label: T.value.help },
  ...props.shortcuts,
])
</script>

<template>
  <div ref="root" class="m-scene" :class="[`m-scene--${scene.kind}`, `m-scene--${mode}`, { 'm-scene--side': side, 'm-scene--framed': framed, 'm-scene--status': status, 'is-animating': animating && !dragging && !resizing, 'is-dragging': dragging, 'm-scene--fab': fabCount > 0, 'm-scene--backchip': chip && !!$slots['back-chip'] }]" :style="style" @keydown="keydown">
    <div class="m-scene__listfill" aria-hidden="true" />
    <div class="m-scene__seam" aria-hidden="true" />
    <div class="m-scene__railfill" aria-hidden="true" />
    <div class="m-scene__corner" aria-hidden="true" />
    <div class="m-scene__barfill" aria-hidden="true" />
    <MRail v-if="mode !== 'bar'" class="m-scene__rail" :inert="modalOpen ? '' : undefined" :items="railItems" :current="nav.rail.value" :mode="mode" :label="T.main" :can-toggle="toggleable" :expand-label="T.expand" :collapse-label="T.collapse" :show-name="captionHeight === 0" @select="(i) => { focus = false; emit('rail', i) }" @toggle="toggleRail">
      <template v-if="$slots['rail-head']" #head><slot name="rail-head" /></template>
      <template v-if="$slots['rail-foot']" #foot><slot name="rail-foot" /></template>
    </MRail>
    <section class="m-scene__pane m-scene__pane--list" :class="{ 'is-hidden': hidden(0) }" @scroll.passive="keepSide" :inert="hidden(0) || modalOpen || status ? '' : undefined" :aria-hidden="hidden(0) || undefined">
      <div class="m-scene__inner"><slot v-if="listEntry" name="list" :entry="listEntry" :scene="scene" /></div>
    </section>
    <section ref="detailPane" class="m-scene__pane m-scene__pane--detail" :class="{ 'is-hidden': hidden(1) }" @scroll.passive="keepSide" :inert="hidden(1) || status ? '' : undefined" :aria-hidden="hidden(1) || undefined">
      <div ref="detailInner" class="m-scene__inner"><slot v-if="detailEntry" name="detail" :key="detailEntry.key" :entry="detailEntry" :scene="scene" /></div>
    </section>
    <section class="m-scene__pane m-scene__pane--supporting" :class="{ 'is-hidden': hidden(2) }" @scroll.passive="keepSide" :inert="hidden(2) || status ? '' : undefined" :aria-hidden="hidden(2) || undefined">
      <div class="m-scene__inner"><slot v-if="supportingEntry" name="supporting" :key="supportingEntry.key" :entry="supportingEntry" :scene="scene" /></div>
    </section>
    <div v-if="chip && $slots['back-chip']" class="m-scene__backchip"><slot name="back-chip" /></div>
    <div ref="fabHost" class="m-scene__fabs" :class="{ 'is-away': hidden(1) || overlay, 'is-tight': size.width < 480 }" :style="{ '--m-fab-lift': `${fabLiftPx}px` }" />
    <div v-if="$slots.overlay" class="m-scene__overlay" :class="{ 'is-active': overlay }" :inert="overlay ? undefined : ''"><slot name="overlay" /></div>
    <div
      v-if="!single && !focus"
      class="m-scene__handle"
      :class="{ 'is-on': dragging }"
      role="separator"
      aria-orientation="vertical"
      tabindex="0"
      :aria-label="T.resize"
      :aria-valuenow="layout.cols[0]"
      :style="{ left: `${railWidth + layout.cols[0]}px` }"
      @pointerdown.prevent="startDrag"
      @dblclick="reset"
      @keydown.left.prevent="nudge(-16)"
      @keydown.right.prevent="nudge(16)"
    />
    <MRail v-if="mode === 'bar'" class="m-scene__bar" :inert="modalOpen ? '' : undefined" :items="barItems || railItems" :current="barCurrent || nav.rail.value" mode="bar" :side="side" :label="T.main" @select="(i) => emit('rail', i)" />
    <Teleport to="body"><Transition name="m-modalscrim"><div v-if="modalOpen" class="m-scene__modalscrim" :style="{ '--m-modal-clip': modalClip }" aria-hidden="true" @click="closeFrameModal" /></Transition></Teleport>
    <MSheet v-model="help" :title="T.shortcuts" side="center" :close-label="T.close">
      <ul class="m-shortcuts">
        <li v-for="(s, i) in allShortcuts" :key="i"><span>{{ s.label }}</span><span class="m-shortcuts__keys"><kbd v-for="k in s.keys" :key="k">{{ k }}</kbd></span></li>
      </ul>
    </MSheet>
  </div>
</template>
