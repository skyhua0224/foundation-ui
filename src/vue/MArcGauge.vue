<script setup>
import { computed } from 'vue'
import MProgressRing from './MProgressRing.vue'

/**
 * A ring gauge for one value that has a safe range: the shared Material 3 circular progress indicator (MProgressRing) in the colour of the zone the value is in (`zones`: [{ to (0..1), tone: ok|warn|err }]).
 * The centre slot holds the number. Used for temperature and load against a threshold.
 */
const props = defineProps({
  value: { type: Number, default: 0 }, // 0..1
  zones: { type: Array, default: () => [{ to: 0.7, tone: 'ok' }, { to: 0.9, tone: 'warn' }, { to: 1, tone: 'err' }] },
  size: { type: Number, default: 132 },
  label: { type: String, default: '' },
})
const v = computed(() => Math.max(0, Math.min(1, props.value)))
const zone = computed(() => props.zones.find((z) => v.value <= z.to)?.tone || props.zones[props.zones.length - 1]?.tone || 'ok')
</script>

<template>
  <MProgressRing class="m-agauge" :style="{ width: `${size}px`, height: `${size}px` }" :value="v" :tone="zone" :label="label"><slot /></MProgressRing>
</template>
