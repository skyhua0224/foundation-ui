<script setup>
import { computed } from 'vue'
import MIcon from './MIcon.vue'
import { coverOk, coverStyle } from './coverOk.js'
import MDashSpark from './MDashSpark.vue'
import MProgressRing from './MProgressRing.vue'
import MClientTag from './MClientTag.vue'
import { MText } from './textNode.js'

// The small size of a card, one anatomy for every card (data from homeSmall.js): the icon in a shape of the card's category as a badge, the label, a strong value (with its unit),
// one meaningful second line, and the tile's own graphic: the covers of its apps, the avatars of its devices, a drawn display, a trend curve, a progress ring, a live pulse; a tile without
// data for a graphic shows its chip, or a quiet pair of shapes. An empty tile (nothing to show yet) keeps the shape, says so and offers the one action that fills it.
// Wide and short (a row of the grid): the badge, the text, the graphic at the right. Square (方形, the dock and the grid alike): the badge and the graphic on top, the text under them.
const props = defineProps({ small: { type: Object, required: true }, group: { type: String, default: '' }, chevron: { type: Boolean, default: false }, square: { type: Boolean, default: false } })
const emit = defineEmits(['act'])
// the width of a text in em: a CJK character is one, any other about .55 (a long text is set smaller and may take two lines)
const long = computed(() => [...String(props.small.value || props.small.title || '')].reduce((w, c) => w + (/[\u3000-\u9fff\uff00-\uffef]/.test(c) ? 1 : 0.55), 0) > 4.6)
// the second line in its parts (the pieces of one fact: the host's name, its uptime): a line breaks between pieces, never inside one, so nothing is cut
const parts = computed(() => String(props.small.secondary || '').split(' · ').filter(Boolean).slice(0, 2))
const barMax = computed(() => Math.max(1, ...(props.small.bars || [])))
const kind = computed(() => {
  const s = props.small
  if (s.empty || s.cta) return s.action ? 'action' : 'none'
  if (s.covers?.length) return 'covers'
  if (s.avatars?.length) return 'avatars'
  if (s.display) return 'display'
  if (s.image) return 'image'
  if (s.bars?.length) return 'bars'
  if (s.pills?.length || s.tag) return 'pills'
  if (s.spark) return 'spark'
  if (s.progress !== undefined && s.progress !== null) return 'ring'
  if (s.toggle !== undefined) return 'toggle'
  if (s.dots) return 'dots'
  if (s.pulse) return 'pulse'
  return s.chip ? 'chip' : 'none'
})
</script>

<template>
  <section class="m-dcard m-dsmall" :class="[small.tone && `is-${small.tone}`, (small.empty || small.cta) && 'is-empty', small.cta && 'is-cta', square && 'is-square']" :data-group="group" :data-visual="kind">
    <div class="m-dsmall__in">
      <span class="m-dsmall__icon"><MIcon :name="small.icon || 'apps'" /></span>
      <div class="m-dsmall__body">
        <span v-if="small.value && small.title" class="m-dsmall__title">{{ small.title }}</span>
        <!-- the value and the second line change while the page is idle (a live number): their text is patched in place, the node stays (textNode.js) -->
        <b class="m-dsmall__value" :class="{ 'is-long': long }"><i v-if="small.state" class="m-dsmall__state" :class="`is-${small.state}`" aria-hidden="true" /><span><MText :text="small.value || small.title" /></span><small v-if="small.unit && small.value">{{ small.unit }}</small></b>
        <span v-if="small.secondary" class="m-dsmall__sub"><span v-for="(p, i) in parts" :key="i" class="m-dsmall__part"><MText :text="p" /></span></span>
      </div>
      <div class="m-dsmall__end">
        <button v-if="kind === 'action'" type="button" class="m-dsmall__act" @click.stop="emit('act', small.action)">{{ small.action.label }}</button>
        <MDashSpark v-else-if="kind === 'spark'" class="m-dsmall__spark" :points="small.spark" />
        <div v-else-if="kind === 'covers'" class="m-dsmall__covers" :data-n="small.covers.length" aria-hidden="true"><i v-for="(c, i) in small.covers" :key="i" :class="`c${i}`" :style="coverStyle(c.cover)"><MIcon v-if="!coverOk(c.cover)" :name="c.icon || 'sports_esports'" /></i><b v-if="small.more">+{{ small.more }}</b></div>
        <div v-else-if="kind === 'avatars'" class="m-dsmall__avatars" aria-hidden="true"><i v-for="(a, i) in small.avatars" :key="i" :class="a.tone && `is-${a.tone}`"><MIcon :name="a.icon || 'devices'" /></i><b v-if="small.more">+{{ small.more }}</b></div>
        <div v-else-if="kind === 'display'" class="m-dsmall__display" aria-hidden="true"><span class="m-dsmall__screen" :class="{ 'is-hdr': small.display.hdr }" :style="{ aspectRatio: small.display.ratio }"><i v-if="small.display.label">{{ small.display.label }}</i></span><span class="m-dsmall__stand" /></div>
        <MProgressRing v-else-if="kind === 'ring'" class="m-dsmall__ring" :value="small.progress" :label="small.title || small.value" />
        <img v-else-if="kind === 'image'" class="m-dsmall__image" :src="small.image" alt="" />
        <div v-else-if="kind === 'bars'" class="m-dsmall__bars" aria-hidden="true"><i v-for="(b, i) in small.bars" :key="i" :style="{ height: `${Math.max(6, (b / barMax) * 100)}%` }" /></div>
        <div v-else-if="kind === 'pills'" class="m-dsmall__pills"><MClientTag v-if="small.tag" :official="small.tag.official" :locale="small.tag.locale" /><span v-for="(c, i) in small.pills" :key="i" class="m-dchip" :class="c.tone && `m-dchip--${c.tone}`">{{ c.label }}</span></div>
        <span v-else-if="kind === 'toggle'" class="m-dsmall__switch" :class="{ 'is-on': small.toggle }" aria-hidden="true"><i /></span>
        <span v-else-if="kind === 'dots'" class="m-dsmall__dots" aria-hidden="true"><i v-for="n in small.dots.n" :key="n" :class="{ 'is-on': n - 1 === small.dots.i }" /></span>
        <span v-else-if="kind === 'pulse'" class="m-dsmall__pulse" aria-hidden="true"><i /><i /><i /></span>
        <span v-else-if="kind === 'chip'" class="m-dchip" :class="small.chip.tone && `m-dchip--${small.chip.tone}`">{{ small.chip.label }}</span>
        <MIcon v-if="chevron && kind !== 'action'" class="m-dsmall__chev" name="chevron_right" />
      </div>
    </div>
  </section>
</template>
