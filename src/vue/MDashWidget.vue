<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import MDashCard from './MDashCard.vue'
import MIcon from './MIcon.vue'
import { coverOk, coverStyle } from './coverOk.js'
import MDashNics from './MDashNics.vue'
import MDashNews from './MDashNews.vue'
import MDashAddress from './MDashAddress.vue'
import MRing from './MRing.vue'
import MArcGauge from './MArcGauge.vue'
import MHeatStrip from './MHeatStrip.vue'
import MChartX from './MChartX.vue'
import MSparkline from './MSparkline.vue'
import MChipSet from './MChipSet.vue'
import MDialog from './MDialog.vue'
import MSlider from './MSlider.vue'
import MSwitch from './MSwitch.vue'
import MFpsPresets from './MFpsPresets.vue'
import MVirtualDisplay from './MVirtualDisplay.vue'
import MSwatches from './MSwatches.vue'
import { useAppearance } from './useAppearance.js'
import { PRESET_SEEDS } from '../appearance/appearance.js'

/**
 * The card kinds of the extended catalogue (homeCatalogue.js) that are not a curve: ring timer, arc gauge, rows, heat strip, stacked bars,
 * chart, clients, covers, chips, an action tile and a control card. It adapts to the card size (s, m, l): more rows, more days, taller charts.
 * A control card is the tier-1 chip set of the setting: choosing saves it through the product's one saving path (the `setting` action).
 */
const props = defineProps({
  data: { type: Object, required: true },
  size: { type: String, default: 's' },
  texts: { type: Object, default: () => ({}) },
  cardId: { type: String, default: '' },
  chevron: { type: Boolean, default: false }, // the card has a detail sheet
  live: { type: Boolean, default: true }, // false in the picker and in edit mode: nothing is started on the host for a card that is only shown
})
const emit = defineEmits(['act'])
// the pairing card: the PIN is typed on the card (four digit boxes); medium and large also show the QR code, which the product creates only while the
// card is on screen (`live`): the card asks for it when it shows and gives it back when it goes away
const pin = ref('')
const pinFocus = ref(false)
const onPin = (e) => { pin.value = String(e.target.value).replace(/\D/g, '').slice(0, 4); e.target.value = pin.value }
const sendPin = () => { if (pin.value.length === 4) { emit('act', 'pair-pin', { pin: pin.value }); pin.value = '' } }
const qr = computed(() => (props.data.type === 'pair' ? props.data.qr : null))
const qrShown = computed(() => !!qr.value && props.size !== 's' && props.live)
watch(qrShown, (on, was) => { if (on) emit('act', 'pair-qr-begin'); else if (was) emit('act', 'pair-qr-stop') }, { immediate: true })
onBeforeUnmount(() => { if (qrShown.value) emit('act', 'pair-qr-stop') })
const clock = (n) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`
// a pinned setting: the switch or the slider writes its key at once (the `setting` action); a risky setting asks first. The tile shows what the person chose until the host's value comes back.
const ask = ref(null)
const draft = ref(null)
const pinOn = computed(() => (draft.value !== null && props.data.type === 'pin-switch' ? draft.value : props.data.on))
function setPin(value) { ask.value = null; if (props.data.type === 'pin-switch') draft.value = value; emit('act', 'setting', { key: props.data.key, value: props.data.type === 'pin-switch' ? (value ? props.data.onValue : props.data.offValue) : value, failed: () => { draft.value = null; if (props.data.type === 'pin-slider') sliderValue.value = props.data.value } }) }
function wantPin(value) { if (props.data.confirm) ask.value = { value }; else setPin(value) }
watch(() => props.data.on, () => { draft.value = null })
const sliderValue = ref(props.data.type === 'pin-slider' ? props.data.value : 0)
watch(() => props.data.value, (v) => { sliderValue.value = v })
const sliderText = computed(() => (props.data.type === 'pin-slider' ? (sliderValue.value === 0 && props.data.zeroText ? props.data.zeroText : `${sliderValue.value}${props.data.unit}`) : ''))
// the cards that change the window's own appearance (light or dark, wallpaper, colour, tile density) do it directly
const ap = useAppearance()
const swatches = PRESET_SEEDS.map((p) => ({ value: p.hex, label: p.id }))
const presetHex = computed(() => (ap.state.color === 'preset' ? PRESET_SEEDS.find((p) => p.id === ap.state.preset)?.hex || '' : ''))
const apValue = computed(() => (props.data.which === 'mode' ? ap.state.mode : props.data.which === 'source' ? (ap.state.background === 'wallpaper' ? ap.state.source : '') : ap.state.tiles))
const setAp = (v) => ap.set(props.data.which === 'source' ? { background: 'wallpaper', source: v } : { [props.data.which]: v })
const setPreset = (hex) => { const p = PRESET_SEEDS.find((x) => x.hex === hex); if (p) ap.set({ color: 'preset', preset: p.id }) }
const n = computed(() => ({ s: 2, m: 2, l: 6, xl: 8 })[props.size] || 2)
const initial = (name) => String(name || '?').trim().charAt(0).toUpperCase()
const days = computed(() => (props.size === 's' ? props.data.days.slice(-14) : props.data.days))
// 中 has to stand in the smallest unit too (a phone's column, 158 px high): its charts and heat cells are sized for that
const cell = computed(() => ({ s: 15, m: 18, l: 26 })[props.size] || 15)
const chartH = computed(() => ({ s: 90, m: 76, l: 250 })[props.size] || 76)
const count = computed(() => ({ s: 2, m: 4, l: 8 })[props.size] || 2)
// the covers of a library: a row at 中, two rows at 大, the whole library (sixteen) at 特大; the clients: their avatars, all of them in the table of 特大
const COVERS = { s: 2, m: 4, l: 8, xl: 16 }
const items = computed(() => (props.data.items || []).slice(0, props.data.type === 'covers' || props.data.type === 'apps' ? COVERS[props.size] || 4 : props.size === 'xl' ? 99 : count.value))
const errLines = computed(() => (props.data.lines || []).slice(0, props.size === 'xl' ? 8 : props.size === 'l' ? 3 : 0))

// a control strip whose options do not fit (a narrow window) scrolls sideways: the edge that has more behind it fades and the chosen option is brought into view
const stripChips = ref(null)
const stripEdge = ref('')
let stripObserver = null
const measureStrip = () => {
  const e = stripChips.value?.$el
  if (!e) return
  const more = e.scrollWidth - e.clientWidth > 1
  const start = more && e.scrollLeft > 1
  const end = more && e.scrollLeft + e.clientWidth < e.scrollWidth - 1
  stripEdge.value = start && end ? 'both' : start ? 'start' : end ? 'end' : ''
}
// the chosen option comes into view inside its own strip only: scrollIntoView would also move every scrolling ancestor (the dock row of the overview scrolled sideways by it)
const revealStrip = () => {
  const strip = stripChips.value?.$el
  const chip = strip?.querySelector('[aria-checked="true"], [aria-pressed="true"], .is-selected')
  if (!strip || !chip) return
  const s = strip.getBoundingClientRect(), c = chip.getBoundingClientRect()
  if (c.left < s.left) strip.scrollLeft -= s.left - c.left
  else if (c.right > s.right) strip.scrollLeft += c.right - s.right
}
watch(stripChips, (c) => {
  stripObserver?.disconnect()
  if (!c?.$el) return
  stripObserver = new ResizeObserver(() => { revealStrip(); measureStrip() }) // the strip may settle after it mounted (the row it is in changes width): the chosen option stays in view
  stripObserver.observe(c.$el)
  nextTick(() => { revealStrip(); measureStrip() })
})
watch(() => props.data?.value, () => nextTick(revealStrip))
onBeforeUnmount(() => stripObserver?.disconnect())
</script>

<template>
  <MDashNews v-if="data.type === 'news'" :data="data" :size="size" :still="!live" @act="(t, v) => emit('act', t, v)" />
  <MDashNics v-else-if="data.type === 'nics'" :data="data" :size="size" />
  <MDashAddress v-else-if="data.type === 'address'" :data="data" :size="size" @act="(t, v) => emit('act', t, v)" />
  <button v-else-if="data.type === 'action'" type="button" class="m-dcard m-dact" @click="emit('act', data.act, data.value)">
    <span class="m-dact__icon m-shape m-shape--cookie"><MIcon :name="data.icon" /></span>
    <span class="m-dact__title">{{ data.title }}</span>
    <span v-if="size !== 's'" class="m-dact__go">{{ data.label }}</span>
    <MIcon class="m-dact__arrow" name="chevron_right" />
  </button>

  <!-- 条 (strip): one row of a setting (its options, its presets, its swatches) or one line of a tip, the same row as the gamepad type -->
  <section v-else-if="size === 'strip' && ['control', 'appearance', 'fps', 'tip'].includes(data.type)" class="m-dcard m-dstripctl" :class="`m-dstripctl--${data.type}`">
    <MIcon class="m-dcard__icon" :name="data.type === 'tip' ? 'lightbulb' : data.icon" />
    <span class="m-dstripctl__title"><b>{{ data.type === 'tip' ? data.text : data.title }}</b><small v-if="data.type === 'control' && data.note">{{ data.note }}</small></span>
    <MChipSet v-if="data.type === 'control'" ref="stripChips" :data-edge="stripEdge" :model-value="data.value" :options="data.options" :label="data.title" @scroll.passive="measureStrip" @update:model-value="(v) => emit('act', 'setting', { key: data.key, value: v })" />
    <MSwatches v-else-if="data.type === 'appearance' && data.which === 'preset'" ref="stripChips" :data-edge="stripEdge" :model-value="presetHex" :colors="swatches" :label="data.title" @scroll.passive="measureStrip" @update:model-value="setPreset" />
    <MChipSet v-else-if="data.type === 'appearance'" ref="stripChips" :data-edge="stripEdge" :model-value="apValue" :options="data.options" :label="data.title" @scroll.passive="measureStrip" @update:model-value="setAp" />
    <MFpsPresets v-else-if="data.type === 'fps'" :model-value="data.value" :label="data.title" :add-label="data.addLabel" :add-text="data.addText" @update:model-value="(v) => emit('act', 'setting', { key: 'fps', value: `[${[...v].sort((a, b) => a - b).join(',')}]` })" />
  </section>
  <section v-else-if="data.type === 'strip-control'" class="m-dcard m-dstripctl">
    <MIcon class="m-dcard__icon" :name="data.icon" />
    <span class="m-dstripctl__title"><b>{{ data.title }}</b><small v-if="data.sub">{{ data.sub }}</small></span>
    <MChipSet ref="stripChips" :data-edge="stripEdge" :model-value="data.value" :options="data.options" :label="data.title" :disabled="data.busy" @scroll.passive="measureStrip" @update:model-value="(v) => emit('act', data.act, data.act === 'switch' ? { id: data.id, value: v === 'on' } : v)" />
  </section>

  <section v-else-if="data.type === 'quick'" class="m-dcard m-dquick">
    <MIcon class="m-dcard__icon" :name="data.icon" />
    <span class="m-dquick__title">{{ data.title }}</span>
    <span class="m-dquick__items"><button v-for="it in data.items" :key="it.id" type="button" class="m-dquick__btn" :aria-label="it.label" :data-tip="it.label" @click="emit('act', it.act, it.value)"><MIcon :name="it.icon" /><span>{{ it.label }}</span></button></span>
  </section>

  <section v-else-if="data.type === 'pin-switch'" class="m-dcard m-dpin m-dpin--switch" :class="`m-dpin--${size}`">
    <MIcon class="m-dcard__icon" :name="data.icon" />
    <span class="m-dpin__title"><b>{{ data.title }}</b><small v-if="size !== 's'">{{ pinOn ? data.onText : data.offText }}</small></span>
    <MSwitch :model-value="pinOn" :label="data.title" @update:model-value="wantPin" />
    <MDialog v-if="data.confirm" :model-value="!!ask" :title="data.confirm.title" icon="warning" @update:model-value="(v) => { if (!v) ask = null }">
      <p>{{ data.confirm.body }}</p>
      <template #actions><button type="button" class="m-dpill" @click="ask = null">{{ data.confirm.cancel }}</button><button type="button" class="m-dpill m-dpill--fill" @click="setPin(ask.value)">{{ data.confirm.change }}</button></template>
    </MDialog>
  </section>

  <section v-else-if="data.type === 'pin-slider'" class="m-dcard m-dpin m-dpin--slider" :class="`m-dpin--${size}`">
    <header class="m-dcard__head"><MIcon class="m-dcard__icon" :name="data.icon" /><h3 class="m-dcard__title">{{ data.title }}</h3><b class="m-dnum m-dpin__value">{{ sliderText }}</b></header>
    <MSlider v-model="sliderValue" :min="data.min" :max="data.max" :step="data.step" size="m" :label="data.title" @commit="wantPin(Math.round(sliderValue * data.scale))" />
    <MDialog v-if="data.confirm" :model-value="!!ask" :title="data.confirm.title" icon="warning" @update:model-value="(v) => { if (!v) { ask = null; sliderValue = data.value } }">
      <p>{{ data.confirm.body }}</p>
      <template #actions><button type="button" class="m-dpill" @click="ask = null; sliderValue = data.value">{{ data.confirm.cancel }}</button><button type="button" class="m-dpill m-dpill--fill" @click="setPin(ask.value)">{{ data.confirm.change }}</button></template>
    </MDialog>
  </section>

  <button v-else-if="data.type === 'pair' && size === 's'" type="button" class="m-dcard m-dpair m-dpair--s" :aria-label="texts.pairQr" @click="emit('act', 'pair-qr')">
    <MIcon name="person_add" /><b class="m-dnum">{{ data.count }}</b><span>{{ texts.pairedCount }}</span>
  </button>

  <section v-else-if="data.type === 'pair'" class="m-dcard m-dpair" :class="[`m-dpair--${size}`, { 'has-qr': !!qr }]">
    <div class="m-dpair__main">
      <header class="m-dcard__head"><MIcon class="m-dcard__icon" :name="data.icon" /><h3 class="m-dcard__title">{{ data.title }}</h3></header>
      <div class="m-dpair__entry">
        <label class="m-dpair__digits" :class="{ 'is-focus': pinFocus, 'is-off': !data.canPin }">
          <i v-for="k in 4" :key="k" :class="{ 'is-next': pinFocus && pin.length === k - 1, 'is-filled': pin.length >= k }">{{ pin.charAt(k - 1) }}</i>
          <input class="m-dpair__pin" type="text" inputmode="numeric" autocomplete="off" maxlength="4" :aria-label="texts.pairPin" :value="pin" :disabled="!data.canPin" @input="onPin" @keydown.enter="sendPin" @focus="pinFocus = true" @blur="pinFocus = false">
        </label>
        <button type="button" class="m-dpill m-dpill--fill m-dpair__go" :disabled="pin.length < 4 || !data.canPin" :aria-label="texts.pairGo" @click="sendPin"><MIcon name="check" /><span>{{ texts.pairGo }}</span></button>
        <button v-if="!qr" type="button" class="m-dpill" @click="emit('act', 'pair-qr')"><MIcon name="qr_code_2" /><span>{{ texts.pairQr }}</span></button>
      </div>
      <p class="m-dpair__facts"><MIcon :name="data.latest?.icon || 'devices'" /><b class="m-dnum">{{ data.count }}</b><span>{{ texts.pairedCount }}</span><i aria-hidden="true">·</i><span class="m-dpair__latest">{{ texts.latestClient }}: <b>{{ data.latest?.name || texts.pairNone }}</b></span></p>
    </div>
    <div v-if="qr" class="m-dpair__qr" :class="`is-${qr.state}`">
      <div class="m-dpair__code">
        <img v-if="qr.image" :src="qr.image" :alt="texts.pairQr" decoding="async">
        <span v-if="qr.state === 'loading' || qr.state === 'idle'" class="m-dpair__wait" aria-hidden="true" />
        <button v-else-if="qr.state === 'expired' || qr.state === 'error'" type="button" class="m-dpair__renew" @click="emit('act', 'pair-qr-begin')"><MIcon name="refresh" /><span>{{ qr.state === 'error' ? texts.pairFailed : texts.pairRefresh }}</span></button>
        <span v-else-if="qr.state === 'paired'" class="m-dpair__done"><MIcon name="check_circle" /><span>{{ texts.pairDone }}</span></span>
      </div>
      <small v-if="qr.state === 'ready'" class="m-dnum">{{ texts.pairScan }} · {{ clock(qr.seconds) }}</small>
    </div>
  </section>

  <MDashCard v-else :title="data.title" :icon="data.icon" :chevron="chevron" :chevron-label="texts.more" class="m-dwidget" @open="emit('act', 'detail')" :class="`m-dwidget--${data.type} m-dwidget--${size}`">
    <!-- an elapsed time: the time is the hero, no ring (it has no full) -->
    <div v-if="data.type === 'ring'" class="m-dwidget__centre m-dwidget__time"><b class="m-dnum m-dwidget__clock">{{ data.centre }}</b><span v-if="data.caption && size !== 's'" class="m-dwidget__cap">{{ data.caption }}</span></div>

    <!-- arc gauge with the latency behind it -->
    <div v-else-if="data.type === 'gauge'" class="m-dwidget__centre m-dwidget__gauge"><MArcGauge :value="data.value" :zones="data.zones" :size="size === 's' ? 120 : 140" :label="data.title"><b class="m-dnum m-dwidget__clock">{{ data.centre }}</b><small>{{ data.unit }}</small></MArcGauge><MSparkline v-if="data.spark && size !== 's'" :points="data.spark" :width="140" :height="44" /></div>

    <!-- rows: icon, name, value; a big number when the card has one -->
    <template v-else-if="data.type === 'rows'">
      <div v-if="data.big" class="m-dwidget__big"><b class="m-dnum">{{ data.big }}</b></div>
      <ul v-if="data.rows.length" class="m-dwidget__rows"><li v-for="(r, i) in data.rows.slice(0, n)" :key="i" :class="r.tone && `is-${r.tone}`"><MIcon :name="r.icon" /><span>{{ r.title }}</span><b class="m-dnum">{{ r.value }}</b></li></ul>
      <p v-else class="m-dwidget__empty">{{ data.empty }}</p>
    </template>

    <!-- lines: a title and a small second line (log, announcements) -->
    <template v-else-if="data.type === 'lines'">
      <ul v-if="data.rows.length" class="m-dwidget__lines"><li v-for="(r, i) in data.rows.slice(0, n)" :key="i" :class="r.tone && `is-${r.tone}`"><MIcon :name="r.icon" /><span><b>{{ r.title }}</b><small v-if="r.sub">{{ r.sub }}</small></span></li></ul>
      <p v-else class="m-dwidget__empty">{{ data.empty }}</p>
    </template>

    <!-- what is running now -->
    <div v-else-if="data.type === 'now'" class="m-dwidget__now">
      <span class="m-dwidget__cover" :style="coverStyle(data.cover)"><MIcon v-if="!coverOk(data.cover)" name="sports_esports" /></span>
      <div class="m-dwidget__nowtext"><b>{{ data.name }}</b><ul v-if="size !== 's'"><li v-for="(r, i) in data.rows" :key="i"><MIcon :name="r.icon" />{{ r.value }}</li></ul></div>
    </div>

    <!-- minutes per day -->
    <div v-else-if="data.type === 'heat'" class="m-dwidget__heat">
      <div v-if="data.total" class="m-dwidget__big"><b class="m-dnum">{{ data.total }}</b><small>{{ data.caption }}</small></div>
      <MHeatStrip :days="days" :cell="cell" :label="data.title" :empty="data.empty" />
      <p v-if="!data.total" class="m-dwidget__empty">{{ data.empty }}</p>
    </div>

    <!-- stacked bars per hour -->
    <div v-else-if="data.type === 'bars'" class="m-dwidget__bars" :class="`is-${size}`">
      <div class="m-dwidget__chart"><MChartX type="stackbar" :series="data.series" :labels="data.labels" :floor="4" :height="{ m: 76, l: 128, xl: 236 }[size] || 76" :empty="data.empty" legend="compact" :label="data.title" /></div>
      <ul v-if="errLines.length" class="m-dwidget__lines"><li v-for="(r, i) in errLines" :key="i" :class="r.tone && `is-${r.tone}`"><MIcon :name="r.icon" /><span><b>{{ r.title }}</b><small v-if="r.sub">{{ r.sub }}</small></span></li></ul>
    </div>

    <!-- a chart of several series -->
    <div v-else-if="data.type === 'chart'" class="m-dwidget__chart"><MChartX :type="data.chart" :series="data.series" :height="chartH" :unit="data.unit" :fixed-max="data.max" :label="data.title" /></div>

    <!-- clients -->
    <template v-else-if="data.type === 'clients'">
      <div class="m-dwidget__big"><b class="m-dnum">{{ data.count }}</b></div>
      <table v-if="size === 'xl' && items.length" class="m-dwidget__clients" data-redact="client"><thead><tr><th /><th>{{ data.labels?.last }}</th><th>{{ data.labels?.time }}</th></tr></thead><tbody><tr v-for="(c, i) in items" :key="i" :class="c.tone && `is-${c.tone}`"><td><MIcon :name="c.icon" /><span><b>{{ c.name }}</b><small>{{ c.state }}</small></span></td><td class="m-dnum">{{ c.last }}</td><td class="m-dnum">{{ c.time }}</td></tr></tbody></table>
      <div v-else-if="items.length" class="m-dwidget__avatars"><span v-for="(c, i) in items" :key="i" class="m-dwidget__avatar" :class="c.tone && `is-${c.tone}`" :title="c.name">{{ initial(c.name) }}</span></div>
      <p v-else class="m-dwidget__empty">{{ data.empty }}</p>
      <ul v-if="size === 'l' && data.items.length" class="m-dwidget__rows"><li v-for="(c, i) in data.items" :key="i" :class="c.tone && `is-${c.tone}`"><MIcon :name="c.icon" /><span>{{ c.name }}</span></li></ul>
    </template>

    <!-- covers and recent games -->
    <template v-else-if="data.type === 'covers' || data.type === 'apps'">
      <div v-if="items.length" class="m-dwidget__covers"><span v-for="(a, i) in items" :key="i" class="m-dwidget__tile" :title="a.name"><i :style="coverStyle(a.cover)"><MIcon v-if="!coverOk(a.cover)" name="sports_esports" /></i><small v-if="size !== 's' || data.type === 'apps'">{{ a.name }}</small><em v-if="a.sub && (size === 'l' || size === 'xl')">{{ a.sub }}</em></span></div>
      <p v-else class="m-dwidget__empty">{{ data.empty }}</p>
    </template>

    <!-- chips -->
    <template v-else-if="data.type === 'chips'">
      <div v-if="data.big" class="m-dwidget__big"><b class="m-dnum" :class="data.tone && `is-${data.tone}`">{{ data.big }}</b></div>
      <div class="m-dinfo__chips"><span v-for="(c, i) in data.chips" :key="i" class="m-dchip" :class="c.tone && `m-dchip--${c.tone}`"><MIcon v-if="c.icon" :name="c.icon" />{{ c.label }}</span></div>
    </template>

    <!-- the shared virtual display control, card variant -->
    <div v-else-if="data.type === 'vdd'" class="m-dwidget__vdd"><MVirtualDisplay :store="data.store" variant="card" :locale="data.locale" @more="emit('act', 'open', 'vdd')" /></div>

    <!-- control: the tier-1 chip set of the setting; choosing saves it -->
    <!-- frame rate presets: the shared control, choosing saves the list the way the settings page does -->
    <div v-else-if="data.type === 'fps'" class="m-dwidget__control"><MFpsPresets :model-value="data.value" :label="data.title" :add-label="data.addLabel" :add-text="data.addText" @update:model-value="(v) => emit('act', 'setting', { key: 'fps', value: `[${[...v].sort((a, b) => a - b).join(',')}]` })" /></div>
    <div v-else-if="data.type === 'appearance' && data.which === 'preset'" class="m-dwidget__control"><MSwatches :model-value="presetHex" :colors="swatches" :label="data.title" @update:model-value="setPreset" /></div>
    <div v-else-if="data.type === 'appearance'" class="m-dwidget__control"><MChipSet :model-value="apValue" :options="data.options" :label="data.title" @update:model-value="setAp" /></div>
    <div v-else-if="data.type === 'vivi'" class="m-dwidget__vivi"><img :src="data.image" alt="" width="56" height="56" decoding="async"><p>{{ data.text }}</p></div>
    <div v-else-if="data.type === 'tip'" class="m-dwidget__tip"><MIcon name="lightbulb" /><p>{{ data.text }}</p></div>
    <div v-else-if="data.type === 'control'" class="m-dwidget__control"><MChipSet :model-value="data.value" :options="data.options" :label="data.title" @update:model-value="(v) => emit('act', 'setting', { key: data.key, value: v })" /><small v-if="data.note">{{ data.note }}</small></div>
  </MDashCard>
</template>
