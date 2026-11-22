<script setup>
import MProgressRing from './MProgressRing.vue'

// Ring (progress or donut) with numerals in the middle: the shared Material 3 circular progress indicator (MProgressRing) at `size` px. `value` 0..1, or `segments` [{ value, tone }] that add up to at most 1.
// The stroke and the gap are the spec's, scaled to the size (the stroke is a tenth of the diameter).
defineProps({
  value: { type: Number, default: null },
  segments: { type: Array, default: () => [] },
  size: { type: Number, default: 112 },
  tone: { type: String, default: 'primary' },
  label: { type: String, default: '' },
})
</script>

<template>
  <MProgressRing class="m-ring" :style="{ width: `${size}px`, height: `${size}px` }" :value="value ?? 0" :segments="segments.length ? segments : null" :tone="tone" :label="label"><slot /></MProgressRing>
</template>
