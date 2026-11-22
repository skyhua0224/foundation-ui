<script setup>
// Tile kit (docs/tile-kit.md): the ring of a tile. It is the shared Material 3 circular progress indicator (MProgressRing, docs/progress-ring.md): a closed ring from 12 o'clock, a track a gap behind the
// active indicator, round caps. Parts of a whole (内存: this host, the other programs) are segments of the same ring. The slot is the centre (a numeral).
import MProgressRing from './MProgressRing.vue'

defineProps({
  /** 0..1 */
  value: { type: Number, default: 0 },
  /** [{ value 0..1, tone: 'a' | 'b' | 'c' }]: drawn instead of `value` */
  segments: { type: Array, default: null },
  /** the Material 3 Expressive wavy active indicator */
  wavy: { type: Boolean, default: false },
  label: { type: String, default: '' },
})
</script>

<template>
  <MProgressRing :value="value" :segments="segments" :wavy="wavy" :label="label"><slot /></MProgressRing>
</template>
