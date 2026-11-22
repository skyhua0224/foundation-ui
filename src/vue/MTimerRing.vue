<script setup>
import { computed } from 'vue'
import MRing from './MRing.vue'

// Circular timer: a ring that sweeps once per `period` seconds, big numerals in the middle, a small control beneath (slot).
const props = defineProps({
  seconds: { type: Number, default: 0 },
  period: { type: Number, default: 3600 },
  size: { type: Number, default: 176 },
  label: { type: String, default: '' },
  tone: { type: String, default: 'primary' },
})
const pad = (n) => String(n).padStart(2, '0')
const text = computed(() => {
  const s = Math.max(0, Math.floor(props.seconds))
  const h = Math.floor(s / 3600)
  return `${h ? `${h}:` : ''}${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
})
const sweep = computed(() => (Math.max(0, props.seconds) % props.period) / props.period)
</script>

<template>
  <div class="m-timer">
    <MRing :value="sweep" :size="size" :tone="tone" :label="label">
      <b class="m-timer__text m-dnum">{{ text }}</b>
      <small v-if="label" class="m-timer__label">{{ label }}</small>
    </MRing>
    <div v-if="$slots.default" class="m-timer__control"><slot /></div>
  </div>
</template>
