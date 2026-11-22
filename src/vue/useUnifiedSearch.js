import { computed, onBeforeUnmount, onMounted, ref, unref, watch } from 'vue'
import { buildIndex, search } from '../search/index.js'
import { RECENT_SEARCH_KEY, loadQueries, pushQuery, removeQuery, saveQueries } from '../search/recent.js'

/**
 * The state of the unified search of a product: the query, the index built from `docs`, the grouped results, the recent searches and settings, the active row
 * (arrow keys), the confirmation of a tier 3 action, and the keyboard shortcuts (Ctrl+K, Ctrl+F, "/" when no field has focus; Esc closes).
 *   docs            ref or getter of the docs of the index (see search/index.js)
 *   recentSettings  ref or getter of docs of the recently changed settings, newest first
 *   onChoose(doc)   what a result does (the product navigates, runs, adds a tile); called after the view has closed
 *   storageKey      where the recent searches are kept
 */
export function useUnifiedSearch({ docs, recentSettings = () => [], onChoose, onPin = null, isPinned = null, storageKey = RECENT_SEARCH_KEY, storage = typeof localStorage !== 'undefined' ? localStorage : null, shortcuts = true } = {}) {
  const read = (x) => (typeof x === 'function' ? x() : unref(x))
  const open = ref(false)
  const query = ref('')
  const active = ref(0)
  const confirm = ref(null)
  const pinVersion = ref(0)
  const lastMs = ref(0)
  const recentQueries = ref(loadQueries(storage, storageKey))

  const index = computed(() => buildIndex(read(docs) || []))
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
  const result = computed(() => {
    const t = now()
    const r = search(index.value, query.value)
    lastMs.value = now() - t
    return r
  })
  const idle = computed(() => !query.value.trim())
  const settings = computed(() => (read(recentSettings) || []).slice(0, 5))
  // the fixed quick actions of the empty view (the docs that say `quick`: pair a new device, download a client)
  const quick = computed(() => (read(docs) || []).filter((d) => d.quick))
  // the rows the arrow keys walk: the recent searches then the recent settings when the field is empty, else the results in display order
  const rows = computed(() => (idle.value
    ? [...quick.value.map((doc) => ({ kind: 'doc', doc })), ...recentQueries.value.map((q) => ({ kind: 'query', q })), ...settings.value.map((doc) => ({ kind: 'doc', doc }))]
    : (result.value.total ? result.value.flat : (result.value.suggest || []).map((x) => x.doc)).map((doc) => ({ kind: 'doc', doc }))))
  watch([query, open], () => { active.value = 0 })

  function show(prefill = '') { open.value = true; if (prefill) query.value = prefill }
  function hide() { open.value = false; confirm.value = null; query.value = '' }
  const toggle = () => (open.value ? hide() : show())

  function remember(q) {
    recentQueries.value = pushQuery(recentQueries.value, q)
    saveQueries(storage, recentQueries.value, storageKey)
  }
  function forget(q) { recentQueries.value = removeQuery(recentQueries.value, q); saveQueries(storage, recentQueries.value, storageKey) }
  function forgetAll() { recentQueries.value = []; saveQueries(storage, [], storageKey) }

  // an action carries its own `run`; anything else is the product's to open
  const perform = (doc) => (typeof doc.run === 'function' ? doc.run(doc) : onChoose?.(doc))
  function run(doc) {
    if (query.value.trim()) remember(query.value)
    hide()
    perform(doc)
  }
  /** A row was chosen (a click or Enter): a recent query fills the field, an action of tier 3 asks first, anything else opens. */
  function choose(row) {
    if (!row) return
    if (row.kind === 'query') { query.value = row.q; return }
    const doc = row.doc || row
    if (doc.type === 'action' && (doc.tier || 1) >= 3) { confirm.value = doc; return }
    run(doc)
  }
  function confirmRun() {
    const doc = confirm.value
    if (!doc) return
    if (query.value.trim()) remember(query.value)
    hide()
    perform(doc)
  }
  const confirmCancel = () => { confirm.value = null }

  function move(delta) {
    const n = rows.value.length
    if (!n) return
    active.value = (active.value + delta + n) % n
  }
  /** The keys of the field: arrows move, Enter opens the active row, Esc closes (the confirmation first). Returns true when it handled the key. */
  function onKey(event) {
    if (event.key === 'ArrowDown') { move(1); event.preventDefault(); return true }
    if (event.key === 'ArrowUp') { move(-1); event.preventDefault(); return true }
    if (event.key === 'Home' && event.ctrlKey) { active.value = 0; event.preventDefault(); return true }
    if (event.key === 'Enter') { choose(rows.value[active.value]); event.preventDefault(); return true }
    if (event.key === 'Escape') { confirm.value ? confirmCancel() : hide(); event.preventDefault(); return true }
    return false
  }

  const editable = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
  /** Global shortcuts: Ctrl+K and Ctrl+F open the search (and take the key from the page), "/" does when no field has focus. */
  function onShortcut(event) {
    const mod = event.ctrlKey || event.metaKey
    if (mod && !event.altKey && !event.shiftKey && (event.key === 'k' || event.key === 'K' || event.key === 'f' || event.key === 'F')) { show(); event.preventDefault(); return true }
    if (event.key === '/' && !mod && !event.altKey && !editable(event.target) && !open.value) { show(); event.preventDefault(); return true }
    if (event.key === 'Escape' && open.value) { confirm.value ? confirmCancel() : hide(); event.preventDefault(); return true }
    return false
  }
  if (shortcuts) {
    onMounted(() => document.addEventListener('keydown', onShortcut, true))
    onBeforeUnmount(() => document.removeEventListener('keydown', onShortcut, true))
  }

  /** Pin a result to the overview (a setting's tile, an action's tile); the search stays open and the row shows it is pinned. */
  function pin(doc) { if (!doc?.pin || !onPin) return; onPin(doc); pinVersion.value++ }
  const pinned = (doc) => { void pinVersion.value; return !!(doc?.pin && isPinned?.(doc)) }
  return { pin, pinned, quick, open, query, active, confirm, lastMs, result, idle, rows, recentQueries, recentSettings: settings, show, hide, toggle, choose, run, confirmRun, confirmCancel, move, onKey, onShortcut, forget, forgetAll }
}
