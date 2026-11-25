<script setup>
import { appIcon } from '../about/appicon.js'

// The product's brand lockup: its icon and its name side by side on one row, the icon at the scale of the name's cap height (a 20 px icon with a 15 px
// title). The caption bar of a window carries it at its start; a page without a caption bar shows it beside the menu button of the expanded rail.
const props = defineProps({
  name: { type: String, default: '' },
  /** the icon's side in CSS pixels (the file is chosen for it and for the screen's density) */
  size: { type: Number, default: 20 },
})
const icon = appIcon(props.size, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
</script>

<template>
  <span class="m-brand">
    <img class="m-brand__icon" :src="icon.src" :srcset="icon.srcset || undefined" :width="size" :height="size" alt="" draggable="false" />
    <span v-if="name" class="m-brand__name">{{ name }}</span>
  </span>
</template>
