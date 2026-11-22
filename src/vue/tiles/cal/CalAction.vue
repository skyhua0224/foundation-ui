<script setup>
// Calibration round: an action (添加应用). The whole tile is the button: a Google Home favourites tile / an Android 16 QS tile:
// the tonal container, the glyph at the top left, the action's name at the bottom left. Nothing else.
import { computed } from 'vue'
import MIcon from '../../MIcon.vue'

const props = defineProps({ card: { type: Object, required: true } })
const emit = defineEmits(['act'])
const d = computed(() => props.card.data || {})
</script>

<template>
  <button type="button" class="m-tile m-cal m-cala" :class="{ 'is-quiet': card.quiet }" data-size="s" data-accent="secondary" @click="emit('act', { type: d.act, value: d.value })">
    <span class="m-cala__glyph"><MIcon :name="d.icon" :fill="d.icon === 'stop'" /></span>
    <b class="m-cala__name">{{ d.title }}</b>
  </button>
</template>
