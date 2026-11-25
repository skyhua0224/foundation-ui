<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MIcon from './MIcon.vue'
import MBadge from './MBadge.vue'
import MBrand from './MBrand.vue'

// Navigation rail after the Material spec (NavigationRail of Material Components for Android), in its two states, or the
// bottom bar with the same item. Collapsed (96 wide): the icon in a 56 x 32 pill-shaped active indicator, the label under it
// (12, one line). Expanded (240): the icon and the label in a row, the indicator 56 high and as wide as its content. A menu
// button at the top toggles the two; the choice is the user's (the scene keeps it) and the rail collapses by itself when the
// window is too narrow for list and detail. Persistent: the scene never rebuilds it.
// items: [{ id, icon, label, badge?: number | 'dot', image?: { src, srcset, width, height } }]; an item with an image shows it in place of the symbol (a pixel picture drawn without smoothing)
const props = defineProps({
  items: { type: Array, required: true },
  current: { type: String, default: '' },
  mode: { type: String, default: 'rail' }, // rail | expanded | bar
  label: { type: String, default: 'Main' },
  /** the menu button that expands and collapses the rail (only where the window has room for the expanded one) */
  canToggle: { type: Boolean, default: false },
  expandLabel: { type: String, default: 'Expand navigation' },
  collapseLabel: { type: String, default: 'Collapse navigation' },
  /** the brand lockup beside the menu button (expanded); a window with a caption bar of its own carries the lockup there and the rail has none */
  showName: { type: Boolean, default: true },
  /** the product's name in the lockup */
  brandName: { type: String, default: '' },
  /** the bar of a short window: it stands beside the content as a narrow rail, the label under each icon */
  side: { type: Boolean, default: false },
})
const emit = defineEmits(['select', 'toggle'])

// Every item is visible with its label at every height; where the height does not hold them at their tightest the rail scrolls (tier 2), and where there is room the rail is airy. It takes the roomiest of its states in which the items fit, then spends the height that is
// left on the space between destinations (never less than the 12 px of the Material 3 spec in the roomy tiers; up to 20), keeping a stretch of air between the last destination and the foot's icons.
// The states, roomiest first: tier 0 with the roomy foot, tier 0 with the compact foot (so a window of 800 px keeps its full-size destinations at 56 px or more), 1 tighter, 2 the labels kept and the rail scrolling (a window under about 600 px tall); the labels are never dropped.
// What decides is the measure of the items as they are laid out here (the fonts, the scale, the real height of the window of this machine), never an assumed size: each state is tried on the element at its
// closest spacing and kept when the items no longer overflow. It is decided in the frame of the change and again when the fonts arrive or the items change, as another font changes the height of a label.
const root = ref(null)
const tier = ref(0)
const FOOT_AIR = 16 // between the last destination and the foot
// [tier, compact foot, the closest and the widest space between destinations]
const STATES = [[0, false, [8, 12]], [0, true, [4, 12]], [1, true, [4, 12]], [2, true, null]]
let observer = null
let mutations = null
function fit() {
  const el = root.value
  if (!el || el.classList.contains('m-rail--bar')) return
  const items = el.querySelector('.m-rail__items')
  if (!items) return
  const spaced = props.mode === 'rail'
  let chosen = STATES[STATES.length - 1]
  for (const state of STATES) {
    const [t, compact, gap] = state
    el.dataset.tier = String(t)
    if (compact) el.dataset.foot = 'compact'
    else delete el.dataset.foot
    if (spaced && gap) items.style.setProperty('--m-rail-gap', `${gap[0]}px`)
    else if (spaced) items.style.setProperty('--m-rail-gap', '2px')
    else items.style.removeProperty('--m-rail-gap')
    if (items.scrollHeight <= items.clientHeight + 1) { chosen = state; break }
  }
  const [t, compact, gap] = chosen
  el.dataset.tier = String(t)
  if (compact) el.dataset.foot = 'compact'
  else delete el.dataset.foot
  if (spaced && gap) {
    // what is left of the height goes to the space between destinations
    const kids = [...items.children]
    const cs = getComputedStyle(items)
    const content = kids.length ? kids[kids.length - 1].offsetTop + kids[kids.length - 1].offsetHeight - kids[0].offsetTop : 0
    // the room of the items is what the rail has between its head and its foot (the items element itself is only as tall as they are)
    const room = el.clientHeight - (el.querySelector('.m-rail__head')?.offsetHeight || 0) - (el.querySelector('.m-rail__foot')?.offsetHeight || 0)
    const free = room - content - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - FOOT_AIR
    const [lo, hi] = gap
    const next = kids.length > 1 ? Math.max(lo, Math.min(hi, lo + Math.floor(free / (kids.length - 1)))) : lo
    items.style.setProperty('--m-rail-gap', `${next}px`)
    if (items.scrollHeight > items.clientHeight + 1) items.style.setProperty('--m-rail-gap', `${lo}px`)
  }
  tier.value = t
}
onMounted(() => {
  observer = new ResizeObserver(fit)
  observer.observe(root.value)
  mutations = new MutationObserver(fit)
  const foot = root.value.querySelector('.m-rail__foot')
  if (foot) mutations.observe(foot, { childList: true, subtree: true })
  mutations.observe(root.value.querySelector('.m-rail__items'), { childList: true, subtree: true, characterData: true })
  // a font that arrives after the first layout (the system font of the machine, a web font) changes the height of the labels
  document.fonts?.ready?.then(fit)
  document.fonts?.addEventListener?.('loadingdone', fit)
  fit()
})
onBeforeUnmount(() => { observer?.disconnect(); mutations?.disconnect(); document.fonts?.removeEventListener?.('loadingdone', fit) })
watch(() => [props.items.length, props.mode], () => fit(), { flush: 'post' })
function key(event) {
  const keys = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight']
  if (!keys.includes(event.key)) return
  const buttons = [...event.currentTarget.querySelectorAll('.m-rail__item')]
  const at = buttons.indexOf(document.activeElement)
  if (at < 0) return
  const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1
  buttons[(at + step + buttons.length) % buttons.length]?.focus()
  event.preventDefault()
}
</script>

<template>
  <nav ref="root" class="m-rail" :class="[`m-rail--${mode}`, { 'm-rail--side': side }]" :aria-label="label" @keydown="key">
    <div v-if="mode !== 'bar'" class="m-rail__head" data-tauri-drag-region="deep">
      <button v-if="canToggle" type="button" class="m-rail__menu" :aria-expanded="mode === 'expanded'" :aria-label="mode === 'expanded' ? collapseLabel : expandLabel" :data-tip="mode === 'expanded' ? collapseLabel : expandLabel" @click="emit('toggle')">
        <MIcon :name="mode === 'expanded' ? 'menu_open' : 'menu'" />
      </button>
      <MBrand v-if="mode === 'expanded' && showName" class="m-rail__brand" :name="brandName" :size="20" />
      <slot name="head" />
    </div>
    <div class="m-rail__items">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="m-rail__item"
        :data-rail="item.id"
        :aria-current="current === item.id ? 'page' : undefined"
        :aria-label="item.label"
        @click="emit('select', item)"
      >
        <span class="m-rail__pill">
          <img v-if="item.image" class="m-rail__img" :src="item.image.src" :srcset="item.image.srcset || undefined" :width="item.image.width" :height="item.image.height" alt="" draggable="false" />
          <MIcon v-else :name="item.icon" :fill="current === item.id" />
          <MBadge v-if="item.badge" class="m-rail__badge" :value="item.badge === 'dot' ? null : item.badge" />
          <span v-if="mode === 'expanded'" class="m-rail__label m-rail__label--row">{{ item.label }}</span>
        </span>
        <span v-if="mode !== 'expanded'" class="m-rail__label">{{ item.label }}</span>
      </button>
    </div>
    <div v-if="$slots.foot && mode !== 'bar'" class="m-rail__foot"><slot name="foot" /></div>
  </nav>
</template>
