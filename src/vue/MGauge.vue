<script setup>
import { computed } from 'vue'
import MProgressRing from './MProgressRing.vue'

// A small progress ring with its percentage in the middle: the shared Material 3 circular progress indicator (MProgressRing).
const props = defineProps({
  value: { type: Number, required: true }, // 0..1
  label: { type: String, default: '' },
  size: { type: Number, default: 44 },
})
const pct = computed(() => Math.round(Math.max(0, Math.min(1, props.value)) * 100))
</script>

<template>
  <MProgressRing class="m-gauge" :style="{ width: `${size}px`, height: `${size}px` }" :value="value" :label="label"><b class="m-gauge__text">{{ pct }}</b></MProgressRing>
</template>
