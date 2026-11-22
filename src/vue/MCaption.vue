<script setup>
import { onBeforeUnmount, onMounted, provide, ref, useSlots } from 'vue'
import MIconButton from './MIconButton.vue'
import { SEARCH_ICON, SEARCH_MIN, partsOf } from './useCaptionRoom.js'
import { isCompactNav } from '../nav/scenes.js'

// The caption bar over the top of the window, beside the rail, one for both products. It only orders what the product puts in it:
//   [back] brand [version] | search | mita (a character's avatar button: the control panel only) | connect (连接设备) | announcements (公告) | account (the account menu) | controls (the window's own buttons: the control panel only)
// `mita`, `connect`, `announcements` and `account` sit together in one actions group right of the search, in that order, then the window controls, all in one cluster at the end (the third
// column of the control panel's grid); a slot the product does not fill takes no room.
// `back` (the global back button, left of the logo) and `version` (the short version and the update line, after the name) are optional; with either, the three sit in one row in the first column.
// `bem` is the product's own class (panel-caption, web-caption): the group is `<bem>__actions`, so the product's styles keep working.
//
// Whatever the width, the window's own buttons stay and nothing is cut: the bar picks the roomiest TIER in which what it shows fits, decided in the frame of the change like the rail's (nav MRail), and
// writes it as data-tier. What a tier leaves out is not gone: the product lists it in 更多 (the `more` event), in the order it has in the bar.
//   0 everything · 1 the version and the update line · 2 the label of 连接设备 (the icon stays) and the search field (its icon stays) · 3 the name beside the logo · 4 公告 and 反馈 · 5 连接设备
// The search field needs about SEARCH_MIN; as its icon, SEARCH_ICON.
//
// A phone is what the shell says it is (isCompactNav: narrower than 600, or shorter than 480, so a phone on its side too), never what a media query on the width says: the bar writes it as data-phone and
// every phone rule of the bar hangs on that, so the rail, the search and the bar are one decision. A phone never has the field or the words of 连接设备 or the version: it starts at tier 2.
const props = defineProps({
  bem: { type: String, default: 'm-caption' },
  /** the product has a 更多 surface to open: from tier 4 a button at the end of the actions opens it (`more`) */
  more: { type: Boolean, default: false },
  moreLabel: { type: String, default: 'More' },
  /** the compact navigation (the bar) has a 更多 destination of its own that lists the same: no caption button while it is on */
  barMore: { type: Boolean, default: false },
})
const emit = defineEmits(['more'])
const slots = useSlots()
const actions = () => !!(slots.mita || slots.connect || slots.announcements || slots.account)

const root = ref(null)
const tier = ref(0)
provide('m-caption-tier', tier)
const TIERS = 6
const PHONE_TIER = 2
const phone = ref(typeof window !== 'undefined' && isCompactNav(window.innerWidth, window.innerHeight))
let observer = null
let mutations = null
let busy = false
// does what this tier shows fit? (the bar's own parts as laid out now; the name and the logo are cut by the product's grid when they have no room: what is cut is not a fit)
function fits(el, t) {
  el.dataset.tier = String(t)
  const { bar, lead, end } = partsOf(el)
  const need = t < 2 && !phone.value ? SEARCH_MIN : SEARCH_ICON
  const cut = [...el.querySelectorAll('.m-caption__lead, .m-brand, .m-brand__name')].some((n) => n.scrollWidth > n.clientWidth + 1)
  return bar - lead - end >= need && !cut
}
// From the tier the bar has: a tier that still fits is kept unless the roomier one fits too (one more look), one that does not fit goes up until it does: two layouts of the bar in a step of a drag, not six.
function fit() {
  const el = root.value
  if (!el || busy) return
  busy = true
  phone.value = isCompactNav(window.innerWidth, window.innerHeight)
  el.toggleAttribute('data-phone', phone.value)
  const floor = phone.value ? PHONE_TIER : 0
  let t = Math.max(tier.value, floor)
  if (fits(el, t)) { while (t > floor && fits(el, t - 1)) t-- }
  else { t++; while (t < TIERS - 1 && !fits(el, t)) t++ }
  el.dataset.tier = String(t)
  tier.value = t
  busy = false
}
onMounted(() => {
  observer = new ResizeObserver(fit)
  observer.observe(root.value)
  // a phone turned on its side keeps its width class in the width but not in the height
  window.addEventListener('resize', fit)
  // what the product puts in the bar changes its widths (the version arrives, an update line comes, a button appears)
  mutations = new MutationObserver(fit)
  mutations.observe(root.value, { childList: true, subtree: true, characterData: true })
  document.fonts?.ready?.then(fit)
  document.fonts?.addEventListener?.('loadingdone', fit)
  fit()
})
onBeforeUnmount(() => { window.removeEventListener('resize', fit); observer?.disconnect(); mutations?.disconnect(); document.fonts?.removeEventListener?.('loadingdone', fit) })
</script>

<template>
  <header ref="root" class="m-caption" :class="[bem, { 'm-caption--bar-more': barMore }]" :data-phone="phone ? '' : null">
    <div v-if="$slots.back || $slots.version" class="m-caption__lead" :class="`${bem}__lead`">
      <slot name="back" />
      <slot name="brand" />
      <slot name="version" />
    </div>
    <slot v-else name="brand" />
    <slot name="search" />
    <div v-if="actions() || $slots.controls" class="m-caption__end" :class="`${bem}__end`">
      <div v-if="actions() || more" class="m-caption__actions" :class="`${bem}__actions`">
        <slot name="mita" />
        <slot name="connect" />
        <slot name="announcements" />
        <slot name="account" />
        <MIconButton v-if="more" class="m-caption__more" icon="more_horiz" :label="moreLabel" @click="emit('more')" />
      </div>
      <slot name="controls" />
    </div>
  </header>
</template>
