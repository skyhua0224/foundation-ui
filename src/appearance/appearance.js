// Appearance: solid background or wallpaper, where the colours come from, light/dark, scrim. Pure logic here (tested); the DOM part is `applyAppearance`.
import { schemeColors as realSchemeColors, BRAND_SEEDS, COLOR_STYLES, DEFAULT_STYLE } from '../tokens/theme.js'
import { WALLPAPERS, autoPictures, wallpaperSources } from './wallpaper.js'
import { LIST_STYLES } from './listStyle.js'
import { luminance, imageStats } from './pictureStats.js'

export { luminance, imageStats }

// The default is Auto: one of the registered pictures, chosen by the shape of the window (see wallpaper.js); with none registered the window gets the
// gradient. The other sources are the gradient of the theme's own tones (the seed colour; nothing to load), the person's file and a web address.
export const DEFAULT_WALLPAPER = 'auto'
// The backdrop of a window with no wallpaper, and the plain gradient: three large soft blobs of the container tones over the surface, calm and low in contrast (the frost lies over it as over a
// picture). --m-tonal-k (shell-blend.css) is how much of each container tone shows: 70 % in light, 45 % in 深色, 22 % in 纯黑 where it stays very dark. Images only: it is used as a background-image.
export const DEFAULT_GRADIENT = 'radial-gradient(62% 56% at 14% 10%, color-mix(in srgb, var(--md-sys-color-primary-container) var(--m-tonal-k, 70%), transparent) 0%, transparent 72%), radial-gradient(56% 62% at 90% 16%, color-mix(in srgb, var(--md-sys-color-tertiary-container) calc(var(--m-tonal-k, 70%) * .85), transparent) 0%, transparent 70%), radial-gradient(72% 62% at 76% 104%, color-mix(in srgb, var(--md-sys-color-secondary-container) var(--m-tonal-k, 70%), transparent) 0%, transparent 74%), linear-gradient(var(--md-sys-color-surface), var(--md-sys-color-surface))'
// Nothing in a gradient is busy; the tones are mid so the scrim is computed for the worst case of both schemes.
export const DEFAULT_WALLPAPER_STATS = Object.freeze({ mean: 0.5, lo: 0.1, hi: 0.9, busy: 0 })
// Any other remote picture is shown but treated as unreadable: conservative statistics (strong scrim) and the brand seed.
export const UNREADABLE_STATS = Object.freeze({ mean: 0.5, lo: 0, hi: 1, busy: 0.2 })
export const STORAGE_KEY = 'foundation-ui.appearance'
export const IMAGE_KEY = 'foundation-ui.appearance.image'

/** Seeds of the preset row (inputs to the Material You scheme, not UI colours themselves). */
export const PRESET_SEEDS = Object.freeze([
  { id: 'red', hex: '#e0443e' }, { id: 'orange', hex: '#f2833a' }, { id: 'amber', hex: '#e8a33d' }, { id: 'yellow', hex: '#e8b900' }, { id: 'green', hex: '#3fae7a' }, { id: 'teal', hex: '#2ab3ad' },
  { id: 'blue', hex: '#4a9eff' }, { id: 'violet', hex: '#8b6ff0' }, { id: 'pink', hex: '#ec4f93' }, { id: 'rose', hex: '#d4a5a5' },
])
/** How many seeds of the wallpaper are offered (material-color-utilities' score picks them with distinct hues), and the styles the scheme can be grown in (theme.js). */
export const WALLPAPER_SEEDS = 4
export { COLOR_STYLES, DEFAULT_STYLE }

// Default: wallpaper on (Auto), colour from the wallpaper (solid and the brand seed when the picture fails)
// The frosted layer over the wallpaper: a blur (px) and a tint of the scheme's surface tone (0 to 0.8). The overview is much lighter than the other pages
// so that she shows there; `homeSame` makes the overview use the values of the other pages. Both are stored with the appearance, per interface.
export const FROST_DEFAULTS = Object.freeze({ home: Object.freeze({ blur: 4, dim: 0.12 }), other: Object.freeze({ blur: 32, dim: 0.5 }) })
export const FROST_LIMITS = Object.freeze({ blur: [0, 48], dim: [0, 0.8] })
/** The faces of the dock clock (in the spirit of the Android and iOS lock-screen clocks; MDockClock.vue), its sizes (小 中 大 特大) and where it sits. */
export const CLOCK_FACES = Object.freeze(['default', 'metro', 'calligraphy', 'inflate', 'growth', 'handwritten', 'numoverlap', 'analog', 'minimal', 'flex', 'tall', 'dots', 'outline', 'flip', 'hanzi'])
export const CLOCK_SIZES = Object.freeze(['s', 'm', 'l', 'xl'])
/**
 * The clock sizes a window offers. 特大 stands the date and the status line beside the clock and gives it the header's whole height; in a window narrower than 840 px (compact and medium:
 * a phone, a portrait tablet) there is no room beside it and it comes out no larger than 大, or smaller (28 to 188 px against 65 to 201 for 大), so those windows offer 小 中 大.
 * The saved size is a preference: it is drawn at the largest size the window offers that is not above it, and comes back when the window is wide again.
 */
export const CLOCK_XL_FROM = 840
export const clockSizesOffered = (width) => (width >= CLOCK_XL_FROM ? CLOCK_SIZES : CLOCK_SIZES.filter((s) => s !== 'xl'))
export const effectiveClockSize = (size, width) => { const offered = clockSizesOffered(width); return offered.includes(size) ? size : offered[offered.length - 1] }
/** Motion: follow the system (default), full, or reduced. */
export const MOTIONS = Object.freeze(['system', 'full', 'reduced'])
export const MOTION_RULE = 2 // 2: the default is full motion; 'system' is an opt-in
export const CLOCK_SIZE_RULE = 3 // 3: the default clock is 中 (m) again, now drawn at a middle size; a record of rule 2 that says 特大 only kept the default of that rule (a clock of 特大 chosen before rule 2 has no rule and is kept)
export const CLOCK_ALIGNS = Object.freeze(['left', 'center', 'right'])
export const DEFAULTS = Object.freeze({ cardCorner: 28, textSize: 14, listStyle: 'merged', motion: 'full', clockFace: 'default', clockAlign: 'right', clockSize: 'm', clockSeconds: false, background: 'wallpaper', source: 'auto', url: '', color: 'wallpaper', preset: 'blue', custom: '#4a9eff', mode: 'system', dark: 'tinted', colorStyle: DEFAULT_STYLE, seedIndex: 0, overview: 'grid', smartTiles: true, fade: true, tileDensity: 'standard', heroStyle: 'soft', heroArt: true, homeSame: false, home: FROST_DEFAULTS.home, other: FROST_DEFAULTS.other })

const oneOf = (v, list, d) => (list.includes(v) ? v : d)
const clamp = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : d)
const HEX = /^#[0-9a-f]{6}$/i
/** Only https images (or a data URL of the person's own file) are ever used; anything else is ignored. */
export const safeImageUrl = (u) => (typeof u === 'string' && u.length < 2_500_000 && (/^https:\/\/[^\s"'()]+$/i.test(u) || /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(u)) ? u : '')

// a source that is not offered (a picture this Product did not register) reads as the default; Auto with no pictures to choose from is the gradient
const sourceOf = (v) => { const s = oneOf(v === 'default' ? 'auto' : v, wallpaperSources(), DEFAULTS.source); return s === 'auto' && !autoPictures() ? 'gradient' : s }
export function normalize(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  return {
    background: oneOf(r.background, ['solid', 'wallpaper'], DEFAULTS.background),
    source: sourceOf(r.source),
    url: r.source === 'url' ? safeImageUrl(r.url) : '',
    color: oneOf(r.color, ['wallpaper', 'preset', 'custom'], DEFAULTS.color),
    preset: PRESET_SEEDS.some((p) => p.id === r.preset) ? r.preset : DEFAULTS.preset,
    custom: HEX.test(r.custom) ? r.custom : DEFAULTS.custom,
    mode: oneOf(r.mode, ['system', 'light', 'dark'], DEFAULTS.mode),
    // 动画: full motion (the default: a machine that turns system animations off, a virtual machine or a remote session, must not silence the panel), reduced, or follow the system.
    // A record written before this rule (no motionRule) that says 'system' only kept the old default, so it reads as full; from rule 2 on 'system' is a choice made on purpose.
    motion: r.motion === 'system' && r.motionRule !== MOTION_RULE ? DEFAULTS.motion : oneOf(r.motion, MOTIONS, DEFAULTS.motion),
    motionRule: MOTION_RULE,
    clockFace: oneOf(r.clockFace, CLOCK_FACES, DEFAULTS.clockFace), // the face of the dock clock
    clockAlign: oneOf(r.clockAlign, CLOCK_ALIGNS, DEFAULTS.clockAlign), // left, centre or right (the default)
    clockSize: r.clockSize === 'xl' && r.clockSizeRule === 2 ? DEFAULTS.clockSize : oneOf(r.clockSize, CLOCK_SIZES, DEFAULTS.clockSize), // 小 中 (the default) 大 特大; rule 2 made 特大 the default, so its 特大 reads as 中
    clockSizeRule: CLOCK_SIZE_RULE,
    clockSeconds: r.clockSeconds === true, // seconds on the clock: off by default
    overview: oneOf(r.overview, ['grid', 'dock'], DEFAULTS.overview), // the layout of the overview: the full-screen tiles (default) or the clock mode: a clock above, every tile in one row at the bottom
    smartTiles: r.smartTiles !== false, // independent of the layout: the tiles follow what the host is doing (homeSmart.js). On by default, also for everyone who had the smart grid or the dock; off: the person's own tiles, sizes and order
    colorStyle: oneOf(r.colorStyle, COLOR_STYLES, DEFAULTS.colorStyle), // 配色风格: 清亮 (default), 经典, 素雅
    seedIndex: Math.round(clamp(r.seedIndex, 0, WALLPAPER_SEEDS - 1, 0)), // which of the wallpaper's seeds the colours grow from
    dark: oneOf(r.dark, ['tinted', 'black'], DEFAULTS.dark), // the dark scheme: tinted surfaces from the seed (Material You, the default) or true black
    tileDensity: oneOf(r.tileDensity, ['smaller', 'standard', 'larger'], DEFAULTS.tileDensity),
    heroStyle: oneOf(r.heroStyle, ['soft', 'solid'], DEFAULTS.heroStyle), // 本主机: 柔和 (tonal, the action labelled; default) or 实色 (the solid primary hero)
    heroArt: r.heroArt !== false, // while streaming the 本主机 tile takes its colours from the game's cover (default on)
    fade: r.fade !== false, // the tint rises towards the bottom into a pale tone of the scheme
    homeSame: r.homeSame === true,
    home: frostOf(r.home, FROST_DEFAULTS.home),
    other: frostOf(r.other, FROST_DEFAULTS.other),
    // 界面: the corner of the cards (0–32 px; 28 is the Material extra-large corner) and the body text size (12–18 px; 14 is the scale as designed).
    // They come from the old desktop's theme editor (--fd-card-radius, --fd-font-size) and change nothing while they stay at their defaults.
    cardCorner: Math.round(clamp(r.cardCorner, ...LOOK_LIMITS.cardCorner, DEFAULTS.cardCorner)),
    textSize: Math.round(clamp(r.textSize, ...LOOK_LIMITS.textSize, DEFAULTS.textSize)),
    // the list pane: joined to the title bar and the rail ('merged') or one surface with the detail ('one'); anything else, an old 'step' too, is the default
    listStyle: oneOf(r.listStyle, LIST_STYLES, DEFAULTS.listStyle),
  }
}
export const LOOK_LIMITS = Object.freeze({ cardCorner: [0, 32], textSize: [12, 18] })
/** The old desktop's theme record (localStorage foundation-desktop-theme); its corner and text size are carried over while the new record has none. */
export const LEGACY_DESKTOP_THEME_KEY = 'foundation-desktop-theme'
export function legacyDesktopLook(raw) {
  const vars = raw && typeof raw === 'object' && raw.vars && typeof raw.vars === 'object' ? raw.vars : null
  if (!vars) return {}
  const px = (v) => (typeof v === 'string' && /^\d+(\.\d+)?px$/.test(v.trim()) ? Number.parseFloat(v) : NaN)
  const out = {}
  if (Number.isFinite(px(vars['--fd-card-radius']))) out.cardCorner = px(vars['--fd-card-radius'])
  if (Number.isFinite(px(vars['--fd-font-size']))) out.textSize = px(vars['--fd-font-size'])
  return out
}
function frostOf(raw, d) {
  const r = raw && typeof raw === 'object' ? raw : {}
  return { blur: Math.round(clamp(r.blur, ...FROST_LIMITS.blur, d.blur)), dim: Math.round(clamp(r.dim, ...FROST_LIMITS.dim, d.dim) * 100) / 100 }
}
/** The frost of a scope: 'home' (the overview) or 'other' (every other page). */
export const frostFor = (s, scope) => (scope === 'home' && !s.homeSame ? s.home : s.other)

/** The picture to show: null for a solid background. `file` is the person's stored data URL. */
export function imageSource(s, file = '') {
  if (s.background !== 'wallpaper') return null
  if (s.source === 'auto') return autoPictures() ? 'auto' : 'gradient'
  if (s.source === 'gradient') return 'gradient'
  if (WALLPAPERS[s.source]) return WALLPAPERS[s.source].url
  if (s.source === 'file') return safeImageUrl(file) || null
  return s.url || null
}

/** The seed the theme grows from: one of the picture's (when it was read; `imageSeed` is one hex or the list of them), a preset, the custom colour, else the brand seed. */
export function seedFor(s, imageSeed = null) {
  const list = Array.isArray(imageSeed) ? imageSeed.filter(Boolean) : imageSeed ? [imageSeed] : []
  if (s.color === 'wallpaper' && s.background === 'wallpaper' && list.length) { const hex = list[Math.min(s.seedIndex || 0, list.length - 1)]; return { light: hex, dark: hex } }
  if (s.color === 'preset') { const hex = PRESET_SEEDS.find((p) => p.id === s.preset).hex; return { light: hex, dark: hex } }
  if (s.color === 'custom') return { light: s.custom, dark: s.custom }
  return { light: BRAND_SEEDS.light, dark: BRAND_SEEDS.dark }
}

// ---- contrast and the scrim ----
export const contrastRatio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
const mix = (top, bot, a) => ({ r: top.r * a + bot.r * (1 - a), g: top.g * a + bot.g * (1 - a), b: top.b * a + bot.b * (1 - a) })
export const hexRgb = (h) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) })

const greyOf = (l) => { const v = l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055; const c = Math.round(v * 255); return { r: c, g: c, b: c } }

/**
 * The scrim (surface colour laid over the picture) that keeps text at `minRatio` (6: the quieter text colours, the rail and caption labels are about a quarter dimmer than on-surface and still hold 4.5): the text of the page that is not in a card, and the
 * text in a card (a card is `cardAlpha` opaque over the scrim). The worst pixel is the one nearest the text colour's luminance:
 * the brightest 2 % for light text, the darkest 2 % for dark text. Returns { alpha, ratio, card }. `dim` is the person's minimum.
 */
export function scrimFor({ stats: raw, surface, onSurface, card = surface, cardAlpha = 0.96, region = 0.3, dim = 0, minRatio = 6, blur = 0 }) {
  // a blurred picture has no extremes: its darkest and brightest are pulled towards its mean (a blur of 24 px or more keeps a fifth of them, 8 px or more a third)
  const k = blur >= 24 ? 0.2 : blur >= 8 ? 0.33 : 0.5
  const stats = { ...raw, lo: raw.mean + (raw.lo - raw.mean) * k, hi: raw.mean + (raw.hi - raw.mean) * k }
  const textLum = luminance(onSurface)
  const worst = greyOf(textLum > luminance(surface) ? stats.lo : stats.hi) // light text on a dark scheme: the darkest pixel is the best case; the worst case is the one closest to the text colour
  const adverse = textLum > luminance(surface) ? greyOf(stats.hi) : greyOf(stats.lo)
  void worst
  // the page's own text sits on the window's material: the tint, then the region's tone over it
  const ratioAt = (a) => { const bg = mix(surface, adverse, 1 - (1 - a) * (1 - region)); const onCard = mix(card, bg, cardAlpha); return { page: contrastRatio(onSurface, bg), card: contrastRatio(onSurface, onCard) } }
  let alpha = dim
  for (; alpha < 1; alpha += 0.01) { const r = ratioAt(alpha); if (r.page >= minRatio && r.card >= minRatio) break }
  alpha = Math.min(1, Math.round(alpha * 100) / 100)
  const r = ratioAt(alpha)
  return { alpha, ratio: Math.round(r.page * 100) / 100, card: Math.round(r.card * 100) / 100 }
}

/** The scrim of both schemes for a seed and picture stats: { light, dark }. */
export function scrimsFor(seeds, stats, dim, blur = 0, { black = false, style = DEFAULT_STYLE } = {}) {
  const out = {}
  for (const mode of ['light', 'dark']) {
    const c = realSchemeColors(seeds[mode], { dark: mode === 'dark', variant: mode === 'light' ? 'vibrant' : 'tonalSpot', black, style })
    const pageSolid = hexRgb(mode === 'dark' ? c.surface : c.surfaceContainer)
    out[mode] = scrimFor({ stats, surface: pageSolid, onSurface: hexRgb(c.onSurface), card: hexRgb(mode === 'dark' ? c.surfaceContainerHigh : c.surfaceBright), dim, blur })
  }
  return out
}
