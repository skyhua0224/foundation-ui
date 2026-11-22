<script>
export const tileIds = ['ctl-encoder', 'ctl-bitrate', 'ctl-fps', 'pers-colour', 'pers-theme']
</script>

<script setup>
// The settings with a few values, in the calibrated language of 快捷操作: a strip is the quiet title at the start and one row of equal
// pills; the chosen value is the filled pill (an M3 connected button group: these are choices). The squares (编码器, 明暗) are the value in display type under the head,
// or a Quick Settings tile that cycles. Choosing saves through the one saving path (the `setting` action) or changes the window at once (个性化, useAppearance).
import { computed, ref } from 'vue'
import MIcon from '../MIcon.vue'
import MPickSheet from '../MPickSheet.vue'
import { choicesOf } from './b2.js'
import { useAppearance } from '../useAppearance.js'
import { PRESET_SEEDS } from '../../appearance/appearance.js'
import { schemeColors } from '../../tokens/theme.js'
import { encoderName } from '../../settings/model.js'
import { b3Texts } from './b3Texts.js'
import { designProps } from './tileData.js'

const props = defineProps(designProps)
const emit = defineEmits(['act'])
const ap = useAppearance()
const d = computed(() => props.card.data || {})
const id = computed(() => props.card.id)
const strip = computed(() => props.card.size === 'strip')
const L = computed(() => b3Texts(props.texts))
const save = (key, value) => { if (!props.preview) emit('act', { type: 'setting', value: { key, value } }) }
const setAp = (patch) => { if (!props.preview) ap.set(patch) }

// 编码器
// the encoders as buttons: 自动, the one in use, then the likely ones; the whole choice is behind the chevron
const ENC_LIKELY = ['nvenc', 'amdvce', 'quicksync', 'videotoolbox', 'vaapi']
const encChoices = computed(() => choicesOf(d.value.options, current.value.value, { first: d.value.options?.[0]?.value, likely: ENC_LIKELY }))
const pickOpen = ref(false)
// the strips say when a change applies: the encoder after a restart, the frame rates are the client's to decide (the host list after a restart)
const stripNote = computed(() => (id.value === 'ctl-encoder' ? L.value.restartNote : id.value === 'ctl-fps' || id.value === 'ctl-bitrate' ? L.value.clientNote : ''))
const current = computed(() => d.value.options?.find((o) => o.value === d.value.value) || { value: d.value.value, label: encoderName(d.value.value) || d.value.options?.[0]?.label || '' })
const bitrateChoices = computed(() => choicesOf(d.value.options, current.value.value, { limit: 2 }))
// 帧率预设: the presets the host offers a client (at most five, 30 to 500)
const fps = computed(() => [...(d.value.value || [])].map(Number).filter(Number.isFinite).sort((a, b) => a - b))
const saveFps = (list) => save('fps', `[${[...list].sort((a, b) => a - b).join(',')}]`)
const adding = ref(false)
const draft = ref('')
const valid = (t) => /^\d+(\.\d+)?$/.test(t) && Number(t) >= 30 && Number(t) <= 500
function add() { const t = draft.value.trim(); if (valid(t) && !fps.value.includes(Number(t)) && fps.value.length < 5) saveFps([...fps.value, Number(t)]); draft.value = ''; adding.value = false }
// 取色: each preset as a disc of its scheme's four tones (Pixel Wallpaper & style), in the window's light or dark
const dark = computed(() => { void ap.state.mode; const h = typeof document === 'undefined' ? null : document.documentElement; return !!h && (h.classList.contains('dark') || h.dataset.bsTheme === 'dark') })
const quarters = (hex) => { try { const c = schemeColors(hex, { dark: dark.value }); return [c.primary, c.secondary, c.primaryContainer, c.tertiary] } catch { return [hex, hex, hex, hex] } }
const presets = computed(() => PRESET_SEEDS.map((p) => ({ ...p, q: quarters(p.hex), on: ap.state.color === 'preset' && ap.state.preset === p.id })))
const disc = (q) => ({ background: `conic-gradient(${q[0]} 0 25%, ${q[1]} 0 50%, ${q[2]} 0 75%, ${q[3]} 0)` })
const NAMES = { red: '红', orange: '橙', amber: '琥珀', yellow: '黄', green: '绿', teal: '青', blue: '蓝', violet: '紫', pink: '粉', rose: '玫瑰' }
const presetName = (pid) => (/^zh/i.test(String(props.texts.__locale || '')) ? NAMES[pid] : pid.charAt(0).toUpperCase() + pid.slice(1)) || pid
// 明暗
const MODE_ICON = { system: 'contrast', light: 'light_mode', dark: 'dark_mode' }
const mode = computed(() => ap.state.mode || 'system')
const modeLabel = (m) => d.value.options?.find((o) => o.value === m)?.label || m
</script>

<template>
  <!-- 编码器 方形: the encoders as list buttons (the choice is the picture; it is saved in place and takes effect after a restart, which the tile says) -->
  <section v-if="id === 'ctl-encoder' && !strip" class="m-tile m-cal m-b2 m-b2padtype is-s" data-size="s" data-accent="primary">
    <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span><button v-if="encChoices.more && !preview" type="button" class="m-calm__more" :aria-label="texts.more || card.title" @click.stop="pickOpen = true"><MIcon name="chevron_right" /></button></header>
    <div class="m-b2padtype__body"><div class="m-b2padtype__side">
      <ul class="m-b2opts" role="radiogroup" :aria-label="card.title"><li v-for="o in encChoices.shown" :key="o.value"><button type="button" role="radio" class="m-b2opt" :class="{ 'is-on': o.value === current.value }" :aria-checked="o.value === current.value" @click.stop="save(d.key, o.value)"><span>{{ o.label }}</span><MIcon v-if="o.value === current.value" name="check" /></button></li></ul>
      <span class="m-b2__cap m-b2padtype__note">{{ L.restartNote }}</span>
    </div></div>
    <MPickSheet v-if="encChoices.more" :model-value="current.value" v-model:open="pickOpen" :title="card.title" :options="d.options" :help="L.restartNote" :close-label="texts.close || 'Close'" @update:model-value="(v) => save(d.key, v)" />
  </section>

  <!-- The square keeps the current rate and automatic in reach; the sheet offers every preset. -->
  <section v-else-if="id === 'ctl-bitrate' && !strip" class="m-tile m-cal m-b2 m-b2padtype is-s" data-size="s" data-accent="primary">
    <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span><button v-if="bitrateChoices.more && !preview" type="button" class="m-calm__more" :aria-label="texts.more || card.title" @click.stop="pickOpen = true"><MIcon name="chevron_right" /></button></header>
    <div class="m-b2padtype__body"><div class="m-b2padtype__side">
      <ul class="m-b2opts" role="radiogroup" :aria-label="card.title"><li v-for="o in bitrateChoices.shown" :key="o.value"><button type="button" role="radio" class="m-b2opt" :class="{ 'is-on': o.value === current.value }" :aria-checked="o.value === current.value" @click.stop="save(d.key, o.value)"><span>{{ o.label }}</span><MIcon v-if="o.value === current.value" name="check" /></button></li></ul>
    </div></div>
    <MPickSheet v-if="bitrateChoices.more" :model-value="current.value" v-model:open="pickOpen" :title="card.title" :options="d.options" :help="L.clientNote" :close-label="texts.close || 'Close'" @update:model-value="(v) => save(d.key, v)" />
  </section>

  <!-- 明暗 方形: the three modes as list buttons; the window's own look, so each press takes effect at once -->
  <section v-else-if="id === 'pers-theme' && !strip" class="m-tile m-cal m-b2 m-b2padtype is-s" data-size="s" data-accent="secondary">
    <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span></header>
    <div class="m-b2padtype__body"><div class="m-b2padtype__side">
      <ul class="m-b2opts" role="radiogroup" :aria-label="card.title"><li v-for="o in d.options" :key="o.value"><button type="button" role="radio" class="m-b2opt" :class="{ 'is-on': o.value === mode }" :aria-checked="o.value === mode" @click.stop="setAp({ mode: o.value })"><span>{{ o.label }}</span><MIcon v-if="o.value === mode" name="check" /></button></li></ul>
    </div></div>
  </section>

  <!-- the strips: the quiet title at the start, the values as equal pills -->
  <section v-else class="m-tile m-cal m-calq m-b3s" :class="`m-b3s--${id}`" data-size="strip" :data-accent="id === 'pers-colour' ? 'secondary' : 'primary'">
    <span class="m-calq__title"><MIcon :name="d.icon" /><span v-if="stripNote" class="m-b3s__tt">{{ card.title }}<small>{{ stripNote }}</small></span><template v-else>{{ card.title }}</template></span>
    <div v-if="id === 'ctl-encoder' || id === 'ctl-bitrate'" class="m-b3s__row" role="radiogroup" :aria-label="card.title">
      <button v-for="o in d.options" :key="o.value" type="button" role="radio" :class="{ 'is-on': o.value === current.value }" :aria-checked="o.value === current.value" @click="save(d.key, o.value)">{{ o.label }}</button>
    </div>
    <div v-else-if="id === 'ctl-fps'" class="m-b3s__row m-b3s__row--fps" :aria-label="card.title">
      <button v-for="v in fps" :key="v" type="button" class="is-on m-dnum" :aria-label="`${v} ${L.fps}`" :disabled="fps.length < 2" @click="saveFps(fps.filter((x) => x !== v))"><b>{{ v }}</b><small>{{ L.fps }}</small><MIcon v-if="fps.length > 1" name="close" /></button>
      <span v-if="adding" class="m-b3s__add"><input v-model="draft" inputmode="decimal" placeholder="144" :aria-label="L.addFps" @keydown.enter="add" @blur="add"></span>
      <button v-else-if="fps.length < 5" type="button" class="m-b3s__plus" :aria-label="L.addFps" @click="adding = true"><MIcon name="add" />{{ L.add }}</button>
    </div>
    <div v-else-if="id === 'pers-colour'" class="m-b3s__discs" role="radiogroup" :aria-label="card.title">
      <button v-for="p in presets" :key="p.id" type="button" role="radio" :class="{ 'is-on': p.on }" :aria-checked="p.on" :aria-label="presetName(p.id)" :data-tip="presetName(p.id)" :style="disc(p.q)" @click="setAp({ color: 'preset', preset: p.id })" />
    </div>
    <div v-else class="m-b3s__row" role="radiogroup" :aria-label="card.title">
      <button v-for="o in d.options" :key="o.value" type="button" role="radio" :class="{ 'is-on': o.value === mode }" :aria-checked="o.value === mode" @click="setAp({ mode: o.value })"><i><MIcon :name="MODE_ICON[o.value]" /></i>{{ o.label }}</button>
    </div>
  </section>
</template>
