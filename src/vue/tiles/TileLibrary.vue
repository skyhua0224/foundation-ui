<script>
export const tileIds = ['covers', 'apps']
</script>

<script setup>
// 游戏库 and 应用 in the calibrated calm language (round 31; REFERENCES.md "covers", "apps": the Android canonical image grid, the M3E list widget, One UI's Gallery).
//   游戏库: covers in a grid, each with its own corners and a gap between them, the first one twice the size and the tile's focal element (the iOS Music widget); the count in the header.
//   应用: 方形 the first application's art and its name, the count in the header; 中 the first application large, three more and 添加 as the last tile (a + on the quiet surface).
// An application without art is the kit's designed cover (MTileCover). Empty: the glyph in a quiet circle, one line, 添加应用.
import { computed } from 'vue'
import MIcon from '../MIcon.vue'
import MTileCover from '../MTileCover.vue'
import { OPEN, designProps } from './tileData.js'
import { sizeB2 } from './b2.js'

const props = defineProps(designProps)
const emit = defineEmits(['act'])
const id = computed(() => props.card.id)
const d = computed(() => props.card.data || {})
const size = computed(() => sizeB2(props.card))
const items = computed(() => (d.value.items || []).map((a) => ({ ...a, name: a.name ?? a.title })))
const count = computed(() => d.value.count ?? items.value.length)
const shown = computed(() => items.value.slice(0, id.value === 'apps' ? 4 : { m: 5, l: 6, xl: 11 }[size.value] || 5))
const cols = computed(() => (id.value === 'apps' || size.value === 'm' ? 4 : 7))
const addLabel = computed(() => d.value.addLabel || props.texts.addApp || '')
const title = computed(() => `${props.card.title} · ${count.value}`)
</script>

<template>
  <section class="m-tile m-cal m-b2" :class="[`m-b2--${id}`, `is-${size}`, id === 'apps' ? 'm-b2apps' : 'm-b2lib']" :data-size="size" data-accent="secondary">
    <template v-if="empty || !items.length">
      <header class="m-calm__head"><MIcon :name="d.icon || 'apps'" /><span class="m-calm__title">{{ empty?.title || card.title }}</span></header>
      <div class="m-empty-basic"><b>{{ empty?.value || d.empty }}</b><button v-if="empty?.action || addLabel" type="button" class="m-b2__btn is-tonal" @click.stop="emit('act', empty?.action || { type: 'add-app' })">{{ empty?.action?.label || addLabel }}</button></div>
    </template>
    <template v-else-if="id === 'apps' && size === 's'">
      <header class="m-calm__head"><MIcon :name="d.icon || 'apps'" /><span class="m-calm__title">{{ title }}</span></header>
      <button type="button" class="m-b2art" style="border: 0; padding: 0; cursor: pointer" :data-ctx="`app:${shown[0].name}`" :aria-label="shown[0].name" @click.stop="emit('act', { type: 'app', value: shown[0] })"><MTileCover :name="shown[0].name" :cover="shown[0].cover" /></button>
      <b class="m-b2__name">{{ shown[0].name }}</b>
    </template>
    <template v-else>
      <header class="m-calm__head"><MIcon :name="d.icon || 'apps'" /><span class="m-calm__title">{{ title }}</span><button type="button" class="m-calm__more" :aria-label="texts.more || card.title" @click.stop="emit('act', id === 'apps' ? { type: 'open', value: 'apps' } : OPEN)"><MIcon name="chevron_right" /></button></header>
      <ul class="m-b2lib__grid" :style="{ '--cols': cols }">
        <li v-for="a in shown" :key="a.name" :data-ctx="`app:${a.name}`"><button type="button" :aria-label="a.name" :title="a.name" @click.stop="emit('act', { type: 'app', value: a })"><span class="m-b2art"><MTileCover :name="a.name" :cover="a.cover" /></span><small>{{ a.name }}</small></button></li>
        <li v-if="id === 'apps' && addLabel" class="m-b2lib__add"><button type="button" :aria-label="addLabel" @click.stop="emit('act', { type: 'add-app' })"><span class="m-b2art"><MIcon name="add" /></span><small>{{ addLabel }}</small></button></li>
      </ul>
    </template>
  </section>
</template>
