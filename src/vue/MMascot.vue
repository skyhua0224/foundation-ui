<script setup>
import { computed } from 'vue'
import { viviImage } from '../about/mascot.js'

// Vivi at the size of the slot. The file is chosen by the size drawn and the screen's density (see `viviImage`), so a 32 px mark is a 32 px
// (and a 64 px for dense screens) file, not a large picture scaled down.
const props = defineProps({ size: { type: Number, default: 40 }, alt: { type: String, default: '' }, round: { type: Boolean, default: false } })
const img = computed(() => viviImage(props.size, typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1))
</script>

<template>
  <img v-if="img.src" class="m-mascot" :class="{ 'm-mascot--round': round }" :src="img.src" :srcset="img.srcset || undefined" :width="size" :height="size" :alt="alt" :aria-hidden="alt ? undefined : 'true'" decoding="async" />
</template>
