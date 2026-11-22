<script>
export const tileIds = ['recent-games', 'last-session', 'stream-client']
</script>

<script setup>
// 最近游戏, 上次串流 and 串流客户端 in the calibrated calm language (round 31; round30-bold-tiles/b2/REFERENCES.md, the calibration board's 正在玩). 正在玩 is B1's (TileNowCal).
//   The cover is real art in a rounded mask; without art the icon (MTileCover), never a blank block.
//   最近游戏: the newest cover masked; 中 the two after it as small rows; 大 a grid of six covers with their names (iOS Music Recently Played, the M3E list widget).
//   上次串流 (the iOS Music widget's art, Apple Fitness's summary): the game's real art when it has one, the length as the display numeral, 中 three stats in one row with their
//     units on the line. Without art the tile has no picture and the numeral leads.
//   串流客户端: one device, live: its glyph, its name, its address on the primary container (a Live Activity's one subject).
// Empty (no stream yet): the tile's glyph in a quiet circle, one line, the card's own action (开始串流: guide-go / connect).
import { computed } from 'vue'
import MIcon from '../MIcon.vue'
import MTileCover from '../MTileCover.vue'
import MTileNumeral from '../MTileNumeral.vue'
import { coverOk } from '../coverOk.js'
import { OPEN, designProps } from './tileData.js'
import { deviceGlyph, initialOf, lengthParts, sizeB2 } from './b2.js'

const props = defineProps(designProps)
const emit = defineEmits(['act'])
const id = computed(() => props.card.id)
const d = computed(() => props.card.data || {})
const size = computed(() => sizeB2(props.card))
const open = () => emit('act', OPEN)

// 最近游戏
const games = computed(() => d.value.items || [])
// 上次串流: rows = [game · when, length, bitrate, fps, p95, dropped]. A length of hours and minutes is one numeral, 1:42; a stat's number and its unit stay on one line
const clockOf = ([a, b]) => (b ? { value: `${a.v}:${b.v.padStart(2, '0')}`, unit: a.u } : { value: a?.v || '', unit: a?.u || '' })
const statOf = (r) => { const m = /^([\d.,]+)\s*(.*)$/.exec(String(r.value ?? '')); return { title: r.title, value: m ? m[1] : r.value, unit: m ? m[2] : '' } }
const last = computed(() => { const r = d.value.rows || []; return { game: r[0]?.title || '', when: r[0]?.value || '', length: clockOf(lengthParts(r[1]?.value)), stats: r.slice(2, 5).map(statOf) } })
const hasArt = computed(() => coverOk(d.value.cover))
const lastSize = computed(() => (hasArt.value && size.value === 's' ? 's' : 'm'))
// 串流客户端
const sc = computed(() => d.value.rows?.[0] || {})
</script>

<template>
  <section class="m-tile m-cal m-b2" :class="[`m-b2--${id}`, `is-${size}`, { 'm-b2recent': id === 'recent-games', 'm-b2last': id === 'last-session', 'has-art': id === 'last-session' && hasArt, 'm-b2sc': id === 'stream-client' }]" :data-size="size" :data-accent="id === 'stream-client' ? 'primary' : 'tertiary'">
    <template v-if="empty">
      <header class="m-calm__head"><MIcon :name="empty.icon || d.icon" /><span class="m-calm__title">{{ empty.title || card.title }}</span></header>
      <div class="m-empty-basic"><b>{{ empty.value }}</b><button v-if="empty.action" type="button" class="m-b2__btn is-tonal" @click.stop="emit('act', empty.action)">{{ empty.action.label }}</button></div>
    </template>

    <!-- 最近游戏 -->
    <template v-else-if="id === 'recent-games' && size === 's'">
      <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span></header>
      <span class="m-b2art"><MTileCover :name="games[0]?.name" :cover="games[0]?.cover" /></span>
      <b class="m-b2__name">{{ games[0]?.name }}</b>
      <span class="m-b2__cap">{{ games[0]?.sub }}</span>
    </template>
    <template v-else-if="id === 'recent-games' && size === 'm'">
      <span class="m-b2art"><MTileCover :name="games[0]?.name" :cover="games[0]?.cover" /></span>
      <div class="m-b2recent__side">
        <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span><button v-if="chevron" type="button" class="m-calm__more" :aria-label="texts.more || card.title" @click.stop="open"><MIcon name="chevron_right" /></button></header>
        <b class="m-b2__name" style="--b2n: 19px">{{ games[0]?.name }}</b>
        <ul class="m-b2recent__mini"><li v-for="g in games.slice(1, 3)" :key="g.name"><span class="m-b2art"><MTileCover :name="g.name" :cover="g.cover" /></span><span><b>{{ g.name }}</b><small>{{ g.sub }}</small></span></li></ul>
      </div>
    </template>
    <template v-else-if="id === 'recent-games'">
      <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span><button v-if="chevron" type="button" class="m-calm__more" :aria-label="texts.more || card.title" @click.stop="open"><MIcon name="chevron_right" /></button></header>
      <ul class="m-b2recent__grid" style="--cols: 3"><li v-for="g in games.slice(0, 6)" :key="g.name"><span class="m-b2art"><MTileCover :name="g.name" :cover="g.cover" /></span><small>{{ g.name }}</small></li></ul>
    </template>

    <!-- 上次串流 -->
    <template v-else-if="id === 'last-session'">
      <span v-if="hasArt" class="m-b2art"><MTileCover :name="last.game" :cover="d.cover" /></span>
      <div class="m-b2last__side">
        <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span><button v-if="chevron && size === 'm'" type="button" class="m-calm__more" :aria-label="texts.more || card.title" @click.stop="open"><MIcon name="chevron_right" /></button></header>
        <MTileNumeral :value="last.length.value" :unit="last.length.unit" :size="lastSize" />
        <span class="m-b2__line">{{ last.game }} · {{ last.when }}</span>
        <ul v-if="size === 'm'" class="m-b2last__stats"><li v-for="s in last.stats" :key="s.title">{{ s.title }}<span><b>{{ s.value }}</b> {{ s.unit }}</span></li></ul>
      </div>
    </template>

    <!-- 串流客户端 -->
    <template v-else>
      <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span></header>
      <div class="m-b2plate is-on"><span class="m-b2glyph"><MIcon v-if="deviceGlyph(d.clientIcon)" :name="d.clientIcon" /><MIcon v-else name="devices" /></span><span style="min-width: 0; display: flex; flex-direction: column"><b>{{ sc.title }}</b><small v-if="sc.value">{{ sc.value }}</small></span></div>
    </template>
  </section>
</template>
