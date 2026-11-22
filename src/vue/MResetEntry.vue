<script setup>
import { computed } from 'vue'
import MSection from './MSection.vue'
import MGroup from './MGroup.vue'
import MItem from './MItem.vue'
import { resetTexts } from '../reset/texts.js'

// The way to 恢复默认设置 from the bottom of a settings page: one row that opens the page (the product decides where that is).
const props = defineProps({ locale: { type: String, default: 'en' } })
const emit = defineEmits(['open'])
const T = computed(() => resetTexts(props.locale))
</script>

<template>
  <MSection class="m-reset-entry">
    <MGroup>
      <MItem action icon="restart_alt" :title="T.title" :text="T.hostRowText" data-reset="entry" @click="emit('open')" />
    </MGroup>
  </MSection>
</template>
