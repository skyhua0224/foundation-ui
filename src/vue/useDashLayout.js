import { computed, reactive, watch } from 'vue'
import { CARD_META, DEFAULT_ORDER, defaultVisible } from './homeCards.js'
import { MAX_PINS } from '../pins/registry.js'
import { ALL_SIZE_KEYS } from './homeSizes.js'
import { migrateLayout } from './layoutMigrate.js'

/**
 * Which home cards are shown and in what order, kept locally per interface (`foundation-ui.dash2.<key>`). Any card may go anywhere:
 * `order` holds the whole catalogue (so a card that is unavailable now keeps its place), `overrides` the cards the person showed or hid;
 * a card without an override follows its default (live cards while streaming, the get started cards on a new setup); `sizes` holds the
 * size (s, m, l) the person chose for a card, a card without one has its default size.
 */
export const LAYOUT_VERSION = 8
/** Sizes a tile no longer has, and the size a layout that kept it gets instead: 网卡 has no 方形 (it needs a name, a speed and the way to change the adapter), a saved 方形 is 中. */
export const RETIRED_SIZES = Object.freeze({ net: Object.freeze({ s: 'm' }) })
/** The id of a pinned tile: the setting it controls (or opens). */
export const pinIdOf = (spec) => `pin:${spec.type}:${spec.key}`
const PIN_TYPES = ['setting', 'link']
const cleanPin = (id, d) => {
  if (!d || typeof d !== 'object' || !PIN_TYPES.includes(d.type) || typeof d.key !== 'string' || !d.key || id !== pinIdOf(d)) return null
  const pick = { type: d.type, key: d.key, title: String(d.title || d.key).slice(0, 80), icon: String(d.icon || 'tune').slice(0, 40) }
  if (d.type === 'link') return pick
  if (!['switch', 'seg', 'slider'].includes(d.control)) return null
  const out = { ...pick, control: d.control, tier: d.tier === 1 ? 1 : 2, ...(d.risk ? { risk: String(d.risk) } : {}) }
  if (d.control === 'switch') return { ...out, on: d.on, off: d.off, def: d.def }
  if (d.control === 'seg') return Array.isArray(d.options) && d.options.length ? { ...out, def: d.def, options: d.options.slice(0, 8).map((o) => ({ value: String(o.value), label: String(o.label) })) } : null
  const n = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback)
  return { ...out, def: n(d.def, 0), min: n(d.min, 0), max: n(d.max, 100), step: n(d.step, 1), unit: String(d.unit || ''), scale: n(d.scale, 1) || 1, zeroText: String(d.zeroText || '') }
}
export function useDashLayout(storageKey, storage = globalThis.localStorage) {
  const key = `foundation-ui.dash2.${storageKey}`
  const read = () => {
    try {
      const v = JSON.parse(storage?.getItem(key) || 'null')
      if (v && typeof v === 'object') {
        const pins = {}
        for (const [id, d] of Object.entries(v.pins || {})) { const clean = cleanPin(id, d); if (clean && Object.keys(pins).length < MAX_PINS) pins[id] = clean }
        const known = (id) => DEFAULT_ORDER.includes(id) || id in pins
        const ids = Array.isArray(v.order) ? v.order.filter((id) => typeof id === 'string').slice(0, 64) : []
        let order = [...new Set([...ids.filter(known), ...Object.keys(pins), ...DEFAULT_ORDER])]
        // version 3 ships the 配对 card after the host card: a layout saved before it gets the card there (the person's own order is kept)
        if ((v.v || 0) < 3 && order.includes('hero')) { order = order.filter((id) => id !== 'pair'); order.splice(order.indexOf('hero') + 1, 0, 'pair') }
        // version 5 ships the connect journey as the first card (a layout of the person keeps its order, the card goes in front)
        if ((v.v || 0) < 5) order = ['journey', ...order.filter((id) => id !== 'journey')]
        // version 6 ships the star card (due after the first pairing or stream, back at every stream after 以后再说): after the host card and the pairing card; the person's own order is kept
        if ((v.v || 0) < 6 && order.includes('hero')) { order = order.filter((id) => id !== 'star'); order.splice(Math.max(order.indexOf('hero'), order.indexOf('pair')) + 1, 0, 'star') }
        const overrides = Object.fromEntries(Object.entries(v.overrides || {}).filter(([id, x]) => known(id) && typeof x === 'boolean'))
        const sizes = Object.fromEntries(Object.entries(v.sizes || {}).filter(([id, x]) => known(id) && ALL_SIZE_KEYS.includes(x)))
        // version 7: the overview is smart by default (the tiles follow what the host is doing); a layout saved before keeps what the person arranged (manual), a layout nobody touched is smart
        const touched = Object.keys(overrides).length || Object.keys(sizes).length || Object.keys(pins).length
        const mode = (v.v || 0) >= 7 ? (v.mode === 'manual' ? 'manual' : 'smart') : touched ? 'manual' : 'smart'
        const strings = (x) => (Array.isArray(x) ? x.filter((i) => typeof i === 'string').slice(0, 64) : [])
        const sectionOf = Object.fromEntries(Object.entries(v.sectionOf || {}).filter(([id, n]) => known(id) && Number.isInteger(n) && n >= 0 && n < 8))
        const loaded = { order, overrides, sizes, pins, mode, accepted: strings(v.accepted), hiddenSuggest: strings(v.hiddenSuggest), sectionOf, sectionCount: Number.isInteger(v.sectionCount) && v.sectionCount >= 0 && v.sectionCount <= 8 ? v.sectionCount : 0 }
        // a size a tile no longer has is read as its replacement only after the legacy migration has seen what the person saved (a saved 方形 is a choice of theirs, not the default)
        const { state: legacy, migrated: changed } = migrateLayout(loaded, v.v)
        const migrated = { ...legacy, sizes: Object.fromEntries(Object.entries(legacy.sizes || {}).map(([id, k]) => [id, RETIRED_SIZES[id]?.[k] || k])) }
        if (changed) { try { storage?.setItem(key, JSON.stringify({ v: LAYOUT_VERSION, order: migrated.order, overrides: migrated.overrides, sizes: migrated.sizes, pins: migrated.pins, mode: migrated.mode, accepted: migrated.accepted, hiddenSuggest: migrated.hiddenSuggest, sectionOf: migrated.sectionOf, sectionCount: migrated.sectionCount })) } catch { /* storage unavailable */ } }
        return migrated
      }
    } catch { /* corrupted: defaults */ }
    return { order: [...DEFAULT_ORDER], overrides: {}, sizes: {}, pins: {}, mode: 'smart', accepted: [], hiddenSuggest: [], sectionOf: {}, sectionCount: 0 }
  }
  const state = reactive(read())
  /** Read the saved layout again (another part of the page changed it). */
  const reload = () => { Object.assign(state, read()) }
  watch(state, () => { try { storage?.setItem(key, JSON.stringify({ v: LAYOUT_VERSION, order: state.order, overrides: state.overrides, sizes: state.sizes, pins: state.pins, mode: state.mode, accepted: state.accepted, hiddenSuggest: state.hiddenSuggest, sectionOf: state.sectionOf, sectionCount: state.sectionCount })) } catch { /* storage unavailable */ } }, { deep: true, flush: 'sync' })

  const isVisible = (card, ctx) => card.available && (state.overrides[card.id] ?? defaultVisible(card.def, ctx))
  const sorted = (cards) => [...cards].sort((a, b) => state.order.indexOf(a.id) - state.order.indexOf(b.id))
  /** The cards on the page, in the person's order. */
  const visible = (cards, ctx) => sorted(cards).filter((c) => isVisible(c, ctx))
  /** Cards that could be added now: they have data and are hidden. */
  const addable = (cards, ctx) => sorted(cards).filter((c) => c.available && !isVisible(c, ctx))

  const valid = (id) => DEFAULT_ORDER.includes(id) || id in state.pins
  const shownById = (x) => state.overrides[x] === true || (state.overrides[x] === undefined && CARD_META[x]?.def === 'always')
  function moveTo(id, targetId) {
    if (id === targetId) return
    const list = state.order.filter((x) => x !== id)
    const from = state.order.indexOf(id)
    const to = list.indexOf(targetId)
    if (from < 0 || to < 0) return
    // moving later puts it after the target, moving earlier before it
    list.splice(from < state.order.indexOf(targetId) ? to + 1 : to, 0, id)
    state.order = list
  }
  return {
    state, reload, visible, addable, isVisible, moveTo,
    /** One step earlier or later among the visible cards (the keyboard). */
    step(id, delta, visibleIds) {
      const i = visibleIds.indexOf(id)
      const target = visibleIds[i + delta]
      if (i >= 0 && target) moveTo(id, target)
    },
    setSize(id, size) { if (valid(id) && ALL_SIZE_KEYS.includes(size)) state.sizes = { ...state.sizes, [id]: size } },
    setVisible(id, on) { if (valid(id)) state.overrides = { ...state.overrides, [id]: !!on } },
    /** Pin a setting (a tile with its control, or a link to its page): shown, after the last card that is shown. false when the layout is full or the spec is not a pin. */
    addPin(spec) {
      const id = pinIdOf(spec || {})
      const clean = cleanPin(id, spec)
      if (!clean) return false
      if (!(id in state.pins) && Object.keys(state.pins).length >= MAX_PINS) return false
      state.pins = { ...state.pins, [id]: clean }
      state.overrides = { ...state.overrides, [id]: true }
      const rest = state.order.filter((x) => x !== id)
      const at = rest.map(shownById).lastIndexOf(true) + 1
      state.order = [...rest.slice(0, at), id, ...rest.slice(at)]
      return true
    },
    /** Take a pinned tile away for good (it is not kept hidden: pinning it again adds it again). */
    removePin(id) {
      if (!(id in state.pins)) return false
      const { [id]: _gone, ...pins } = state.pins
      const { [id]: _o, ...overrides } = state.overrides
      const { [id]: _s, ...sizes } = state.sizes
      state.pins = pins; state.overrides = overrides; state.sizes = sizes; state.order = state.order.filter((x) => x !== id)
      return true
    },
    isPinned: (id) => id in state.pins,
    reset() { state.order = [...DEFAULT_ORDER]; state.overrides = {}; state.sizes = {}; state.pins = {}; state.mode = 'smart'; state.accepted = []; state.hiddenSuggest = []; state.sectionOf = {}; state.sectionCount = 0 },
    /** Smart or manual. Editing the layout is manual: `freeze` copies what the smart plan shows into the saved layout first, so nothing jumps; `smart` gives the plan back (the pins stay). */
    setMode(mode) { state.mode = mode === 'manual' ? 'manual' : 'smart' },
    freeze(plan) {
      const keep = new Set(plan.visible)
      const known = state.order.filter((id) => DEFAULT_ORDER.includes(id) || id in state.pins)
      state.order = [...plan.visible.filter((id) => known.includes(id)), ...known.filter((id) => !keep.has(id))]
      const overrides = {}
      for (const id of known) overrides[id] = keep.has(id)
      state.overrides = overrides
      state.sizes = { ...state.sizes, ...Object.fromEntries(Object.entries(plan.sizes || {}).filter(([id]) => known.includes(id))) }
      state.mode = 'manual'
    },
    /** A suggestion the person took (the plan keeps it) or turned away for good. */
    accept(id) { if (!state.accepted.includes(id)) state.accepted = [...state.accepted, id].slice(-32) },
    hideSuggestion(id) { if (!state.hiddenSuggest.includes(id)) state.hiddenSuggest = [...state.hiddenSuggest, id].slice(-64) },
    /** Sections (a very wide window): the section a tile is in, and how many sections there are (0: the default of the window). */
    setSection(id, n) { if (valid(id) && Number.isInteger(n) && n >= 0 && n < 8) state.sectionOf = { ...state.sectionOf, [id]: n } },
    setSectionCount(n) { state.sectionCount = Math.max(0, Math.min(8, Math.round(n))); state.sectionOf = Object.fromEntries(Object.entries(state.sectionOf).map(([id, s]) => [id, Math.min(s, Math.max(0, state.sectionCount - 1))])) },
    snapshot: () => JSON.stringify({ order: state.order, overrides: state.overrides, sizes: state.sizes, pins: state.pins, sectionOf: state.sectionOf }),
    restore(snap) { const v = JSON.parse(snap); state.order = v.order; state.overrides = v.overrides; state.sizes = v.sizes || {}; state.pins = v.pins || {}; state.sectionOf = v.sectionOf || {} },
    isDefault: computed(() => state.mode === 'smart' && state.order.every((id, i) => id === DEFAULT_ORDER[i]) && !Object.keys(state.overrides).length && !Object.keys(state.sizes).length && !Object.keys(state.pins).length),
  }
}
