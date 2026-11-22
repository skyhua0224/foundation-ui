<script>
export const tileIds = ['encoder', 'codecs', 'host-adapter']
</script>

<script setup>
// 编码器, 编解码器 and GPU 适配器 (REFERENCES.md "encoder", "codecs", "host-adapter").
//   编码器 (the Apple TV / Now Playing widget's big name over its art): the encoder's name in display type over a large shape cut by the corner.
//     方形: the name and the shape · 中: + the codecs it can use as tiles, or while streaming the codec, the bitrate and the latency budget as a ring
//   编解码器 (Pixel's quick-settings tiles, one per state): three shape tiles, H.264 / HEVC / AV1, filled when on. 中 only.
//   GPU 适配器 (the Batteries widget's device glyph): the adapter's glyph in a large shape, its name; 中 adds the output.
import { computed } from 'vue'
import MTileHead from '../MTileHead.vue'
import MTileNumeral from '../MTileNumeral.vue'
import MTileShape from '../MTileShape.vue'
import MTileRing from '../MTileRing.vue'
import MTileChip from '../MTileChip.vue'
import { OPEN, sizeOf, designProps } from './tileData.js'

const props = defineProps(designProps)
const emit = defineEmits(['act'])
const id = computed(() => props.card.id)
const d = computed(() => props.card.data || {})
const size = computed(() => sizeOf(props.card))
// 'HEVC · 开' -> { name: 'HEVC', word: '开' }
const codecs = computed(() => (d.value.chips || []).map((c) => { const [name, word] = String(c.label).split(' · '); return { name, word: word || '', on: c.tone === 'ok' } }))
// the codec that leads: the best one the host can use (AV1, then HEVC, then H.264); none on: the first. The others are drawn small beside it, so the tile has one focal shape
const RANK = ['av1', 'hevc', 'h.265', 'h.264', 'h264']
const rank = (n) => { const i = RANK.indexOf(String(n).toLowerCase()); return i < 0 ? RANK.length : i }
const lead = computed(() => { const on = codecs.value.filter((c) => c.on); return (on.length ? on.slice().sort((a, b) => rank(a.name) - rank(b.name))[0] : codecs.value[0])?.name })
const rows = computed(() => d.value.rows || [])
</script>

<template>
  <section class="m-tile m-tenc" :class="[`m-tenc--${id}`, `is-${size}`]" :data-accent="id === 'codecs' ? 'secondary' : 'primary'" :data-size="size">
    <template v-if="empty">
      <MTileHead :icon="empty.icon || d.icon" :title="empty.title || card.title" />
      <div class="m-empty-basic"><b>{{ empty.value }}</b><button v-if="empty.action" type="button" class="m-b2__btn is-tonal" @click.stop="emit('act', empty.action)">{{ empty.action.label }}</button></div>
    </template>
    <template v-else-if="id === 'codecs'">
      <MTileHead :icon="d.icon" :title="card.title" :chevron="chevron" @open="emit('act', OPEN)" />
      <ul class="m-tenc__codecs">
        <li v-for="(c, i) in codecs" :key="c.name" :class="{ 'is-on': c.on, 'is-lead': c.name === lead }"><MTileShape :shape="['cookie', 'clover', 'sunny'][i % 3]" size="100%" :tone="c.on ? 'solid' : 'tonal'"><b>{{ c.name }}</b></MTileShape><span :class="c.name === lead && c.on ? 'm-visually-hidden' : 'm-tenc__state'">{{ c.word || '✓' }}</span></li>
      </ul>
    </template>
    <template v-else-if="id === 'host-adapter'">
      <MTileShape class="m-tile__corner" shape="gem" :size="size === 's' ? '150px' : '176px'" tone="tonal" />
      <MTileHead :icon="d.icon" :title="card.title" :chevron="chevron && size !== 's'" @open="emit('act', OPEN)" />
      <div class="m-tenc__adapter">
        <b class="m-tenc__name">{{ rows[0]?.value }}</b>
        <span v-if="size !== 's' && rows[1]" class="m-tenc__out"><MTileChip :icon="rows[1].icon" :label="`${rows[1].title} ${rows[1].value}`" /></span>
      </div>
    </template>
    <template v-else>
      <MTileHead :icon="d.icon" :title="card.title" :chevron="chevron && size !== 's'" @open="emit('act', OPEN)" />
      <div class="m-tenc__main">
        <div class="m-tenc__word">
          <MTileNumeral :value="d.value" :size="size === 's' ? 's' : 'm'" :caption="d.sub" />
        </div>
        <template v-if="size !== 's'">
          <MTileRing v-if="d.ring" class="m-tenc__budget" :value="d.ring.value"><MTileNumeral :value="d.ring.label" size="s" :caption="d.ring.caption" /></MTileRing>
          <div v-else-if="d.chips?.length" class="m-tenc__chips"><MTileChip v-for="c in d.chips" :key="c.label" :label="c.label" :tone="c.tone === 'ok' ? 'ok' : ''" /></div>
        </template>
      </div>
    </template>
  </section>
</template>
