<script>
export const tileIds = ['pin:*']
</script>

<script setup>
// The settings the person pinned to the overview (homePins.js), in the calibrated language: a switch is a strip (the glyph, the name, what it is now) that turns it at a press;
// a slider is a tile with the value in its head; a choice of a few values is a row of buttons; a setting of tier 3 is a strip that opens its page. A risky switch or slider asks first.
// The tile shows what the person chose until the host's value comes back (draft), and goes back to the host's value when the save fails.
import { computed, ref, watch } from 'vue'
import MDialog from '../MDialog.vue'
import MIcon from '../MIcon.vue'
import MSlider from '../MSlider.vue'
import { designProps } from './tileData.js'

const props = defineProps(designProps)
const emit = defineEmits(['act'])
const d = computed(() => props.card.data || {})
const type = computed(() => d.value.type)
const size = computed(() => (['s', 'm', 'l'].includes(props.card.size) ? props.card.size : 's'))
// the one shared M3 Expressive slider at every height of the tile (docs/tile-kit.md): the layout makes room for it, the track is never swapped for a thin one
const sliderSize = 'm'
const ask = ref(null)
const draft = ref(null)
const pinOn = computed(() => (draft.value !== null && type.value === 'pin-switch' ? draft.value : d.value.on))
const sliderValue = ref(type.value === 'pin-slider' ? d.value.value : 0)
watch(() => d.value.on, () => { draft.value = null })
watch(() => d.value.value, (v) => { sliderValue.value = v })
const sliderText = computed(() => (sliderValue.value === 0 && d.value.zeroText ? d.value.zeroText : `${sliderValue.value}${d.value.unit ?? ''}`))
function setPin(value) {
  ask.value = null
  if (props.preview) return
  if (type.value === 'pin-switch') draft.value = value
  emit('act', { type: 'setting', value: { key: d.value.key, value: type.value === 'pin-switch' ? (value ? d.value.onValue : d.value.offValue) : value, failed: () => { draft.value = null; if (type.value === 'pin-slider') sliderValue.value = d.value.value } } })
}
const wantPin = (value) => { if (d.value.confirm) ask.value = { value }; else setPin(value) }
const cancel = () => { ask.value = null; if (type.value === 'pin-slider') sliderValue.value = d.value.value }
const choose = (v) => { if (!props.preview) emit('act', { type: 'setting', value: { key: d.value.key, value: v } }) }
const open = () => { if (!props.preview) emit('act', { type: d.value.act, value: d.value.value }) }
</script>

<template>
  <!-- 开关: a strip -->
  <button v-if="type === 'pin-switch'" type="button" class="m-tile m-cal m-b2 m-b2strip m-b2strip--switch m-b3pin" :class="{ 'is-on': pinOn }" :data-size="size" data-accent="primary" role="switch" :aria-checked="!!pinOn" :aria-label="d.title" @click.stop="wantPin(!pinOn)">
    <span class="m-b2glyph" :class="{ 'is-on': pinOn }"><MIcon :name="d.icon" /></span><b>{{ d.title }}</b><span class="m-b2__cap m-b2strip__sp">{{ pinOn ? d.onText : d.offText }}</span>
    <MDialog v-if="d.confirm" :model-value="!!ask" :title="d.confirm.title" icon="warning" @update:model-value="(v) => { if (!v) ask = null }">
      <p>{{ d.confirm.body }}</p>
      <template #actions><button type="button" class="m-dpill" @click.stop="cancel">{{ d.confirm.cancel }}</button><button type="button" class="m-dpill m-dpill--fill" @click.stop="setPin(ask.value)">{{ d.confirm.change }}</button></template>
    </MDialog>
  </button>

  <!-- 滑块: one row at the height of one unit: the name, the full M3 Expressive slider, the value at the end -->
  <section v-else-if="type === 'pin-slider'" class="m-tile m-cal m-b3pin m-b3pin--slider" :class="`is-${size}`" :data-size="size" data-accent="primary">
    <header class="m-calm__head"><span class="m-calm__title">{{ d.title }}</span></header>
    <div class="m-b3pin__slider" @click.stop><MSlider v-model="sliderValue" :min="d.min" :max="d.max" :step="d.step" :size="sliderSize" :icon-start="d.icon" :label="d.title" :disabled="preview" @commit="wantPin(Math.round(sliderValue * d.scale))" /></div>
    <b class="m-calm__peak m-dnum m-b3pin__val">{{ sliderText }}</b>
    <MDialog v-if="d.confirm" :model-value="!!ask" :title="d.confirm.title" icon="warning" @update:model-value="(v) => { if (!v) cancel() }">
      <p>{{ d.confirm.body }}</p>
      <template #actions><button type="button" class="m-dpill" @click.stop="cancel">{{ d.confirm.cancel }}</button><button type="button" class="m-dpill m-dpill--fill" @click.stop="setPin(ask.value)">{{ d.confirm.change }}</button></template>
    </MDialog>
  </section>

  <!-- 几个值的选择: the values as buttons, the chosen one filled -->
  <section v-else-if="type === 'control'" class="m-tile m-cal m-b3pin m-b3pin--choice" :class="`is-${size}`" :data-size="size" data-accent="primary">
    <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ d.title }}</span></header>
    <div class="m-b3pin__chips" role="radiogroup" :aria-label="d.title"><button v-for="o in d.options" :key="o.value" type="button" role="radio" :aria-checked="o.value === d.value" :class="{ 'is-on': o.value === d.value }" @click.stop="choose(o.value)">{{ o.label }}</button></div>
    <span v-if="d.note" class="m-b2__cap">{{ d.note }}</span>
  </section>

  <!-- 链接: a strip that opens the page of the setting -->
  <button v-else type="button" class="m-tile m-cal m-b2 m-b2strip m-b2strip--switch m-b3pin" :data-size="size" data-accent="primary" :aria-label="d.title" @click.stop="open">
    <span class="m-b2glyph"><MIcon :name="d.icon" /></span><b>{{ d.title }}</b><span class="m-b2__cap m-b2strip__sp">{{ d.label }}</span><MIcon name="chevron_right" />
  </button>
</template>
