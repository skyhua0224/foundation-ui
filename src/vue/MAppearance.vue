<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MSeg from './MSeg.vue'
import MDockClock from './MDockClock.vue'
import MIcon from './MIcon.vue'
import MButton from './MButton.vue'
import MSlider from './MSlider.vue'
import MSliderItem from './MSliderItem.vue'
import MSwitchItem from './MSwitchItem.vue'
import { CLOCK_FACES, COLOR_STYLES, LOOK_LIMITS, PRESET_SEEDS, clockSizesOffered, contrastRatio, effectiveClockSize, hexRgb, seedFor } from '../appearance/appearance.js'
import { DEFAULT_VARIANTS, schemeColors } from '../tokens/theme.js'
import { WALLPAPERS, autoPictures, wallpaperIds } from '../appearance/wallpaper.js'
import { useAppearance } from './useAppearance.js'
import { afterFirstPaint } from './afterFirstPaint.js'
import { usePreviewBake } from './previewBake.js'
import { systemReducedMotion, watchSystemMotion } from '../appearance/motion.js'
import { appearanceTexts, motionSystemLabel } from './appearanceTexts.js'

/**
 * The appearance controls: background (solid or wallpaper and where it comes from), where the colours come from, light or dark, dim and blur,
 * icon treatment. One component for the 个性化 page, the guide's appearance step and the quick sheet; everything applies live.
 * `compact` drops the preview (the guide shows the real window instead).
 * `part` (the Panel's 个性化 pages): '' = everything (the Web UI, the guide's wider forms); 'theme' = preview, background, colour style and source, light or dark, icon style, interface; 'frost' = the frosted layer of the
 * overview and the other pages, the fade, the animations; 'home' = the overview tiles (layout, smart tiles, clock, density, host card). The sections keep their markup and order whichever part shows them.
 * `essential` (the guide): the wallpaper, the colour and light or dark first, then the colour style and the blur and tint sliders, all in view; the rest stays on the 个性化 page. The sliders are the MSliderItem of the Panel's HDR page (size m, title, value, an icon at each end).
 */
const props = defineProps({ locale: { type: String, default: 'en' }, compact: { type: Boolean, default: false }, showIcons: { type: Boolean, default: true }, essential: { type: Boolean, default: false }, part: { type: String, default: '' } })
const ap = useAppearance()
const T = computed(() => appearanceTexts(props.locale))
const s = ap.state
const url = ref(s.url)
const picker = ref(null)
const wall = computed(() => s.background === 'wallpaper')
// which sections this instance draws: all of them without a part, else the ones of the part (the guide's essential form is its own selection below)
const on = (name) => !props.part || props.part === name
const iconMode = ref(document.documentElement.dataset.icons || 'b')
const setIcons = (v) => { iconMode.value = v; document.documentElement.dataset.icons = v; try { localStorage.setItem('foundation-ui.icons', v) } catch { /* storage unavailable */ } }
const opts = (keys) => keys.map(([value, label, icon]) => ({ value, label: T.value[label], icon }))
const bg = computed(() => opts([['solid', 'solid', 'format_color_fill'], ['wallpaper', 'wallpaper', 'wallpaper']]))
// the sources: Auto and the pictures a Product registered (none by default), then the gradient, the person's file and a web address
const src = computed(() => [
  ...(autoPictures() ? opts([['auto', 'srcAuto', 'wallpaper']]) : []),
  ...wallpaperIds().map((id) => ({ value: id, label: (WALLPAPERS[id].labelKey && T.value[WALLPAPERS[id].labelKey]) || WALLPAPERS[id].label || id, icon: 'image' })),
  ...opts([['gradient', 'srcGradient', 'palette'], ['file', 'srcFile', 'upload_file'], ['url', 'srcUrl', 'link']]),
])
const THUMBS = Object.fromEntries(wallpaperIds().map((id) => [id, WALLPAPERS[id].url]))
const col = computed(() => opts([['wallpaper', 'fromWallpaper', 'palette'], ['preset', 'preset', 'colors'], ['custom', 'custom', 'colorize']]))
const FACES = CLOCK_FACES
const faceName = (f) => T.value[`face${f[0].toUpperCase()}${f.slice(1)}`]
// the sizes this window offers (特大 needs room beside the clock: appearance.js clockSizesOffered)
const winWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
const onWin = () => { winWidth.value = window.innerWidth }
onMounted(() => window.addEventListener('resize', onWin)); onBeforeUnmount(() => window.removeEventListener('resize', onWin))
const sizeOpts = computed(() => [['s', 'sizeS'], ['m', 'sizeM'], ['l', 'sizeL'], ['xl', 'sizeXL']].filter(([value]) => clockSizesOffered(winWidth.value).includes(value)).map(([value, label]) => ({ value, label: T.value[label] })))
const alignOpts = computed(() => opts([['left', 'alignLeft', 'format_align_left'], ['center', 'alignCenter', 'format_align_center'], ['right', 'alignRight', 'format_align_right']]))
const listOpts = computed(() => opts([['merged', 'listMerged'], ['one', 'listOne']]))
// 跟随系统 says what it means now (the system's own setting), and follows it when that changes
const sysReduced = ref(systemReducedMotion())
let stopSysMotion = () => {}
onMounted(() => { stopSysMotion = watchSystemMotion((v) => { sysReduced.value = v }) }); onBeforeUnmount(() => stopSysMotion())
// a row too narrow for the long label (a phone, a side sheet) keeps 跟随系统 on the choice and says the state in the line under the row
const motionRow = ref(null)
const motionWide = ref(true)
let motionObserver = null
onMounted(() => { const el = motionRow.value?.$el; if (el && typeof ResizeObserver === 'function') { motionObserver = new ResizeObserver(([e]) => { motionWide.value = e.contentRect.width >= 480 }); motionObserver.observe(el) } }); onBeforeUnmount(() => motionObserver?.disconnect())
const motionOpts = computed(() => opts([['system', 'motionSystem', 'contrast'], ['full', 'motionFull', 'slow_motion_video'], ['reduced', 'motionReduced', 'speed']]).map((o) => (o.value === 'system' && motionWide.value ? { ...o, label: motionSystemLabel(T.value, sysReduced.value) } : o)))
const overviewOpts = computed(() => opts([['grid', 'overviewGrid', 'apps'], ['dock', 'overviewDock', 'keyboard_arrow_down']]))
const darkStyle = computed(() => opts([['tinted', 'darkTinted', 'invert_colors'], ['black', 'darkBlack', 'brightness_1']]))
const mode = computed(() => opts([['system', 'system', 'contrast'], ['light', 'light', 'light_mode'], ['dark', 'dark', 'dark_mode']]))
const heroStyles = computed(() => [{ value: 'soft', label: T.value.heroSoft }, { value: 'solid', label: T.value.heroSolid }])
const tileDensities = computed(() => [{ value: 'smaller', label: T.value.densitySmaller }, { value: 'standard', label: T.value.densityStandard }, { value: 'larger', label: T.value.densityLarger }])
const icons = computed(() => [{ value: 'a', label: T.value.iconsA }, { value: 'b', label: T.value.iconsB }, { value: 'c', label: T.value.iconsC }])
// the frosted layer: one group for the overview and one for the other pages (the overview uses the others' values when the switch is on); the preview shows the one being edited
const editing = ref('other')
const shown = computed(() => (editing.value === 'home' && !s.homeSame ? s.home : s.other))
const groups = computed(() => [{ scope: 'home', title: T.value.frostHome, v: s.homeSame ? s.other : s.home, off: s.homeSame }, { scope: 'other', title: T.value.frostOther, v: s.other, off: false }])
const previewStyle = computed(() => ({ '--m-ap-blur': `${Math.round(shown.value.blur * 0.45)}px`, '--m-ap-tint': shown.value.dim, '--m-ap-end': s.fade ? Math.max(shown.value.dim, 0.94) : shown.value.dim, '--m-ap-wall': wall.value && document.documentElement.style.getPropertyValue('--m-wallpaper') ? document.documentElement.style.getPropertyValue('--m-wallpaper') : 'none', }))
// the preview is the cost of the page's first frame (measured 2026-11-05 on the panel: 58 ms with it, 41-42 ms without it and no long frame):
// its box is a strip of a fixed min-height over the full width, so the first frame paints the empty box at the final size (the wallpaper blur and the scrim come with the content) and the preview's
// own markup is built after that paint, in place, where nothing moves. From then on every setting reaches it at once, exactly as before; motion settings are untouched by this.
// (the paint boundary is the one of afterFirstPaint.js, m3e-whatwg-html-eventloop-20261106)
const previewIn = ref(false)
let stopPreview = () => {}
// The wallpaper of the preview is blurred once into a bitmap (previewBake.js: the two layers of the CSS blur and scrim were 84-100 ms of raster in the frame that painted them, the bitmap and the scrim as
// backgrounds of the strip 42 ms). The strip stays in its holding state, the empty box, until the bitmap is there; without a wallpaper there is nothing to bake, and where the bake fails the old layers come back.
const previewEl = ref(null)
const { baked, state: bakeState, bake } = usePreviewBake(previewEl, previewStyle)
let resizeTimer = 0
let resizeWatch = null
onMounted(() => {
  stopPreview = afterFirstPaint(async () => {
    previewIn.value = true
    await nextTick()
    await bake()
  })
  if (typeof ResizeObserver === 'function') {
    let first = true
    resizeWatch = new ResizeObserver(() => { if (first) { first = false; return } clearTimeout(resizeTimer); resizeTimer = setTimeout(bake, 150) })
    watch(previewEl, (el, old) => { if (old) resizeWatch.unobserve(old); if (el) resizeWatch.observe(el) }, { immediate: true })
  }
})
watch(() => [previewStyle.value['--m-ap-wall'], previewStyle.value['--m-ap-blur']], () => { if (previewIn.value) bake() })
onBeforeUnmount(() => { stopPreview(); clearTimeout(resizeTimer); resizeWatch?.disconnect() })
const previewHolding = computed(() => !previewIn.value || bakeState.value === 'pending')
const previewFlat = computed(() => bakeState.value === 'baked' || bakeState.value === 'none')
const previewVars = computed(() => (baked.value ? { ...previewStyle.value, '--m-ap-wall-baked': baked.value } : previewStyle.value))

// ---- 配色风格: three cards for the same seed, each drawn live from the scheme it would give (primary, secondary and tertiary circles, a mini surface with a hero card and a container)
const dark = computed(() => s.mode === 'dark' || (s.mode === 'system' && typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches))
const seed = computed(() => seedFor(s, ap.wallpaperSeeds.value)[dark.value ? 'dark' : 'light'])
const styleCards = computed(() => COLOR_STYLES.map((id) => {
  const c = schemeColors(seed.value, { dark: dark.value, black: dark.value && s.dark === 'black', variant: dark.value ? DEFAULT_VARIANTS.dark : DEFAULT_VARIANTS.light, style: id })
  return { id, name: T.value[`style${id[0].toUpperCase()}${id.slice(1)}`], note: T.value[`style${id[0].toUpperCase()}${id.slice(1)}Note`], card: dark.value ? c.surfaceContainerHigh : c.surfaceBright, vars: { '--st-surface': c.surface, '--st-hero': c.heroSurface, '--st-container': c.surfaceContainerHigh, '--st-p': c.primary, '--st-s': c.secondary, '--st-t': c.tertiary, '--st-on': c.onHeroSurface } }
}))
// a swatch that is hardly told from the card it lies on (a very dark seed in the dark scheme, a very light one in the light scheme) gets a thin ring
const cardHex = computed(() => styleCards.value.find((c) => c.id === s.colorStyle)?.card || '')
const ringed = (hex) => !!cardHex.value && /^#[0-9a-f]{6}$/i.test(hex) && contrastRatio(hexRgb(hex), hexRgb(cardHex.value)) < 1.6
const styleNote = computed(() => styleCards.value.find((c) => c.id === s.colorStyle)?.note || '')
// the seeds of the wallpaper (up to four, distinct hues) and the basic colours
const wallSeeds = computed(() => (wall.value ? ap.wallpaperSeeds.value : []))
async function onFile(e) { const f = e.target.files?.[0]; if (f) await ap.chooseFile(f); e.target.value = '' }
// in the guide the order is the wallpaper, the colour, light or dark, the colour style, the sliders, then the pointer to 个性化; the rest of the page's order is the document order
const ord = (n) => (props.essential ? { order: n } : undefined)
const applyUrl = () => ap.set({ background: 'wallpaper', source: 'url', url: url.value.trim() })
</script>

<template>
  <div class="m-ap" :class="{ 'm-ap--compact': compact && !essential, 'm-ap--essential': essential }">
    <div v-if="!compact && (on('theme') || on('frost'))" ref="previewEl" class="m-ap__preview" :class="{ 'm-ap__preview--holding': previewHolding, 'm-ap__preview--flat': previewFlat }" :style="previewVars" aria-hidden="true">
      <template v-if="previewIn">
        <span class="m-ap__capt" />
        <span class="m-ap__rail"><i class="is-on" /><i /><i /><i /></span>
        <span class="m-ap__panel">
          <span class="m-ap__main">
            <span class="m-ap__card m-ap__card--hero"><b class="m-ap__line" /><b class="m-ap__line m-ap__line--short" /><span class="m-ap__pbtn" /><span class="m-ap__pchip" /></span>
            <span class="m-ap__card"><b class="m-ap__line" /><span class="m-ap__pswitch" /></span>
            <span class="m-ap__card"><b class="m-ap__line m-ap__line--short" /><span class="m-ap__pbar"><i /></span></span>
          </span>
        </span>
        <span v-if="wall" class="m-ap__tag">{{ editing === 'home' && !s.homeSame ? T.frostHome : T.frostOther }} · {{ shown.blur }}px · {{ Math.round(shown.dim * 100) }}%</span>
      </template>
    </div>

    <section v-if="on('theme')" class="m-ap__row" :style="ord(0)">
      <h4>{{ T.background }}</h4>
      <MSeg block :model-value="s.background" :label="T.background" :options="bg" @update:model-value="(v) => ap.set({ background: v })" />
      <template v-if="wall">
        <div class="m-ap__sources" role="radiogroup" :aria-label="T.source">
          <button v-for="o in src" :key="o.value" type="button" role="radio" class="m-ap__source" :aria-checked="s.source === o.value" :class="{ 'is-on': s.source === o.value }" @click="ap.set({ source: o.value })">
            <span class="m-ap__thumb" :class="`m-ap__thumb--${o.value}`" :style="THUMBS[o.value] ? { backgroundImage: `url(${THUMBS[o.value]})` } : undefined"><MIcon v-if="!THUMBS[o.value]" :name="o.icon" /></span>
            <span class="m-ap__sourcelabel">{{ o.label }}</span>
          </button>
        </div>
        <div v-if="s.source === 'file'" class="m-ap__field"><MButton variant="tonal" icon="upload_file" @click="picker.click()">{{ T.pick }}</MButton><input ref="picker" type="file" accept="image/*" hidden @change="onFile"><span class="m-ap__note">{{ ap.hasFile.value ? T.fileKept : T.fileNone }}</span></div>
        <div v-if="s.source === 'url'" class="m-ap__field"><input v-model="url" class="m-input" type="url" inputmode="url" :placeholder="T.urlHint" :aria-label="T.srcUrl" @keydown.enter="applyUrl"><MButton variant="tonal" @click="applyUrl">{{ T.apply }}</MButton></div>
        <p v-if="ap.status.value === 'failed'" class="m-ap__note" role="status">{{ T.failed }}</p>
      </template>
    </section>

    <template v-if="wall && on('frost')">
      <section v-for="g in groups" :key="g.scope" class="m-ap__row m-ap__frost" :style="ord(4)" @pointerdown.capture="editing = g.scope" @focusin="editing = g.scope">
        <h4>{{ g.title }}</h4>
        <MSwitchItem v-if="g.scope === 'home'" class="m-ap__same" :model-value="s.homeSame" :title="T.frostSame" @update:model-value="(v) => { editing = v ? 'other' : 'home'; ap.set({ homeSame: v }) }" />
        <MSliderItem :model-value="g.v.blur" :title="T.blur" :min="0" :max="48" :step="1" :decimals="0" unit="px" size="m" icon-start="blur_off" icon-end="blur_on" :disabled="g.off" @update:model-value="(v) => ap.setFrost(g.scope, { blur: v })" />
        <MSliderItem :model-value="Math.round(g.v.dim * 100)" :title="T.dim" :min="0" :max="80" :step="1" :decimals="0" unit="%" size="m" icon-start="brightness_7" icon-end="brightness_4" :disabled="g.off" @update:model-value="(v) => ap.setFrost(g.scope, { dim: v / 100 })" />
      </section>
      <section class="m-ap__row m-ap__frost" :style="ord(4)">
        <MSwitchItem :model-value="s.fade" :title="T.fade" @update:model-value="(v) => ap.set({ fade: v })" />
        <div class="m-ap__field"><MButton variant="text" icon="restart_alt" @click="ap.resetFrost()">{{ T.reset }}</MButton></div>
      </section>
    </template>

    <section v-else-if="part === 'frost'" class="m-ap__row m-ap__frost">
      <h4>{{ T.frost }}</h4>
      <p class="m-ap__note">{{ T.frostNeedsWallpaper }}</p>
      <div class="m-ap__field"><MButton variant="tonal" icon="wallpaper" @click="ap.set({ background: 'wallpaper' })">{{ T.useWallpaper }}</MButton></div>
    </section>

    <section v-if="on('theme')" class="m-ap__row" :style="ord(3)">
      <h4>{{ T.colourStyle }}</h4>
      <div class="m-ap__styles" role="radiogroup" :aria-label="T.colourStyle">
        <button v-for="c in styleCards" :key="c.id" type="button" role="radio" class="m-ap__style" :class="{ 'is-on': s.colorStyle === c.id }" :aria-checked="s.colorStyle === c.id" :data-style="c.id" @click="ap.set({ colorStyle: c.id })">
          <span class="m-ap__stylecard" :style="c.vars" aria-hidden="true">
            <span class="m-ap__styleview"><span class="m-ap__stylehero"><i /><i /></span><span class="m-ap__stylebar" /></span>
            <span class="m-ap__stylecircles"><i class="is-p" /><i class="is-s" /><i class="is-t" /></span>
          </span>
          <span class="m-ap__stylename">{{ c.name }}</span>
        </button>
      </div>
      <p class="m-ap__note">{{ styleNote }}</p>
    </section>

    <section v-if="on('theme')" class="m-ap__row" :style="ord(1)">
      <h4>{{ T.colour }}</h4>
      <div class="m-ap__colours" role="radiogroup" :aria-label="T.colour">
        <template v-if="wallSeeds.length">
          <button v-for="(hex, i) in wallSeeds" :key="`w${i}`" type="button" role="radio" class="m-ap__swatch m-ap__swatch--seed" :class="{ 'has-ring': ringed(hex) }" :style="{ '--sw': hex }" :aria-checked="s.color === 'wallpaper' && Math.min(s.seedIndex, wallSeeds.length - 1) === i" :aria-label="`${T.fromWallpaper} ${i + 1}`" :title="`${T.fromWallpaper} ${i + 1}`" @click="ap.set({ color: 'wallpaper', seedIndex: i })"><MIcon name="check" /></button>
        </template>
        <button v-else-if="wall" type="button" role="radio" class="m-ap__swatch m-ap__swatch--wall" :aria-checked="s.color === 'wallpaper'" :aria-label="T.fromWallpaper" :title="T.fromWallpaper" @click="ap.set({ color: 'wallpaper' })"><MIcon :name="s.color === 'wallpaper' ? 'check' : 'palette'" /></button>
      </div>
      <h4 class="m-ap__sub">{{ T.basicColours }}</h4>
      <div class="m-ap__colours" role="radiogroup" :aria-label="T.basicColours">
        <button v-for="p in PRESET_SEEDS" :key="p.id" type="button" role="radio" class="m-ap__swatch" :class="{ 'has-ring': ringed(p.hex) }" :style="{ '--sw': p.hex }" :aria-checked="s.color === 'preset' && s.preset === p.id" :aria-label="p.id" :title="p.id" @click="ap.set({ color: 'preset', preset: p.id })"><MIcon name="check" /></button>
        <label class="m-ap__swatch m-ap__swatch--custom has-ring" :class="{ 'is-on': s.color === 'custom' }" :style="{ '--sw': s.color === 'custom' ? s.custom : 'var(--md-sys-color-surface-container-highest)' }" :title="T.custom" :data-tip="T.custom"><MIcon :name="s.color === 'custom' ? 'check' : 'colorize'" /><input type="color" :value="s.custom" :aria-label="T.custom" @input="ap.set({ color: 'custom', custom: $event.target.value })"></label>
      </div>
      <p class="m-ap__note">{{ s.color === 'wallpaper' ? T.fromWallpaper : s.color === 'preset' ? T.preset : T.custom }}</p>
    </section>

    <section v-if="on('theme') || on('frost')" class="m-ap__row" :style="ord(2)">
      <template v-if="on('theme')">
      <h4>{{ T.mode }}</h4>
      <MSeg block :model-value="s.mode" :label="T.mode" :options="mode" @update:model-value="(v) => ap.set({ mode: v })" />
      </template>
      <template v-if="!essential">
      <template v-if="on('theme')">
      <h4>{{ T.darkStyle }}</h4>
      <MSeg block :model-value="s.dark" :label="T.darkStyle" :options="darkStyle" @update:model-value="(v) => ap.set({ dark: v })" />
      </template>
      <template v-if="on('frost')">
      <h4>{{ T.motion }}</h4><MSeg ref="motionRow" block :model-value="s.motion" :label="T.motion" :options="motionOpts" @update:model-value="(v) => ap.set({ motion: v })" />
      <p v-if="!motionWide && s.motion === 'system'" class="m-ap__note">{{ motionSystemLabel(T, sysReduced) }}</p>
      <p v-if="s.motion === 'reduced'" class="m-ap__note">{{ T.motionNote }}</p>
      </template>
      <template v-if="showIcons && on('theme')"><h4>{{ T.iconStyle }}</h4><MSeg block :model-value="iconMode" :label="T.iconStyle" :options="icons" @update:model-value="setIcons" /></template>
      </template>
    </section>

    <p v-if="essential" class="m-ap__note m-ap__elsewhere" :style="ord(5)">{{ T.elsewhere }}</p>

    <section v-if="!essential && on('theme')" class="m-ap__row m-ap__frost">
      <h4>{{ T.look }}</h4>
      <MSliderItem :model-value="s.cardCorner" :title="T.cardCorner" :min="LOOK_LIMITS.cardCorner[0]" :max="LOOK_LIMITS.cardCorner[1]" :step="1" :decimals="0" unit="px" size="m" icon-start="crop_square" icon-end="rounded_corner" @update:model-value="(v) => ap.set({ cardCorner: v })" />
      <MSliderItem :model-value="s.textSize" :title="T.textSize" :min="LOOK_LIMITS.textSize[0]" :max="LOOK_LIMITS.textSize[1]" :step="1" :decimals="0" unit="px" size="m" icon-start="text_decrease" icon-end="text_increase" @update:model-value="(v) => ap.set({ textSize: v })" />
      <div class="m-ap__slider"><label>{{ T.listStyle }}</label><MSeg :model-value="s.listStyle" :label="T.listStyle" :options="listOpts" @update:model-value="(v) => ap.set({ listStyle: v })" /></div>
    </section>

    <section v-if="!essential && on('home')" class="m-ap__row m-ap__tiles">
      <h4>{{ T.overview }}</h4>
      <MSeg block :model-value="s.overview" :label="T.overview" :options="overviewOpts" @update:model-value="(v) => ap.set({ overview: v })" />
      <MSwitchItem :model-value="s.smartTiles" :title="T.smartTiles" :text="T.smartTilesNote" icon="wand_stars" @update:model-value="(v) => ap.set({ smartTiles: v })" />
      <template v-if="s.overview === 'dock'">
        <h4>{{ T.clockFace }}</h4>
        <div class="m-ap__faces" role="radiogroup" :aria-label="T.clockFace">
          <button v-for="f in FACES" :key="f" type="button" role="radio" class="m-ap__face" :class="{ 'is-on': s.clockFace === f }" :aria-checked="s.clockFace === f" @click="ap.set({ clockFace: f })"><span class="m-ap__facepreview"><MDockClock :face="f" :locale="locale" :seconds="s.clockSeconds" preview /></span><span class="m-ap__facename">{{ faceName(f) }}</span></button>
        </div>
        <h4>{{ T.clockSize }}</h4>
        <MSeg block :model-value="effectiveClockSize(s.clockSize, winWidth)" :label="T.clockSize" :options="sizeOpts" @update:model-value="(v) => ap.set({ clockSize: v })" />
        <h4>{{ T.clockAlign }}</h4>
        <MSeg block :model-value="s.clockAlign" :label="T.clockAlign" :options="alignOpts" @update:model-value="(v) => ap.set({ clockAlign: v })" />
        <MSwitchItem class="m-ap__seconds" :model-value="s.clockSeconds" :title="T.clockSeconds" @update:model-value="(v) => ap.set({ clockSeconds: v })" />
      </template>
      <h4>{{ T.density }}</h4>
      <MSeg block :model-value="s.tileDensity" :label="T.density" :options="tileDensities" @update:model-value="(v) => ap.set({ tileDensity: v })" />
      <h4>{{ T.heroStyle }}</h4>
      <MSeg block :model-value="s.heroStyle" :label="T.heroStyle" :options="heroStyles" @update:model-value="(v) => ap.set({ heroStyle: v })" />
      <MSwitchItem :model-value="s.heroArt" :title="T.heroArt" @update:model-value="(v) => ap.set({ heroArt: v })" />
    </section>
  </div>
</template>
