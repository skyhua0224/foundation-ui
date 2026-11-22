import { computed, onBeforeUnmount, onMounted } from 'vue'
import { purposeOf, suggestions } from '../homeSmart.js'
import { ALL_SIZE_KEYS, SIZE_UNITS, STRIP_PX, columnsOf, effectiveSize, sizesOf } from '../homeSizes.js'
import { canJoin, commonSizes, rotationPick } from '../stackModel.js'
import { AWAY_MS, IDLE_MS, SETTLE_MS, createRotationDriver } from '../stackRotation.js'
import { DEFAULT_ORDER } from '../homeCards.js'

// per overview (its storage key): when each stack last changed, and when the overview was left; they outlive the component, so a page that is left and opened again counts as away
const rotStates = {}
const awayMark = { leftAt: 0 }

/** dashGrid: one part of the home overview's setup (MHomeDash.vue); D is the shared scope of the parts, in the order they are made. */
export function useDashGrid(D) {
  const { T, appearance, cardById, edit, hasDetailOf, layout, planSnap, sizeOf, smart, stacks, stacksOn, tall, windowClass } = D
  // a card boxed for a grid of `u` columns
  // the 底栏 layout is one row of SMALL tiles: every tile is S there whatever size it has in the smart layout (the saved sizes are not touched), and the size chooser offers S only.
  // Every tile draws the ONE generic small view (icon, value, label, chevron): the own small layouts of the cards were made for the grid and differ from each other.
  // ---- the grid in square units (round27-xl): a column is as wide as a 方形 is tall, the rows of the ladder are one column high, the strip rows are STRIP_PX; the columns follow the width and the density
  // in the dock, a short window (a phone on its side) takes the smaller density (a unit of 130 to 175 px) unless the person chose another: the tiles of a row are shorter, so a whole row stays on the first screen
  const tileDensity = computed(() => { const d = appearance.state.tileDensity || 'standard'; return d === 'standard' && tall.value < 480 && appearance.state.overview === 'dock' ? 'smaller' : d })
  const gridOf = (w) => columnsOf(w, tileDensity.value)
  const JOURNEY_PX = 200
  // the banner of the first pairing is as tall as its step, at least this
  const rowPxIn = (unit) => (cls) => (cls === 'unit' ? unit : cls === 'strip' ? STRIP_PX : JOURNEY_PX)
  const trackTemplate = (rows, unit) => rows.map((r) => (r.cls === 'unit' ? `${unit}px` : r.cls === 'strip' ? `${STRIP_PX}px` : `minmax(${JOURNEY_PX}px, auto)`)).join(' ')
  const dockLayout = computed(() => appearance.state.overview === 'dock')
  const dockBox = (c, u) => ({ ...c, ...boxIn(c, 's', u), size: 's', sizeKey: 's', sizeKeys: ['s'], cls: 'tile', forceGeneric: true })
  // The size drawn is effectiveSize of what is asked (the plan's in smart mode, the person's in manual). The smart fill may ask for the next offered size up to 大 where a row is short, but only from
  // the medium class up: a phone-sized window (under 600) draws the plan as it is, so crossing 600 changes a tile at most once whatever the number of columns does around it.
  const PROMOTE_TO = ['s', 'm', 'l']
  const drawnSize = (c, asked, lift = 0) => {
    const opts = { height: tall.value }
    const mode = smart.value ? 'smart' : 'manual'
    const key = effectiveSize(c, asked, windowClass.value, mode, opts)
    if (!lift || !smart.value || windowClass.value === 'compact' || !PROMOTE_TO.includes(key)) return key
    const offered = PROMOTE_TO.filter((k) => sizesOf(c.id, c, windowClass.value, tall.value).sizes[k])
    const at = offered.indexOf(key)
    return at < 0 ? key : effectiveSize(c, offered[Math.max(0, Math.min(offered.length - 1, at + lift))], windowClass.value, mode, opts)
  }
  // The box of a size in square units (homeSizes.js SIZE_UNITS): 方形 1 x 1, 中 2 x 1, 大 2 x 2, 特大 4 x 2, 特大竖 2 x 4; the strip is one slim row 2 or 4 units wide; the first pairing's banner is
  // the width of its row. A ladder tile is never stretched (max = span): a hole beside it is filled by the next tiles, not by a wider one.
  const boxIn = (c, key, u) => {
    if (c.cls === 'journey') return { span: u, rows: 1, cls: 'journey', max: u }
    if (key === 'strip') { const n = Math.min(u, sizesOf(c.id, c, windowClass.value, tall.value).sizes.strip?.[0] || 4); return { span: n, rows: 1, cls: 'strip', max: n } }
    const span = Math.min((SIZE_UNITS[key] || SIZE_UNITS.s)[0], u)
    return { span, rows: (SIZE_UNITS[key] || SIZE_UNITS.s)[1], cls: 'unit', max: span }
  }
  const sizeKeysOf = (c) => ALL_SIZE_KEYS.filter((k) => sizesOf(c.id, c, windowClass.value, tall.value).sizes[k])
  // a stack is drawn at one size every member offers in this window class: the one it was made at, else the largest below it
  const stackSizeFor = (c) => { const common = commonSizes(c.stackMembers, windowClass.value, tall.value); const order = ['s', 'm', 'l', 'xl', 'xlp']; const want = order.indexOf(c.stack.size); return [...common].reverse().find((k) => order.indexOf(k) <= want) || common[0] || 's' }
  // a tile that belongs with a stack and is in none: the purpose of one of its members, offered at the stack's size, not turned away before; the first in the catalogue's order
  const suggestFor = (st, members, size) => {
    if (!st.suggestions) return null
    const purposes = new Set(members.map((m) => purposeOf(m.id, m.group)))
    const taken = new Set(Object.values(stacks.state.stacks).flatMap((x) => x.members))
    for (const id of DEFAULT_ORDER) {
      const c = cardById.value.get(id)
      if (!c || c.available === false || taken.has(id) || layout.state.hiddenSuggest.includes(id) || !purposes.has(purposeOf(id, c.group))) continue
      if (canJoin(c, size, windowClass.value, tall.value).ok) return { id, title: c.title, icon: D.ghostIconOf(c) }
    }
    return null
  }
  const boxFor = (card, u, lift = 0) => {
    if (card.kind === 'stack') { const key = stackSizeFor(card); return { ...card, ...boxIn(card, key, u), size: key, sizeKey: key, sizeKeys: commonSizes(card.stackMembers, windowClass.value, tall.value), suggestion: suggestFor(card.stack, card.stackMembers, key), stack: { ...card.stack, activeId: card.stack.members[card.stack.active], members: card.stackMembers.map((m) => ({ ...m, hasDetail: hasDetailOf(m), size: key, sizeKey: key, sizeKeys: [key] })) } } }
    const c = { ...card, hasDetail: hasDetailOf(card) }
    if (dockLayout.value) return dockBox(c, u)
    const key = drawnSize(c, c.fillSize || sizeOf(c.id), lift)
    return { ...c, ...boxIn(c, key, u), size: key, sizeKey: key, sizeKeys: sizeKeysOf(c) }
  }
  // ---- smart stacks: what a stack turns to (stackModel.js rotationPick), and WHEN (stackRotation.js): never while the person looks at the overview. A stack with the pointer or the focus on it, a pinned
  // stack (smartRotate off) and every stack with the switch off stay as they are. A turn by hand is told in the polite live region; a turn by the host is not: nobody asked for it.
  const rotState = (rotStates[D.props.storageKey] ||= {})
  const timing = () => (typeof window !== 'undefined' ? window.__m3eStackTiming || {} : {})
  const holds = new Set()
  const holding = (id) => holds.has(`${id}|pointer`) || holds.has(`${id}|focus`)
  const stackWords = (st, index) => String(T.value.stackLabel || '{k} / {n}: {name}').replace('{k}', index + 1).replace('{n}', st.members.length).replace('{name}', D.titleOf(st.members[index]))
  const onStackRotate = ({ id, index, tile, source }) => {
    const st = stacks.state.stacks[id]; if (!st) return
    const i = tile ? st.members.indexOf(tile) : index; if (i < 0) return
    stacks.setActive(id, i); (rotState[id] ||= {}).changedAt = Date.now()
    if (source === 'manual') D.say(stackWords(stacks.state.stacks[id], i))
  }
  const onStackSuggest = ({ id, tile, action }) => {
    if (action === 'add') { const i = stacks.state.stacks[id]?.members.length || 0; stacks.add(id, tile); stacks.setActive(id, i); D.say((T.value.stackAdded || '{name}').replace('{name}', D.titleOf(tile))) } else { layout.hideSuggestion(tile); D.say(`${D.titleOf(tile)}: ${T.value.stackSuggestHide || ''}`) }
  }
  // the pin (MDashStack): smart rotation off for this stack, the card shown stays; told in the live region
  const onStackFlags = ({ id, patch }) => { stacks.setFlags(id, patch) }
  const setStackRotate = (on) => { stacks.setRotate(on); D.say(on ? (T.value.stackRotateOnSay || '') : (T.value.stackRotateOffSay || '')) }
  const onStackHover = ({ id, on, by = 'pointer' }) => { if (on) holds.add(`${id}|${by}`); else holds.delete(`${id}|${by}`) }
  const rotateStacks = () => {
    if (!stacksOn || edit.value || !stacks.state.rotate) return
    const t = timing(); const signals = { ...(D.props.ctx?.signals || {}) }
    const available = (m) => cardById.value.get(m)?.available !== false && cardById.value.has(m)
    for (const [id, st] of Object.entries(stacks.state.stacks)) {
      const i = rotationPick(st, signals, { now: Date.now(), lastChangeAt: rotState[id]?.changedAt || 0, holding: holding(id), available, ...(t.every !== undefined ? { every: t.every } : {}) })
      if (i >= 0) onStackRotate({ id, index: i, source: 'smart' })
    }
  }
  // the page comes back: after it was away (hidden, unfocused, another page of the app) for AWAY_MS; then, when the host's signals are fresh again, once (stackRotation.js)
  const t0 = timing()
  const driver = createRotationDriver({ awayMs: t0.awayMs ?? AWAY_MS, idleMs: t0.idleMs ?? IDLE_MS, settleMs: t0.settleMs ?? SETTLE_MS, run: rotateStacks })
  let idleTimer = 0
  const onVisibility = () => (document.visibilityState === 'hidden' ? driver.hide() : driver.show())
  const onAway = () => driver.hide()
  const onBack = () => driver.show()
  const onInput = () => driver.activity()
  const INPUTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'pointermove']
  onMounted(() => {
    if (!stacksOn || typeof document === 'undefined') return
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onAway); window.addEventListener('focus', onBack)
    for (const e of INPUTS) window.addEventListener(e, onInput, { passive: true })
    idleTimer = setInterval(() => driver.tick(), t0.idleCheckMs ?? 30000)
    // another page of the app was shown meanwhile: this is the overview coming back
    if (awayMark.leftAt) driver.returned(Date.now() - awayMark.leftAt)
    awayMark.leftAt = 0
  })
  onBeforeUnmount(() => {
    driver.dispose(); clearInterval(idleTimer)
    if (!stacksOn || typeof document === 'undefined') return
    awayMark.leftAt = Date.now()
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('blur', onAway); window.removeEventListener('focus', onBack)
    for (const e of INPUTS) window.removeEventListener(e, onInput)
  })
  Object.assign(D, { boxFor, boxIn, dockBox, dockLayout, gridOf, onStackFlags, onStackHover, setStackRotate, onStackRotate, onStackSuggest, rowPxIn, sizeKeysOf, stackSizeFor, trackTemplate })
}
