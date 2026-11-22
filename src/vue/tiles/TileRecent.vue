<script>
export const tileIds = ['recent-actions']
</script>

<script setup>
// 最近操作: the settings the person used last, each as a row with its own control (the pin's control: a switch, a few values, a slider) and, under the name, when a change applies.
// 方形 shows one row, 中 two, 大 four and 特大 eight in two columns; 特大 and 大 draw the whole control, the smaller sizes the switch, or the value and the way to the setting's page. A setting
// with no control of that kind, a risky one, or one whose value is not known is a row that opens its page. Saving goes through the one saving path (the `setting` action).
import { computed, reactive, watch } from 'vue'
import MIcon from '../MIcon.vue'
import MSwitch from '../MSwitch.vue'
import MSlider from '../MSlider.vue'
import MTileShape from '../MTileShape.vue'
import { FULL_CONTROL_SIZES, RECENT_ROWS } from '../homeRecent.js'
import { designProps } from './tileData.js'

const props = defineProps(designProps)
const emit = defineEmits(['act'])
const d = computed(() => props.card.data || {})
const size = computed(() => (RECENT_ROWS[props.card.size] ? props.card.size : 'm'))
const full = computed(() => FULL_CONTROL_SIZES.includes(size.value))
const rows = computed(() => (d.value.rows || []).slice(0, RECENT_ROWS[size.value]))
// 特大 has two columns of its own, each as tall as its rows need
const columns = computed(() => (size.value === 'xl' ? [rows.value.slice(0, 4), rows.value.slice(4)].filter((c) => c.length) : [rows.value]))
// what the person chose shows until the host's value comes back
const draft = reactive({})
watch(() => d.value.rows, () => { for (const k of Object.keys(draft)) delete draft[k] })
const save = (key, value) => { if (!props.preview) emit('act', { type: 'setting', value: { key, value, failed: () => { delete draft[key] } } }) }
const open = (r) => { if (!props.preview) emit('act', { type: 'pin-open', value: { key: r.key } }) }
const on = (r) => (r.key in draft ? draft[r.key] : r.on)
const flip = (r, v) => { draft[r.key] = v; save(r.key, v ? r.onValue : r.offValue) }
const pick = (r, v) => { draft[r.key] = v; save(r.key, v) }
const level = (r) => (r.key in draft ? draft[r.key] : r.value)
const levelText = (r) => { const v = level(r); return v === 0 && r.zeroText ? r.zeroText : `${v}${r.unit || ''}` }
const chosen = (r) => (r.key in draft ? draft[r.key] : r.value)
const slide = (r, v) => { draft[r.key] = v }
const commit = (r, v) => { draft[r.key] = v; save(r.key, Math.round(v * r.scale)) }
// the value a row shows when its control is not drawn: the words of the setting, never the raw 'enabled' or 'ds4'
const word = (r) => { const v = r.valueText; if (/^(enabled|true)$/i.test(v)) return props.texts.on; if (/^(disabled|false)$/i.test(v)) return props.texts.off; return r.options?.find((o) => String(o.value) === v)?.label || v }
const valueText = (r) => (r.control === 'switch' ? (on(r) ? props.texts.on : props.texts.off) : r.control === 'slider' ? levelText(r) : word(r))
</script>

<template>
  <!-- nothing used yet: the same compact header and bottom action as the other empty tiles -->
  <section v-if="empty" class="m-tile m-cal m-rc is-empty" :class="`is-${size}`" :data-size="size" data-accent="primary">
    <header class="m-calm__head"><MIcon name="history" /><span class="m-calm__title">{{ card.title }}</span></header>
    <div class="m-empty-basic"><b>{{ empty.value }}</b><button v-if="empty.action" type="button" class="m-b2__btn" @click.stop="emit('act', empty.action)">{{ empty.action.label }}</button></div>
  </section>
  <!-- 方形: the last setting is the hero: its glyph in a shape, its name, when it applies, and its control -->
  <section v-else-if="size === 's' && rows.length" class="m-tile m-cal m-rc is-s is-hero" data-size="s" data-accent="primary">
    <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span></header>
    <div class="m-rc__heroview">
      <div class="m-rc__identity">
        <MTileShape :icon="rows[0].icon" shape="clover" size="36px" />
        <span class="m-rc__text"><b :title="rows[0].path">{{ rows[0].title }}</b><small :title="rows[0].appliesText">{{ rows[0].appliesText }}</small></span>
      </div>
      <MSwitch v-if="rows[0].control === 'switch'" :model-value="on(rows[0])" :label="rows[0].title" @update:model-value="(v) => flip(rows[0], v)" />
      <button v-else type="button" class="m-rc__jump" :aria-label="`${rows[0].title}: ${texts.rcOpen}`" @click.stop="open(rows[0])"><span v-if="valueText(rows[0])">{{ valueText(rows[0]) }}</span><MIcon name="chevron_right" /></button>
    </div>
  </section>
  <section v-else class="m-tile m-cal m-rc" :class="`is-${size}`" :data-size="size" data-accent="primary">
    <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span></header>
    <div v-if="rows.length" class="m-rc__cols" :class="{ 'is-two': size === 'xl' }">
    <ul v-for="(col, ci) in columns" :key="ci" class="m-rc__rows">
      <li v-for="r in col" :key="r.key" class="m-rc__row" :class="[`is-${r.control}`, { 'is-full': full && (r.control === 'slider' || r.control === 'seg') }]">
        <span class="m-rc__text"><b :title="r.path">{{ r.title }}</b><small>{{ r.appliesText }}</small></span>
        <span class="m-rc__ctl">
          <MSwitch v-if="r.control === 'switch'" :model-value="on(r)" :label="r.title" @update:model-value="(v) => flip(r, v)" />
          <div v-else-if="r.control === 'seg' && full" class="m-rc__seg" role="radiogroup" :aria-label="r.title">
            <button v-for="o in r.options" :key="o.value" type="button" role="radio" :class="{ 'is-on': String(o.value) === String(chosen(r)) }" :aria-checked="String(o.value) === String(chosen(r))" @click.stop="pick(r, o.value)">{{ o.label }}</button>
          </div>
          <template v-else-if="r.control === 'slider' && full">
            <MSlider :model-value="level(r)" :min="r.min" :max="r.max" :step="r.step" size="m" :label="r.title" @update:model-value="(v) => slide(r, v)" @commit="(v) => commit(r, v)" />
            <b class="m-rc__val">{{ levelText(r) }}</b>
          </template>
          <button v-else type="button" class="m-rc__jump" :aria-label="`${r.title}: ${texts.rcOpen}`" @click.stop="open(r)"><span v-if="valueText(r)">{{ valueText(r) }}</span><MIcon name="chevron_right" /></button>
        </span>
      </li>
    </ul>
    </div>
    <p v-else class="m-rc__empty">{{ d.empty }}</p>
  </section>
</template>
