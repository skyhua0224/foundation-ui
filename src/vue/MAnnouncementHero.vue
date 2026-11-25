<script setup>
// The hero of an announcement that has no banner (announcements/hero.js): a colourful mesh chosen from the post's id, and now and then our own 薇薇. It fills the banner's box (the box is positioned by
// tilefit.css); `thumb` is the small square of the list, gradient only.
import { computed } from 'vue'
import { announcementHero, announcementHeroBackground } from '../announcements/hero.js'
import { VIVI } from '../about/mascot.js'

const props = defineProps({ id: { type: [String, Number], default: '' }, title: { type: String, default: '' }, thumb: { type: Boolean, default: false } })
const key = computed(() => String(props.id || props.title))
const vivi = computed(() => !props.thumb && announcementHero(key.value).vivi)
</script>

<template>
  <span class="m-ahero" :style="{ background: announcementHeroBackground(key) }" aria-hidden="true"><img v-if="vivi && VIVI.logo[192]" class="m-ahero__vivi" :src="VIVI.logo[192]" alt="" decoding="async"></span>
</template>
