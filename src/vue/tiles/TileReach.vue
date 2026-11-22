<script>
export const tileIds = ['reach']
</script>

<script setup>
// 远程访问 (the host's own verdict per path): 方形 the paths that work out of all of them, as a number, and the path that needs a look (or the first one); 中 the paths as calm rows,
// each with its address or its evidence, the state as the glyph's colour (the list style of 日志).
import { computed } from 'vue'
import MIcon from '../MIcon.vue'
import MTileHead from '../MTileHead.vue'
import MTileNumeral from '../MTileNumeral.vue'
import MTileEmpty from '../MTileEmpty.vue'
import { OPEN, designProps } from './tileData.js'

const props = defineProps(designProps)
const emit = defineEmits(['act'])
const d = computed(() => props.card.data || {})
const size = computed(() => (props.card.size === 'm' ? 'm' : 's'))
const rows = computed(() => d.value.rows || [])
const okN = computed(() => rows.value.filter((r) => r.tone === 'ok').length)
const attention = computed(() => rows.value.find((r) => r.tone !== 'ok') || rows.value[0])
const accent = computed(() => (rows.value.some((r) => r.tone === 'err') ? 'error' : rows.value.length && okN.value === rows.value.length ? 'primary' : 'secondary'))
const TONE_ICON = { ok: 'check_circle', err: 'error' }
</script>

<template>
  <section class="m-tile m-cal m-b3r" :class="`is-${size}`" :data-size="size" :data-accent="accent">
    <MTileEmpty v-if="empty || !rows.length" :icon="empty?.icon || d.icon" :title="empty?.title || card.title" :text="empty?.value || d.empty || ''" :action="empty?.action" :size="size" @act="(a) => emit('act', a)" />
    <template v-else>
      <MTileHead :icon="d.icon" :title="card.title" :chevron="chevron && size !== 's'" @open="emit('act', OPEN)" />
      <template v-if="size === 's'">
        <MTileNumeral :value="`${okN}/${rows.length}`" size="m" />
        <span v-if="attention" class="m-b3r__cap">{{ attention.title }}</span>
      </template>
      <ol v-else class="m-b3e__lines" data-fit-rows="drop"><li v-for="(r, i) in rows.slice(0, 3)" :key="i" :class="`is-${r.tone || 'quiet'}`"><MIcon :name="TONE_ICON[r.tone] || r.icon || 'info'" fill /><span>{{ r.title }}</span><time class="m-dnum">{{ r.sub }}</time></li></ol>
    </template>
  </section>
</template>
