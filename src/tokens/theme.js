/**
 * Dynamic colour from one seed, using Google's material-color-utilities (HCT).
 * The brand colours of the product are the default seeds: the light theme grows from
 * the blue, the dark theme from the rose. A wallpaper can replace the seed at run time.
 */
import { chartColors } from './chartColors.js'
import { FILL_ROLES, SURFACE_ROLES, MUDDY, hctOf, isMuddyFill } from './muddy.js'
import {
  Hct, MaterialDynamicColors, SchemeTonalSpot, SchemeExpressive, SchemeVibrant, SchemeNeutral, SchemeFidelity,
  Blend, TonalPalette, argbFromHex, hexFromArgb, sourceColorFromImage,
} from '@material/material-color-utilities'

export const BRAND_SEEDS = Object.freeze({ light: '#4a9eff', dark: '#d4a5a5' })
/** Light keeps the vivid blue of the brand (vibrant); dark keeps the muted rose (tonal spot). */
export const DEFAULT_VARIANTS = Object.freeze({ light: 'vibrant', dark: 'tonalSpot' })
const SCHEMES = { tonalSpot: SchemeTonalSpot, expressive: SchemeExpressive, vibrant: SchemeVibrant, neutral: SchemeNeutral, fidelity: SchemeFidelity }

const ROLES = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'primaryDim', 'inversePrimary',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer', 'secondaryDim',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer', 'tertiaryDim',
  'primaryFixed', 'primaryFixedDim', 'onPrimaryFixed', 'onPrimaryFixedVariant',
  'secondaryFixed', 'secondaryFixedDim', 'onSecondaryFixed', 'onSecondaryFixedVariant',
  'tertiaryFixed', 'tertiaryFixedDim', 'onTertiaryFixed', 'onTertiaryFixedVariant',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
  'background', 'onBackground', 'surface', 'onSurface', 'surfaceVariant', 'onSurfaceVariant',
  'surfaceDim', 'surfaceBright', 'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer',
  'surfaceContainerHigh', 'surfaceContainerHighest', 'surfaceTint',
  'outline', 'outlineVariant', 'shadow', 'scrim', 'inverseSurface', 'inverseOnSurface',
]

const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())

/**
 * The surfaces of the dark scheme in true black (OLED): the page and the lowest container are #000, the containers above it step up in neutral greys so cards
 * still separate from the page. Every accent role (primary, secondary, tertiary, their containers, outline, error) stays the scheme's own.
 */
export const BLACK_SURFACES = Object.freeze({
  background: '#000000', surface: '#000000', surfaceDim: '#000000', surfaceContainerLowest: '#000000', surfaceContainerLow: '#0b0b0b', surfaceContainer: '#131313',
  surfaceContainerHigh: '#1b1b1b', surfaceContainerHighest: '#242424', surfaceBright: '#2a2a2a', surfaceVariant: '#1f1f1f', inverseSurface: '#e6e6e6', scrim: '#000000',
})

/**
 * The dark surfaces exactly as Material 3 (Material You) tones them from the seed's hue: the neutral palette (chroma 6) gives surface N6, the containers
 * lowest, low, container, high, highest N4, N10, N12, N17, N22, bright N24, on-surface N90; the neutral variant palette (chroma 8) gives the variant,
 * on-surface-variant NV80, outline NV60 and outline-variant NV30. A blue seed gives the blue-grey of #111418 that Android apps have, not a near black.
 */
export function tintedDarkSurfaces(scheme) {
  const n = TonalPalette.fromHueAndChroma(scheme.neutralPalette.hue, 6)
  const nv = TonalPalette.fromHueAndChroma(scheme.neutralVariantPalette.hue, 8)
  const hex = (palette, tone) => hexFromArgb(palette.tone(tone))
  return {
    background: hex(n, 6), surface: hex(n, 6), surfaceDim: hex(n, 6), surfaceBright: hex(n, 24),
    surfaceContainerLowest: hex(n, 4), surfaceContainerLow: hex(n, 10), surfaceContainer: hex(n, 12), surfaceContainerHigh: hex(n, 17), surfaceContainerHighest: hex(n, 22),
    onSurface: hex(n, 90), onBackground: hex(n, 90), inverseSurface: hex(n, 90), inverseOnSurface: hex(n, 20),
    surfaceVariant: hex(nv, 30), onSurfaceVariant: hex(nv, 80), outline: hex(nv, 60), outlineVariant: hex(nv, 30),
  }
}

/**
 * Yellow, orange and gold seeds. A Material scheme puts its fills at tone 40 (light) or 30 (dark), and there is no dark saturated yellow: that tone of an orange, amber, yellow or yellow-green hue is
 * brown or olive (the primary button, the hero card and the dark primary container of a yellow wallpaper were brown), and the 2025 spec multiplies the chroma of the light surfaces for yellow hues
 * (Hct.isYellow), which on a whole page is a heavy beige. Two corrections, taken from what the sources do about the same two problems:
 *  - Fills: material-color-utilities' own DislikeAnalyzer (dislike/dislike_analyzer.ts: hue 90 to 111, chroma over 16, tone under 65, "universal distaste for dark yellow-greens") answers it by lifting
 *    the colour to tone 70 and keeping hue and chroma. The same lift is applied to every fill role that lies in the wider band of muddy.js (hue 35 to 125, chroma 20 or more, tone 20 to 58: brown is dark
 *    orange, olive is dark yellow-green), to the lightest tone that keeps the Material contrast rules: 3 : 1 against the surface (non-text) and 4.5 : 1 for the role's label, which turns dark
 *    (tone 10 of the same hue; a mid tone of yellow cannot carry white text). The chroma is the most the gamut gives at that tone, so the result is gold or amber, not khaki.
 *  - Surfaces: Android's Shades.java (frameworks/base/packages/SystemUI/monet, "Use chroma max of 40 at tone 90", 2021) caps the chroma of the light tones because "blue and yellow hues can reach a much
 *    higher chroma at tone 90 and above"; the light surfaces of the warm hues are brought to at most chroma 8 here (Material's neutral palettes are chroma 4 to 10), fading in and out at the edges of the band.
 */
const PAIRS = [['primary', 'onPrimary'], ['primaryContainer', 'onPrimaryContainer'], ['secondary', 'onSecondary'], ['secondaryContainer', 'onSecondaryContainer'], ['tertiary', 'onTertiary'], ['tertiaryContainer', 'onTertiaryContainer']]
const SURFACE_CHROMA_CAP = 8
const warmWeight = (hue) => { const t = (x) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k) }; return Math.min(t((hue - 45) / 20), t((140 - hue) / 20)) }
const lumOf = (argb) => { const f = [(argb >> 16) & 255, (argb >> 8) & 255, argb & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2] }
const contrastOf = (a, b) => { const [x, y] = [lumOf(a), lumOf(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
// (the safety net of the styles: a fill that is still brown or olive after a style's own roles is lifted, a warm light surface is capped)
export function warmGuard(roles, { dark = false } = {}) {
  const out = { ...roles }
  const surface = argbFromHex(out.surface)
  for (const [fill, on] of PAIRS) {
    if (!out[fill] || !FILL_ROLES.includes(fill)) continue
    const h = hctOf(out[fill])
    if (!isMuddyFill(h)) continue
    const ink = Hct.from(h.hue, 20, 10).toInt()
    let tone = dark ? 60 : 62
    let colour = Hct.from(h.hue, 100, tone).toInt()
    while (tone > 46 && contrastOf(colour, surface) < 3.05) { tone -= 1; colour = Hct.from(h.hue, 100, tone).toInt() }
    out[fill] = hexFromArgb(colour)
    out[on] = hexFromArgb(ink)
    if (fill === 'primary') {
      out.surfaceTint = out.primary
      if (out.primaryDim) out.primaryDim = hexFromArgb(Hct.from(h.hue, 100, Math.max(40, tone - 8)).toInt())
    }
  }
  if (dark && out.primary) {
    // the dark primary of a warm hue is tone 80 at the palette's chroma 36, which the gamut shortens to about 26: a pastel tan, the "beige" of the sheet. Brought to chroma 48 it is a soft yellow or amber.
    const h = hctOf(out.primary), w = warmWeight(h.hue)
    if (w > 0 && h.tone > 70 && h.chroma < 48) { out.primary = hexFromArgb(Hct.from(h.hue, h.chroma * (1 - w) + 48 * w, h.tone).toInt()); out.surfaceTint = out.primary }
  }
  if (!dark) {
    for (const role of SURFACE_ROLES) {
      if (!out[role]) continue
      const h = hctOf(out[role])
      const w = warmWeight(h.hue)
      if (w > 0 && h.chroma > SURFACE_CHROMA_CAP) out[role] = hexFromArgb(Hct.from(h.hue, h.chroma * (1 - w) + SURFACE_CHROMA_CAP * w, h.tone).toInt())
    }
  }
  return out
}

/** Colour roles of one scheme as { roleName: '#rrggbb' }. `black` (dark only) swaps the surfaces for true black; the default dark keeps the tinted ones (Material You: N6 and the neutral tones of the seed's hue). */
function libraryColors(seedHex, { dark = false, variant = 'tonalSpot', contrast = 0, spec = '2025', black = false } = {}) {
  const Scheme = SCHEMES[variant]
  if (!Scheme) throw new Error(`unknown scheme variant ${variant}`)
  const scheme = new Scheme(Hct.fromInt(argbFromHex(seedHex)), dark, contrast, spec)
  const colors = new MaterialDynamicColors()
  const out = {}
  for (const role of ROLES) {
    const color = colors[role]?.()
    if (color) out[role] = hexFromArgb(color.getArgb(scheme))
  }
  if (dark) Object.assign(out, tintedDarkSurfaces(scheme))
  if (dark && black) Object.assign(out, BLACK_SURFACES)
  return out
}

// ---- Colour styles (配色风格): three ways to grow a scheme from the same seed, as Android offers several colour styles for the same wallpaper. Each is defined for every hue.
//   bright   清亮 (the default): pale containers for the big surfaces and the hero card with dark text; the accent keeps the seed's hue, and for a warm seed (the band of muddy.js: orange, yellow, yellow-green)
//            it is a clean amber (a yellow seed's hue turned about 22 degrees towards orange, tone 58 with a dark label: gold is not mustard), the light surfaces near neutral.
//   classic  经典: the scheme of the library (the tonal spot of Material You), as the product had it.
//   quiet    素雅: near-neutral surfaces and a near-neutral hero card, the colour only in small accents (the filled button, the rail pill, chips) in a bright tone; the track of a toggle or slider is a darker tone
//            of the accent so that it keeps 3 : 1 against the surface.
// Tokens besides the Material roles: heroSurface / onHeroSurface (the big filled card of the overview: the primary in classic, a pale or near-neutral tone in the others) and track / onTrack (the on state of a
// switch, the active part of a slider).
export const COLOR_STYLES = Object.freeze(['bright', 'classic', 'quiet'])
export const DEFAULT_STYLE = 'bright'
const H = (h, c, t) => hexFromArgb(Hct.from(h, c, t).toInt())
// The hue of a hex is the forward conversion (sRGB to CAM16, `Hct.fromInt`): cheap, and the same hex comes back scheme after scheme of the same seed, so it is kept. It is NOT the cost the CPU profile
// shows as `hueOf` on the first mount of the log page (9-17 ms of self time): that is HctSolver.hueOf, the inverse solve of `Hct.from(h, c, t)` that Material's dynamic colours run for every role of a
// scheme (DynamicColor.getTone). It is paid once per scheme, by the idle preparation of the next themes (apply.js, warmNextThemes), not by the page; that preparation now waits for a quiet window.
const hueMemo = new Map()
const hueOfHex = (hex) => { let hue = hueMemo.get(hex); if (hue === undefined) { hue = Hct.fromInt(argbFromHex(hex)).hue; if (hueMemo.size >= 512) hueMemo.delete(hueMemo.keys().next().value); hueMemo.set(hex, hue) } return hue }
const smooth = (x) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k) }
/** 1 for a yellow hue (75 to 115), fading to 0 at 60 and 130. */
const yellowWeight = (hue) => Math.min(smooth((hue - 60) / 15), smooth((130 - hue) / 15))
const NEUTRAL_LIGHT = Object.freeze({ surface: 98, background: 98, surfaceBright: 98, surfaceDim: 87, surfaceContainerLowest: 100, surfaceContainerLow: 96, surfaceContainer: 94, surfaceContainerHigh: 92, surfaceContainerHighest: 90, surfaceVariant: 90 })
const NEUTRAL_DARK = Object.freeze({ surface: 6, background: 6, surfaceDim: 6, surfaceBright: 24, surfaceContainerLowest: 4, surfaceContainerLow: 10, surfaceContainer: 12, surfaceContainerHigh: 17, surfaceContainerHighest: 22 })
const neutralSurfaces = (hue, chroma, tones) => Object.fromEntries(Object.entries(tones).map(([role, tone]) => [role, H(hue, chroma, tone)]))
const best = (fill, hue) => { const f = argbFromHex(fill); const dark = Hct.from(hue, 20, 8).toInt(), light = Hct.from(hue, 6, 100).toInt(); return contrastOf(f, dark) >= contrastOf(f, light) ? hexFromArgb(dark) : hexFromArgb(light) }
function fixPairs(o) { for (const [fill, on] of PAIRS) if (o[fill] && o[on] && contrastOf(argbFromHex(o[fill]), argbFromHex(o[on])) < 4.5) o[on] = best(o[fill], hueOfHex(o[fill])) }

function styledColors(lib, seedHex, { dark, black, style }) {
  const hue = Hct.fromInt(argbFromHex(seedHex)).hue
  const warm = hue >= MUDDY.hue[0] && hue <= MUDDY.hue[1]
  const o = { ...lib }
  if (style === 'bright') {
    const hp = Math.max(62, hue - 22 * yellowWeight(hue)) // the accent's hue: a yellow seed is turned towards orange
    if (warm) { o.primary = dark ? H(hp, 80, 76) : H(hp, 95, 58); o.onPrimary = H(hp, 20, dark ? 12 : 8) }
    const sec = hueOfHex(lib.secondary), ter = hueOfHex(lib.tertiary)
    if (!dark) {
      Object.assign(o, { primaryContainer: H(hue, 44, 91), onPrimaryContainer: H(hue, 20, 10), secondaryContainer: H(sec, 30, 90), onSecondaryContainer: H(sec, 24, 12), tertiaryContainer: H(ter, 32, 90), onTertiaryContainer: H(ter, 24, 12) })
      if (warm) Object.assign(o, neutralSurfaces(hue, 5, NEUTRAL_LIGHT))
    } else if (warm) {
      // a dark container is dark: at chroma 18 it is a warm grey, not a brown block
      Object.assign(o, { primaryContainer: H(hp, 18, 30), onPrimaryContainer: H(hp, 16, 92), secondaryContainer: H(sec, 16, 30), onSecondaryContainer: H(sec, 14, 90), tertiaryContainer: H(ter, 18, 30), onTertiaryContainer: H(ter, 16, 92) })
      if (!black) Object.assign(o, neutralSurfaces(hue, 3, NEUTRAL_DARK))
    }
    o.heroSurface = dark ? H(hue, 36, 84) : H(hue, 44, 91); o.onHeroSurface = H(hue, 20, 10)
    o.track = o.primary; o.onTrack = o.onPrimary
  } else if (style === 'quiet') {
    const hp = Math.max(62, hue - 14 * yellowWeight(hue))
    Object.assign(o, neutralSurfaces(hue, dark ? 2.5 : 3, dark ? (black ? {} : NEUTRAL_DARK) : NEUTRAL_LIGHT))
    o.primary = dark ? H(hp, 95, 80) : H(hp, 100, 72); o.onPrimary = H(hp, 20, 8)
    if (!dark) Object.assign(o, { primaryContainer: H(hp + 4, 70, 90), onPrimaryContainer: H(hp, 24, 10), secondaryContainer: H(hp + 2, 75, 86), onSecondaryContainer: H(hp, 24, 10), tertiaryContainer: H(hp + 4, 70, 90), onTertiaryContainer: H(hp, 24, 10) })
    else Object.assign(o, { primaryContainer: H(hp, 18, 30), onPrimaryContainer: H(hp, 16, 92), secondaryContainer: H(hp, 70, 62), onSecondaryContainer: H(hp, 24, 8), tertiaryContainer: H(hp, 18, 30), onTertiaryContainer: H(hp, 16, 92) })
    o.heroSurface = dark ? H(hue, 3, 20) : H(hue, 4, 90); o.onHeroSurface = dark ? H(hue, 4, 92) : H(hue, 6, 10)
    if (dark) { o.track = o.primary; o.onTrack = o.onPrimary } else {
      // the bright accent is 1.9 : 1 against the surface: the track is the darkest of the accent that keeps 3 : 1
      const surface = argbFromHex(o.surface)
      let tone = 62
      while (tone > 40 && contrastOf(Hct.from(hp, 100, tone).toInt(), surface) < 3.05) tone -= 1
      o.track = H(hp, 100, tone); o.onTrack = best(o.track, hp)
    }
  }
  fixPairs(o)
  o.surfaceTint = o.primary
  return warmGuard(o, { dark })
}

// The accent as the colour of WORDS (text buttons, links, section titles). The primary, secondary and tertiary roles are fills first: their tone is chosen to carry a label (on-primary), not to be
// read as text on a surface; a pale or golden accent is 1.7 : 1 on a light card. So each has a text role (primaryText, secondaryText, tertiaryText): the same hue and chroma, the nearest tone to
// the fill (darker on a light scheme, lighter on a dark one) at which it is 4.5 : 1 on every surface text sits on. A fill that already reaches it is its own text role: nothing moves.
const TEXT_SURFACES = ['surface', 'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer', 'surfaceContainerHigh', 'surfaceContainerHighest', 'surfaceVariant']
export function textColour(fillHex, surfaceHexes, { dark = false, min = 4.55 } = {}) {
  const surfaces = surfaceHexes.filter(Boolean).map(argbFromHex)
  const worst = (argb) => Math.min(...surfaces.map((x) => contrastOf(argb, x)))
  const fill = argbFromHex(fillHex)
  if (!surfaces.length || worst(fill) >= min) return fillHex
  const hct = Hct.fromInt(fill)
  for (let tone = Math.round(hct.tone); dark ? tone <= 100 : tone >= 0; tone += dark ? 1 : -1) {
    const c = Hct.from(hct.hue, hct.chroma, tone).toInt()
    if (worst(c) >= min) return hexFromArgb(c)
  }
  return hexFromArgb(Hct.from(hct.hue, hct.chroma, dark ? 100 : 0).toInt())
}
// The secondary text colour of the surfaces (on-surface-variant: captions, units, labels, the small words of a tile) sits on every surface of the scheme, the dim and the bright ones included. Material's
// tone (NV30 / NV80) is 4.5 : 1 on the surface and falls under it on the darker ones, so it is moved along its own hue and chroma until it is SECONDARY_MIN : 1 on every one of them (the margin is for
// the word drawn at 12 px, which is thinner than the type the rule is measured with). The accent containers carry their own on-container text and are not in the list.
const SECONDARY_SURFACES = [...TEXT_SURFACES, 'surfaceDim', 'surfaceBright']
export const SECONDARY_MIN = 4.9
const withTextRoles = (o, dark) => {
  const surfaces = TEXT_SURFACES.map((k) => o[k])
  if (o.onSurfaceVariant) o.onSurfaceVariant = textColour(o.onSurfaceVariant, SECONDARY_SURFACES.map((k) => o[k]), { dark, min: SECONDARY_MIN })
  for (const [fill, text] of [['primary', 'primaryText'], ['secondary', 'secondaryText'], ['tertiary', 'tertiaryText']]) if (o[fill]) o[text] = textColour(o[fill], surfaces, { dark })
  return o
}

/** Colour roles of one scheme as { roleName: '#rrggbb' }, in a colour style (see above). `black` (dark only) swaps the surfaces for true black; the default dark keeps the tinted ones (Material You: N6 and the neutral tones of the seed's hue). */
export function schemeColors(seedHex, { dark = false, variant = 'tonalSpot', contrast = 0, spec = '2025', black = false, style = DEFAULT_STYLE } = {}) {
  if (!COLOR_STYLES.includes(style)) throw new Error(`unknown colour style ${style}`)
  const lib = libraryColors(seedHex, { dark, variant, contrast, spec, black })
  if (style === 'classic') return withTextRoles({ ...lib, heroSurface: lib.primary, onHeroSurface: lib.onPrimary, track: lib.primary, onTrack: lib.onPrimary }, dark)
  return withTextRoles(styledColors(lib, seedHex, { dark, black, style }), dark)
}

/**
 * Status colours that are not part of the scheme (success, warning), harmonised towards the
 * seed so that they sit in the same theme, as the Material colour guidance recommends.
 */
export function statusColors(seedHex, { dark = false } = {}) {
  const seed = argbFromHex(seedHex)
  const make = (hex) => {
    const harmonised = Blend.harmonize(argbFromHex(hex), seed)
    const hue = Hct.fromInt(harmonised).hue
    const p = TonalPalette.fromInt(harmonised)
    // Containers use a calmer chroma than the accent so a status never shouts louder than the theme.
    const calm = TonalPalette.fromHueAndChroma(hue, 28)
    return dark
      ? { c: p.tone(80), on: p.tone(20), container: calm.tone(30), onContainer: calm.tone(90) }
      : { c: p.tone(40), on: p.tone(100), container: calm.tone(90), onContainer: calm.tone(10) }
  }
  const hex = (n) => hexFromArgb(n)
  const result = {}
  for (const [name, base] of [['success', '#2e9e6b'], ['warning', '#d99a00']]) {
    const t = make(base)
    result[name] = hex(t.c)
    result[`on${name[0].toUpperCase()}${name.slice(1)}`] = hex(t.on)
    result[`${name}Container`] = hex(t.container)
    result[`on${name[0].toUpperCase()}${name.slice(1)}Container`] = hex(t.onContainer)
  }
  return result
}

/** CSS custom properties, --md-sys-color-<role> (the names @material/web reads). */
export function colorCss(seedHex, options = {}) {
  const roles = { ...schemeColors(seedHex, options), ...statusColors(seedHex, options), ...Object.fromEntries(chartColors(seedHex, options).map((hex, i) => [`chart${i + 1}`, hex])) }
  return Object.entries(roles).map(([role, hex]) => `  --md-sys-color-${kebab(role)}: ${hex};`).join('\n')
}

// The colour science behind one scheme (about 40 ms the first time, tone searches for 400 roles) is deterministic: the same inputs give the same sheet.
// Going between light and dark, back to a colour that was used, or to one that was prepared at idle (warmTheme) costs nothing.
const sheetMemo = new Map()
function sheetFor(seed, options) {
  const key = JSON.stringify([seed, options])
  let css = sheetMemo.get(key)
  if (css === undefined) {
    css = colorCss(seed, options)
    if (sheetMemo.size >= 48) sheetMemo.delete(sheetMemo.keys().next().value)
    sheetMemo.set(key, css)
  }
  return css
}
const sheetOptions = ({ light = BRAND_SEEDS.light, dark = BRAND_SEEDS.dark, variants = DEFAULT_VARIANTS, contrast = 0, black = false, style = DEFAULT_STYLE } = {}) => ({
  light: [light, { dark: false, variant: variants.light, contrast, style }],
  dark: [dark, { dark: true, variant: variants.dark, contrast, black, style }],
})

/** Works out the two sheets of a theme ahead (at idle), so that applying it later has nothing left to compute. */
export function warmTheme(theme, which = 'both') {
  const { light, dark } = sheetOptions(theme)
  if (which !== 'dark') sheetFor(...light)
  if (which !== 'light') sheetFor(...dark)
}

/** Apply a theme to an element at run time: both schemes, selected by the data-bs-theme attribute. */
export function applyTheme(target, { light = BRAND_SEEDS.light, dark = BRAND_SEEDS.dark, variants = DEFAULT_VARIANTS, contrast = 0, black = false, style = DEFAULT_STYLE } = {}) {
  const id = 'foundation-ui-theme'
  let sheet = target.ownerDocument.getElementById(id)
  if (!sheet) {
    sheet = target.ownerDocument.createElement('style')
    sheet.id = id
    target.ownerDocument.head.appendChild(sheet)
  }
  const sheets = sheetOptions({ light, dark, variants, contrast, black, style })
  const text = `:root, [data-bs-theme='light'], [data-theme='light'] {\n${sheetFor(...sheets.light)}\n}\n` +
    `[data-bs-theme='dark'], [data-theme='dark'] {\n${sheetFor(...sheets.dark)}\n}\n`
  if (sheet.textContent !== text) sheet.textContent = text
}

/** Seed colour of an image (Material You "dynamic colour from wallpaper"). */
export async function seedFromImage(image) {
  return hexFromArgb(await sourceColorFromImage(image))
}
