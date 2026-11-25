import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULTS, normalize, imageSource, seedFor, safeImageUrl, contrastRatio, imageStats, scrimFor, scrimsFor, frostFor, FROST_DEFAULTS, DEFAULT_WALLPAPER } from '../src/appearance/appearance.js'
import { registerFakeArt } from './fakeArt.js'
registerFakeArt()

const flat = (grey, n = 64) => { const a = new Uint8ClampedArray(n * n * 4); for (let i = 0; i < n * n; i++) { a[i * 4] = a[i * 4 + 1] = a[i * 4 + 2] = grey; a[i * 4 + 3] = 255 } return { a, n } }
const noisy = (n = 64) => { const a = new Uint8ClampedArray(n * n * 4); for (let i = 0; i < n * n; i++) { const g = (i * 7919) % 2 ? 250 : 5; a[i * 4] = a[i * 4 + 1] = a[i * 4 + 2] = g; a[i * 4 + 3] = 255 } return { a, n } }

test('defaults: wallpaper on, default picture, colour from the wallpaper', () => {
  assert.equal(DEFAULTS.background, 'wallpaper'); assert.equal(imageSource(normalize(null)), DEFAULT_WALLPAPER); assert.equal(normalize(null).color, 'wallpaper')
})
test('normalize drops bad values and unsafe urls', () => {
  const s = normalize({ background: 'x', source: 'url', url: 'http://evil/x.png', other: { dim: 9, blur: -4 }, home: { blur: 99, dim: 'x' }, custom: 'red', mode: 'dark', preset: 'nope' })
  assert.equal(s.background, 'wallpaper'); assert.equal(s.url, ''); assert.deepEqual(s.other, { blur: 0, dim: 0.8 }); assert.deepEqual(s.home, { blur: 48, dim: 0.12 }); assert.equal(s.custom, '#4a9eff'); assert.equal(s.mode, 'dark'); assert.equal(s.preset, 'blue')
  assert.equal(safeImageUrl('javascript:alert(1)'), ''); assert.equal(safeImageUrl('https://a.b/c.webp'), 'https://a.b/c.webp'); assert.equal(safeImageUrl('https://a.b/c"onload=x'), '')
  assert.equal(safeImageUrl('data:image/png;base64,iVBOR'), 'data:image/png;base64,iVBOR'); assert.equal(safeImageUrl('data:text/html;base64,AAAA'), '')
})
test('the frost: the other pages are stronger than the overview, both stored, the overview may follow the others, the fade is on', () => {
  const d = normalize(null)
  assert.deepEqual(d.other, { blur: 32, dim: 0.5 }); assert.deepEqual(d.home, { blur: 4, dim: 0.12 }); assert.equal(d.homeSame, false); assert.equal(d.fade, true)
  assert.ok(d.other.blur > d.home.blur && d.other.dim > d.home.dim)
  assert.equal(frostFor(d, 'home'), d.home); assert.equal(frostFor(d, 'other'), d.other); assert.equal(frostFor(d, 'whatever'), d.other)
  const same = normalize({ homeSame: true }); assert.equal(frostFor(same, 'home'), same.other)
  assert.equal(normalize({ fade: false }).fade, false)
  // what is stored round-trips
  assert.deepEqual(normalize(JSON.parse(JSON.stringify({ ...d, other: { blur: 20, dim: 0.4 } }))).other, { blur: 20, dim: 0.4 })
  // the old single blur and dim are gone: an older stored state gets the defaults
  assert.deepEqual(normalize({ blur: 0, dim: 0.35 }).other, FROST_DEFAULTS.other)
})
test('solid has no picture; a url source needs a valid url; file uses the stored data', () => {
  assert.equal(imageSource(normalize({ background: 'solid' })), null)
  assert.equal(imageSource(normalize({ source: 'url', url: 'https://x.y/z.jpg' })), 'https://x.y/z.jpg')
  assert.equal(imageSource(normalize({ source: 'url', url: 'nope' })), null)
  assert.equal(imageSource(normalize({ source: 'file' }), 'data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA')
})
test('seed: wallpaper colour when read, brand fallback when not, presets and custom', () => {
  assert.equal(seedFor(normalize({}), '#112233').light, '#112233')
  assert.equal(seedFor(normalize({}), null).light, '#4a9eff')
  assert.equal(seedFor(normalize({ color: 'preset', preset: 'green' })).light, '#3fae7a')
  assert.equal(seedFor(normalize({ color: 'custom', custom: '#abcdef' })).dark, '#abcdef')
  assert.equal(seedFor(normalize({ background: 'solid', color: 'wallpaper' }), '#112233').light, '#4a9eff')
})
test('scrim keeps 4.5:1 for page text and card text on any picture, light and dark schemes', () => {
  const cases = [flat(0), flat(255), flat(128), noisy()]
  for (const c of cases) {
    const st = imageStats(c.a, c.n, c.n)
    for (const seed of ['#4a9eff', '#d4a5a5', '#3fae7a']) {
      const sc = scrimsFor({ light: seed, dark: seed }, st, 0.2)
      for (const m of ['light', 'dark']) { assert.ok(sc[m].ratio >= 4.5, `${seed} ${m} page ${sc[m].ratio}`); assert.ok(sc[m].card >= 4.5, `${seed} ${m} card ${sc[m].card}`); assert.ok(sc[m].alpha >= 0.2 && sc[m].alpha <= 1) }
    }
  }
})
test('bright pictures get a stronger scrim than calm dark ones where the text needs it; the tint of the person is a floor', () => {
  const calm = scrimsFor({ light: '#4a9eff', dark: '#4a9eff' }, imageStats(flat(40).a, 64, 64), 0.1)
  const bright = scrimsFor({ light: '#4a9eff', dark: '#4a9eff' }, imageStats(flat(250).a, 64, 64), 0.1)
  const busy = scrimsFor({ light: '#4a9eff', dark: '#4a9eff' }, imageStats(noisy().a, 64, 64), 0.1)
  assert.ok(bright.dark.alpha >= calm.dark.alpha); assert.ok(calm.light.alpha >= bright.light.alpha); assert.ok(busy.dark.alpha >= 0.1 && busy.light.alpha >= 0.1)
  assert.ok(scrimsFor({ light: '#4a9eff', dark: '#4a9eff' }, imageStats(flat(40).a, 64, 64), 0.7).dark.alpha >= 0.7)
  assert.ok(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }) > 20)
})

test('the default wallpaper is a gradient of the theme tones, not a picture from anywhere', async () => {
  const { DEFAULT_GRADIENT, DEFAULT_WALLPAPER_STATS } = await import('../src/appearance/appearance.js')
  assert.ok(!/^https?:/.test(DEFAULT_WALLPAPER))
  assert.match(DEFAULT_GRADIENT, /^radial-gradient\(.*var\(--md-sys-color-primary-container\)/)
  assert.equal(DEFAULT_WALLPAPER_STATS.busy, 0)
  const src = (await import('node:fs')).readFileSync(new URL('../src/appearance/appearance.js', import.meta.url), 'utf8')
  assert.ok(!/alkaidlab\.com|\.webp/.test(src))
})

test('the dark scheme has two variants stored with the appearance: tinted (Material You, the default) and true black', async () => {
  const { normalize, DEFAULTS } = await import('../src/appearance/appearance.js')
  assert.equal(DEFAULTS.dark, 'tinted')
  assert.equal(normalize(null).dark, 'tinted')
  assert.equal(normalize({ dark: 'black' }).dark, 'black')
  assert.equal(normalize({ dark: 'purple' }).dark, 'tinted')
})

test('tinted dark follows the Material 3 neutral tones of the seed hue: a blue seed gives the blue-grey of #111418, not a near black', async () => {
  const { schemeColors, BLACK_SURFACES } = await import('../src/tokens/theme.js')
  const blue = schemeColors('#4a9eff', { dark: true })
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const [r, g, b] = rgb(blue.surface)
  assert.ok(Math.abs(r - 0x11) <= 3 && Math.abs(g - 0x14) <= 6 && Math.abs(b - 0x18) <= 6, blue.surface) // N6, the reference app's #111418
  assert.ok(b - r >= 6, 'the tint is visible: blue above red')
  // the container tones rise N4 < N10 < N12 < N17 < N22
  const lum = (hex) => rgb(hex).reduce((a, v) => a + v, 0)
  const order = ['surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer', 'surfaceContainerHigh', 'surfaceContainerHighest']
  for (let i = 1; i < order.length; i++) assert.ok(lum(blue[order[i]]) > lum(blue[order[i - 1]]), order[i])
  assert.ok(lum(blue.surfaceContainerLowest) < lum(blue.surface))
  // another seed tints another way
  assert.notEqual(schemeColors('#3fae7a', { dark: true }).surface, blue.surface)
  // the light scheme is not touched by the dark variants
  assert.deepEqual(schemeColors('#4a9eff', { dark: false, variant: 'vibrant' }), schemeColors('#4a9eff', { dark: false, variant: 'vibrant', black: true }))
  assert.equal(BLACK_SURFACES.surface, '#000000')
})

test('true black keeps the accent roles of the seed and only swaps the surfaces', async () => {
  const { schemeColors, colorCss } = await import('../src/tokens/theme.js')
  const tinted = schemeColors('#4a9eff', { dark: true })
  const black = schemeColors('#4a9eff', { dark: true, black: true })
  for (const role of ['surface', 'background', 'surfaceContainerLowest']) assert.equal(black[role], '#000000', role)
  for (const role of ['primary', 'onPrimary', 'secondaryContainer', 'tertiary', 'error', 'outline']) assert.equal(black[role], tinted[role], role)
  assert.notEqual(black.surfaceContainerHigh, black.surface) // cards still separate from the page
  assert.match(colorCss('#4a9eff', { dark: true, black: true }), /--md-sys-color-surface: #000000;/)
})

test('the overview layout is stored with the appearance: the smart grid by default, the dock (a clock above, one row of tiles below) by choice', () => {
  assert.equal(DEFAULTS.overview, 'grid')
  assert.equal(normalize(null).overview, 'grid')
  assert.equal(normalize({ overview: 'dock' }).overview, 'dock')
  assert.equal(normalize({ overview: 'rows' }).overview, 'grid')
})
