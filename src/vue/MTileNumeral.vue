<script setup>
// Tile kit (docs/tile-kit.md): the display numeral of a tile and its unit. Sizes follow the Material 3 display scale and go past it for a hero:
// s 40 px (over display small, 36), m 57 px (display large), l 76 px, xl 96 px. A live number rolls (MRoll: its text nodes are patched in place); the unit sits on the baseline.
import { onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import MRoll from './MRoll.vue'

const props = defineProps({
  value: { type: String, default: '' },
  unit: { type: String, default: '' },
  size: { type: String, default: 'm' },
  /** a smaller line under the numeral: a state or a number, never a restated title */
  caption: { type: String, default: '' },
  /** the width axis: 'normal', 'condensed' (a tall numeral, the 07 30 clock) or 'wide' */
  width: { type: String, default: 'normal' },
  /** the roundness axis: 'crisp' (0) or 'soft' (100) */
  round: { type: String, default: 'crisp' },
  /** the weight (300-800) */
  weight: { type: Number, default: 600 },
})

// A numeral that is wider than the room its tile gives it shrinks (--tn-k, 0.5 to 1) instead of leaving the tile or pushing its unit out: 「113.0 Mbps」 at 方形, 「2160p」 in a narrow column.
const root = ref(null)
let ro = null, queued = 0
const fit = () => {
  queued = 0
  const el = root.value; const row = el?.querySelector('.m-tnum__row'); if (!el || !row) return
  el.style.removeProperty('--tn-k')
  const tile = el.closest('.m-tile, .m-dcard, .m-dsmall')
  const left = row.getBoundingClientRect().left
  let room = el.clientWidth
  if (tile) { const t = tile.getBoundingClientRect(), cs = getComputedStyle(tile); const lim = t.right - (parseFloat(cs.paddingRight) || 0) - left; room = room > 0 ? Math.min(room, lim) : lim }
  const need = row.scrollWidth
  if (room > 8 && need > room + 0.5) {
    let k = Math.max(0.5, room / need - 0.01)
    el.style.setProperty('--tn-k', k.toFixed(3))
    // the unit keeps a floor of 13 px and does not follow --tn-k: a numeral with a long unit (「31 台已配对」 at 方形) is still wider than the room after the first step. Step down again until the row fits.
    for (let i = 0; i < 4 && k > 0.5 && row.scrollWidth > room + 0.5; i++) {
      k = Math.max(0.5, k * (room / row.scrollWidth) - 0.005)
      el.style.setProperty('--tn-k', k.toFixed(3))
    }
  }
}
const queue = () => { if (!queued) queued = requestAnimationFrame(fit) }
// the display font arrives after the first measure and widens every digit and unit without changing the box of the tile: measure again when a font has loaded (fitText.js does the same for the values)
const onFonts = () => queue()
onMounted(() => {
  fit()
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(queue); ro.observe(root.value); const t = root.value.closest('.m-tile, .m-dcard, .m-dsmall'); if (t) ro.observe(t) }
  if (typeof document !== 'undefined' && document.fonts) { document.fonts.ready?.then(queue); document.fonts.addEventListener?.('loadingdone', onFonts) }
})
watch(() => [props.value, props.unit, props.size], () => nextTick(fit))
onBeforeUnmount(() => { ro?.disconnect(); if (typeof document !== 'undefined') document.fonts?.removeEventListener?.('loadingdone', onFonts); if (queued) cancelAnimationFrame(queued) })
</script>

<template>
  <div ref="root" class="m-tnum" :class="[`m-tnum--${size}`, width !== 'normal' && `m-tnum--${width}`, `m-tnum--${round}`]" :style="weight !== 600 ? { '--tn-wght': weight } : undefined">
    <span class="m-tnum__row"><b class="m-tnum__v m-dnum"><MRoll :text="value || '–'" /></b><small v-if="unit && value" class="m-tnum__u">{{ unit }}</small></span>
    <span v-if="caption" class="m-tnum__cap">{{ caption }}</span>
  </div>
</template>
