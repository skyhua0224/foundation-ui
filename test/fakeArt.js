// Stand-in art for the tests: the library ships no picture, so a test that needs a mascot or wallpapers registers these (the names and sizes of the real ones,
// the addresses fake). A test that needs the library as shipped calls `clearArt()`.
import { registerMascot } from '../src/about/mascot.js'
import { registerWallpapers, clearWallpapers } from '../src/appearance/wallpaper.js'

const by = (sizes, f) => Object.fromEntries(sizes.map((n) => [n, f(n)]))
export const FAKE_ART = {
  logo: by([24, 32, 48, 64, 96, 128, 192], (n) => `fake:logo-${n}`),
  avatar: by([256, 384, 512, 768, 1024], (n) => `fake:avatar-${n}`),
  clip: by([24, 32, 48, 64, 96, 128, 256, 512], (n) => `fake:clip-${n}`),
  loading: 'fake:loading', bg: 'fake:bg',
  buttons: { close: 'fake:close', maximize: 'fake:maximize', minimize: 'fake:minimize', restore: 'fake:restore' },
}
export const FAKE_WALLPAPERS = [
  { id: 'vivi1', url: 'fake:wallpaper-1', w: 1491, h: 1055, focus: { x: 0.60, y: 0.50 }, labelKey: 'srcVivi1' },
  { id: 'vivi2', url: 'fake:wallpaper-2', w: 1672, h: 941, focus: { x: 0.63, y: 0.52 }, labelKey: 'srcVivi2' },
]
export function registerFakeArt() {
  registerMascot(FAKE_ART)
  registerWallpapers(FAKE_WALLPAPERS, { auto: { narrow: 'vivi1', wide: 'vivi2', colour: 'vivi2' } })
}
export function clearArt() { registerMascot(null); clearWallpapers() }
