<script>
export const tileIds = ['ctl-vdd', 'pers-wallpaper']
</script>

<script setup>
// 虚拟显示器 (大) and 壁纸 (中) in the calibrated language.
//   虚拟显示器: a calm card; the mode is the one large thing (display type), its state in a chip; the three modes as Quick Settings rows (Google Home's favourites,
//     iOS 18 Home controls at 2 × 2), the chosen one filled; 更多选项 to the settings. The same store as the settings page: a choice saves at once.
//   壁纸: the picture is the tile (iOS Photos widget); a scrim under the text; the sources as small round thumbnails, the chosen one ringed.
import { computed } from 'vue'
import MIcon from '../MIcon.vue'
import { vddTexts } from '../../settings/vddTexts.js'
import { useAppearance } from '../useAppearance.js'
import { DEFAULT_GRADIENT, IMAGE_KEY } from '../../appearance/appearance.js'
import { WALLPAPERS, autoPictures } from '../../appearance/wallpaper.js'
import MTileShape from '../MTileShape.vue'
import { designProps } from './tileData.js'
import { b3Texts } from './b3Texts.js'

const props = defineProps(designProps)
const emit = defineEmits(['act'])
const L = computed(() => b3Texts(props.texts))
const d = computed(() => props.card.data || {})
const isVdd = computed(() => props.card.id === 'ctl-vdd')
// 虚拟显示器
const store = computed(() => d.value.store)
const t = computed(() => vddTexts(d.value.locale || 'en'))
const mode = computed(() => store.value?.mode.value || 'physical')
const summary = computed(() => store.value?.summary.value || {})
const ICONS = { physical: 'monitor', ondemand: 'screen_share', persistent: 'keep' }
const modes = computed(() => (store.value?.modes.value || []).map((m) => ({ id: m.id, label: t.value.modes[m.id], icon: ICONS[m.id], disabled: m.disabled })))
const setMode = (m) => { if (!props.preview && m !== mode.value) store.value?.setMode(m, { save: true }) }
const virtual = computed(() => mode.value !== 'physical')
const chip = computed(() => (virtual.value && summary.value.active !== null && summary.value.active !== undefined ? (summary.value.active ? t.value.active : t.value.inactive) : ''))
// 壁纸
const ap = useAppearance()
const source = computed(() => (ap.state.background === 'wallpaper' ? ap.state.source : ''))
const stored = () => { try { return globalThis.localStorage?.getItem(IMAGE_KEY) || '' } catch { return '' } }
const pictureOf = (s) => (WALLPAPERS[s] ? WALLPAPERS[s].url : s === 'auto' && autoPictures() ? WALLPAPERS[autoPictures().colour].url : s === 'url' ? ap.state.url || '' : s === 'file' ? stored() : '')
const ground = (s) => { const u = pictureOf(s); return u ? { backgroundImage: `url("${u}")` } : { backgroundImage: DEFAULT_GRADIENT } }
const sourceLabel = computed(() => (d.value.options || []).find((o) => o.value === source.value)?.label || (source.value ? '' : L.value.noWallpaper))
const setSource = (s) => { if (!props.preview) ap.set({ background: 'wallpaper', source: s }) }
</script>

<template>
  <section v-if="isVdd" class="m-tile m-cal m-b3d" data-size="l" :data-accent="virtual ? 'primary' : 'secondary'">
    <header class="m-calm__head"><MIcon name="desktop_windows" /><span class="m-calm__title">{{ card.title }}</span><span v-if="chip" class="m-b3d__chip" :class="{ 'is-on': summary.active }">{{ chip }}</span></header>
    <b class="m-b3d__mode">{{ t.modes[mode] }}</b>
    <div class="m-b3d__modes" role="radiogroup" :aria-label="card.title">
      <button v-for="m in modes" :key="m.id" type="button" role="radio" :class="{ 'is-on': m.id === mode }" :aria-checked="m.id === mode" :disabled="m.disabled" @click="setMode(m.id)"><i><MIcon :name="m.icon" /></i>{{ m.label }}</button>
    </div>
    <button type="button" class="m-b3d__more" @click="!preview && emit('act', { type: 'open', value: 'vdd' })"><MIcon name="tune" />{{ t.more }}</button>
  </section>

  <section v-else class="m-tile m-cal m-b3w" data-size="m">
    <div class="m-b3w__pic" :style="ground(source || 'gradient')"><MTileShape v-if="!source" class="m-b3w__hero" icon="wallpaper" shape="clover" size="92px" tone="tonal" /></div>
    <div class="m-b3w__foot">
      <span class="m-b3w__text"><small>{{ card.title }}</small><b>{{ sourceLabel }}</b></span>
      <span class="m-b3w__srcs" role="radiogroup" :aria-label="card.title"><button v-for="o in d.options" :key="o.value" type="button" role="radio" :class="{ 'is-on': o.value === source }" :aria-checked="o.value === source" :aria-label="o.label" :data-tip="o.label" :style="ground(o.value)" @click="setSource(o.value)" /></span>
    </div>
  </section>
</template>
