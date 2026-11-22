<script setup>
import MDashCard from './MDashCard.vue'
import MIcon from './MIcon.vue'
import MRoll from './MRoll.vue'
import MRing from './MRing.vue'
import MDashSpark from './MDashSpark.vue'

// Small info card: one big value, then one graphic or nested control (a stacked bar, chips, nested tone blocks).
defineProps({
  title: { type: String, required: true },
  icon: { type: String, default: '' },
  value: { type: String, default: '' },
  unit: { type: String, default: '' },
  sub: { type: String, default: '' },
  chips: { type: Array, default: () => [] }, // [{ label, tone?, icon? }]
  bar: { type: Object, default: null }, // { segments: [{ label, text, value (0..1), tone: 'a'|'b'|'free' }] }
  blocks: { type: Array, default: () => [] },
  tiles: { type: Array, default: () => [] }, // [{ icon, label, word, ready }]: an icon in a tonal shape, one word, a green dot while ready
  ring: { type: Object, default: null }, // { value 0..1, label, caption }
  spark: { type: Array, default: null }, // samples drawn as a small area curve along the bottom
  screen: { type: Object, default: null }, // { w, h, hdr } a small drawn display with the real aspect ratio // [{ icon, title, sub, tone? }]
  chevron: { type: Boolean, default: true },
  chevronLabel: { type: String, default: '' },
})
const emit = defineEmits(['open'])
</script>

<template>
  <MDashCard :title="title" :icon="icon" :chevron="chevron" :chevron-label="chevronLabel" class="m-dinfo" @open="emit('open')">
    <div v-if="screen" class="m-dinfo__screen" aria-hidden="true"><span class="m-dinfo__display" :class="{ 'is-hdr': screen.hdr }" :style="{ aspectRatio: `${screen.w} / ${screen.h}` }"><i>{{ screen.w }}×{{ screen.h }}</i></span><span class="m-dinfo__stand" /></div>
    <MRing v-if="ring" class="m-dinfo__ring" :value="ring.value" :size="64" :label="ring.caption"><b class="m-dnum m-dinfo__ringtext">{{ ring.label }}</b></MRing>
    <div v-if="value" class="m-dinfo__value"><b class="m-dnum"><MRoll :text="value" /></b><small v-if="unit">{{ unit }}</small></div>
    <div v-if="sub" class="m-dinfo__sub">{{ sub }}</div>
    <div v-if="chips.length" class="m-dinfo__chips"><span v-for="(c, i) in chips" :key="i" class="m-dchip" :class="c.tone && `m-dchip--${c.tone}`"><MIcon v-if="c.icon" :name="c.icon" />{{ c.label }}</span></div>
    <div v-if="bar" class="m-dstack">
      <div class="m-dstack__bar"><i v-for="(s, i) in bar.segments" :key="i" :class="`m-dstack__seg--${s.tone}`" :style="{ flexGrow: Math.max(s.value, 0.001) }" /></div>
      <ul class="m-dstack__legend"><li v-for="(s, i) in bar.segments" :key="i"><i :class="`m-dstack__dot--${s.tone}`" /><span>{{ s.label }}</span><b class="m-dnum">{{ s.text }}</b></li></ul>
    </div>
    <ul v-if="tiles.length" class="m-dtiles"><li v-for="(t, i) in tiles" :key="i" class="m-dtile" :class="{ 'is-ready': t.ready }" :aria-label="`${t.label}: ${t.word}`"><span class="m-dtile__icon"><MIcon :name="t.icon" /></span><span class="m-dtile__word"><i class="m-dtile__dot" :class="{ 'is-off': !t.ready }" aria-hidden="true" />{{ t.word }}</span></li></ul>
    <div v-if="blocks.length" class="m-dblocks" :class="{ 'm-dblocks--tight': blocks.length >= 3 }"><div v-for="(b, i) in blocks" :key="i" class="m-dblock" :class="b.tone && `m-dblock--${b.tone}`"><span class="m-dblock__lead"><MIcon :name="b.icon" /></span><span class="m-dblock__text"><b>{{ b.title }}</b><small v-if="b.sub">{{ b.sub }}</small></span></div></div>
    <MDashSpark v-if="spark" :points="spark" />
    <slot />
  </MDashCard>
</template>
