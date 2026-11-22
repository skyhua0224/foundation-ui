<script setup>
import MIcon from './MIcon.vue'
import MRing from './MRing.vue'

/**
 * Row 4 for a new setup: the "get started" card and the download promo for the clients. The guide card is the bold promo
 * (tertiary container, a large organic shape); its steps tick from real data. The promo lists the platforms and opens the downloads page
 * for the one picked, the recommended client first.
 */
const props = defineProps({
  steps: { type: Array, default: () => [] }, // [{ id, title, sub, done, auto, icon }]
  platforms: { type: Array, default: () => [] }, // [{ id, label, icon, product?, recommended? }]
  recommended: { type: Array, default: () => [] }, // [{ id, label, sub? }] first lines of the promo
  texts: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['toggle', 'step', 'continue', 'dismiss', 'download'])
const T = (k, d) => props.texts[k] || d
</script>

<template>
  <section class="m-dguide m-dcard">
    <header class="m-dguide__head">
      <div>
        <h3 class="m-dguide__title">{{ T('title', 'Get started') }}</h3>
        <p class="m-dguide__sub">{{ T('sub', 'Five steps to your first stream') }}</p>
      </div>
      <MRing :segments="[{ value: steps.filter((s) => s.done).length / Math.max(steps.length, 1), tone: 'primary' }]" :size="52" :label="T('title', 'Get started')"><b class="m-dnum m-dguide__count">{{ steps.filter((s) => s.done).length }}/{{ steps.length }}</b></MRing>
    </header>
    <ol class="m-dguide__steps">
      <li v-for="(s, i) in steps" :key="s.id" class="m-dguide__step" :class="{ 'is-done': s.done }">
        <button type="button" class="m-dguide__tick" :class="{ 'is-auto': s.auto }" :aria-pressed="s.done" :aria-label="s.title" :disabled="s.auto" @click="emit('toggle', s.id)"><MIcon :name="s.done ? 'check' : ''" /><span v-if="!s.done">{{ i + 1 }}</span></button>
        <button type="button" class="m-dguide__text" @click="emit('step', s)"><b>{{ s.title }}</b><small v-if="s.sub">{{ s.sub }}</small></button>
      </li>
    </ol>
    <footer class="m-dguide__foot">
      <button type="button" class="m-dguide__go" @click="emit('continue')"><MIcon name="rocket_launch" />{{ T('continue', 'Guided setup') }}</button>
      <button type="button" class="m-dguide__skip" @click="emit('dismiss')">{{ T('dismiss', 'Hide') }}</button>
    </footer>
  </section>

  <section class="m-dpromo m-dcard">
    <header class="m-dcard__head"><MIcon class="m-dcard__icon" name="download" /><h3 class="m-dcard__title">{{ T('downloadTitle', 'Download a control app') }}</h3></header>
    <ul class="m-dpromo__rec">
      <li v-for="r in recommended" :key="r.id"><button type="button" class="m-dblock" @click="emit('download', r.id)"><span class="m-dblock__lead"><MIcon :name="r.icon || 'download'" /></span><span class="m-dblock__text"><b>{{ r.label }}</b><small v-if="r.sub">{{ r.sub }}</small></span></button></li>
    </ul>
    <div class="m-dpromo__plat">
      <button v-for="p in platforms" :key="p.id" type="button" class="m-dpromo__chip" :title="p.label" @click="emit('download', p.id)"><MIcon :name="p.icon" /><span>{{ p.label }}</span></button>
    </div>
  </section>
</template>
